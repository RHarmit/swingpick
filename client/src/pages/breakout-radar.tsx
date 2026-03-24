import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Crosshair, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Activity,
  Zap, Target, Shield, AlertTriangle, ChevronDown, ChevronUp, BarChart3, Gauge
} from "lucide-react";
import type { Stock } from "@shared/schema";

interface BreakoutStock extends Stock {
  breakoutScore: number;
  estMoveLow: number;
  estMoveHigh: number;
  direction: "bullish" | "bearish" | "either";
  confidence: "high" | "medium" | "low";
  catalysts: string[];
  volRatio: number;
  bbWidth: number;
}

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

const DIRECTION_CONFIG = {
  bullish: { label: "Bullish", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  bearish: { label: "Bearish", icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  either: { label: "Either Way", icon: Activity, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
};

const CONFIDENCE_CONFIG = {
  high: { label: "High", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", icon: Shield },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", icon: Target },
  low: { label: "Low", color: "text-red-500", bg: "bg-red-500/15", border: "border-red-500/30", icon: AlertTriangle },
};

// Animated gauge ring for breakout score
function BreakoutGauge({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/20"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// Mini bar indicator
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: "width 0.8s ease-out" }} />
    </div>
  );
}

function BreakoutCard({ stock, rank }: { stock: BreakoutStock; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { entry, target, stopLoss } = computeEntryExit(stock);
  const dirConfig = DIRECTION_CONFIG[stock.direction];
  const confConfig = CONFIDENCE_CONFIG[stock.confidence];
  const DirIcon = dirConfig.icon;
  const ConfIcon = confConfig.icon;
  const potentialGain = ((target - entry) / entry * 100).toFixed(1);

  return (
    <Card
      className={`overflow-hidden border-card-border transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 ${
        rank <= 3 ? "border-l-4 border-l-primary" : ""
      }`}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank + Gauge */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground"
            }`}>
              #{rank}
            </span>
            <BreakoutGauge score={stock.breakoutScore} size={72} />
            <span className="text-[9px] text-muted-foreground">Breakout</span>
          </div>

          {/* Stock Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/stock/${stock.symbol}`}>
                    <span className="font-bold text-base hover:underline cursor-pointer" data-testid={`link-breakout-${stock.symbol}`}>
                      {stock.symbol}
                    </span>
                  </Link>
                  <Badge variant="outline" className="text-[10px]">{stock.sector}</Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 ${dirConfig.bg} ${dirConfig.color}`}>
                    <DirIcon className="w-3 h-3 mr-0.5" />
                    {dirConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stock.name}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums">
                  ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-sm font-semibold flex items-center gap-0.5 justify-end ${
                  stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                }`}>
                  {stock.changePct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Expected Move + Confidence */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <Crosshair className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {stock.estMoveLow}% - {stock.estMoveHigh}%
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[220px]">
                  Estimated 2-day move range based on ATR (Average True Range). Historical volatility suggests this stock could move this much.
                </TooltipContent>
              </Tooltip>

              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${confConfig.bg} border ${confConfig.border}`}>
                <ConfIcon className={`w-3.5 h-3.5 ${confConfig.color}`} />
                <span className={`text-xs font-semibold ${confConfig.color}`}>{confConfig.label} Confidence</span>
              </div>

              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BarChart3 className="w-3 h-3" />
                    <span className="tabular-nums">{stock.volRatio}x vol</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Volume is {stock.volRatio}x the 20-day average</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Gauge className="w-3 h-3" />
                    <span className="tabular-nums">BB {stock.bbWidth}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px]">Bollinger Band width: {stock.bbWidth}%. Lower = tighter squeeze = bigger potential breakout.</TooltipContent>
              </Tooltip>
            </div>

            {/* Catalysts */}
            {stock.catalysts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {stock.catalysts.map((c, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Score Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Technical</span>
                  <span className="text-[10px] font-semibold tabular-nums">{stock.swingScore}</span>
                </div>
                <MiniBar value={stock.swingScore} max={100} color="bg-blue-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Fundamental</span>
                  <span className="text-[10px] font-semibold tabular-nums">{stock.fundamentalScore}</span>
                </div>
                <MiniBar value={stock.fundamentalScore} max={100} color="bg-violet-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Sentiment</span>
                  <span className="text-[10px] font-semibold tabular-nums">{stock.sentimentScore}</span>
                </div>
                <MiniBar value={stock.sentimentScore} max={100} color="bg-amber-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Combined</span>
                  <span className="text-[10px] font-semibold tabular-nums">{stock.combinedScore}</span>
                </div>
                <MiniBar value={stock.combinedScore} max={100} color="bg-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 transition-colors w-full justify-center pt-2 border-t border-border/50"
          data-testid={`button-expand-${stock.symbol}`}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Less Detail" : "Entry / Target / Stop Loss & More"}
        </button>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Entry / Target / Stop Loss */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">Entry</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-emerald-600">₹{entry.toFixed(0)}</div>
              <p className="text-[10px] text-muted-foreground">Support level</p>
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
                <Shield className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-500">Stop Loss</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-red-500">₹{stopLoss.toFixed(0)}</div>
              <p className="text-[10px] text-muted-foreground">
                R:R {((target - entry) / (entry - stopLoss)).toFixed(1)}
              </p>
            </Card>
          </div>

          {/* Technical Grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">RSI</div>
              <div className={`font-semibold ${stock.rsi14 < 30 ? "text-emerald-600" : stock.rsi14 > 70 ? "text-red-500" : ""}`}>
                {stock.rsi14.toFixed(1)}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">ADX</div>
              <div className={`font-semibold ${stock.adx14 >= 25 ? "text-emerald-600" : ""}`}>
                {stock.adx14.toFixed(1)}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">MFI</div>
              <div className="font-semibold">{(stock.mfi14 ?? 50).toFixed(0)}</div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">MACD</div>
              <div className={`font-semibold ${stock.macdHistogram >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {stock.macdHistogram.toFixed(2)}
              </div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">ATR</div>
              <div className="font-semibold">{stock.atr14.toFixed(2)}</div>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="text-muted-foreground">2-Day</div>
              <div className={`font-semibold ${stock.change2d >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {stock.change2d >= 0 ? "+" : ""}{stock.change2d.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


export default function BreakoutRadar() {
  const { data: radarStocks, isLoading } = useQuery<BreakoutStock[]>({
    queryKey: ["/api/breakout-radar"],
    staleTime: 10 * 60 * 1000,
  });

  const [showCount, setShowCount] = useState(5);

  const displayStocks = useMemo(() => {
    if (!radarStocks) return [];
    return radarStocks.slice(0, showCount);
  }, [radarStocks, showCount]);

  // Stats
  const highConf = radarStocks?.filter(s => s.confidence === "high").length ?? 0;
  const bullish = radarStocks?.filter(s => s.direction === "bullish").length ?? 0;
  const avgScore = radarStocks && radarStocks.length > 0
    ? Math.round(radarStocks.reduce((a, s) => a + s.breakoutScore, 0) / radarStocks.length)
    : 0;

  if (isLoading || !radarStocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crosshair className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Scanning NIFTY 500 for breakout candidates...</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Analyzing volume, Bollinger Bands, ADX, MACD, MFI across all stocks</p>
      </Card>
    );
  }

  if (radarStocks.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Crosshair className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No strong breakout candidates detected right now.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 border-card-border bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="p-2 rounded-xl bg-primary/15">
            <Crosshair className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Breakout Radar
              <Badge variant="outline" className="text-primary border-primary/30 text-xs">5-10% Move</Badge>
              <Badge variant="outline" className="text-violet-500 border-violet-500/30 text-xs">2-Day Window</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stocks showing highest probability of a 5-10% move in the next 2 trading days. Scored by: 25% Volume Surge · 20% Bollinger Squeeze · 15% ADX Trend · 10% RSI · 10% MACD · 10% SMA Structure · 10% MFI.
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-center">
            <div className="text-xl font-bold tabular-nums text-primary">{highConf}</div>
            <div className="text-[10px] text-muted-foreground">High Confidence</div>
          </div>
          <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-center">
            <div className="text-xl font-bold tabular-nums text-emerald-500">{bullish}</div>
            <div className="text-[10px] text-muted-foreground">Bullish Bias</div>
          </div>
          <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-center">
            <div className="text-xl font-bold tabular-nums">{avgScore}</div>
            <div className="text-[10px] text-muted-foreground">Avg Score</div>
          </div>
        </div>
      </Card>

      {/* Stock Cards */}
      {displayStocks.map((stock, i) => (
        <BreakoutCard key={stock.symbol} stock={stock} rank={i + 1} />
      ))}

      {/* Show More/Less */}
      {radarStocks.length > 5 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCount(showCount === 5 ? 10 : 5)}
            data-testid="button-show-more-radar"
          >
            {showCount === 5 ? (
              <>
                <ChevronDown className="w-4 h-4" />
                Show All 10 Picks
              </>
            ) : (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Top 5
              </>
            )}
          </Button>
        </div>
      )}

      {/* Methodology */}
      <Card className="p-4 border-card-border bg-muted/30">
        <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          How Breakout Radar Works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
            <span><strong>Volume Surge (25%)</strong> — unusual volume signals institutional interest</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />
            <span><strong>Bollinger Squeeze (20%)</strong> — tight bands = energy building for breakout</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
            <span><strong>ADX Trend (15%)</strong> — ADX above 25 = strong directional move</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
            <span><strong>RSI + MACD + MFI (30%)</strong> — momentum, acceleration, money flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
            <span><strong>SMA Structure (10%)</strong> — price above key averages = bullish setup</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
            <span><strong>Est. Move</strong> — ATR-based expected range (1.2x to 2.5x daily ATR)</span>
          </div>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="p-3 border-card-border bg-yellow-500/5 border-yellow-500/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>Disclaimer:</strong> Breakout Radar identifies stocks with technical setups that historically precede large moves. This is NOT a guarantee of future performance. The estimated move range is based on ATR volatility, not a prediction. Always use stop losses, manage position size, and do your own due diligence. This is not financial advice.
        </p>
      </Card>
    </div>
  );
}
