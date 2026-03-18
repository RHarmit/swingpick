import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Activity,
  BarChart3, Target, Gauge, Waves, Zap, Brain, Newspaper, Star
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { useTheme } from "@/components/ThemeProvider";
import type { Stock, PricePoint } from "@shared/schema";
import { useMemo, useState } from "react";

const SIGNAL_CONFIG: Record<string, { label: string; color: string }> = {
  strong_buy: { label: "Strong Buy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  buy: { label: "Buy", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" },
  neutral: { label: "Neutral", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  sell: { label: "Sell", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  strong_sell: { label: "Strong Sell", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
};

function formatPrice(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMarketCap(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L Cr`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(2)}K Cr`;
  return `₹${n} Cr`;
}

function formatVolume(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export default function StockDetail() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol || "";
  const { theme } = useTheme();
  const [chartDays, setChartDays] = useState(90);

  const { data: stock, isLoading: stockLoading } = useQuery<Stock>({
    queryKey: [`/api/stocks/${symbol}`],
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });
  const { data: history, isLoading: histLoading } = useQuery<PricePoint[]>({
    queryKey: [`/api/stocks/${symbol}/history?days=${chartDays}`],
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });

  const chartColor = useMemo(() => {
    if (!stock) return theme === "dark" ? "#60a5fa" : "#3b82f6";
    return stock.changePct >= 0
      ? theme === "dark" ? "#34d399" : "#10b981"
      : theme === "dark" ? "#f87171" : "#ef4444";
  }, [stock, theme]);

  const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0";
  const textColor = theme === "dark" ? "#94a3b8" : "#64748b";

  if (stockLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 md:px-6 py-4 max-w-[1200px] mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[300px] w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 md:px-6 py-8 text-center">
          <p className="text-muted-foreground">Stock not found</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">Back to Screener</Button>
          </Link>
        </div>
      </div>
    );
  }

  const priceFrom52wLow = ((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 px-3 md:px-6 py-4 max-w-[1200px] mx-auto w-full">
        {/* Back nav + Stock header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{stock.symbol}</h1>
              <Badge variant="outline" className="text-[10px]">{stock.sector}</Badge>
              <Badge variant="outline" className={`text-[10px] ${SIGNAL_CONFIG[stock.combinedSignal].color}`}>
                {SIGNAL_CONFIG[stock.combinedSignal].label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold tabular-nums" data-testid="text-stock-price">{formatPrice(stock.price)}</div>
            <div className={`text-sm tabular-nums font-medium flex items-center justify-end gap-0.5 ${
              stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
            }`}>
              {stock.changePct >= 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {formatPrice(Math.abs(stock.change))} ({stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Price Chart */}
        <Card className="p-4 mb-4 border-card-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">Price Chart</span>
            <div className="flex gap-1">
              {[30, 60, 90, 180].map(d => (
                <Button
                  key={d}
                  variant={chartDays === d ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setChartDays(d)}
                  data-testid={`button-chart-${d}d`}
                >
                  {d}D
                </Button>
              ))}
            </div>
          </div>
          {histLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: textColor }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: textColor }}
                  tickFormatter={(v) => `₹${v}`}
                  width={60}
                />
                <RTooltip
                  contentStyle={{
                    backgroundColor: theme === "dark" ? "#1e293b" : "#fff",
                    border: `1px solid ${gridColor}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [formatPrice(val), "Close"]}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </Card>

        {/* Volume Chart */}
        <Card className="p-4 mb-4 border-card-border">
          <span className="text-xs font-medium text-muted-foreground mb-2 block">Volume</span>
          {history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={history.slice(-60)} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis hide />
                <RTooltip
                  contentStyle={{
                    backgroundColor: theme === "dark" ? "#1e293b" : "#fff",
                    border: `1px solid ${gridColor}`,
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(val: number) => [formatVolume(val), "Volume"]}
                />
                <Bar
                  dataKey="volume"
                  fill={theme === "dark" ? "hsl(226, 70%, 60%)" : "hsl(226, 70%, 55%)"}
                  fillOpacity={0.5}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Card>

        {/* ─── Score Overview Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 border-card-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Combined</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{stock.combinedScore}</div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${stock.combinedScore}%`, background: stock.combinedScore >= 70 ? '#10b981' : stock.combinedScore >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Technical</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{stock.swingScore}</div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${stock.swingScore}%`, background: stock.swingScore >= 70 ? '#10b981' : stock.swingScore >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Fundamental</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{stock.fundamentalScore}</div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${stock.fundamentalScore}%`, background: stock.fundamentalScore >= 70 ? '#10b981' : stock.fundamentalScore >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </Card>
          <Card className="p-3 border-card-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Newspaper className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Sentiment</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{stock.sentimentScore}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{stock.newsCount} news articles analyzed</div>
          </Card>
        </div>

        {/* Fundamental Signals */}
        {stock.fundamentalSignals && stock.fundamentalSignals.length > 0 && (
          <Card className="p-3 mb-4 border-card-border">
            <span className="text-xs font-medium block mb-2">Fundamental Signals</span>
            <div className="flex flex-wrap gap-1.5">
              {stock.fundamentalSignals.map(s => (
                <Badge key={s} variant="outline" className="text-[10px] bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400">{s}</Badge>
              ))}
            </div>
          </Card>
        )}

        <Tabs defaultValue="technical" className="mb-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="technical" className="text-xs" data-testid="tab-technical">Technical</TabsTrigger>
            <TabsTrigger value="fundamentals" className="text-xs" data-testid="tab-fundamentals">Fundamentals</TabsTrigger>
            <TabsTrigger value="swing" className="text-xs" data-testid="tab-swing">Swing Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="technical" className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IndicatorCard
                icon={<Gauge className="w-4 h-4" />}
                label="RSI (14)"
                value={stock.rsi14.toFixed(1)}
                subtitle={stock.rsi14 <= 30 ? "Oversold" : stock.rsi14 >= 70 ? "Overbought" : "Neutral"}
                color={stock.rsi14 <= 30 ? "text-emerald-600 dark:text-emerald-400" : stock.rsi14 >= 70 ? "text-red-500" : "text-foreground"}
              />
              <IndicatorCard
                icon={<Activity className="w-4 h-4" />}
                label="MACD"
                value={stock.macdLine.toFixed(2)}
                subtitle={`Signal: ${stock.macdSignal.toFixed(2)} | Hist: ${stock.macdHistogram > 0 ? "+" : ""}${stock.macdHistogram.toFixed(2)}`}
                color={stock.macdHistogram > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}
              />
              <IndicatorCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="ADX (14)"
                value={stock.adx14.toFixed(1)}
                subtitle={stock.adx14 >= 25 ? "Strong Trend" : "Weak Trend"}
                color={stock.adx14 >= 25 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}
              />
              <IndicatorCard
                icon={<Target className="w-4 h-4" />}
                label="ATR (14)"
                value={`₹${stock.atr14.toFixed(2)}`}
                subtitle={`${((stock.atr14 / stock.price) * 100).toFixed(2)}% of price`}
              />
              <IndicatorCard
                icon={<Waves className="w-4 h-4" />}
                label="Stochastic"
                value={`${stock.stochK.toFixed(1)} / ${stock.stochD.toFixed(1)}`}
                subtitle={stock.stochK < 20 ? "Oversold" : stock.stochK > 80 ? "Overbought" : "Neutral"}
                color={stock.stochK < 20 ? "text-emerald-600 dark:text-emerald-400" : stock.stochK > 80 ? "text-red-500" : "text-foreground"}
              />
              <IndicatorCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="VWAP"
                value={formatPrice(stock.vwap)}
                subtitle={stock.price > stock.vwap ? "Above VWAP" : "Below VWAP"}
                color={stock.price > stock.vwap ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}
              />
              <IndicatorCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="OBV"
                value={formatVolume(Math.abs(stock.obv))}
                subtitle={stock.obv > 0 ? "Accumulation" : "Distribution"}
                color={stock.obv > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}
              />
              <IndicatorCard
                icon={<Activity className="w-4 h-4" />}
                label="Bollinger Bands"
                value={formatPrice(stock.bollingerMiddle)}
                subtitle={`${formatPrice(stock.bollingerLower)} — ${formatPrice(stock.bollingerUpper)}`}
              />
            </div>

            {/* Moving Averages Table */}
            <Card className="mt-3 overflow-hidden border-card-border">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-xs font-medium">Moving Averages</span>
              </div>
              <div className="divide-y divide-border/50">
                {[
                  { label: "EMA 9", value: stock.ema9, above: stock.price > stock.ema9 },
                  { label: "EMA 21", value: stock.ema21, above: stock.price > stock.ema21 },
                  { label: "SMA 20", value: stock.sma20, above: stock.price > stock.sma20 },
                  { label: "SMA 50", value: stock.sma50, above: stock.price > stock.sma50 },
                  { label: "SMA 200", value: stock.sma200, above: stock.price > stock.sma200 },
                ].map(ma => (
                  <div key={ma.label} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">{ma.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums font-medium">{formatPrice(ma.value)}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                        ma.above
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      }`}>
                        {ma.above ? "Above" : "Below"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="fundamentals" className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DataCard label="Market Cap" value={formatMarketCap(stock.marketCap)} />
              <DataCard label="P/E Ratio" value={stock.pe ? stock.pe.toFixed(1) : "N/A"} />
              <DataCard label="EPS" value={stock.eps ? `₹${stock.eps.toFixed(2)}` : "N/A"} />
              <DataCard label="Day Range" value={`${formatPrice(stock.dayLow)} — ${formatPrice(stock.dayHigh)}`} />
              <DataCard label="52W Range" value={`${formatPrice(stock.low52w)} — ${formatPrice(stock.high52w)}`} />
              <DataCard label="52W Position" value={`${priceFrom52wLow.toFixed(1)}% from low`} />
              <DataCard label="Open" value={formatPrice(stock.open)} />
              <DataCard label="Prev Close" value={formatPrice(stock.prevClose)} />
              <DataCard label="Volume" value={formatVolume(stock.volume)} />
              <DataCard label="Avg Volume" value={formatVolume(stock.avgVolume)} />
              <DataCard label="Vol/Avg" value={`${(stock.volume / stock.avgVolume).toFixed(2)}x`} />
              <DataCard label="Sector" value={stock.sector} />
              <DataCard label="2-Day Change" value={`${stock.change2d >= 0 ? "+" : ""}${stock.change2d.toFixed(2)}%`} />
              <DataCard label="Fund. Score" value={`${stock.fundamentalScore}/100`} />
              <DataCard label="Sentiment" value={`${stock.sentimentScore}/100 (${stock.sentimentLabel.replace("_", " ")})`} />
            </div>
          </TabsContent>

          <TabsContent value="swing" className="mt-3">
            {/* Swing Score Gauge */}
            <Card className="p-4 mb-3 border-card-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Swing Trading Score</span>
                <Badge variant="outline" className={SIGNAL_CONFIG[stock.signal].color}>
                  {SIGNAL_CONFIG[stock.signal].label}
                </Badge>
              </div>
              <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${stock.swingScore}%`,
                    background: stock.swingScore >= 70
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : stock.swingScore >= 50
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>0 (Strong Sell)</span>
                <span className="font-semibold text-foreground text-xs">{stock.swingScore}/100</span>
                <span>100 (Strong Buy)</span>
              </div>
            </Card>

            {/* Detected Patterns */}
            <Card className="p-4 mb-3 border-card-border">
              <span className="text-sm font-medium block mb-2">Detected Patterns</span>
              {stock.patterns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stock.patterns.map(p => (
                    <Badge key={p} variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No notable patterns detected</p>
              )}
            </Card>

            {/* Swing Setup Summary */}
            <Card className="p-4 border-card-border">
              <span className="text-sm font-medium block mb-3">Swing Setup Summary</span>
              <div className="space-y-3">
                <SetupRow
                  label="Trend Direction"
                  value={stock.price > stock.sma50 ? "Bullish" : "Bearish"}
                  good={stock.price > stock.sma50}
                  detail={`Price ${stock.price > stock.sma50 ? "above" : "below"} SMA 50`}
                />
                <SetupRow
                  label="Momentum"
                  value={stock.macdHistogram > 0 ? "Positive" : "Negative"}
                  good={stock.macdHistogram > 0}
                  detail={`MACD Hist: ${stock.macdHistogram > 0 ? "+" : ""}${stock.macdHistogram.toFixed(2)}`}
                />
                <SetupRow
                  label="RSI Condition"
                  value={stock.rsi14 <= 30 ? "Oversold" : stock.rsi14 >= 70 ? "Overbought" : "Neutral"}
                  good={stock.rsi14 <= 40}
                  detail={`RSI(14): ${stock.rsi14.toFixed(1)}`}
                />
                <SetupRow
                  label="Trend Strength"
                  value={stock.adx14 >= 25 ? "Strong" : "Weak"}
                  good={stock.adx14 >= 25}
                  detail={`ADX: ${stock.adx14.toFixed(1)}`}
                />
                <SetupRow
                  label="Volume"
                  value={stock.volume > stock.avgVolume ? "Above Avg" : "Below Avg"}
                  good={stock.volume > stock.avgVolume}
                  detail={`${(stock.volume / stock.avgVolume).toFixed(1)}x average`}
                />
                <SetupRow
                  label="Volatility"
                  value={`ATR: ₹${stock.atr14.toFixed(2)}`}
                  good={true}
                  detail={`${((stock.atr14 / stock.price) * 100).toFixed(2)}% daily range`}
                />
                <SetupRow
                  label="Entry Zone"
                  value={stock.price <= stock.bollingerLower ? "Near BB Lower" : stock.price >= stock.bollingerUpper ? "Near BB Upper" : "Mid-Band"}
                  good={stock.price <= stock.bollingerMiddle}
                  detail={`BB: ${formatPrice(stock.bollingerLower)} — ${formatPrice(stock.bollingerUpper)}`}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <PerplexityAttribution className="mt-4 mb-4" />
      </main>
    </div>
  );
}

function IndicatorCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  color?: string;
}) {
  return (
    <Card className="p-3 border-card-border">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-base font-semibold tabular-nums ${color || "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>
    </Card>
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 border-card-border">
      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </Card>
  );
}

function SetupRow({ label, value, good, detail }: {
  label: string;
  value: string;
  good: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1 mr-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-2">{detail}</span>
      </div>
      <Badge variant="outline" className={`text-[10px] shrink-0 ${
        good
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-500 border-red-500/20"
      }`}>
        {value}
      </Badge>
    </div>
  );
}
