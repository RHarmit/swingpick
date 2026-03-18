import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAllStocks, getStockBySymbol, getHistoricalData, getSectors, getLoadingStatus, getSectorPerformance, getTopStocks } from "./yahooData";
import type { ScreenerParams } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Get all stocks with optional screening
  app.get("/api/stocks", async (req, res) => {
    try {
      let stocks = await getAllStocks();
      const params: ScreenerParams = {
        rsiMin: req.query.rsiMin ? Number(req.query.rsiMin) : undefined,
        rsiMax: req.query.rsiMax ? Number(req.query.rsiMax) : undefined,
        macdCross: req.query.macdCross as any,
        aboveSma20: req.query.aboveSma20 === "true" ? true : undefined,
        aboveSma50: req.query.aboveSma50 === "true" ? true : undefined,
        aboveSma200: req.query.aboveSma200 === "true" ? true : undefined,
        volumeMultiple: req.query.volumeMultiple ? Number(req.query.volumeMultiple) : undefined,
        adxMin: req.query.adxMin ? Number(req.query.adxMin) : undefined,
        sectors: req.query.sectors ? (req.query.sectors as string).split(",") : undefined,
        minSwingScore: req.query.minSwingScore ? Number(req.query.minSwingScore) : undefined,
        minCombinedScore: req.query.minCombinedScore ? Number(req.query.minCombinedScore) : undefined,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
      };

      // Apply filters
      if (params.rsiMin !== undefined) stocks = stocks.filter(s => s.rsi14 >= params.rsiMin!);
      if (params.rsiMax !== undefined) stocks = stocks.filter(s => s.rsi14 <= params.rsiMax!);

      if (params.macdCross === "bullish") stocks = stocks.filter(s => s.macdHistogram > 0);
      if (params.macdCross === "bearish") stocks = stocks.filter(s => s.macdHistogram < 0);

      if (params.aboveSma20) stocks = stocks.filter(s => s.price > s.sma20);
      if (params.aboveSma50) stocks = stocks.filter(s => s.price > s.sma50);
      if (params.aboveSma200) stocks = stocks.filter(s => s.price > s.sma200);

      if (params.volumeMultiple) stocks = stocks.filter(s => s.volume / s.avgVolume >= params.volumeMultiple!);

      if (params.adxMin) stocks = stocks.filter(s => s.adx14 >= params.adxMin!);

      if (params.sectors && params.sectors.length > 0) {
        stocks = stocks.filter(s => params.sectors!.includes(s.sector));
      }

      if (params.minSwingScore) stocks = stocks.filter(s => s.swingScore >= params.minSwingScore!);
      if (params.minCombinedScore) stocks = stocks.filter(s => s.combinedScore >= params.minCombinedScore!);

      if (params.priceMin) stocks = stocks.filter(s => s.price >= params.priceMin!);
      if (params.priceMax) stocks = stocks.filter(s => s.price <= params.priceMax!);

      // MFI / Buying pressure filters
      if (req.query.minMfi) stocks = stocks.filter(s => s.mfi14 >= Number(req.query.minMfi));
      if (req.query.maxMfi) stocks = stocks.filter(s => s.mfi14 <= Number(req.query.maxMfi));
      if (req.query.buyingPressure && req.query.buyingPressure !== "any") {
        stocks = stocks.filter(s => s.buyingPressure === req.query.buyingPressure);
      }

      // Sort
      const sortBy = params.sortBy || "combinedScore";
      const sortOrder = params.sortOrder || "desc";
      stocks.sort((a, b) => {
        const aVal = (a as any)[sortBy] ?? 0;
        const bVal = (b as any)[sortBy] ?? 0;
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      });

      res.json(stocks);
    } catch (err) {
      console.error("Error fetching stocks:", err);
      res.status(500).json({ error: "Failed to fetch stock data. Please try again." });
    }
  });

  // Get single stock detail
  app.get("/api/stocks/:symbol", async (req, res) => {
    try {
      const stock = await getStockBySymbol(req.params.symbol);
      if (!stock) return res.status(404).json({ error: "Stock not found" });
      res.json(stock);
    } catch (err) {
      console.error("Error fetching stock:", err);
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // Get historical data for charts
  app.get("/api/stocks/:symbol/history", async (req, res) => {
    try {
      const days = Number(req.query.days) || 90;
      const data = await getHistoricalData(req.params.symbol, days);
      if (data.length === 0) return res.status(404).json({ error: "Stock not found" });
      res.json(data);
    } catch (err) {
      console.error("Error fetching history:", err);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  // Get available sectors
  app.get("/api/sectors", async (_req, res) => {
    try {
      res.json(await getSectors());
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sectors" });
    }
  });

  // Sector performance (2-day)
  app.get("/api/sector-performance", async (_req, res) => {
    try {
      res.json(await getSectorPerformance());
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sector performance" });
    }
  });

  // Top stocks by combined score
  app.get("/api/top-stocks", async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 10;
      res.json(await getTopStocks(limit));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch top stocks" });
    }
  });

  // Momentum stocks - top sell candidates (lowest combined scores from NSE momentum universe)
  app.get("/api/momentum-sells", async (_req, res) => {
    try {
      const allStocks = await getAllStocks();
      // Return bottom 3 by combined score (best sell candidates)
      const sorted = [...allStocks].sort((a, b) => a.combinedScore - b.combinedScore);
      const top3Sells = sorted.slice(0, 3);
      res.json(top3Sells);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch momentum sells" });
    }
  });

  // Loading status endpoint
  app.get("/api/status", async (_req, res) => {
    try {
      res.json(await getLoadingStatus());
    } catch (err) {
      res.status(500).json({ loaded: 0, total: 0, loading: false });
    }
  });

  return httpServer;
}
