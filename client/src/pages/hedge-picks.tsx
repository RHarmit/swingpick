import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, TrendingUp, TrendingDown, Activity } from "lucide-react";
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
  // Use the EXISTING stocks data — no extra API call needed
  const { data: allStocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  // Compute hedge fund picks client-side
  const hedgePicks = useMemo<HedgeStock[]>(() => {
    if (!allStocks || allStocks.length === 0) return [];
    const affordable = allStocks.filter(s => s.price <= 600 && s.price > 0);
    const scored = affordable.map(s => ({
      ...s,
      hedgeScore: Math.round((s.swingScore * 0.4 + s.fundamentalScore * 0.3 + s.sentimentScore * 0.3) * 10) / 10,
    }));
    scored.sort((a, b) => b.hedgeScore - a.hedgeScore);
    return scored.slice(0, 5);
  }, [allStocks]);

  if (isLoading || !allStocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crown className="w-8 h-8 mx-auto mb-3 text-amber-500 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading hedge fund picks...</p>
      </Card>
    );
  }

  if (hedgePicks.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crown className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No stocks under ₹600 found yet. Data may still be loading.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 border-card-border bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-500" />
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Hedge Fund Top 5 Picks
              <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-xs">Under ₹600</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weighted scoring: 40% Technical · 30% Fundamental · 30% Sentiment. Filtered to stocks under ₹600 for accessibility.
            </p>
          </div>
        </div>
      </Card>

      {/* Picks */}
      {hedgePicks.map((stock, index) => {
        const rank = index + 1;
        const style = RANK_STYLES[rank] || RANK_STYLES[4];
        const signalCfg = SIGNAL_CONFIG[stock.signal] || SIGNAL_CONFIG.neutral;
        const reason = generateReason(stock);

        return (
          <Card key={stock.symbol} className={`p-4 md:p-5 border-card-border ${style.border}`}>
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Left: Rank + Stock Info */}
              <div className="flex items-start gap-3 md:min-w-[200px]">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${style.label}`}>
                  #{rank}
                </span>
                <div>
                  <Link href={`/stock/${stock.symbol}`}>
                    <span className="font-bold text-base hover:underline cursor-pointer">{stock.symbol}</span>
                  </Link>
                  <Badge variant="outline" className="ml-2 text-[10px]">{stock.sector}</Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">{stock.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-semibold">₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {stock.changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <Badge variant="outline" className={`mt-1.5 text-[10px] ${signalCfg.color}`}>
                    {signalCfg.label}
                  </Badge>
                </div>
              </div>

              {/* Center: Score Breakdown */}
              <div className="flex-1 space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">Hedge Score</span>
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stock.hedgeScore}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">Technical</span>
                    <Progress value={stock.swingScore} className="flex-1 h-2.5 [&>div]:bg-emerald-500" />
                    <span className="text-xs font-medium w-8 text-right tabular-nums">{stock.swingScore}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">Fundamental</span>
                    <Progress value={stock.fundamentalScore} className="flex-1 h-2.5 [&>div]:bg-blue-500" />
                    <span className="text-xs font-medium w-8 text-right tabular-nums">{stock.fundamentalScore}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">Sentiment</span>
                    <Progress value={stock.sentimentScore} className="flex-1 h-2.5 [&>div]:bg-purple-500" />
                    <span className="text-xs font-medium w-8 text-right tabular-nums">{stock.sentimentScore}</span>
                  </div>
                </div>
              </div>

              {/* Right: Key Metrics */}
              <div className="md:min-w-[180px]">
                <div className="grid grid-cols-3 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">RSI</span>
                    <div className={`font-semibold tabular-nums ${stock.rsi14 < 30 ? "text-red-500" : stock.rsi14 > 70 ? "text-emerald-600" : ""}`}>
                      {stock.rsi14.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MACD</span>
                    <div className={`font-semibold tabular-nums ${stock.macdHistogram >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {stock.macdHistogram.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ADX</span>
                    <div className={`font-semibold tabular-nums ${stock.adx14 >= 25 ? "text-emerald-600" : ""}`}>
                      {stock.adx14.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MFI</span>
                    <div className="font-semibold tabular-nums">{(stock.mfi14 ?? 50).toFixed(0)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vol</span>
                    <div className="font-semibold tabular-nums">{stock.avgVolume > 0 ? (stock.volume / stock.avgVolume).toFixed(1) + "x" : "—"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ATR</span>
                    <div className="font-semibold tabular-nums">{stock.atr14.toFixed(2)}</div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Why this pick</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{reason}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
