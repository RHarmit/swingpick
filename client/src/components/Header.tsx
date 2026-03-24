import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Sun, Moon, TrendingUp, Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Get status for loaded stock count
  const { data: status } = useQuery<{ loaded: number; total: number; loading: boolean }>({
    queryKey: ["/api/status"],
    staleTime: 60 * 1000,
  });

  // IST time for Indian market hours
  const istTime = new Date(time.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hours = istTime.getHours();
  const mins = istTime.getMinutes();
  const isMarketHours = hours >= 9 && (hours < 15 || (hours === 15 && mins <= 30));
  const isPreMarket = hours >= 9 && hours < 9 || (hours === 9 && mins < 15);
  const marketLabel = isMarketHours ? "Market Open" : "Market Closed";

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

          <div className="flex items-center gap-3">
            {/* Stock count */}
            {status && status.loaded > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 rounded-md bg-muted/50">
                <Activity className="w-3 h-3" />
                <span className="tabular-nums">{status.loaded}</span>
                <span>stocks</span>
              </div>
            )}

            {/* Market status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`inline-block w-2 h-2 rounded-full ${
                isMarketHours ? "bg-green-500 animate-pulse" : "bg-amber-500/60"
              }`} />
              <span>{marketLabel}</span>
            </div>

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
