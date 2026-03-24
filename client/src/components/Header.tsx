import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Sun, Moon, TrendingUp, Activity, Clock, RefreshCw } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [istNow, setIstNow] = useState(() => getIST());

  useEffect(() => {
    const timer = setInterval(() => setIstNow(getIST()), 10000); // update every 10s
    return () => clearInterval(timer);
  }, []);

  // Get status for loaded stock count
  const { data: status } = useQuery<{ loaded: number; total: number; loading: boolean }>({
    queryKey: ["/api/status"],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const isWeekend = istNow.day === 0 || istNow.day === 6;
  const totalMins = istNow.hours * 60 + istNow.mins;
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM

  let marketStatus: "open" | "pre" | "closed";
  if (isWeekend) {
    marketStatus = "closed";
  } else if (totalMins >= marketOpen && totalMins <= marketClose) {
    marketStatus = "open";
  } else if (totalMins >= marketOpen - 15 && totalMins < marketOpen) {
    marketStatus = "pre";
  } else {
    marketStatus = "closed";
  }

  const marketLabel = marketStatus === "open" ? "Market Open" : marketStatus === "pre" ? "Pre-Market" : "Market Closed";
  const marketDotColor = marketStatus === "open" ? "bg-green-500 animate-pulse" : marketStatus === "pre" ? "bg-amber-500 animate-pulse" : "bg-red-500/50";

  // Time until close (if open)
  const minsToClose = marketStatus === "open" ? marketClose - totalMins : 0;
  const hoursToClose = Math.floor(minsToClose / 60);
  const minsRemaining = minsToClose % 60;

  const handleRefresh = () => {
    // Invalidate all queries to force a refetch
    queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/breakout-radar"] });
    queryClient.invalidateQueries({ queryKey: ["/api/top-stocks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sector-performance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/status"] });
  };

  return (
    <>
      {/* Thin animated gradient bar at very top */}
      <div className="animated-gradient h-[2px] w-full" />

      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group" data-testid="logo-link">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-semibold text-sm tracking-tight">SwingPick</span>
                <span className="text-[10px] text-muted-foreground tracking-wide uppercase">NSE / BSE</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            {/* IST Clock + Date */}
            <Tooltip>
              <TooltipTrigger>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 rounded-md bg-muted/50">
                  <Clock className="w-3 h-3 shrink-0" />
                  <div className="flex flex-col leading-tight items-end">
                    <span className="tabular-nums font-medium text-foreground/80">
                      {istNow.timeStr}
                    </span>
                    <span className="text-[9px]">{istNow.dateStr} IST</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <div>India Standard Time (UTC+5:30)</div>
                <div className="text-muted-foreground">{istNow.fullDateStr}</div>
                {marketStatus === "open" && (
                  <div className="text-emerald-500 mt-1">Market closes in {hoursToClose}h {minsRemaining}m</div>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Stock count */}
            {status && status.loaded > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 rounded-md bg-muted/50">
                <Activity className="w-3 h-3" />
                <span className="tabular-nums">{status.loaded}</span>
                <span>stocks</span>
              </div>
            )}

            {/* Market status */}
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`inline-block w-2 h-2 rounded-full ${marketDotColor}`} />
                  <span className="hidden sm:inline">{marketLabel}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <div>{marketLabel}</div>
                <div className="text-muted-foreground">NSE: 9:15 AM - 3:30 PM IST</div>
                {marketStatus === "open" && (
                  <div className="text-emerald-500">Closes in {hoursToClose}h {minsRemaining}m</div>
                )}
                {marketStatus === "closed" && !isWeekend && (
                  <div className="text-muted-foreground">Prices reflect last trading session</div>
                )}
                {isWeekend && (
                  <div className="text-muted-foreground">Weekend — market reopens Monday 9:15 AM IST</div>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Refresh button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  className="h-7 w-7"
                  data-testid="button-header-refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${status?.loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Refresh all data</TooltipContent>
            </Tooltip>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 transition-transform hover:scale-105"
              data-testid="theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}

// Helper: compute IST time info
function getIST() {
  const now = new Date();
  
  // Use Intl to extract IST components reliably
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric", minute: "numeric", second: "numeric",
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map(p => [p.type, p.value])
  );
  
  const hours = parseInt(parts.hour || "0");
  const mins = parseInt(parts.minute || "0");
  const dayNames: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayNames[parts.weekday || "Mon"] ?? 1;

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  const fullDateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return { hours, mins, day, timeStr, dateStr, fullDateStr };
}
