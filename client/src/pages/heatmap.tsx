import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { Stock, SectorPerformance } from "@shared/schema";

type HeatmapMetric = "change2d" | "changePct" | "avgCombinedScore";

function getHeatColor(value: number, metric: HeatmapMetric): string {
  if (metric === "avgCombinedScore") {
    // Score: 0-100 scale
    if (value >= 70) return "bg-emerald-600 dark:bg-emerald-700 text-white";
    if (value >= 60) return "bg-emerald-500/80 dark:bg-emerald-600/80 text-white";
    if (value >= 55) return "bg-green-500/70 dark:bg-green-600/70 text-white";
    if (value >= 50) return "bg-green-400/50 dark:bg-green-500/40 text-foreground";
    if (value >= 45) return "bg-yellow-400/40 dark:bg-yellow-500/30 text-foreground";
    if (value >= 40) return "bg-orange-400/50 dark:bg-orange-500/40 text-foreground";
    if (value >= 35) return "bg-orange-500/70 dark:bg-orange-600/60 text-white";
    return "bg-red-600 dark:bg-red-700 text-white";
  }
  // Percentage change: positive = green, negative = red
  if (value >= 4) return "bg-emerald-600 dark:bg-emerald-700 text-white";
  if (value >= 2.5) return "bg-emerald-500/80 dark:bg-emerald-600/80 text-white";
  if (value >= 1) return "bg-green-500/70 dark:bg-green-600/70 text-white";
  if (value >= 0.3) return "bg-green-400/50 dark:bg-green-500/40 text-foreground";
  if (value >= -0.3) return "bg-muted text-foreground";
  if (value >= -1) return "bg-orange-400/50 dark:bg-orange-500/40 text-foreground";
  if (value >= -2.5) return "bg-orange-500/70 dark:bg-orange-600/60 text-white";
  if (value >= -4) return "bg-red-500/80 dark:bg-red-600/80 text-white";
  return "bg-red-600 dark:bg-red-700 text-white";
}

export default function Heatmap() {
  const [metric, setMetric] = useState<HeatmapMetric>("change2d");

  const { data: sectorPerformance } = useQuery<SectorPerformance[]>({
    queryKey: ["/api/sector-performance"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: stocks } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  // Build sector-level heatmap data with stock breakdown
  const heatmapData = useMemo(() => {
    if (!sectorPerformance || !stocks) return [];

    const stocksBySector = new Map<string, Stock[]>();
    for (const s of stocks) {
      const arr = stocksBySector.get(s.sector) || [];
      arr.push(s);
      stocksBySector.set(s.sector, arr);
    }

    return sectorPerformance.map(sp => {
      const sectorStocks = stocksBySector.get(sp.sector) || [];
      // Sort stocks by the selected metric
      const sortedStocks = [...sectorStocks].sort((a, b) => {
        if (metric === "change2d") return b.change2d - a.change2d;
        if (metric === "changePct") return b.changePct - a.changePct;
        return b.combinedScore - a.combinedScore;
      });

      return {
        ...sp,
        stocks: sortedStocks,
        value: metric === "avgCombinedScore" ? sp.avgCombinedScore : sp.change2d,
      };
    }).sort((a, b) => b.value - a.value);
  }, [sectorPerformance, stocks, metric]);

  if (!sectorPerformance || !stocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading heatmap data...</p>
      </Card>
    );
  }

  const metricLabel = metric === "change2d" ? "2-Day Change" : metric === "changePct" ? "Today's Change" : "Combined Score";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Metric:</span>
        {([
          ["change2d", "2-Day Change"],
          ["changePct", "Today's Change"],
          ["avgCombinedScore", "Combined Score"],
        ] as [HeatmapMetric, string][]).map(([key, label]) => (
          <Button
            key={key}
            variant={metric === key ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setMetric(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-muted-foreground mr-1">Legend:</span>
        <span className="px-2 py-0.5 rounded bg-red-600 text-white">Worst</span>
        <span className="px-2 py-0.5 rounded bg-orange-500/70 text-white">Poor</span>
        <span className="px-2 py-0.5 rounded bg-muted text-foreground">Neutral</span>
        <span className="px-2 py-0.5 rounded bg-green-500/70 text-white">Good</span>
        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">Best</span>
      </div>

      {/* Sector Heatmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {heatmapData.map(sector => {
          const sectorColor = getHeatColor(sector.value, metric);
          return (
            <Card key={sector.sector} className="overflow-hidden border-card-border">
              {/* Sector Header */}
              <div className={`px-3 py-2.5 ${sectorColor}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{sector.sector}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums">
                      {metric === "avgCombinedScore"
                        ? `Score: ${sector.avgCombinedScore}`
                        : `${sector.value >= 0 ? "+" : ""}${sector.value.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] opacity-80">
                  <span>{sector.stockCount} stocks</span>
                  <span className="flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {sector.bullishCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> {sector.bearishCount}
                  </span>
                </div>
              </div>

              {/* Stock Cells */}
              <div className="p-2">
                <div className="flex flex-wrap gap-1">
                  {sector.stocks.slice(0, 20).map(stock => {
                    const stockValue = metric === "avgCombinedScore" ? stock.combinedScore :
                      metric === "change2d" ? stock.change2d : stock.changePct;
                    const cellColor = getHeatColor(stockValue, metric);

                    return (
                      <Tooltip key={stock.symbol}>
                        <TooltipTrigger asChild>
                          <a
                            href={`#/stock/${stock.symbol}`}
                            className={`px-1.5 py-1 rounded text-[10px] font-medium tabular-nums cursor-pointer hover:opacity-80 transition-opacity ${cellColor}`}
                          >
                            <div className="leading-tight">{stock.symbol}</div>
                            <div className="leading-tight font-bold">
                              {metric === "avgCombinedScore"
                                ? stock.combinedScore
                                : `${stockValue >= 0 ? "+" : ""}${stockValue.toFixed(1)}%`}
                            </div>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <div className="font-semibold">{stock.name}</div>
                          <div>Price: ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                          <div>Today: {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%</div>
                          <div>2-Day: {stock.change2d >= 0 ? "+" : ""}{stock.change2d.toFixed(2)}%</div>
                          <div>Combined: {stock.combinedScore} | MFI: {stock.mfi14}</div>
                          <div>Buying: {stock.buyingPressure.replace("_", " ")}</div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {sector.stocks.length > 20 && (
                    <span className="text-[10px] text-muted-foreground self-center px-1">
                      +{sector.stocks.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Market Summary */}
      <Card className="p-4 border-card-border">
        <h3 className="text-sm font-semibold mb-3">Market Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Best Sector</div>
            <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
              {heatmapData[0]?.sector || "—"}
            </div>
            <div className="text-xs tabular-nums">
              {heatmapData[0] ? `${heatmapData[0].value >= 0 ? "+" : ""}${heatmapData[0].value.toFixed(2)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Worst Sector</div>
            <div className="font-semibold text-sm text-red-500">
              {heatmapData[heatmapData.length - 1]?.sector || "—"}
            </div>
            <div className="text-xs tabular-nums">
              {heatmapData.length > 0
                ? `${heatmapData[heatmapData.length - 1].value >= 0 ? "+" : ""}${heatmapData[heatmapData.length - 1].value.toFixed(2)}%`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Bullish</div>
            <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
              {heatmapData.reduce((a, s) => a + s.bullishCount, 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Bearish</div>
            <div className="font-semibold text-sm text-red-500">
              {heatmapData.reduce((a, s) => a + s.bearishCount, 0)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
