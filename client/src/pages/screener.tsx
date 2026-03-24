import { useState, useMemo, useCallback, useTransition, memo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Activity, BarChart3, Search, SlidersHorizontal, RefreshCw,
  Star, Brain, Newspaper, Zap, Crown, ChevronLeft, Grid3X3, Target, DollarSign, Crosshair
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { queryClient } from "@/lib/queryClient";
import type { Stock, SectorPerformance } from "@shared/schema";
import Heatmap from "@/pages/heatmap";
import MomentumPicks from "@/pages/momentum-picks";
import HedgePicks from "@/pages/hedge-picks";
import MarketSentiment from "@/pages/market-sentiment";
import MarketNews from "@/pages/market-news";
import ExplosivePicks from "@/pages/explosive-picks";
import BreakoutRadar from "@/pages/breakout-radar";

type SortField = "combinedScore" | "swingScore" | "fundamentalScore" | "sentimentScore" | "changePct" | "rsi14" | "volume" | "price" | "marketCap" | "adx14" | "atr14" | "change2d" | "mfi14" | "mfiChange";
type SortOrder = "asc" | "desc";

const SIGNAL_CONFIG: Record<string, { label: string; color: string }> = {
  strong_buy: { label: "Strong Buy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  buy: { label: "Buy", color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" },
  neutral: { label: "Neutral", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  sell: { label: "Sell", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  strong_sell: { label: "Strong Sell", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
};

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  very_positive: { label: "Very Positive", color: "text-emerald-600 dark:text-emerald-400", icon: "🟢" },
  positive: { label: "Positive", color: "text-green-600 dark:text-green-400", icon: "🟢" },
  neutral: { label: "Neutral", color: "text-yellow-600 dark:text-yellow-400", icon: "🟡" },
  negative: { label: "Negative", color: "text-orange-600 dark:text-orange-400", icon: "🔴" },
  very_negative: { label: "Very Negative", color: "text-red-600 dark:text-red-400", icon: "🔴" },
};

const PAGE_SIZE = 50;

function formatMarketCap(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L Cr`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
  return `₹${n} Cr`;
}

function formatVolume(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatPrice(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Debounce hook for sliders ───
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Hedge fund entry/exit computation using technicals
function computeEntryExit(stock: Stock): { entry: number; target: number; stopLoss: number } {
  const price = stock.price;
  const atr = stock.atr14 || 0;

  // ENTRY: Best support level
  // Priority: Bollinger Lower > SMA support > VWAP > current price - 1 ATR
  let entry = price;
  const supports = [
    stock.bollingerLower,
    stock.sma20 < price ? stock.sma20 : 0,
    stock.sma50 < price ? stock.sma50 : 0,
    stock.vwap < price ? stock.vwap : 0,
  ].filter(v => v > 0 && v < price);

  if (supports.length > 0) {
    // Nearest support below current price
    entry = Math.max(...supports);
  } else {
    // No support below — use price minus 1 ATR
    entry = Math.max(price - atr, price * 0.97);
  }

  // TARGET: Best resistance level
  // Bollinger Upper or 2x ATR above current price
  let target = stock.bollingerUpper || price + 2 * atr;
  if (target <= price) target = price + 2 * atr;
  // Also consider 52-week high as ceiling
  if (stock.high52w > 0 && stock.high52w < target) {
    target = Math.min(target, stock.high52w);
  }
  // Minimum 3% target
  if (target < price * 1.03) target = price * 1.03;

  // STOP LOSS: 1.5x ATR below entry
  let stopLoss = entry - 1.5 * atr;
  if (stopLoss <= 0 || stopLoss >= entry) stopLoss = entry * 0.95; // fallback 5% below

  return {
    entry: Math.round(entry * 100) / 100,
    target: Math.round(target * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
  };
}

export default function Screener() {
  const [activeTab, setActiveTab] = useState<"screener" | "heatmap" | "momentum" | "hedge" | "sentiment" | "news" | "explosive" | "breakout">("screener");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("combinedScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);

  // Filter states - "live" values update immediately for UI display
  const [rsiRange, setRsiRange] = useState<[number, number]>([0, 100]);
  const [macdCross, setMacdCross] = useState<string>("any");
  const [aboveSma20, setAboveSma20] = useState(false);
  const [aboveSma50, setAboveSma50] = useState(false);
  const [aboveSma200, setAboveSma200] = useState(false);
  const [volumeMin, setVolumeMin] = useState<number>(0);
  const [adxMin, setAdxMin] = useState<number>(0);
  const [minSwingScore, setMinSwingScore] = useState<number>(0);
  const [minCombinedScore, setMinCombinedScore] = useState<number>(0);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [mfiRange, setMfiRange] = useState<[number, number]>([0, 100]);
  const [buyingPressureFilter, setBuyingPressureFilter] = useState<string>("any");

  // Debounced values for filtering — sliders won't re-filter on every pixel drag
  const dRsiRange = useDebouncedValue(rsiRange, 200);
  const dVolumeMin = useDebouncedValue(volumeMin, 200);
  const dAdxMin = useDebouncedValue(adxMin, 200);
  const dMinSwingScore = useDebouncedValue(minSwingScore, 200);
  const dMinCombinedScore = useDebouncedValue(minCombinedScore, 200);
  const dMfiRange = useDebouncedValue(mfiRange, 200);
  const dSearch = useDebouncedValue(search, 150);
  const dPriceMin = useDebouncedValue(priceMin, 300);
  const dPriceMax = useDebouncedValue(priceMax, 300);

  // Track if backend returned empty (0 stocks = backend waking up, not a filter issue)
  const [backendWaking, setBackendWaking] = useState(false);
  const wakeAttemptRef = useRef(0);
  const wakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track backend loading state from /api/status
  const [serverStillLoading, setServerStillLoading] = useState(false);

  const { data: stocks, isLoading, isFetching, refetch: refetchStocks } = useQuery<Stock[]>({
    queryKey: ["/api/stocks"],
    staleTime: serverStillLoading ? 0 : 10 * 60 * 1000, // No stale time while server is loading
    refetchInterval: serverStillLoading ? 8_000 : 10 * 60 * 1000, // Refresh every 8s while loading
    retry: 2,
    retryDelay: 5000,
  });

  // Auto-wake + progressive loading: poll status, refetch stocks as they arrive
  useEffect(() => {
    if (isLoading) return;
    const RENDER_URL = "https://swingpick.onrender.com";
    const base = window.location.hostname === "localhost" ? "" : RENDER_URL;

    if (stocks && stocks.length === 0 && !backendWaking) {
      setBackendWaking(true);
      wakeAttemptRef.current = 0;
      fetch(`${base}/api/wake`).catch(() => {});

      const timer = setInterval(async () => {
        wakeAttemptRef.current++;
        try {
          const res = await fetch(`${base}/api/status`);
          const status = await res.json();
          if (status.loaded > 0) {
            clearInterval(timer);
            wakeTimerRef.current = null;
            setBackendWaking(false);
            setServerStillLoading(status.loading); // Keep fast-refresh if still loading
            wakeAttemptRef.current = 0;
            refetchStocks();
          } else if (wakeAttemptRef.current % 3 === 0) {
            fetch(`${base}/api/wake`).catch(() => {});
          }
        } catch {}
        if (wakeAttemptRef.current > 30) {
          clearInterval(timer);
          wakeTimerRef.current = null;
          setBackendWaking(false);
        }
      }, 8_000);
      wakeTimerRef.current = timer;
    } else if (stocks && stocks.length > 0 && backendWaking) {
      if (wakeTimerRef.current) { clearInterval(wakeTimerRef.current); wakeTimerRef.current = null; }
      setBackendWaking(false);
      wakeAttemptRef.current = 0;
    }

    return () => {
      if (wakeTimerRef.current) { clearInterval(wakeTimerRef.current); wakeTimerRef.current = null; }
    };
  }, [stocks, isLoading, backendWaking, refetchStocks]);

  // Track server loading state — keep fast refresh until server finishes
  useEffect(() => {
    if (!serverStillLoading) return;
    const RENDER_URL = "https://swingpick.onrender.com";
    const base = window.location.hostname === "localhost" ? "" : RENDER_URL;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${base}/api/status`);
        const status = await res.json();
        if (!status.loading) {
          setServerStillLoading(false);
          clearInterval(timer);
          refetchStocks(); // Final refetch with all data
        }
      } catch {}
    }, 10_000);

    return () => clearInterval(timer);
  }, [serverStillLoading, refetchStocks]);
  const { data: sectors } = useQuery<string[]>({
    queryKey: ["/api/sectors"],
    staleTime: 60 * 60 * 1000,
  });
  const { data: sectorPerformance } = useQuery<SectorPerformance[]>({
    queryKey: ["/api/sector-performance"],
    staleTime: 10 * 60 * 1000,
  });
  const { data: topStocks } = useQuery<Stock[]>({
    queryKey: ["/api/top-stocks"],
    staleTime: 10 * 60 * 1000,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sector-performance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/top-stocks"] });
  }, []);

  const hasActiveFilters = rsiRange[0] > 0 || rsiRange[1] < 100 || macdCross !== "any" ||
    aboveSma20 || aboveSma50 || aboveSma200 || volumeMin > 0 || adxMin > 0 ||
    minSwingScore > 0 || minCombinedScore > 0 || selectedSectors.length > 0 || priceMin || priceMax ||
    mfiRange[0] > 0 || mfiRange[1] < 100 || buyingPressureFilter !== "any";

  // Filter+sort using DEBOUNCED values — won't stutter during slider drags
  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let result = stocks;

    // Search
    if (dSearch) {
      const q = dSearch.toLowerCase();
      result = result.filter(s =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }

    // Filters (use debounced values for sliders/inputs)
    if (dRsiRange[0] > 0 || dRsiRange[1] < 100) {
      result = result.filter(s => s.rsi14 >= dRsiRange[0] && s.rsi14 <= dRsiRange[1]);
    }
    if (macdCross === "bullish") result = result.filter(s => s.macdHistogram > 0);
    if (macdCross === "bearish") result = result.filter(s => s.macdHistogram < 0);
    if (aboveSma20) result = result.filter(s => s.price > s.sma20);
    if (aboveSma50) result = result.filter(s => s.price > s.sma50);
    if (aboveSma200) result = result.filter(s => s.price > s.sma200);
    if (dVolumeMin > 0) result = result.filter(s => s.volume / s.avgVolume >= dVolumeMin);
    if (dAdxMin > 0) result = result.filter(s => s.adx14 >= dAdxMin);
    if (dMinSwingScore > 0) result = result.filter(s => s.swingScore >= dMinSwingScore);
    if (dMinCombinedScore > 0) result = result.filter(s => s.combinedScore >= dMinCombinedScore);
    if (selectedSectors.length > 0) result = result.filter(s => selectedSectors.includes(s.sector));
    if (dPriceMin) result = result.filter(s => s.price >= Number(dPriceMin));
    if (dPriceMax) result = result.filter(s => s.price <= Number(dPriceMax));
    if (dMfiRange[0] > 0 || dMfiRange[1] < 100) {
      result = result.filter(s => (s.mfi14 ?? 50) >= dMfiRange[0] && (s.mfi14 ?? 50) <= dMfiRange[1]);
    }
    if (buyingPressureFilter !== "any") {
      result = result.filter(s => (s.buyingPressure ?? "neutral") === buyingPressureFilter);
    }

    // Sort (copy only when sorting)
    const sorted = [...result];
    sorted.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortOrder === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

    return sorted;
  }, [stocks, dSearch, dRsiRange, macdCross, aboveSma20, aboveSma50, aboveSma200,
    dVolumeMin, dAdxMin, dMinSwingScore, dMinCombinedScore, selectedSectors, dPriceMin, dPriceMax, dMfiRange, buyingPressureFilter, sortBy, sortOrder]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [dSearch, dRsiRange, macdCross, aboveSma20, aboveSma50, aboveSma200,
    dVolumeMin, dAdxMin, dMinSwingScore, dMinCombinedScore, selectedSectors, dPriceMin, dPriceMax, dMfiRange, buyingPressureFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredStocks.length / PAGE_SIZE);
  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStocks.slice(start, start + PAGE_SIZE);
  }, [filteredStocks, page]);

  const resetFilters = useCallback(() => {
    setRsiRange([0, 100]);
    setMacdCross("any");
    setAboveSma20(false);
    setAboveSma50(false);
    setAboveSma200(false);
    setVolumeMin(0);
    setAdxMin(0);
    setMinSwingScore(0);
    setMinCombinedScore(0);
    setSelectedSectors([]);
    setPriceMin("");
    setPriceMax("");
    setMfiRange([0, 100]);
    setBuyingPressureFilter("any");
    setPage(1);
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortOrder(o => o === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  }, [sortBy]);

  const toggleSector = useCallback((sector: string) => {
    setSelectedSectors(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    );
  }, []);

  // Summary stats
  const bullishCount = filteredStocks.filter(s => s.combinedSignal === "strong_buy" || s.combinedSignal === "buy").length;
  const bearishCount = filteredStocks.filter(s => s.combinedSignal === "sell" || s.combinedSignal === "strong_sell").length;
  const avgCombinedScore = filteredStocks.length > 0
    ? Math.round(filteredStocks.reduce((a, s) => a + s.combinedScore, 0) / filteredStocks.length)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 px-3 md:px-6 py-4 max-w-[1440px] mx-auto w-full">

        {/* ─── Tab Navigation ─── */}
        <div className="flex items-center gap-1 mb-4 border-b border-border pb-1 overflow-x-auto">
          <Button
            variant={activeTab === "screener" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("screener")}
          >
            <Activity className="w-3.5 h-3.5" />
            Screener
          </Button>
          <Button
            variant={activeTab === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("heatmap")}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Heatmap
          </Button>
          <Button
            variant={activeTab === "momentum" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("momentum")}
          >
            <Target className="w-3.5 h-3.5" />
            Momentum Picks
          </Button>
          <Button
            variant={activeTab === "hedge" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("hedge")}
          >
            <Crown className="w-3.5 h-3.5" />
            HF Picks
          </Button>
          <Button
            variant={activeTab === "sentiment" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("sentiment")}
          >
            <Brain className="w-3.5 h-3.5" />
            Sentiment
          </Button>
          <Button
            variant={activeTab === "news" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("news")}
          >
            <Newspaper className="w-3.5 h-3.5" />
            News
          </Button>
          <Button
            variant={activeTab === "breakout" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0 relative"
            onClick={() => setActiveTab("breakout")}
          >
            <Crosshair className="w-3.5 h-3.5" />
            Breakout Radar
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
          </Button>
          <Button
            variant={activeTab === "explosive" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs h-8 shrink-0"
            onClick={() => setActiveTab("explosive")}
          >
            <Zap className="w-3.5 h-3.5" />
            Explosive
          </Button>
        </div>

        {/* Heatmap Tab */}
        {activeTab === "heatmap" && (
          <>
            <Heatmap />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {/* Momentum Picks Tab */}
        {activeTab === "momentum" && (
          <>
            <MomentumPicks />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {activeTab === "hedge" && (
          <>
            <HedgePicks />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {activeTab === "sentiment" && (
          <>
            <MarketSentiment />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {activeTab === "news" && (
          <>
            <MarketNews />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {activeTab === "breakout" && (
          <>
            <BreakoutRadar />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {activeTab === "explosive" && (
          <>
            <ExplosivePicks />
            <PerplexityAttribution className="mt-6 mb-4" />
          </>
        )}

        {/* Screener Tab */}
        {activeTab === "screener" && (<>

        {/* ─── Top Stocks Bar ─── */}
        {topStocks && topStocks.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Picks by Combined Score</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {topStocks.slice(0, 10).map((stock, i) => (
                <Link key={stock.symbol} href={`/stock/${stock.symbol}`}>
                  <Card
                    className="p-2.5 min-w-[160px] border-card-border hover:bg-muted/40 transition-all cursor-pointer shrink-0 card-hover-lift"
                    data-testid={`card-top-stock-${stock.symbol}`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">#{i + 1}</span>
                        <span className="text-xs font-semibold">{stock.symbol}</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${SIGNAL_CONFIG[stock.combinedSignal]?.color || ""}`}>
                        {SIGNAL_CONFIG[stock.combinedSignal]?.label || "N/A"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-1.5">{stock.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium tabular-nums">{formatPrice(stock.price)}</span>
                      <span className={`text-[10px] font-semibold tabular-nums ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
                      <ScorePill label="C" value={stock.combinedScore} />
                      <ScorePill label="T" value={stock.swingScore} />
                      <ScorePill label="F" value={stock.fundamentalScore} />
                      <ScorePill label="S" value={stock.sentimentScore} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ─── Sector Performance (2-Day) ─── */}
        {sectorPerformance && sectorPerformance.length > 0 && (
          <SectorPerformanceBar sectors={sectorPerformance} onSectorClick={(s) => {
            setSelectedSectors([s]);
            setShowFilters(false);
          }} />
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 border-card-border card-hover-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-primary" />
              <span className="text-xs text-muted-foreground">Stocks Screened</span>
            </div>
            <div className="text-xl font-semibold tabular-nums" data-testid="text-total-count">{filteredStocks.length}</div>
          </Card>
          <Card className="p-3 border-card-border card-hover-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Bullish (Combined)</span>
            </div>
            <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400" data-testid="text-bullish-count">
              {bullishCount}
            </div>
          </Card>
          <Card className="p-3 border-card-border card-hover-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span className="text-xs text-muted-foreground">Bearish (Combined)</span>
            </div>
            <div className="text-xl font-semibold tabular-nums text-red-500" data-testid="text-bearish-count">
              {bearishCount}
            </div>
          </Card>
          <Card className="p-3 border-card-border card-hover-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-muted-foreground">Avg Combined Score</span>
            </div>
            <div className="text-xl font-semibold tabular-nums" data-testid="text-avg-score">{avgCombinedScore}</div>
          </Card>
        </div>

        {/* Data status bar */}
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <span>Real-time data from NSE via Yahoo Finance</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1 text-xs"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Updating..." : "Refresh"}
          </Button>
        </div>

        {/* Search + Filter Toggle */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stock or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9"
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Parameters</span>
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                !
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 h-9 text-xs" data-testid="button-reset-filters">
              <X className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 mb-4 border-card-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* RSI Range */}
              <div>
                <Label className="text-xs font-medium mb-2 block">RSI (14) Range</Label>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground w-8">{rsiRange[0]}</span>
                  <Slider
                    value={rsiRange}
                    onValueChange={(v) => setRsiRange(v as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                    data-testid="slider-rsi"
                  />
                  <span className="text-xs tabular-nums text-muted-foreground w-8">{rsiRange[1]}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setRsiRange([20, 40])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    Oversold
                  </button>
                  <button onClick={() => setRsiRange([40, 60])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    Neutral
                  </button>
                  <button onClick={() => setRsiRange([60, 80])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    Overbought
                  </button>
                </div>
              </div>

              {/* MACD Cross */}
              <div>
                <Label className="text-xs font-medium mb-2 block">MACD Signal</Label>
                <Select value={macdCross} onValueChange={setMacdCross}>
                  <SelectTrigger className="h-9" data-testid="select-macd">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="bullish">Bullish (MACD &gt; Signal)</SelectItem>
                    <SelectItem value="bearish">Bearish (MACD &lt; Signal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Moving Averages */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Moving Averages</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={aboveSma20} onCheckedChange={setAboveSma20} id="sma20" data-testid="switch-sma20" />
                    <Label htmlFor="sma20" className="text-xs">Above SMA 20</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={aboveSma50} onCheckedChange={setAboveSma50} id="sma50" data-testid="switch-sma50" />
                    <Label htmlFor="sma50" className="text-xs">Above SMA 50</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={aboveSma200} onCheckedChange={setAboveSma200} id="sma200" data-testid="switch-sma200" />
                    <Label htmlFor="sma200" className="text-xs">Above SMA 200</Label>
                  </div>
                </div>
              </div>

              {/* Volume Filter */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Volume vs Avg ({volumeMin > 0 ? `≥${volumeMin}x` : "Any"})</Label>
                <Slider
                  value={[volumeMin]}
                  onValueChange={(v) => setVolumeMin(v[0])}
                  min={0}
                  max={3}
                  step={0.5}
                  className="mt-2"
                  data-testid="slider-volume"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Any</span>
                  <span>1.5x</span>
                  <span>3x</span>
                </div>
              </div>

              {/* ADX Filter */}
              <div>
                <Label className="text-xs font-medium mb-2 block">ADX Trend Strength ({adxMin > 0 ? `≥${adxMin}` : "Any"})</Label>
                <Slider
                  value={[adxMin]}
                  onValueChange={(v) => setAdxMin(v[0])}
                  min={0}
                  max={60}
                  step={5}
                  className="mt-2"
                  data-testid="slider-adx"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Any</span>
                  <span>25 (Trending)</span>
                  <span>60</span>
                </div>
              </div>

              {/* Min Swing Score */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Min Technical Score ({minSwingScore > 0 ? `≥${minSwingScore}` : "Any"})</Label>
                <Slider
                  value={[minSwingScore]}
                  onValueChange={(v) => setMinSwingScore(v[0])}
                  min={0}
                  max={90}
                  step={5}
                  className="mt-2"
                  data-testid="slider-swing-score"
                />
              </div>

              {/* Min Combined Score */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Min Combined Score ({minCombinedScore > 0 ? `≥${minCombinedScore}` : "Any"})</Label>
                <Slider
                  value={[minCombinedScore]}
                  onValueChange={(v) => setMinCombinedScore(v[0])}
                  min={0}
                  max={90}
                  step={5}
                  className="mt-2"
                  data-testid="slider-combined-score"
                />
              </div>

              {/* Price Range */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Price Range (₹)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Min"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="h-9 text-xs"
                    type="number"
                    data-testid="input-price-min"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    placeholder="Max"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="h-9 text-xs"
                    type="number"
                    data-testid="input-price-max"
                  />
                </div>
              </div>

              {/* MFI (Buying Pressure) Range */}
              <div>
                <Label className="text-xs font-medium mb-2 block">MFI Buying Pressure ({mfiRange[0]}-{mfiRange[1]})</Label>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground w-8">{mfiRange[0]}</span>
                  <Slider
                    value={mfiRange}
                    onValueChange={(v) => setMfiRange(v as [number, number])}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs tabular-nums text-muted-foreground w-8">{mfiRange[1]}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setMfiRange([0, 20])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    Oversold
                  </button>
                  <button onClick={() => setMfiRange([60, 100])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    Buying
                  </button>
                  <button onClick={() => setMfiRange([80, 100])} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground">
                    High Buying
                  </button>
                </div>
              </div>

              {/* Buying Pressure Filter */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Buying Pressure Signal</Label>
                <Select value={buyingPressureFilter} onValueChange={setBuyingPressureFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="high_buying">High Buying (MFI &gt; 80)</SelectItem>
                    <SelectItem value="buying">Buying (MFI 60-80)</SelectItem>
                    <SelectItem value="neutral">Neutral (MFI 40-60)</SelectItem>
                    <SelectItem value="selling">Selling (MFI 20-40)</SelectItem>
                    <SelectItem value="high_selling">High Selling (MFI &lt; 20)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sector Filter */}
              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-medium mb-2 block">Sectors</Label>
                <div className="flex flex-wrap gap-1">
                  {sectors?.map(sector => (
                    <button
                      key={sector}
                      onClick={() => toggleSector(sector)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        selectedSectors.includes(sector)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
                      }`}
                      data-testid={`button-sector-${sector}`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preset Strategies */}
            <div className="mt-4 pt-3 border-t border-border">
              <Label className="text-xs font-medium mb-2 block text-muted-foreground">Quick Strategies</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7" data-testid="button-preset-oversold"
                  onClick={() => { setRsiRange([20, 35]); setMacdCross("bullish"); setMinCombinedScore(60); setVolumeMin(1.5); }}>
                  <TrendingUp className="w-3 h-3 mr-1" /> Oversold Bounce
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" data-testid="button-preset-momentum"
                  onClick={() => { setAboveSma20(true); setAboveSma50(true); setAdxMin(25); setMinCombinedScore(55); }}>
                  <Activity className="w-3 h-3 mr-1" /> Momentum
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" data-testid="button-preset-volume"
                  onClick={() => { setVolumeMin(2); setAdxMin(20); setMacdCross("bullish"); }}>
                  <BarChart3 className="w-3 h-3 mr-1" /> Volume Breakout
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" data-testid="button-preset-value"
                  onClick={() => { resetFilters(); setTimeout(() => setMinCombinedScore(65), 0); }}>
                  <Star className="w-3 h-3 mr-1" /> High Combined Score
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Sort Bar */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground mr-1 shrink-0">Sort:</span>
          {([
            ["combinedScore", "Combined"],
            ["swingScore", "Technical"],
            ["fundamentalScore", "Fundamental"],
            ["sentimentScore", "Sentiment"],
            ["changePct", "% Change"],
            ["change2d", "2-Day"],
            ["rsi14", "RSI"],
            ["mfi14", "MFI"],
            ["mfiChange", "MFI Change"],
            ["volume", "Volume"],
            ["price", "Price"],
            ["marketCap", "Mkt Cap"],
          ] as [SortField, string][]).map(([field, label]) => (
            <Button
              key={field}
              variant={sortBy === field ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7 gap-1 shrink-0"
              onClick={() => toggleSort(field)}
              data-testid={`button-sort-${field}`}
            >
              {label}
              {sortBy === field && (
                sortOrder === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
              )}
            </Button>
          ))}
        </div>

        {/* Stock Table */}
        {isLoading || backendWaking ? (
          <BackendWakeProgress backendWaking={backendWaking} />
        ) : stocks && stocks.length === 0 ? (
          <Card className="p-8 text-center border-card-border">
            <Activity className="w-8 h-8 text-orange-500 mx-auto mb-3" />
            <h3 className="font-semibold text-sm mb-1">Backend is starting up</h3>
            <p className="text-muted-foreground text-xs mb-3">The server is waking from sleep. Data will load automatically.</p>
            <RefreshCw className="w-4 h-4 text-primary mx-auto animate-spin" />
          </Card>
        ) : filteredStocks.length === 0 ? (
          <Card className="p-8 text-center border-card-border">
            <p className="text-muted-foreground text-sm">No stocks match your criteria. Try adjusting the filters.</p>
          </Card>
        ) : (
          <>
            {/* Progressive loading banner */}
            {serverStillLoading && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                <span className="text-xs text-primary">Loading more stocks... {stocks?.length || 0} loaded so far</span>
              </div>
            )}

            {/* Pagination Info */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, filteredStocks.length)} of {filteredStocks.length} stocks
              </span>
              {totalPages > 1 && (
                <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-stocks-desktop">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Stock</th>
                    <th className="text-right py-2 px-2 font-medium">Price</th>
                    <th className="text-right py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help text-emerald-600">Entry</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">Best entry price from support levels (Bollinger Lower, SMA, VWAP)</TooltipContent></Tooltip>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help text-blue-600">Target</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">Price target from Bollinger Upper / 2x ATR resistance</TooltipContent></Tooltip>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help text-red-500">SL</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">Stop Loss: 1.5x ATR below entry for risk management</TooltipContent></Tooltip>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">Change</th>
                    <th className="text-center py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help">Combined</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">40% Technical + 30% Fundamental + 30% Sentiment</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help">Tech</TooltipTrigger>
                        <TooltipContent className="text-xs">Technical/Swing Score</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help">Fund</TooltipTrigger>
                        <TooltipContent className="text-xs">Fundamental Score (PE, ROE, Debt, Margins)</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help">Sent</TooltipTrigger>
                        <TooltipContent className="text-xs">News Sentiment Score</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">RSI</th>
                    <th className="text-center py-2 px-2 font-medium">
                      <Tooltip><TooltipTrigger className="cursor-help">MFI</TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">Money Flow Index - buying pressure (0-100). &gt;80 = high buying, &lt;20 = high selling</TooltipContent></Tooltip>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">MACD</th>
                    <th className="text-center py-2 px-2 font-medium">2-Day</th>
                    <th className="text-center py-2 px-2 font-medium">Signal</th>
                    <th className="text-left py-2 px-2 font-medium">Patterns</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStocks.map(stock => (
                    <StockRow key={stock.symbol} stock={stock} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-2" data-testid="list-stocks-mobile">
              {paginatedStocks.map(stock => (
                <MobileStockCard key={stock.symbol} stock={stock} />
              ))}
            </div>

            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center mt-4">
                <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}

        <PerplexityAttribution className="mt-6 mb-4" />
        </>)}
      </main>
    </div>
  );
}

// ─── Pagination ───

const PaginationControls = memo(function PaginationControls({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline" size="sm" className="h-7 w-7 p-0"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </Button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let pageNum: number;
        if (totalPages <= 7) {
          pageNum = i + 1;
        } else if (page <= 4) {
          pageNum = i + 1;
        } else if (page >= totalPages - 3) {
          pageNum = totalPages - 6 + i;
        } else {
          pageNum = page - 3 + i;
        }
        return (
          <Button
            key={pageNum}
            variant={page === pageNum ? "default" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => onPageChange(pageNum)}
          >
            {pageNum}
          </Button>
        );
      })}
      <Button
        variant="outline" size="sm" className="h-7 w-7 p-0"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
});

// ─── Memoized Stock Row (Desktop) ───

const StockRow = memo(function StockRow({ stock }: { stock: Stock }) {
  const { entry, target, stopLoss } = computeEntryExit(stock);
  return (
    <tr
      className="border-b border-border/50 hover:bg-muted/40 transition-all duration-200 cursor-pointer hover:shadow-sm"
      data-testid={`row-stock-${stock.symbol}`}
    >
      <td className="py-2.5 px-3">
        <Link href={`/stock/${stock.symbol}`}>
          <div className="cursor-pointer">
            <div className="font-semibold text-sm">{stock.symbol}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[160px]">{stock.name}</div>
          </div>
        </Link>
      </td>
      <td className="text-right py-2.5 px-2 tabular-nums font-medium">{formatPrice(stock.price)}</td>
      <td className="text-right py-2.5 px-2 tabular-nums text-xs">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">₹{entry.toFixed(0)}</span>
      </td>
      <td className="text-right py-2.5 px-2 tabular-nums text-xs">
        <span className="text-blue-600 dark:text-blue-400 font-medium">₹{target.toFixed(0)}</span>
      </td>
      <td className="text-right py-2.5 px-2 tabular-nums text-xs">
        <span className="text-red-500 font-medium">₹{stopLoss.toFixed(0)}</span>
      </td>
      <td className={`text-right py-2.5 px-2 tabular-nums font-medium ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
        <div className="flex items-center justify-end gap-0.5">
          {stock.changePct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(stock.changePct).toFixed(2)}%
        </div>
      </td>
      <td className="text-center py-2.5 px-2">
        <CombinedScoreBadge score={stock.combinedScore} />
      </td>
      <td className="text-center py-2.5 px-2">
        <MiniScoreBadge score={stock.swingScore} label="T" />
      </td>
      <td className="text-center py-2.5 px-2">
        <MiniScoreBadge score={stock.fundamentalScore} label="F" />
      </td>
      <td className="text-center py-2.5 px-2">
        <SentimentBadge score={stock.sentimentScore} label={stock.sentimentLabel} />
      </td>
      <td className="text-center py-2.5 px-2">
        <RsiIndicator value={stock.rsi14} />
      </td>
      <td className="text-center py-2.5 px-2">
        <MfiIndicator mfi={stock.mfi14 ?? 50} change={stock.mfiChange ?? 0} pressure={stock.buyingPressure ?? "neutral"} />
      </td>
      <td className="text-center py-2.5 px-2">
        <MacdIndicator histogram={stock.macdHistogram} />
      </td>
      <td className={`text-center py-2.5 px-2 tabular-nums text-xs font-medium ${stock.change2d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
        {stock.change2d >= 0 ? "+" : ""}{stock.change2d.toFixed(2)}%
      </td>
      <td className="text-center py-2.5 px-2">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${SIGNAL_CONFIG[stock.combinedSignal]?.color || ""}`}>
          {SIGNAL_CONFIG[stock.combinedSignal]?.label || "N/A"}
        </Badge>
      </td>
      <td className="py-2.5 px-2">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {stock.patterns.slice(0, 2).map(p => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
          ))}
          {stock.patterns.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{stock.patterns.length - 2}</span>
          )}
        </div>
      </td>
    </tr>
  );
});

// ─── Memoized Mobile Stock Card ───

const MobileStockCard = memo(function MobileStockCard({ stock }: { stock: Stock }) {
  const { entry, target, stopLoss } = computeEntryExit(stock);
  return (
    <Link href={`/stock/${stock.symbol}`}>
      <Card className="p-3 border-card-border hover:bg-muted/40 transition-all duration-200 cursor-pointer card-hover-lift" data-testid={`card-stock-${stock.symbol}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-semibold text-sm">{stock.symbol}</div>
            <div className="text-xs text-muted-foreground">{stock.name}</div>
          </div>
          <div className="text-right">
            <div className="font-medium tabular-nums text-sm">{formatPrice(stock.price)}</div>
            <div className={`text-xs tabular-nums font-medium ${stock.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
        {/* Entry/Exit/SL */}
        <div className="flex items-center gap-3 mb-2 text-[10px]">
          <span className="text-muted-foreground">Entry: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{entry.toFixed(0)}</span></span>
          <span className="text-muted-foreground">Target: <span className="text-blue-600 dark:text-blue-400 font-semibold">₹{target.toFixed(0)}</span></span>
          <span className="text-muted-foreground">SL: <span className="text-red-500 font-semibold">₹{stopLoss.toFixed(0)}</span></span>
        </div>
        {/* Score Row */}
        <div className="flex items-center gap-1.5 mb-2">
          <CombinedScoreBadge score={stock.combinedScore} />
          <MiniScoreBadge score={stock.swingScore} label="T" />
          <MiniScoreBadge score={stock.fundamentalScore} label="F" />
          <SentimentBadge score={stock.sentimentScore} label={stock.sentimentLabel} />
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ml-auto ${SIGNAL_CONFIG[stock.combinedSignal]?.color || ""}`}>
            {SIGNAL_CONFIG[stock.combinedSignal]?.label || "N/A"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RsiIndicator value={stock.rsi14} />
            <MfiIndicator mfi={stock.mfi14 ?? 50} change={stock.mfiChange ?? 0} pressure={stock.buyingPressure ?? "neutral"} />
            <span className={`text-[10px] font-medium tabular-nums ${stock.change2d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              2D: {stock.change2d >= 0 ? "+" : ""}{stock.change2d.toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Vol {formatVolume(stock.volume)}
          </div>
        </div>
        {stock.patterns.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {stock.patterns.slice(0, 3).map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
});

// ─── Sub-components ───

function SectorPerformanceBar({ sectors, onSectorClick }: { sectors: SectorPerformance[]; onSectorClick: (sector: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const topSectors = expanded ? sectors : sectors.slice(0, 6);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sector Performance (2-Day)</span>
        </div>
        {sectors.length > 6 && (
          <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show Less" : `Show All (${sectors.length})`}
            {expanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {topSectors.map(sp => {
          const isPositive = sp.change2d >= 0;
          return (
            <Card
              key={sp.sector}
              className="p-2.5 border-card-border hover:bg-muted/40 transition-all cursor-pointer card-hover-lift"
              onClick={() => onSectorClick(sp.sector)}
              data-testid={`card-sector-${sp.sector}`}
            >
              <div className="text-[10px] text-muted-foreground font-medium truncate mb-1">{sp.sector}</div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {isPositive ? "+" : ""}{sp.change2d.toFixed(2)}%
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{sp.stockCount} stocks</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[10px] text-muted-foreground">Score:</span>
                <MiniScoreBadge score={Math.round(sp.avgCombinedScore)} label="C" />
              </div>
              {sp.topStocks.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50">
                  <div className="text-[9px] text-muted-foreground mb-0.5">Top pick:</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold">{sp.topStocks[0].symbol}</span>
                    <span className={`text-[10px] tabular-nums ${sp.topStocks[0].changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {sp.topStocks[0].changePct >= 0 ? "+" : ""}{sp.topStocks[0].changePct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function BackendWakeProgress({ backendWaking }: { backendWaking: boolean }) {
  const { data: status } = useQuery<{ loaded: number; total: number; loading: boolean; retrying?: boolean; retryCount?: number }>({
    queryKey: ["/api/status"],
    refetchInterval: 2000,
    staleTime: 0,
  });

  const loaded = status?.loaded ?? 0;
  const total = status?.total ?? 500;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const isRetrying = status?.retrying ?? false;
  const retryNum = status?.retryCount ?? 0;

  // Determine message based on state
  let title = "Loading NSE Total Market Universe";
  let subtitle = `Fetching real-time data, fundamentals, MFI, and news sentiment for ${total} stocks...`;
  let statusText = loaded > 0 ? `${loaded} / ${total} stocks loaded (${pct}%)` : "Initializing...";

  if (backendWaking || (loaded === 0 && isRetrying)) {
    title = "Backend waking up — please wait";
    subtitle = "The server was sleeping to save resources. It's fetching fresh market data now. This usually takes 1-3 minutes.";
    statusText = isRetrying
      ? `Retry ${retryNum}/3 in progress... Fetching data from Yahoo Finance`
      : loaded > 0
        ? `${loaded} / ${total} stocks loaded (${pct}%)`
        : "Connecting to Yahoo Finance...";
  }

  return (
    <Card className="p-8 border-card-border">
      <div className="max-w-md mx-auto text-center">
        <Activity className="w-8 h-8 text-primary mx-auto mb-3 animate-pulse" />
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
        <Progress value={backendWaking && loaded === 0 ? undefined : pct} className="h-2 mb-2" />
        <p className="text-xs tabular-nums text-muted-foreground">{statusText}</p>
      </div>
    </Card>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  let bg = "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  if (value >= 70) bg = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  else if (value >= 55) bg = "bg-green-500/15 text-green-700 dark:text-green-400";
  else if (value < 35) bg = "bg-red-500/15 text-red-600 dark:text-red-400";

  return (
    <span className={`text-[9px] tabular-nums font-semibold rounded px-1 py-0.5 ${bg}`}>
      {label}:{value}
    </span>
  );
}

function CombinedScoreBadge({ score }: { score: number }) {
  let bg = "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
  if (score >= 70) bg = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  else if (score >= 55) bg = "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20";
  else if (score < 35) bg = "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20";

  return (
    <span className={`inline-flex items-center gap-1 text-xs tabular-nums font-bold rounded-md px-2 py-0.5 border ${bg}`}>
      <Zap className="w-3 h-3" />
      {score}
    </span>
  );
}

function MiniScoreBadge({ score, label }: { score: number; label: string }) {
  let color = "text-yellow-600 dark:text-yellow-400";
  if (score >= 70) color = "text-emerald-600 dark:text-emerald-400";
  else if (score >= 55) color = "text-green-600 dark:text-green-400";
  else if (score < 35) color = "text-red-500";

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={`text-[10px] tabular-nums font-semibold ${color}`}>
          {label}:{score}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        {label === "T" ? "Technical" : label === "F" ? "Fundamental" : "Combined"} Score: {score}/100
      </TooltipContent>
    </Tooltip>
  );
}

function SentimentBadge({ score, label }: { score: number; label: string }) {
  const config = SENTIMENT_CONFIG[label] || SENTIMENT_CONFIG.neutral;
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={`text-[10px] tabular-nums font-semibold ${config.color}`}>
          S:{score}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        Sentiment: {config.label} ({score}/100)
      </TooltipContent>
    </Tooltip>
  );
}

function RsiIndicator({ value }: { value: number }) {
  let color = "text-yellow-600 dark:text-yellow-400";
  if (value <= 30) color = "text-emerald-600 dark:text-emerald-400";
  else if (value >= 70) color = "text-red-500";

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className={`text-xs tabular-nums font-medium ${color}`}>{value.toFixed(1)}</span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        RSI(14): {value <= 30 ? "Oversold" : value >= 70 ? "Overbought" : "Neutral"}
      </TooltipContent>
    </Tooltip>
  );
}

function MacdIndicator({ histogram }: { histogram: number }) {
  const positive = histogram > 0;
  return (
    <div className="flex items-center justify-center gap-1">
      <div className={`w-2 h-2 rounded-full ${positive ? "bg-emerald-500" : "bg-red-500"}`} />
      <span className={`text-xs tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
        {histogram > 0 ? "+" : ""}{histogram.toFixed(1)}
      </span>
    </div>
  );
}

function MfiIndicator({ mfi, change, pressure }: { mfi: number; change: number; pressure: string }) {
  let color = "text-yellow-600 dark:text-yellow-400";
  if (mfi >= 80) color = "text-emerald-600 dark:text-emerald-400";
  else if (mfi >= 60) color = "text-green-600 dark:text-green-400";
  else if (mfi <= 20) color = "text-red-600 dark:text-red-400";
  else if (mfi <= 40) color = "text-orange-600 dark:text-orange-400";

  const pressureLabels: Record<string, string> = {
    high_buying: "High Buying",
    buying: "Buying",
    neutral: "Neutral",
    selling: "Selling",
    high_selling: "High Selling",
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-0.5">
          <span className={`text-xs tabular-nums font-medium ${color}`}>{mfi.toFixed(0)}</span>
          {change !== 0 && (
            <span className={`text-[9px] tabular-nums ${change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {change > 0 ? "+" : ""}{change.toFixed(0)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <div>MFI(14): {mfi.toFixed(1)} — {pressureLabels[pressure] || "Neutral"}</div>
        <div>Change: {change > 0 ? "+" : ""}{change.toFixed(1)} vs previous day</div>
        <div className="text-muted-foreground mt-1">MFI combines price + volume to measure buying pressure</div>
      </TooltipContent>
    </Tooltip>
  );
}
