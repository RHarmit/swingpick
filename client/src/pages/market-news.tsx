import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Newspaper } from "lucide-react";

interface MarketAlert {
  type: string;
  sector: string;
  title: string;
  description: string;
  impact: "positive" | "negative" | "warning" | "opportunity";
  timestamp: string;
  stock?: string;
}

const IMPACT_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string; badge: string }> = {
  positive: {
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  negative: {
    icon: TrendingDown,
    color: "text-red-500",
    bg: "bg-red-500/5 border-red-500/20",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/5 border-yellow-500/20",
    badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  opportunity: {
    icon: Zap,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/5 border-blue-500/20",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function MarketNews() {
  const { data: alerts, isLoading } = useQuery<MarketAlert[]>({
    queryKey: ["/api/market-news"],
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading || !alerts) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Newspaper className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading market alerts...</p>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="p-8 text-center border-card-border">
        <Newspaper className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No market alerts at the moment</p>
        <p className="text-[10px] text-muted-foreground mt-1">Alerts appear when significant market moves are detected</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Live indicator */}
      <Card className="p-4 border-card-border">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-sm">Market Alerts</h2>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Real-time alerts based on stock data: sector moves, volume spikes, RSI extremes, and top movers. Updates every 30s.
        </p>
      </Card>

      {/* Alert Cards */}
      <div className="space-y-3">
        {alerts.map((alert, i) => {
          const config = IMPACT_CONFIG[alert.impact] || IMPACT_CONFIG.warning;
          const Icon = config.icon;

          return (
            <Card key={`${alert.type}-${alert.sector}-${i}`} className={`p-4 border ${config.bg} transition-colors`}>
              <div className="flex gap-3">
                {/* Icon */}
                <div className={`shrink-0 mt-0.5 ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold leading-tight">{alert.title}</h3>
                    <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{alert.sector}</Badge>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 capitalize ${config.badge}`}>
                      {alert.impact}
                    </Badge>
                    {alert.stock && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                        {alert.stock}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                      {alert.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="p-4 border-card-border bg-muted/30">
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Alert Types</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Positive — Bullish signals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <span>Negative — Bearish signals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span>Warning — Overbought/risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span>Opportunity — Oversold/bounce</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
