import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingDown, TrendingUp, AlertTriangle, Target, ArrowDown, ArrowUp,
  Zap, Activity, BarChart3
} from "lucide-react";
import type { Stock } from "@shared/schema";

const SIGNAL_CONFIG: Record<string, { label: string; color: string }> = {
  strong_buy: { label: "Strong Buy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  buy: { label: "Buy", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" },
  neutral: { label: "Neutral", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  sell: { label: "Sell", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  strong_sell: { label: "Strong Sell", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
};

const BUYING_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  high_buying: { label: "High Buying", color: "text-emerald-600 dark:text-emerald-400", icon: "🟢" },
  buying: { label: "Buying", color: "text-green-600 dark:text-green-400", icon: "🟢" },
  neutral: { label: "Neutral", color: "text-yellow-600 dark:text-yellow-400", icon: "🟡" },
  selling: { label: "Selling", color: "text-orange-600 dark:text-orange-400", icon: "🔴" },
  high_selling: { label: "High Selling", color: "text-red-600 dark:text-red-400", icon: "🔴" },
};

export default function MomentumPicks() {
  const { data: stocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  // Top 3 SELL candidates - lowest combined scores
  const sellCandidates = useMemo(() => {
    if (!stocks) return [];
    return [...stocks]
      .sort((a, b) => a.combinedScore - b.combinedScore)
      .slice(0, 3);
  }, [stocks]);

  // Top 3 BUY candidates - highest combined scores
  const buyCandidates = useMemo(() => {
    if (!stocks) return [];
    return [...stocks]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 3);
  }, [stocks]);

  // Biggest MFI increases (buying surging)
  const buyingSurge = useMemo(() => {
    if (!stocks) return [];
    return [...stocks]
      .filter(s => s.mfiChange > 0)
      .sort((a, b) => b.mfiChange - a.mfiChange)
      .slice(0, 5);
  }, [stocks]);

  // Biggest MFI decreases (selling surging)
  const sellingSurge = useMemo(() => {
    if (!stocks) return [];
    return [...stocks]
      .filter(s => s.mfiChange < 0)
      .sort((a, b) => a.mfiChange - b.mfiChange)
      .slice(0, 5);
  }, [stocks]);

  // Momentum breakdown stats
  const stats = useMemo(() => {
    if (!stocks) return null;
    const highBuying = stocks.filter(s => s.buyingPressure === "high_buying" || s.buyingPressure === "buying").length;
    const highSelling = stocks.filter(s => s.buyingPressure === "selling" || s.buyingPressure === "high_selling").length;
    const avgMfi = stocks.length > 0 ? Math.round(stocks.reduce((a, s) => a + s.mfi14, 0) / stocks.length) : 0;
    const mfiAbove50 = stocks.filter(s => s.mfi14 > 50).length;
    return { highBuying, highSelling, avgMfi, mfiAbove50, total: stocks.length };
  }, [stocks]);

  if (isLoading || !stocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Target className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading momentum analysis...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Market MFI Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 border-card-border">
            <div className="text-xs text-muted-foreground mb-1">Avg Market MFI</div>
            <div className={`text-xl font-semibold tabular-nums ${stats.avgMfi >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {stats.avgMfi}
            </div>
            <div className="text-[10px] text-muted-foreground">{stats.avgMfi >= 50 ? "Bullish bias" : "Bearish bias"}</div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="text-xs text-muted-foreground mb-1">Buying Pressure</div>
            <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {stats.highBuying}
            </div>
            <div className="text-[10px] text-muted-foreground">of {stats.total} stocks</div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="text-xs text-muted-foreground mb-1">Selling Pressure</div>
            <div className="text-xl font-semibold tabular-nums text-red-500">
              {stats.highSelling}
            </div>
            <div className="text-[10px] text-muted-foreground">of {stats.total} stocks</div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="text-xs text-muted-foreground mb-1">MFI &gt; 50</div>
            <div className="text-xl font-semibold tabular-nums">
              {stats.total > 0 ? Math.round((stats.mfiAbove50 / stats.total) * 100) : 0}%
            </div>
            <div className="text-[10px] text-muted-foreground">{stats.mfiAbove50} stocks</div>
          </Card>
        </div>
      )}

      {/* Top 3 Sell Candidates */}
      <Card className="p-4 border-card-border border-red-500/20">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-sm">Top 3 Sell Candidates</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Based on Combined Score (lowest)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sellCandidates.map((stock, i) => (
            <StockPickCard key={stock.symbol} stock={stock} rank={i + 1} type="sell" />
          ))}
        </div>
      </Card>

      {/* Top 3 Buy Candidates */}
      <Card className="p-4 border-card-border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Top 3 Buy Candidates</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">Based on Combined Score (highest)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {buyCandidates.map((stock, i) => (
            <StockPickCard key={stock.symbol} stock={stock} rank={i + 1} type="buy" />
          ))}
        </div>
      </Card>

      {/* Buying & Selling Surge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Buying Surge */}
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Buying Surge</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">MFI increasing most</span>
          </div>
          <div className="space-y-2">
            {buyingSurge.map(stock => (
              <Link key={stock.symbol} href={`/stock/${stock.symbol}`}>
                <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{stock.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      MFI: {stock.mfi14}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{stock.mfiChange.toFixed(1)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {buyingSurge.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No stocks with increasing MFI</p>
            )}
          </div>
        </Card>

        {/* Selling Surge */}
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-sm">Selling Surge</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">MFI decreasing most</span>
          </div>
          <div className="space-y-2">
            {sellingSurge.map(stock => (
              <Link key={stock.symbol} href={`/stock/${stock.symbol}`}>
                <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{stock.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{stock.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      MFI: {stock.mfi14}
                    </span>
                    <span className="text-xs font-bold text-red-500 tabular-nums">
                      {stock.mfiChange.toFixed(1)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {sellingSurge.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No stocks with decreasing MFI</p>
            )}
          </div>
        </Card>
      </div>

      {/* How to read */}
      <Card className="p-4 border-card-border bg-muted/30">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">How to Read This</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Money Flow Index (MFI)</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Combines price AND volume to measure buying pressure</li>
              <li>MFI &gt; 80 = High buying (overbought zone)</li>
              <li>MFI &lt; 20 = High selling (oversold zone)</li>
              <li>Rising MFI = Buying pressure increasing</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Combined Score</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>40% Technical + 30% Fundamental + 30% Sentiment</li>
              <li>Low combined score = strong sell candidate</li>
              <li>High combined score = strong buy candidate</li>
              <li>Top 3 sell = worst scoring stocks across all factors</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Stock Pick Card component
function StockPickCard({ stock, rank, type }: { stock: Stock; rank: number; type: "buy" | "sell" }) {
  const isSell = type === "sell";
  const borderColor = isSell ? "border-red-500/20" : "border-emerald-500/20";
  const rankBg = isSell ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  const buyingCfg = BUYING_CONFIG[stock.buyingPressure] || BUYING_CONFIG.neutral;

  return (
    <Link href={`/stock/${stock.symbol}`}>
      <Card className={`p-3 border ${borderColor} hover:bg-muted/40 transition-colors cursor-pointer h-full`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${rankBg}`}>
              {rank}
            </span>
            <div>
              <div className="font-semibold text-sm">{stock.symbol}</div>
              <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{stock.name}</div>
            </div>
          </div>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${SIGNAL_CONFIG[stock.combinedSignal]?.color || ""}`}>
            {SIGNAL_CONFIG[stock.combinedSignal]?.label || "N/A"}
          </Badge>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium tabular-nums">
            ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {stock.changePct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(stock.changePct).toFixed(2)}%
          </span>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] border-t border-border/50 pt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Combined</span>
            <span className="font-bold tabular-nums">{stock.combinedScore}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Technical</span>
            <span className="font-semibold tabular-nums">{stock.swingScore}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fundamental</span>
            <span className="font-semibold tabular-nums">{stock.fundamentalScore}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sentiment</span>
            <span className="font-semibold tabular-nums">{stock.sentimentScore}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MFI</span>
            <span className="font-semibold tabular-nums">{stock.mfi14}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buying</span>
            <span className={`font-semibold ${buyingCfg.color}`}>{buyingCfg.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">RSI</span>
            <span className="font-semibold tabular-nums">{stock.rsi14}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">2-Day</span>
            <span className={`font-semibold tabular-nums ${stock.change2d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {stock.change2d >= 0 ? "+" : ""}{stock.change2d.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Patterns */}
        {stock.patterns.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-border/50">
            {stock.patterns.slice(0, 3).map(p => (
              <span key={p} className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
