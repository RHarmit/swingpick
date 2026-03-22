import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Activity } from "lucide-react";
import type { Stock } from "@shared/schema";

type HedgeStock = Stock & { hedgeScore: number };

const SIGNAL_CONFIG: Record<string, { label: string; color: string }> = {
  strong_buy: { label: "Strong Buy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  buy: { label: "Buy", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" },
  neutral: { label: "Neutral", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  sell: { label: "Sell", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  strong_sell: { label: "Strong Sell", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
};

const RANK_STYLES: Record<number, { border: string; accent: string; label: string }> = {
  1: { border: "border-amber-500/40", accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "bg-amber-500 text-white" },
  2: { border: "border-slate-400/40", accent: "bg-slate-400/15 text-slate-500 dark:text-slate-300", label: "bg-slate-400 text-white" },
  3: { border: "border-orange-700/40", accent: "bg-orange-700/15 text-orange-700 dark:text-orange-400", label: "bg-orange-700 text-white" },
  4: { border: "border-border", accent: "bg-muted text-muted-foreground", label: "bg-muted text-muted-foreground" },
  5: { border: "border-border", accent: "bg-muted text-muted-foreground", label: "bg-muted text-muted-foreground" },
};

function generateReason(stock: any): string {
  const reasons: string[] = [];
  if (stock.rsi14 >= 40 && stock.rsi14 <= 60) reasons.push("RSI in sweet spot");
  else if (stock.rsi14 < 35) reasons.push("Oversold bounce potential");
  if (stock.macdHistogram > 0) reasons.push("MACD bullish crossover");
  if (stock.adx14 >= 25) reasons.push("Strong trend (ADX " + stock.adx14.toFixed(0) + ")");
  if (stock.mfi14 && stock.mfi14 > 60) reasons.push("High money flow");
  if (stock.volume > stock.avgVolume * 1.5) reasons.push("Volume confirmation");
  if (stock.fundamentalScore >= 60) reasons.push("Strong fundamentals");
  if (stock.sentimentScore >= 60) reasons.push("Positive sentiment");
  if (stock.price < stock.sma200 * 1.05 && stock.price > stock.sma200 * 0.95) reasons.push("Near 200 SMA support");
  return reasons.slice(0, 3).join(" · ") || "Balanced technical profile";
}

export default function HedgePicks() {
  const { data: stocks, isLoading } = useQuery<HedgeStock[]>({
    queryKey: ["/api/hedge-picks"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
  });

  if (isLoading || !stocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crown className="w-8 h-8 mx-auto mb-3 text-amber-500 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading hedge fund picks...</p>
      </Card>
    );
  }

  if (stocks.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crown className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No stocks under ₹600 available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 border-card-border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-sm">Hedge Fund Top 5 Picks</h2>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">Under ₹600</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Weighted scoring: 40% Technical · 30% Fundamental · 30% Sentiment. Filtered to stocks under ₹600 for accessibility.
        </p>
      </Card>

      {/* Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        {stocks.map((stock, i) => {
          const rank = i + 1;
          const style = RANK_STYLES[rank] || RANK_STYLES[5];
          const signalCfg = SIGNAL_CONFIG[stock.signal] || SIGNAL_CONFIG.neutral;
          const reason = generateReason(stock);
          const volMultiple = stock.avgVolume > 0 ? (stock.volume / stock.avgVolume).toFixed(1) : "N/A";

          return (
            <Link key={stock.symbol} href={`/stock/${stock.symbol}`}>
              <Card className={`p-4 border ${style.border} hover:bg-muted/40 transition-colors cursor-pointer`}>
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left: Rank + Stock info */}
                  <div className="flex items-start gap-3 md:w-[220px] shrink-0">
                    <span className={`text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shrink-0 ${style.label}`}>
                      #{rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{stock.symbol}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{stock.sector}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{stock.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium tabular-nums">
                          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {stock.changePct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {Math.abs(stock.changePct).toFixed(2)}%
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 mt-1 ${signalCfg.color}`}>
                        {signalCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Middle: Score Breakdown */}
                  <div className="flex-1 space-y-2">
                    {/* Hedge Score */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">Hedge Score</span>
                      <span className={`text-lg font-bold tabular-nums ${stock.hedgeScore >= 60 ? "text-emerald-600 dark:text-emerald-400" : stock.hedgeScore >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"}`}>
                        {stock.hedgeScore.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/ 100</span>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-[70px] shrink-0">Technical</span>
                        <Progress value={stock.swingScore} className="h-2 flex-1 [&>div]:bg-emerald-500" />
                        <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{stock.swingScore}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-[70px] shrink-0">Fundamental</span>
                        <Progress value={stock.fundamentalScore} className="h-2 flex-1 [&>div]:bg-blue-500" />
                        <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{stock.fundamentalScore}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-[70px] shrink-0">Sentiment</span>
                        <Progress value={stock.sentimentScore} className="h-2 flex-1 [&>div]:bg-purple-500" />
                        <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{stock.sentimentScore}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics */}
                  <div className="md:w-[200px] shrink-0">
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">RSI</span>
                        <div className={`font-semibold tabular-nums ${stock.rsi14 >= 70 ? "text-red-500" : stock.rsi14 <= 30 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                          {stock.rsi14.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">MACD</span>
                        <div className={`font-semibold tabular-nums ${stock.macdHistogram >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {stock.macdHistogram.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ADX</span>
                        <div className={`font-semibold tabular-nums ${stock.adx14 >= 25 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {stock.adx14.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">MFI</span>
                        <div className="font-semibold tabular-nums">{(stock.mfi14 ?? 50).toFixed(0)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vol</span>
                        <div className="font-semibold tabular-nums">{volMultiple}x</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ATR</span>
                        <div className="font-semibold tabular-nums">{stock.atr14.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Why This Pick */}
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Why This Pick</div>
                      <div className="text-[10px] text-foreground/80">{reason}</div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Methodology */}
      <Card className="p-4 border-card-border bg-muted/30">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Methodology</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Technical (40%)</p>
            <p>RSI, MACD, ADX, Bollinger Bands, SMA crossovers, volume patterns</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Fundamental (30%)</p>
            <p>P/E ratio, EPS, market cap, 52-week position, growth signals</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Sentiment (30%)</p>
            <p>News analysis, institutional sentiment, market mood indicators</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
