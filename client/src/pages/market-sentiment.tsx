import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { Stock } from "@shared/schema";

interface SentimentData {
  sentiment: string;
  score: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalStocks: number;
  avgRsi: number;
  avgMfi: number;
  advanceDecline: { advances: number; declines: number; unchanged: number };
  sectorBreakdown: {
    sector: string;
    sentiment: string;
    bullishPct: number;
    bearishPct: number;
    avgChange: number;
    stockCount: number;
  }[];
}

function computeSentiment(stocks: Stock[]): SentimentData {
  if (stocks.length === 0) {
    return {
      sentiment: "neutral", score: 50, bullishCount: 0, bearishCount: 0, neutralCount: 0,
      totalStocks: 0, avgRsi: 50, avgMfi: 50,
      advanceDecline: { advances: 0, declines: 0, unchanged: 0 },
      sectorBreakdown: [],
    };
  }

  let bullish = 0, bearish = 0, neutral = 0;
  let totalRsi = 0, totalMfi = 0;
  let advances = 0, declines = 0, unchanged = 0;

  for (const s of stocks) {
    totalRsi += s.rsi14;
    totalMfi += (s.mfi14 ?? 50);
    if (s.changePct > 0.5) advances++;
    else if (s.changePct < -0.5) declines++;
    else unchanged++;
    if (s.signal === "strong_buy" || s.signal === "buy") bullish++;
    else if (s.signal === "strong_sell" || s.signal === "sell") bearish++;
    else neutral++;
  }

  const n = stocks.length;
  const avgRsi = totalRsi / n;
  const avgMfi = totalMfi / n;
  const bullPct = (bullish / n) * 100;
  const adRatio = advances / Math.max(declines, 1);
  const score = Math.round(avgRsi * 0.25 + avgMfi * 0.25 + Math.min(adRatio * 25, 50) * 0.25 + bullPct * 0.25);
  const sentiment = score >= 60 ? "bullish" : score <= 40 ? "bearish" : "neutral";

  // Sector breakdown
  const sectorMap = new Map<string, { bullish: number; bearish: number; neutral: number; total: number; avgChange: number }>();
  for (const s of stocks) {
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

  return {
    sentiment, score, bullishCount: bullish, bearishCount: bearish, neutralCount: neutral,
    totalStocks: n, avgRsi: Math.round(avgRsi * 10) / 10, avgMfi: Math.round(avgMfi * 10) / 10,
    advanceDecline: { advances, declines, unchanged },
    sectorBreakdown,
  };
}

export default function MarketSentiment() {
  const { data: stocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  const data = useMemo(() => computeSentiment(stocks || []), [stocks]);

  if (isLoading || !stocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Brain className="w-8 h-8 mx-auto mb-3 text-purple-400 animate-pulse" />
        <p className="text-sm text-muted-foreground">Analyzing market sentiment...</p>
      </Card>
    );
  }

  if (stocks.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Brain className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No stock data available yet.</p>
      </Card>
    );
  }

  const gaugeRotation = -90 + (data.score / 100) * 180;
  const sentimentColor = data.sentiment === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : data.sentiment === "bearish" ? "text-red-500" : "text-yellow-600 dark:text-yellow-400";

  return (
    <div className="space-y-4">
      {/* Gauge Card */}
      <Card className="p-6 border-card-border">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold">Market Sentiment</h2>
            <Badge variant="outline" className="text-xs">{data.totalStocks} stocks</Badge>
          </div>

          {/* Semicircle Gauge */}
          <div className="relative w-48 h-28 mx-auto mb-2">
            {/* Background arc */}
            <div
              className="absolute inset-0 rounded-t-full overflow-hidden"
              style={{
                background: `conic-gradient(from -90deg at 50% 100%, #ef4444 0deg, #eab308 90deg, #22c55e 180deg, transparent 180deg)`,
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
              }}
            />
            {/* Inner white circle */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-[72px] bg-background rounded-t-full" />
            {/* Needle */}
            <div
              className="absolute bottom-0 left-1/2 origin-bottom h-20 w-0.5 bg-foreground rounded-full transition-transform duration-700"
              style={{ transform: `translateX(-50%) rotate(${gaugeRotation}deg)` }}
            />
            {/* Center score */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
              <div className={`text-3xl font-bold ${sentimentColor}`}>{data.score}</div>
              <div className="text-[10px] text-muted-foreground">/ 100</div>
            </div>
          </div>

          <div className={`text-lg font-semibold capitalize ${sentimentColor}`}>{data.sentiment}</div>
          <div className="flex justify-center gap-8 mt-1 text-[10px] text-muted-foreground">
            <span className="text-red-500">Bearish</span>
            <span className="text-yellow-600">Neutral</span>
            <span className="text-emerald-600">Bullish</span>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-card-border">
          <p className="text-xs text-muted-foreground mb-1">Advance / Decline</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-600">{data.advanceDecline.advances}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-xl font-bold text-red-500">{data.advanceDecline.declines}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Ratio: {(data.advanceDecline.advances / Math.max(data.advanceDecline.declines, 1)).toFixed(2)} · Unchanged: {data.advanceDecline.unchanged}
          </p>
        </Card>
        <Card className="p-3 border-card-border">
          <p className="text-xs text-muted-foreground mb-1">Avg RSI</p>
          <p className="text-xl font-bold">{data.avgRsi}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.avgRsi > 60 ? "Overbought zone" : data.avgRsi < 40 ? "Oversold zone" : "Neutral range"}
          </p>
        </Card>
        <Card className="p-3 border-card-border">
          <p className="text-xs text-muted-foreground mb-1">Avg MFI</p>
          <p className="text-xl font-bold">{data.avgMfi}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.avgMfi > 60 ? "Buying pressure" : data.avgMfi < 40 ? "Selling pressure" : "Neutral flow"}
          </p>
        </Card>
        <Card className="p-3 border-card-border">
          <p className="text-xs text-muted-foreground mb-1">Signal Breakdown</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-emerald-600">↑ {data.bullishCount}</span>
            <span className="text-sm font-bold">{data.neutralCount}</span>
            <span className="text-sm font-bold text-red-500">↓ {data.bearishCount}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Bullish · Neutral · Bearish</p>
        </Card>
      </div>

      {/* Sector Sentiment Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sector Sentiment</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.sectorBreakdown.map(sector => {
            const sColor = sector.sentiment === "bullish" ? "border-l-emerald-500"
              : sector.sentiment === "bearish" ? "border-l-red-500" : "border-l-yellow-500";
            const bgColor = sector.avgChange > 0 ? "bg-emerald-500/5" : sector.avgChange < 0 ? "bg-red-500/5" : "";

            return (
              <Card key={sector.sector} className={`p-3 border-card-border border-l-4 ${sColor} ${bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{sector.sector}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      sector.sentiment === "bullish" ? "text-emerald-600 border-emerald-500/30"
                      : sector.sentiment === "bearish" ? "text-red-500 border-red-500/30"
                      : "text-yellow-600 border-yellow-500/30"
                    }`}
                  >
                    {sector.sentiment}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Avg Change</span>
                    <div className={`font-semibold ${sector.avgChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bullish %</span>
                    <div className="font-semibold">{sector.bullishPct}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stocks</span>
                    <div className="font-semibold">{sector.stockCount}</div>
                  </div>
                </div>
                {/* Mini bar */}
                <div className="flex h-1.5 rounded-full mt-2 overflow-hidden bg-muted">
                  <div className="bg-emerald-500 rounded-l-full" style={{ width: `${sector.bullishPct}%` }} />
                  <div className="bg-red-500 rounded-r-full" style={{ width: `${sector.bearishPct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
