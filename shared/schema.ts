import { z } from "zod";

// Stock data types (no database needed - all in-memory)
export const stockSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  price: z.number(),
  change: z.number(),
  changePct: z.number(),
  volume: z.number(),
  avgVolume: z.number(),
  marketCap: z.number(),
  high52w: z.number(),
  low52w: z.number(),
  dayHigh: z.number(),
  dayLow: z.number(),
  open: z.number(),
  prevClose: z.number(),
  pe: z.number().nullable(),
  eps: z.number().nullable(),
  // Technical indicators
  rsi14: z.number(),
  macdLine: z.number(),
  macdSignal: z.number(),
  macdHistogram: z.number(),
  sma20: z.number(),
  sma50: z.number(),
  sma200: z.number(),
  ema9: z.number(),
  ema21: z.number(),
  bollingerUpper: z.number(),
  bollingerMiddle: z.number(),
  bollingerLower: z.number(),
  atr14: z.number(),
  adx14: z.number(),
  stochK: z.number(),
  stochD: z.number(),
  vwap: z.number(),
  obv: z.number(),
  mfi14: z.number().optional().default(50), // Money Flow Index (0-100) - buying pressure indicator
  buyingPressure: z.enum(["high_buying", "buying", "neutral", "selling", "high_selling"]).optional().default("neutral"),
  mfiChange: z.number().optional().default(0), // MFI change vs previous day (positive = increased buying)
  // Swing trading signals (Technical Score)
  swingScore: z.number(), // 0-100 technical composite score
  signal: z.enum(["strong_buy", "buy", "neutral", "sell", "strong_sell"]),
  patterns: z.array(z.string()),
  // Fundamental Rating
  fundamentalScore: z.number(), // 0-100
  fundamentalSignals: z.array(z.string()), // e.g. "Low PE", "High EPS Growth"
  // Sentiment Rating
  sentimentScore: z.number(), // 0-100 (50 = neutral, >50 positive, <50 negative)
  sentimentLabel: z.enum(["very_positive", "positive", "neutral", "negative", "very_negative"]),
  newsCount: z.number(), // number of recent news items analyzed
  // Combined Score
  combinedScore: z.number(), // 0-100 weighted average of technical + fundamental + sentiment
  combinedSignal: z.enum(["strong_buy", "buy", "neutral", "sell", "strong_sell"]),
  // 2-day performance
  change2d: z.number(), // 2-day price change %
});

export type Stock = z.infer<typeof stockSchema>;

export const screenerParamsSchema = z.object({
  rsiMin: z.number().min(0).max(100).optional(),
  rsiMax: z.number().min(0).max(100).optional(),
  macdCross: z.enum(["bullish", "bearish", "any"]).optional(),
  aboveSma20: z.boolean().optional(),
  aboveSma50: z.boolean().optional(),
  aboveSma200: z.boolean().optional(),
  volumeMultiple: z.number().optional(),
  adxMin: z.number().optional(),
  sectors: z.array(z.string()).optional(),
  minSwingScore: z.number().optional(),
  minCombinedScore: z.number().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  marketCapMin: z.number().optional(),
  minMfi: z.number().optional(),
  maxMfi: z.number().optional(),
  buyingPressure: z.enum(["high_buying", "buying", "neutral", "selling", "high_selling", "any"]).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type ScreenerParams = z.infer<typeof screenerParamsSchema>;

// Historical price data for charts
export const pricePointSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type PricePoint = z.infer<typeof pricePointSchema>;

// Sector performance data
export const sectorPerformanceSchema = z.object({
  sector: z.string(),
  change2d: z.number(), // 2-day change %
  stockCount: z.number(),
  topStocks: z.array(z.object({
    symbol: z.string(),
    name: z.string(),
    changePct: z.number(),
    combinedScore: z.number(),
  })),
  avgCombinedScore: z.number(),
  bullishCount: z.number(),
  bearishCount: z.number(),
});

export type SectorPerformance = z.infer<typeof sectorPerformanceSchema>;
