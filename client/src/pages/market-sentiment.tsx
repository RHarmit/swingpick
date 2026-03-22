import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Activity, BarChart3 } from "lucide-react";

interface SectorBreakdown {
  sector: string;
  sentiment: "bullish" | "bearish" | "neutral";
  bullishPct: number;
  bearishPct: number;
  avgChange: number;
  stockCount: number;
}

interface MarketSentimentData {
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalStocks: number;
  avgRsi?: number;
  avgMfi?: number;
  advanceDecline: { advances: number; declines: number; unchanged: number };
  sectorBreakdown: SectorBreakdown[];
}

function SentimentGauge({ score, sentiment }: { score: number; sentiment: string }) {
  // Semicircle gauge using CSS conic-gradient
  const clampedScore = Math.max(0, Math.min(100, score));
  const rotation = (clampedScore / 100) * 180; // 0-180 degrees for semicircle
  const gaugeColor = sentiment === "bullish" ? "#22c55e" : sentiment === "bearish" ? "#ef4444" : "#eab308";
  const bgColor = sentiment === "bullish" ? "rgba(34,197,94,0.1)" : sentiment === "bearish" ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)";
  const textColor = sentiment === "bullish" ? "text-emerald-600 dark:text-emerald-400" : sentiment === "bearish" ? "text-red-500" : "text-yellow-600 dark:text-yellow-400";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[200px] h-[110px] overflow-hidden">
        {/* Background semicircle */}
        <div
          className="absolute w-[200px] h-[200px] rounded-full"
          style={{
            background: `conic-gradient(
              from 180deg,
              ${gaugeColor} 0deg,
              ${gaugeColor} ${rotation}deg,
              rgba(128,128,128,0.15) ${rotation}deg,
              rgba(128,128,128,0.15) 180deg,
              transparent 180deg
            )`,
          }}
        />
        {/* Inner circle cutout */}
        <div
          className="absolute top-[20px] left-[20px] w-[160px] h-[160px] rounded-full bg-background"
          style={{ backgroundColor: bgColor }}
        />
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-3xl font-bold tabular-nums ${textColor}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      {/* Sentiment label */}
      <div className={`mt-1 text-sm font-semibold capitalize ${textColor}`}>
        {sentiment}
      </div>
      {/* Scale labels */}
      <div className="flex justify-between w-[200px] mt-1">
        <span className="text-[9px] text-red-500">Bearish</span>
        <span className="text-[9px] text-yellow-600 dark:text-yellow-400">Neutral</span>
        <span className="text-[9px] text-emerald-600 dark:text-emerald-400">Bullish</span>
      </div>
    </div>
  );
}

export default function MarketSentiment() {
  const { data, isLoading } = useQuery<MarketSentimentData>({
    queryKey: ["/api/market-sentiment"],
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Brain className="w-8 h-8 mx-auto mb-3 text-purple-500 animate-pulse" />
        <p className="text-sm text-muted-foreground">Analyzing market sentiment...</p>
      </Card>
    );
  }

  const adTotal = data.advanceDecline.advances + data.advanceDecline.declines + data.advanceDecline.unchanged;
  const adRatio = data.advanceDecline.declines > 0
    ? (data.advanceDecline.advances / data.advanceDecline.declines).toFixed(2)
    : "N/A";

  return (
    <div className="space-y-4">
      {/* Section 1: Sentiment Gauge */}
      <Card className="p-6 border-card-border flex flex-col items-center">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-sm">Market Sentiment</h2>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {data.totalStocks} stocks
          </Badge>
        </div>
        <SentimentGauge score={data.score} sentiment={data.sentiment} />
      </Card>

      {/* Section 2: Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-card-border">
          <div className="text-xs text-muted-foreground mb-1">Advance / Decline</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {data.advanceDecline.advances}
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-lg font-semibold tabular-nums text-red-500">
              {data.advanceDecline.declines}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Ratio: {adRatio} · Unchanged: {data.advanceDecline.unchanged}
          </div>
        </Card>

        <Card className="p-3 border-card-border">
          <div className="text-xs text-muted-foreground mb-1">Avg RSI</div>
          <div className={`text-xl font-semibold tabular-nums ${(data.avgRsi ?? 50) >= 60 ? "text-red-500" : (data.avgRsi ?? 50) <= 40 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
            {data.avgRsi ?? "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {(data.avgRsi ?? 50) >= 60 ? "Overbought zone" : (data.avgRsi ?? 50) <= 40 ? "Oversold zone" : "Neutral range"}
          </div>
        </Card>

        <Card className="p-3 border-card-border">
          <div className="text-xs text-muted-foreground mb-1">Avg MFI</div>
          <div className={`text-xl font-semibold tabular-nums ${(data.avgMfi ?? 50) >= 60 ? "text-emerald-600 dark:text-emerald-400" : (data.avgMfi ?? 50) <= 40 ? "text-red-500" : ""}`}>
            {data.avgMfi ?? "N/A"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {(data.avgMfi ?? 50) >= 60 ? "Buying pressure" : (data.avgMfi ?? 50) <= 40 ? "Selling pressure" : "Neutral flow"}
          </div>
        </Card>

        <Card className="p-3 border-card-border">
          <div className="text-xs text-muted-foreground mb-1">Signal Breakdown</div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUp className="w-3 h-3" />{data.bullishCount}
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{data.neutralCount}</span>
            <span className="text-sm font-semibold tabular-nums text-red-500 flex items-center gap-0.5">
              <ArrowDown className="w-3 h-3" />{data.bearishCount}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Bullish · Neutral · Bearish
          </div>
        </Card>
      </div>

      {/* Section 3: Sector Sentiment Grid */}
      {data.sectorBreakdown.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Sector Sentiment</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.sectorBreakdown.map((sector) => {
              const bgClass = sector.sentiment === "bullish"
                ? "bg-emerald-500/5 border-emerald-500/20"
                : sector.sentiment === "bearish"
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-yellow-500/5 border-yellow-500/20";
              const sentimentColor = sector.sentiment === "bullish"
                ? "text-emerald-600 dark:text-emerald-400"
                : sector.sentiment === "bearish"
                  ? "text-red-500"
                  : "text-yellow-600 dark:text-yellow-400";

              return (
                <Card key={sector.sector} className={`p-3 border ${bgClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{sector.sector}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 capitalize ${sentimentColor}`}>
                      {sector.sentiment}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Avg Change</span>
                      <div className={`font-semibold tabular-nums ${sector.avgChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {sector.avgChange >= 0 ? "+" : ""}{sector.avgChange.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bullish %</span>
                      <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{sector.bullishPct}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stocks</span>
                      <div className="font-semibold tabular-nums">{sector.stockCount}</div>
                    </div>
                  </div>
                  {/* Sentiment bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full"
                      style={{ width: `${sector.bullishPct}%` }}
                    />
                    <div
                      className="h-full bg-red-500 rounded-r-full"
                      style={{ width: `${sector.bearishPct}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
