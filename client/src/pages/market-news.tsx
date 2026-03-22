import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Newspaper, Activity } from "lucide-react";
import type { Stock } from "@shared/schema";

interface MarketAlert {
  type: string;
  sector: string;
  title: string;
  description: string;
  impact: "positive" | "negative" | "warning" | "opportunity";
  timestamp: string;
  stock?: string;
}

const IMPACT_CONFIG: Record<string, { color: string; border: string; icon: any; badge: string }> = {
  positive: {
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-l-emerald-500",
    icon: TrendingUp,
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  negative: {
    color: "text-red-500",
    border: "border-l-red-500",
    icon: TrendingDown,
    badge: "bg-red-500/15 text-red-500 border-red-500/20",
  },
  warning: {
    color: "text-yellow-600 dark:text-yellow-400",
    border: "border-l-yellow-500",
    icon: AlertTriangle,
    badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  opportunity: {
    color: "text-blue-600 dark:text-blue-400",
    border: "border-l-blue-500",
    icon: Zap,
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
};

function computeAlerts(stocks: Stock[]): MarketAlert[] {
  if (stocks.length === 0) return [];
  const alerts: MarketAlert[] = [];
  const now = new Date().toISOString();

  // Sector analysis
  const sectorMoves = new Map<string, { totalChange: number; count: number; topMover: string; topChange: number }>();
  for (const s of stocks) {
    const entry = sectorMoves.get(s.sector) || { totalChange: 0, count: 0, topMover: "", topChange: 0 };
    entry.totalChange += s.changePct;
    entry.count++;
    if (Math.abs(s.changePct) > Math.abs(entry.topChange)) {
      entry.topMover = s.symbol;
      entry.topChange = s.changePct;
    }
    sectorMoves.set(s.sector, entry);
  }

  const sectors = Array.from(sectorMoves.entries())
    .map(([sector, data]) => ({ sector, avgChange: data.totalChange / data.count, topMover: data.topMover, topChange: data.topChange }))
    .sort((a, b) => b.avgChange - a.avgChange);

  // Top gaining sector
  if (sectors.length > 0 && sectors[0].avgChange > 0.5) {
    alerts.push({
      type: "sector_bullish", sector: sectors[0].sector,
      title: `${sectors[0].sector} sector leading gains`,
      description: `${sectors[0].sector} stocks up ${sectors[0].avgChange.toFixed(2)}% on average. ${sectors[0].topMover} leads with +${sectors[0].topChange.toFixed(2)}%`,
      impact: "positive", timestamp: now,
    });
  }

  // Top losing sector
  const last = sectors[sectors.length - 1];
  if (last && last.avgChange < -0.5) {
    alerts.push({
      type: "sector_bearish", sector: last.sector,
      title: `${last.sector} sector under pressure`,
      description: `${last.sector} stocks down ${Math.abs(last.avgChange).toFixed(2)}% on average. ${last.topMover} drops ${last.topChange.toFixed(2)}%`,
      impact: "negative", timestamp: now,
    });
  }

  // Volume spikes
  const highVol = stocks.filter(s => s.volume > s.avgVolume * 3 && s.avgVolume > 0)
    .sort((a, b) => (b.volume / b.avgVolume) - (a.volume / a.avgVolume))
    .slice(0, 3);
  for (const s of highVol) {
    const mult = (s.volume / s.avgVolume).toFixed(1);
    alerts.push({
      type: "volume_spike", sector: s.sector, stock: s.symbol,
      title: `${s.symbol}: Volume spike ${mult}x average`,
      description: `${s.symbol} (${s.sector}) trading at ${mult}x normal volume. Price ${s.changePct >= 0 ? "up" : "down"} ${Math.abs(s.changePct).toFixed(2)}%. Signal: ${(s.signal || "neutral").replace("_", " ")}`,
      impact: s.changePct >= 0 ? "positive" : "negative", timestamp: now,
    });
  }

  // RSI extremes
  const overbought = stocks.filter(s => s.rsi14 >= 75).sort((a, b) => b.rsi14 - a.rsi14).slice(0, 2);
  for (const s of overbought) {
    alerts.push({
      type: "overbought", sector: s.sector, stock: s.symbol,
      title: `${s.symbol}: RSI overbought at ${s.rsi14.toFixed(0)}`,
      description: `${s.symbol} (${s.sector}) RSI at ${s.rsi14.toFixed(1)} — may be overextended. Price: ₹${s.price.toFixed(2)}`,
      impact: "warning", timestamp: now,
    });
  }

  const oversold = stocks.filter(s => s.rsi14 <= 25).sort((a, b) => a.rsi14 - b.rsi14).slice(0, 2);
  for (const s of oversold) {
    alerts.push({
      type: "oversold", sector: s.sector, stock: s.symbol,
      title: `${s.symbol}: RSI oversold at ${s.rsi14.toFixed(0)}`,
      description: `${s.symbol} (${s.sector}) RSI at ${s.rsi14.toFixed(1)} — potential bounce candidate. Price: ₹${s.price.toFixed(2)}`,
      impact: "opportunity", timestamp: now,
    });
  }

  // Top gainer/loser
  const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
  if (sorted[0] && sorted[0].changePct > 3) {
    alerts.push({
      type: "top_gainer", sector: sorted[0].sector, stock: sorted[0].symbol,
      title: `${sorted[0].symbol}: Top gainer +${sorted[0].changePct.toFixed(2)}%`,
      description: `${sorted[0].symbol} (${sorted[0].sector}) surging +${sorted[0].changePct.toFixed(2)}%. Combined score: ${sorted[0].combinedScore.toFixed(0)}`,
      impact: "positive", timestamp: now,
    });
  }
  const bottom = sorted[sorted.length - 1];
  if (bottom && bottom.changePct < -3) {
    alerts.push({
      type: "top_loser", sector: bottom.sector, stock: bottom.symbol,
      title: `${bottom.symbol}: Top loser ${bottom.changePct.toFixed(2)}%`,
      description: `${bottom.symbol} (${bottom.sector}) falling ${bottom.changePct.toFixed(2)}%. Combined score: ${bottom.combinedScore.toFixed(0)}`,
      impact: "negative", timestamp: now,
    });
  }

  return alerts;
}

export default function MarketNews() {
  const { data: stocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: 10 * 60 * 1000,
  });

  const alerts = useMemo(() => computeAlerts(stocks || []), [stocks]);

  if (isLoading || !stocks) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Newspaper className="w-8 h-8 mx-auto mb-3 text-blue-400 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading market alerts...</p>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Newspaper className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No significant market alerts right now.</p>
      </Card>
    );
  }

  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 border-card-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-bold">Market Alerts</h2>
              <p className="text-xs text-muted-foreground">
                Real-time alerts based on stock data: sector moves, volume spikes, RSI extremes, and top movers. Updates every 30s.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {alerts.map((alert, i) => {
        const cfg = IMPACT_CONFIG[alert.impact] || IMPACT_CONFIG.positive;
        const Icon = cfg.icon;

        return (
          <Card key={`${alert.type}-${alert.stock || alert.sector}-${i}`} className={`p-4 border-card-border border-l-4 ${cfg.border}`}>
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm">{alert.title}</h3>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeStr}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{alert.sector}</Badge>
                  <Badge variant="outline" className={`text-[10px] capitalize ${cfg.badge}`}>{alert.impact}</Badge>
                  {alert.stock && (
                    <a href={`#/stock/${alert.stock}`}>
                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted">{alert.stock}</Badge>
                    </a>
                  )}
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{alert.type.replace("_", " ")}</Badge>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
