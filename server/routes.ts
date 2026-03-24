import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAllStocks, getStockBySymbol, getHistoricalData, getSectors, getLoadingStatus, getSectorPerformance, getTopStocks, forceRefresh } from "./yahooData";
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
      res.status(500).json({ loaded: 0, total: 0, loading: false, retrying: false, retryCount: 0 });
    }
  });

  // Wake/refresh endpoint — forces a re-fetch of all stock data
  // Called when frontend detects 0 stocks, or by keep-alive pings
  app.get("/api/wake", async (_req, res) => {
    try {
      const status = await getLoadingStatus();
      if (status.loaded === 0 && !status.loading) {
        console.log("[Yahoo] Wake request received — forcing data refresh");
        forceRefresh();
        res.json({ status: "refreshing", message: "Data refresh triggered" });
      } else if (status.loading) {
        res.json({ status: "loading", message: `Already loading... ${status.loaded}/${status.total}` });
      } else {
        res.json({ status: "ok", message: `${status.loaded} stocks loaded`, loaded: status.loaded });
      }
    } catch (err) {
      res.status(500).json({ status: "error", message: "Failed to trigger wake" });
    }
  });

  // Force a full data refresh (regardless of current state)
  app.get("/api/force-refresh", async (_req, res) => {
    try {
      console.log("[Yahoo] Force refresh requested — fetching latest data from Yahoo Finance");
      forceRefresh();
      res.json({ status: "refreshing", message: "Full data refresh triggered. New data will be available in 2-5 minutes." });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Failed to trigger refresh" });
    }
  });

  // Hedge fund top 5 picks — stocks under Rs 600 with weighted scoring
  app.get("/api/hedge-picks", async (req, res) => {
    try {
      const allStocks = await getAllStocks();
      // Filter stocks under Rs 600
      const affordable = allStocks.filter(s => s.price <= 600 && s.price > 0);
      // Hedge fund scoring: weight technical 40%, fundamental 30%, sentiment 30%
      const scored = affordable.map(s => ({
        ...s,
        hedgeScore: (s.swingScore * 0.4) + (s.fundamentalScore * 0.3) + (s.sentimentScore * 0.3),
      }));
      // Sort by hedge score, take top 5
      scored.sort((a, b) => b.hedgeScore - a.hedgeScore);
      res.json(scored.slice(0, 5));
    } catch (err) {
      console.error("Error fetching hedge picks:", err);
      res.status(500).json({ error: "Failed to fetch hedge picks" });
    }
  });

  // Overall market sentiment computed from all stocks
  app.get("/api/market-sentiment", async (req, res) => {
    try {
      const allStocks = await getAllStocks();
      if (allStocks.length === 0) {
        return res.json({ sentiment: "neutral", score: 50, bullishCount: 0, bearishCount: 0, neutralCount: 0, totalStocks: 0, sectorBreakdown: [], advanceDecline: { advances: 0, declines: 0, unchanged: 0 } });
      }

      let bullish = 0, bearish = 0, neutral = 0;
      let totalRsi = 0, totalMfi = 0;
      let advances = 0, declines = 0, unchanged = 0;

      for (const s of allStocks) {
        totalRsi += s.rsi14;
        totalMfi += (s.mfi14 ?? 50);

        if (s.changePct > 0.5) advances++;
        else if (s.changePct < -0.5) declines++;
        else unchanged++;

        if (s.signal === "strong_buy" || s.signal === "buy") bullish++;
        else if (s.signal === "strong_sell" || s.signal === "sell") bearish++;
        else neutral++;
      }

      const n = allStocks.length;
      const avgRsi = totalRsi / n;
      const avgMfi = totalMfi / n;
      const bullPct = (bullish / n) * 100;
      const bearPct = (bearish / n) * 100;

      const adRatio = advances / Math.max(declines, 1);
      const sentimentScore = Math.round(
        (avgRsi * 0.25) + (avgMfi * 0.25) + (Math.min(adRatio * 25, 50) * 0.25) + (bullPct * 0.25)
      );

      const sentiment = sentimentScore >= 60 ? "bullish" : sentimentScore <= 40 ? "bearish" : "neutral";

      const sectorMap = new Map<string, { bullish: number; bearish: number; neutral: number; total: number; avgChange: number }>();
      for (const s of allStocks) {
        const entry = sectorMap.get(s.sector) || { bullish: 0, bearish: 0, neutral: 0, total: 0, avgChange: 0 };
        entry.total++;
        entry.avgChange += s.changePct;
        if (s.signal === "strong_buy" || s.signal === "buy") entry.bullish++;
        else if (s.signal === "strong_sell" || s.signal === "sell") entry.bearish++;
        else entry.neutral++;
        sectorMap.set(s.sector, entry);
      }

      const sectorBreakdown = Array.from(sectorMap.entries()).map(([sector, data]) => ({
        sector,
        sentiment: data.bullish > data.bearish ? "bullish" : data.bearish > data.bullish ? "bearish" : "neutral",
        bullishPct: Math.round((data.bullish / data.total) * 100),
        bearishPct: Math.round((data.bearish / data.total) * 100),
        avgChange: Math.round((data.avgChange / data.total) * 100) / 100,
        stockCount: data.total,
      })).sort((a, b) => b.avgChange - a.avgChange);

      res.json({
        sentiment,
        score: sentimentScore,
        bullishCount: bullish,
        bearishCount: bearish,
        neutralCount: neutral,
        totalStocks: n,
        avgRsi: Math.round(avgRsi * 10) / 10,
        avgMfi: Math.round(avgMfi * 10) / 10,
        advanceDecline: { advances, declines, unchanged },
        sectorBreakdown,
      });
    } catch (err) {
      console.error("Error computing market sentiment:", err);
      res.status(500).json({ error: "Failed to compute market sentiment" });
    }
  });

  // Market news/alerts computed from stock data
  app.get("/api/market-news", async (req, res) => {
    try {
      const allStocks = await getAllStocks();
      if (allStocks.length === 0) return res.json([]);

      const sectorMoves = new Map<string, { totalChange: number; count: number; topMover: string; topChange: number }>();
      for (const s of allStocks) {
        const entry = sectorMoves.get(s.sector) || { totalChange: 0, count: 0, topMover: "", topChange: 0 };
        entry.totalChange += s.changePct;
        entry.count++;
        if (Math.abs(s.changePct) > Math.abs(entry.topChange)) {
          entry.topMover = s.symbol;
          entry.topChange = s.changePct;
        }
        sectorMoves.set(s.sector, entry);
      }

      const alerts: any[] = [];

      const sectors = Array.from(sectorMoves.entries()).map(([sector, data]) => ({
        sector,
        avgChange: data.totalChange / data.count,
        topMover: data.topMover,
        topChange: data.topChange,
        stockCount: data.count,
      }));
      sectors.sort((a, b) => b.avgChange - a.avgChange);

      if (sectors.length > 0 && sectors[0].avgChange > 0.5) {
        alerts.push({
          type: "sector_bullish",
          sector: sectors[0].sector,
          title: `${sectors[0].sector} sector leading gains`,
          description: `${sectors[0].sector} stocks up ${sectors[0].avgChange.toFixed(2)}% on average. ${sectors[0].topMover} leads with +${sectors[0].topChange.toFixed(2)}%`,
          impact: "positive",
          timestamp: new Date().toISOString(),
        });
      }

      const lastSector = sectors[sectors.length - 1];
      if (lastSector && lastSector.avgChange < -0.5) {
        alerts.push({
          type: "sector_bearish",
          sector: lastSector.sector,
          title: `${lastSector.sector} sector under pressure`,
          description: `${lastSector.sector} stocks down ${Math.abs(lastSector.avgChange).toFixed(2)}% on average. ${lastSector.topMover} drops ${lastSector.topChange.toFixed(2)}%`,
          impact: "negative",
          timestamp: new Date().toISOString(),
        });
      }

      const highVolume = allStocks.filter(s => s.volume > s.avgVolume * 3 && s.avgVolume > 0)
        .sort((a, b) => (b.volume / b.avgVolume) - (a.volume / a.avgVolume))
        .slice(0, 3);
      for (const s of highVolume) {
        const volMultiple = (s.volume / s.avgVolume).toFixed(1);
        alerts.push({
          type: "volume_spike",
          sector: s.sector,
          title: `${s.symbol}: Volume spike ${volMultiple}x average`,
          description: `${s.symbol} (${s.sector}) trading at ${volMultiple}x normal volume. Price ${s.changePct >= 0 ? "up" : "down"} ${Math.abs(s.changePct).toFixed(2)}%. Signal: ${s.signal?.replace("_", " ")}`,
          impact: s.changePct >= 0 ? "positive" : "negative",
          timestamp: new Date().toISOString(),
          stock: s.symbol,
        });
      }

      const overbought = allStocks.filter(s => s.rsi14 >= 75).sort((a, b) => b.rsi14 - a.rsi14).slice(0, 2);
      for (const s of overbought) {
        alerts.push({
          type: "overbought",
          sector: s.sector,
          title: `${s.symbol}: RSI overbought at ${s.rsi14.toFixed(0)}`,
          description: `${s.symbol} (${s.sector}) RSI at ${s.rsi14.toFixed(1)} — may be overextended. Price: ₹${s.price.toFixed(2)}`,
          impact: "warning",
          timestamp: new Date().toISOString(),
          stock: s.symbol,
        });
      }

      const oversold = allStocks.filter(s => s.rsi14 <= 25).sort((a, b) => a.rsi14 - b.rsi14).slice(0, 2);
      for (const s of oversold) {
        alerts.push({
          type: "oversold",
          sector: s.sector,
          title: `${s.symbol}: RSI oversold at ${s.rsi14.toFixed(0)}`,
          description: `${s.symbol} (${s.sector}) RSI at ${s.rsi14.toFixed(1)} — potential bounce candidate. Price: ₹${s.price.toFixed(2)}`,
          impact: "opportunity",
          timestamp: new Date().toISOString(),
          stock: s.symbol,
        });
      }

      const sorted = [...allStocks].sort((a, b) => b.changePct - a.changePct);
      if (sorted[0] && sorted[0].changePct > 3) {
        alerts.push({
          type: "top_gainer",
          sector: sorted[0].sector,
          title: `${sorted[0].symbol}: Top gainer +${sorted[0].changePct.toFixed(2)}%`,
          description: `${sorted[0].symbol} (${sorted[0].sector}) surging +${sorted[0].changePct.toFixed(2)}%. Combined score: ${sorted[0].combinedScore.toFixed(0)}`,
          impact: "positive",
          timestamp: new Date().toISOString(),
          stock: sorted[0].symbol,
        });
      }
      const last = sorted[sorted.length - 1];
      if (last && last.changePct < -3) {
        alerts.push({
          type: "top_loser",
          sector: last.sector,
          title: `${last.symbol}: Top loser ${last.changePct.toFixed(2)}%`,
          description: `${last.symbol} (${last.sector}) falling ${last.changePct.toFixed(2)}%. Combined score: ${last.combinedScore.toFixed(0)}`,
          impact: "negative",
          timestamp: new Date().toISOString(),
          stock: last.symbol,
        });
      }

      res.json(alerts);
    } catch (err) {
      console.error("Error fetching market news:", err);
      res.status(500).json({ error: "Failed to fetch market news" });
    }
  });

  // Breakout Radar — stocks most likely to move 5-10% in next 2 days
  app.get("/api/breakout-radar", async (req, res) => {
    try {
      const allStocks = await getAllStocks();
      if (allStocks.length === 0) return res.json([]);

      // Score each stock for 2-day breakout potential
      const scored = allStocks.filter(s => s.price > 0 && s.avgVolume > 0).map(s => {
        // 1. Volume Surge (25%) — unusual volume = institutional interest
        const volRatio = Math.min(s.volume / Math.max(s.avgVolume, 1), 15);
        const volumeScore = volRatio >= 3 ? 100 : volRatio >= 2 ? 80 : volRatio >= 1.5 ? 60 : volRatio * 33;

        // 2. Bollinger Squeeze + Breakout (20%) — tight bands about to explode
        const bbWidth = s.bollingerUpper > 0 && s.bollingerLower > 0
          ? (s.bollingerUpper - s.bollingerLower) / s.bollingerMiddle * 100
          : 5;
        const nearUpper = s.bollingerUpper > 0 ? (s.price / s.bollingerUpper) : 0.5;
        const bollingerScore = bbWidth < 3 ? 90 : bbWidth < 5 ? 70 : bbWidth < 8 ? 50 : 30;
        const breakoutBonus = nearUpper >= 0.98 ? 30 : nearUpper >= 0.95 ? 15 : 0;

        // 3. ADX + Momentum Direction (15%) — strong trending stocks
        const adxScore = s.adx14 >= 30 ? 90 : s.adx14 >= 25 ? 70 : s.adx14 >= 20 ? 50 : s.adx14 * 2.5;

        // 4. RSI Momentum (10%) — not overbought but showing strength
        const rsiScore = s.rsi14 >= 55 && s.rsi14 <= 75 ? 90 :
          s.rsi14 >= 45 && s.rsi14 < 55 ? 60 :
          s.rsi14 < 30 ? 80 : // oversold bounce
          s.rsi14 > 75 ? 30 : 40;

        // 5. MACD Acceleration (10%) — positive and increasing histogram
        const macdScore = s.macdHistogram > 0 && s.macdLine > s.macdSignal ? 90 :
          s.macdHistogram > 0 ? 70 :
          s.macdHistogram > -0.5 ? 40 : 20;

        // 6. Price vs SMAs (10%) — above 20 & 50 SMA = bullish structure
        const smaScore = (s.price > s.sma20 ? 35 : 0) + (s.price > s.sma50 ? 35 : 0) + (s.price > s.sma200 ? 30 : 0);

        // 7. MFI Buying Pressure (10%) — smart money flowing in
        const mfi = s.mfi14 ?? 50;
        const mfiScore = mfi >= 70 ? 90 : mfi >= 55 ? 70 : mfi >= 40 ? 50 : 30;

        // Composite breakout score
        const breakoutScore = Math.round(
          volumeScore * 0.25 +
          (bollingerScore + breakoutBonus) * 0.20 +
          adxScore * 0.15 +
          rsiScore * 0.10 +
          macdScore * 0.10 +
          smaScore * 0.10 +
          mfiScore * 0.10
        );

        // Estimated move range using ATR
        const atrPct = s.atr14 / s.price * 100;
        const estMoveLow = Math.round(atrPct * 1.2 * 10) / 10;
        const estMoveHigh = Math.round(atrPct * 2.5 * 10) / 10;

        // Direction bias
        const bullSignals = (s.macdHistogram > 0 ? 1 : 0) + (s.price > s.sma20 ? 1 : 0) +
          (s.price > s.sma50 ? 1 : 0) + (s.rsi14 > 50 ? 1 : 0) + (mfi > 50 ? 1 : 0);
        const direction = bullSignals >= 4 ? "bullish" : bullSignals <= 1 ? "bearish" : "either";

        // Confidence (number of aligned signals)
        const alignedSignals = [
          volRatio >= 1.5,
          s.adx14 >= 20,
          s.macdHistogram > 0,
          s.price > s.sma20,
          mfi >= 55,
          s.rsi14 >= 45 && s.rsi14 <= 75,
          bbWidth < 8,
        ].filter(Boolean).length;
        const confidence = alignedSignals >= 6 ? "high" : alignedSignals >= 4 ? "medium" : "low";

        // Catalysts
        const catalysts: string[] = [];
        if (volRatio >= 2) catalysts.push(`Volume ${volRatio.toFixed(1)}x avg`);
        if (bbWidth < 4) catalysts.push("Bollinger Squeeze");
        if (nearUpper >= 0.98) catalysts.push("BB Upper Breakout");
        if (s.adx14 >= 25) catalysts.push(`Strong Trend (ADX ${s.adx14.toFixed(0)})`);
        if (s.macdHistogram > 0 && s.macdLine > s.macdSignal) catalysts.push("MACD Bullish Cross");
        if (s.rsi14 < 30) catalysts.push("RSI Oversold Bounce");
        if (mfi >= 70) catalysts.push("High Buying Pressure");
        if (s.change2d > 2) catalysts.push(`2-Day Momentum +${s.change2d.toFixed(1)}%`);
        if (s.patterns.length > 0) catalysts.push(...s.patterns.slice(0, 2));

        return {
          ...s,
          breakoutScore,
          estMoveLow,
          estMoveHigh,
          direction,
          confidence,
          catalysts,
          volRatio: Math.round(volRatio * 10) / 10,
          bbWidth: Math.round(bbWidth * 10) / 10,
        };
      });

      // Sort by breakout score, take top 10
      scored.sort((a, b) => b.breakoutScore - a.breakoutScore);
      const limit = Number(req.query.limit) || 10;
      res.json(scored.slice(0, limit));
    } catch (err) {
      console.error("Error fetching breakout radar:", err);
      res.status(500).json({ error: "Failed to fetch breakout radar" });
    }
  });

  return httpServer;
}
// trigger rebuild 1774216471
