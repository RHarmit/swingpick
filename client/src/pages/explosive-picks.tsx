import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, TrendingUp, ArrowUp, Activity, Flame, Target } from "lucide-react";
import type { Stock } from "@shared/schema";

function computeEntryExit(stock: Stock): { entry: number; target: number; stopLoss: number } {
  const price = stock.price;
  const atr = stock.atr14 || 0;
  let entry = price;
  const supports = [
    stock.bollingerLower,
    stock.sma20 < price ? stock.sma20 : 0,
    stock.sma50 < price ? stock.sma50 : 0,
    stock.vwap < price ? stock.vwap : 0,
  ].filter(v => v > 0 && v < price);
  if (supports.length > 0) entry = Math.max(...supports);
  else entry = Math.max(price - atr, price * 0.97);
  let target = stock.bollingerUpper || price + 2 * atr;
  if (target <= price) target = price + 2 * atr;
  if (stock.high52w > 0 && stock.high52w < target) target = Math.min(target, stock.high52w);
  if (target < price * 1.03) target = price * 1.03;
  let stopLoss = entry - 1.5 * atr;
  if (stopLoss <= 0 || stopLoss >= entry) stopLoss = entry * 0.95;
  return {
    entry: Math.round(entry * 100) / 100,
    target: Math.round(target * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
  };
}

export default function ExplosivePicks() {
  const { data: allStocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  const explosivePicks = useMemo(() => {
    if (!allStocks || allStocks.length === 0) return [];

    // Filter: under 600, reasonable volume
    const candidates = allStocks.filter(s =>
      s.price > 0 && s.price <= 600 && s.avgVolume > 0
    );

    // Score each stock for explosiveness
    const scored = candidates.map(s => {
      const volSpike = Math.min(s.volume / s.avgVolume, 10); // cap at 10x
      const momentum = Math.abs(s.changePct) + Math.abs(s.change2d);
      const adxStrength = Math.min(s.adx14 / 50, 1); // normalize 0-1
      const mfiBuying = ((s.mfi14 ?? 50) - 30) / 70; // normalize

      // Explosive score: momentum + volume spike are the biggest factors
      const explosiveScore = Math.round(
        (momentum * 8) * 0.3 + // momentum weight
        (volSpike * 10) * 0.25 + // volume spike weight
        (s.sentimentScore || 50) * 0.15 + // sentiment
        (s.swingScore || 50) * 0.15 + // technical
        (adxStrength * 100) * 0.1 + // trend strength
        (Math.max(mfiBuying, 0) * 100) * 0.05 // buying pressure
      );

      return { ...s, explosiveScore, volSpike, momentum };
    });

    // Sort by explosive score, take top 2
    scored.sort((a, b) => b.explosiveScore - a.explosiveScore);
    return scored.slice(0, 2);
  }, [allStocks]);

  if (isLoading || !allStocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Flame className="w-8 h-8 mx-auto mb-3 text-orange-500 animate-pulse" />
        <p className="text-sm text-muted-foreground">Scanning for explosive stocks...</p>
      </Card>
    );
  }

  if (explosivePicks.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Flame className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No explosive picks found under ₹600 right now.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 border-card-border bg-gradient-to-r from-orange-500/10 via-red-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Explosive Picks
              <Badge variant="outline" className="text-orange-600 border-orange-500/30 text-xs">Under ₹600</Badge>
              <Badge variant="outline" className="text-red-500 border-red-500/30 text-xs">High Risk</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top 2 stocks with highest momentum + volume surge + strong signals. Scored by: 30% Momentum · 25% Volume Spike · 15% Sentiment · 15% Technical · 15% Trend.
            </p>
          </div>
        </div>
      </Card>

      {/* Picks */}
      {explosivePicks.map((stock, index) => {
        const { entry, target, stopLoss } = computeEntryExit(stock);
        const potentialGain = ((target - entry) / entry * 100).toFixed(1);
        const riskReward = ((target - entry) / (entry - stopLoss)).toFixed(1);

        return (
          <Card key={stock.symbol} className="overflow-hidden border-card-border border-l-4 border-l-orange-500">
            {/* Top accent bar */}
            <div className="bg-gradient-to-r from-orange-500/10 via-red-500/5 to-transparent px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                    #{index + 1}
                  </span>
                  <div>
                    <Link href={`/stock/${stock.symbol}`}>
                      <span className="font-bold text-lg hover:underline cursor-pointer">{stock.symbol}</span>
                    </Link>
                    <Badge variant="outline" className="ml-2 text-[10px]">{stock.sector}</Badge>
                    <p className="text-xs text-muted-foreground">{stock.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">₹{stock.price.toFixed(2)}</div>
                  <div className={`text-sm font-semibold flex items-center gap-1 justify-end ${stock.changePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    <TrendingUp className="w-4 h-4" />
                    {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Explosive Score */}
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Explosive Score</span>
                  <div className="text-3xl font-bold text-orange-500">{stock.explosiveScore}</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16">Momentum</span>
                    <Progress value={Math.min(stock.momentum * 5, 100)} className="flex-1 h-2 [&>div]:bg-orange-500" />
                    <span className="text-[10px] tabular-nums w-8">{stock.momentum.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16">Vol Spike</span>
                    <Progress value={Math.min(stock.volSpike * 10, 100)} className="flex-1 h-2 [&>div]:bg-red-500" />
                    <span className="text-[10px] tabular-nums w-8">{stock.volSpike.toFixed(1)}x</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16">Technical</span>
                    <Progress value={stock.swingScore} className="flex-1 h-2 [&>div]:bg-emerald-500" />
                    <span className="text-[10px] tabular-nums w-8">{stock.swingScore}</span>
                  </div>
                </div>
              </div>

              {/* Entry / Target / Stop Loss */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Entry</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-emerald-600">₹{entry.toFixed(0)}</div>
                  <p className="text-[10px] text-muted-foreground">Best support level</p>
                </Card>
                <Card className="p-3 border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">Target</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-blue-600">₹{target.toFixed(0)}</div>
                  <p className="text-[10px] text-muted-foreground">+{potentialGain}% upside</p>
                </Card>
                <Card className="p-3 border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-500">Stop Loss</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-red-500">₹{stopLoss.toFixed(0)}</div>
                  <p className="text-[10px] text-muted-foreground">R:R {riskReward}</p>
                </Card>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">RSI</div>
                  <div className={`font-semibold ${stock.rsi14 < 30 ? "text-red-500" : stock.rsi14 > 70 ? "text-emerald-600" : ""}`}>{stock.rsi14.toFixed(1)}</div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">ADX</div>
                  <div className={`font-semibold ${stock.adx14 >= 25 ? "text-emerald-600" : ""}`}>{stock.adx14.toFixed(1)}</div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">MFI</div>
                  <div className="font-semibold">{(stock.mfi14 ?? 50).toFixed(0)}</div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">MACD</div>
                  <div className={`font-semibold ${stock.macdHistogram >= 0 ? "text-emerald-600" : "text-red-500"}`}>{stock.macdHistogram.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">ATR</div>
                  <div className="font-semibold">{stock.atr14.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="text-muted-foreground">Signal</div>
                  <div className="font-semibold capitalize">{(stock.signal || "neutral").replace("_", " ")}</div>
                </div>
              </div>

              {/* Patterns */}
              {stock.patterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {stock.patterns.map(p => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Disclaimer */}
      <Card className="p-3 border-card-border bg-yellow-500/5 border-yellow-500/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>Disclaimer:</strong> Explosive picks are identified by extreme momentum, volume spikes, and strong signals. These are inherently HIGH RISK. Entry/exit levels are computed from Bollinger Bands, SMA support, VWAP, and ATR. Always use stop losses and manage position size. This is not financial advice.
        </p>
      </Card>
    </div>
  );
}
