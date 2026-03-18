import type { Stock, PricePoint, SectorPerformance } from "@shared/schema";

// yahoo-finance2 v3 requires instantiation
let _yf: any = null;
function getYF(): any {
  if (!_yf) {
    const mod = require("yahoo-finance2");
    const YF = mod.default || mod;
    _yf = new YF({ suppressNotices: ["yahooSurvey"] });
  }
  return _yf;
}

interface StockMeta {
  symbol: string;
  sector: string;
}

// Full NIFTY 500 universe - loaded from JSON at startup
import * as fs from "fs";
import * as path from "path";

let STOCK_LIST: StockMeta[] = [];

// Try loading the NIFTY 500 JSON file
try {
  const jsonPath = path.resolve(__dirname, "../nifty500_stocks.json");
  if (fs.existsSync(jsonPath)) {
    STOCK_LIST = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  }
} catch (e) {
  // Fallback - will be populated below
}

// If JSON not found (e.g., after build), use the embedded list
if (STOCK_LIST.length === 0) {
  try {
    const altPath = path.resolve(process.cwd(), "nifty500_stocks.json");
    if (fs.existsSync(altPath)) {
      STOCK_LIST = JSON.parse(fs.readFileSync(altPath, "utf8"));
    }
  } catch (e) {}
}

// Final fallback with the core stocks if file not found
if (STOCK_LIST.length === 0) {
  STOCK_LIST = [
    { symbol: "RELIANCE", sector: "Energy" },
    { symbol: "TCS", sector: "IT" },
    { symbol: "HDFCBANK", sector: "Banking" },
    { symbol: "INFY", sector: "IT" },
    { symbol: "ICICIBANK", sector: "Banking" },
  ];
  console.warn("[Yahoo] nifty500_stocks.json not found, using minimal fallback list");
}

console.log(`[Yahoo] Loaded ${STOCK_LIST.length} stocks from NIFTY 500 universe`);

function toNSE(symbol: string): string {
  return `${symbol}.NS`;
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// ─── Technical indicator calculations from real OHLCV data ───

function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes[0];
  result.push(ema);
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [NaN];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  if (gains.length < period) return closes.map(() => NaN);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < period - 1; i++) result.push(NaN);

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs2));
  }
  return result;
}

function calcMACD(closes: number[]): { macdLine: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, histogram };
}

function calcBollingerBands(closes: number[], period: number = 20, mult: number = 2) {
  const sma = calcSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - sma[i]) ** 2;
    const std = Math.sqrt(sumSq / period);
    upper.push(sma[i] + mult * std);
    lower.push(sma[i] - mult * std);
  }
  return { upper, middle: sma, lower };
}

function calcATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const trs: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trs.push(tr);
  }
  const result: number[] = [];
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

function calcADX(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  if (closes.length < period * 2) return closes.map(() => NaN);

  const trs: number[] = [highs[0] - lows[0]];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trs.push(tr);
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smoothTR: number[] = [];
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];

  let sTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let sPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  smoothTR.push(sTR); smoothPlusDM.push(sPDM); smoothMinusDM.push(sMDM);

  for (let i = period; i < closes.length; i++) {
    sTR = sTR - sTR / period + trs[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];
    smoothTR.push(sTR); smoothPlusDM.push(sPDM); smoothMinusDM.push(sMDM);
  }

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const pdi = smoothTR[i] !== 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
    const mdi = smoothTR[i] !== 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
    const sum = pdi + mdi;
    dx.push(sum !== 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0);
  }

  const result: number[] = [];
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  if (dx.length < period) return closes.map(() => NaN);

  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(adx);
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
    result.push(adx);
  }
  return result;
}

function calcStochastic(highs: number[], lows: number[], closes: number[], kPeriod = 14, dPeriod = 3) {
  const kValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) { kValues.push(NaN); continue; }
    let highestHigh = -Infinity, lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    kValues.push(range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
  }
  const validK = kValues.filter(v => !isNaN(v));
  const dValues = calcSMA(validK, dPeriod);
  const paddedD: number[] = [];
  let dIdx = 0;
  for (let i = 0; i < kValues.length; i++) {
    if (isNaN(kValues[i])) { paddedD.push(NaN); continue; }
    paddedD.push(dIdx < dValues.length ? (isNaN(dValues[dIdx]) ? kValues[i] : dValues[dIdx]) : kValues[i]);
    dIdx++;
  }
  return { k: kValues, d: paddedD };
}

// ─── Money Flow Index (MFI) - Buying Pressure Indicator ───
// MFI uses both price and volume to measure buying/selling pressure
// Range 0-100: >80 overbought (high buying), <20 oversold (high selling)
function calcMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number[] {
  const mfi: number[] = [];
  if (closes.length < period + 1) return mfi;

  // Typical price = (High + Low + Close) / 3
  const typicalPrices: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  // Raw Money Flow = Typical Price × Volume
  // Positive MF: when TP > previous TP
  // Negative MF: when TP < previous TP
  for (let i = period; i < closes.length; i++) {
    let posMF = 0;
    let negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const rawMF = typicalPrices[j] * volumes[j];
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        posMF += rawMF;
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negMF += rawMF;
      }
    }
    // Money Flow Ratio = Positive MF / Negative MF
    // MFI = 100 - (100 / (1 + MFR))
    if (negMF === 0) {
      mfi.push(100);
    } else {
      const mfr = posMF / negMF;
      mfi.push(100 - (100 / (1 + mfr)));
    }
  }
  return mfi;
}

function calcOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return 0;
}

// ─── Fundamental Score ───

function calcFundamentalScore(quote: any, price: number, closes: number[]): { score: number; signals: string[] } {
  let score = 50;
  const signals: string[] = [];

  const pe = quote.trailingPE ?? null;
  const forwardPe = quote.forwardPE ?? null;
  const eps = quote.epsTrailingTwelveMonths ?? null;
  const bookValue = quote.bookValue ?? null;
  const priceToBook = quote.priceToBook ?? null;
  const marketCap = quote.marketCap ?? 0;
  const dividendYield = quote.dividendYield ?? 0;
  const revenueGrowth = quote.revenueGrowth ?? null;
  const profitMargins = quote.profitMargins ?? null;
  const returnOnEquity = quote.returnOnEquity ?? null;
  const debtToEquity = quote.debtToEquity ?? null;
  const earningsGrowth = quote.earningsGrowth ?? null;

  // PE Ratio scoring (lower is better for value, but not negative)
  if (pe !== null && pe > 0) {
    if (pe < 15) { score += 12; signals.push("Low PE (<15)"); }
    else if (pe < 25) { score += 6; signals.push("Fair PE"); }
    else if (pe > 50) { score -= 8; signals.push("High PE (>50)"); }
    else if (pe > 35) { score -= 4; }
  }

  // Forward PE vs trailing PE (earnings growth expected)
  if (forwardPe !== null && pe !== null && forwardPe > 0 && pe > 0) {
    if (forwardPe < pe * 0.85) { score += 8; signals.push("Earnings Growth Expected"); }
  }

  // EPS positive and growing
  if (eps !== null) {
    if (eps > 0) { score += 5; }
    if (eps > price * 0.05) { score += 5; signals.push("Strong EPS"); }
  }

  // Price to Book
  if (priceToBook !== null && priceToBook > 0) {
    if (priceToBook < 2) { score += 8; signals.push("Low P/B (<2)"); }
    else if (priceToBook < 4) { score += 3; }
    else if (priceToBook > 8) { score -= 5; signals.push("High P/B (>8)"); }
  }

  // Market Cap - larger = more stable
  if (marketCap > 500000000000) { score += 5; signals.push("Large Cap"); } // >50K Cr
  else if (marketCap > 100000000000) { score += 3; signals.push("Mid Cap"); }
  else if (marketCap < 10000000000) { score -= 3; signals.push("Small Cap"); }

  // Dividend yield
  if (dividendYield > 0.03) { score += 6; signals.push(`Dividend ${(dividendYield * 100).toFixed(1)}%`); }
  else if (dividendYield > 0.01) { score += 3; }

  // Profit margins
  if (profitMargins !== null) {
    if (profitMargins > 0.20) { score += 8; signals.push("High Margins (>20%)"); }
    else if (profitMargins > 0.10) { score += 4; }
    else if (profitMargins < 0) { score -= 8; signals.push("Negative Margins"); }
  }

  // Return on Equity
  if (returnOnEquity !== null) {
    if (returnOnEquity > 0.20) { score += 8; signals.push("High ROE (>20%)"); }
    else if (returnOnEquity > 0.12) { score += 4; }
    else if (returnOnEquity < 0) { score -= 6; signals.push("Negative ROE"); }
  }

  // Debt to Equity
  if (debtToEquity !== null) {
    if (debtToEquity < 0.5) { score += 8; signals.push("Low Debt"); }
    else if (debtToEquity < 1) { score += 4; }
    else if (debtToEquity > 2) { score -= 6; signals.push("High Debt (>2x)"); }
    else if (debtToEquity > 1.5) { score -= 3; }
  }

  // Earnings growth
  if (earningsGrowth !== null) {
    if (earningsGrowth > 0.20) { score += 8; signals.push("Earnings Growth >20%"); }
    else if (earningsGrowth > 0.05) { score += 4; }
    else if (earningsGrowth < -0.10) { score -= 6; signals.push("Earnings Declining"); }
  }

  // 52-week position (closer to low = value opportunity)
  const high52 = quote.fiftyTwoWeekHigh ?? 0;
  const low52 = quote.fiftyTwoWeekLow ?? 0;
  if (high52 > 0 && low52 > 0) {
    const range52 = high52 - low52;
    if (range52 > 0) {
      const position = (price - low52) / range52; // 0 = at low, 1 = at high
      if (position < 0.3) { score += 5; signals.push("Near 52w Low"); }
      else if (position > 0.9) { score -= 3; signals.push("Near 52w High"); }
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), signals };
}

// ─── Sentiment Analysis (keyword-based from Yahoo Finance news) ───

// Positive and negative keyword lists for financial sentiment
const POSITIVE_WORDS = new Set([
  "surge", "surges", "rally", "rallies", "gain", "gains", "growth", "profit", "profits",
  "beat", "beats", "exceeds", "outperform", "upgrade", "upgraded", "bullish", "buy",
  "strong", "record", "high", "boost", "boosted", "rise", "rises", "rising",
  "positive", "optimistic", "recovery", "breakthrough", "expansion", "dividend",
  "upbeat", "innovation", "success", "exceed", "exceeded", "soar", "soars",
  "jump", "jumps", "improve", "improved", "improvement", "up", "higher",
  "best", "top", "winner", "winners", "momentum", "breakout", "accumulate",
]);

const NEGATIVE_WORDS = new Set([
  "fall", "falls", "decline", "declines", "drop", "drops", "loss", "losses",
  "crash", "crashes", "plunge", "plunges", "miss", "misses", "downgrade",
  "downgraded", "bearish", "sell", "weak", "low", "slump", "slumps",
  "negative", "pessimistic", "warning", "risk", "risks", "debt", "default",
  "fraud", "scandal", "probe", "investigation", "lawsuit", "penalty",
  "down", "lower", "worst", "concern", "concerns", "fear", "fears",
  "cut", "cuts", "layoff", "layoffs", "closure", "shutdown", "ban",
  "fine", "fined", "violation", "under pressure", "disappointed",
]);

async function fetchSentiment(nseSymbol: string): Promise<{ score: number; label: Stock["sentimentLabel"]; newsCount: number }> {
  try {
    const yf = getYF();
    // Use search to get news
    const searchResult = await yf.search(nseSymbol.replace(".NS", ""), { newsCount: 8 });
    const news = searchResult?.news || [];

    if (news.length === 0) {
      return { score: 50, label: "neutral", newsCount: 0 };
    }

    let totalSentiment = 0;
    let analyzedCount = 0;

    for (const article of news) {
      const text = ((article.title || "") + " " + (article.snippet || "")).toLowerCase();
      const words = text.split(/\s+/);

      let posCount = 0;
      let negCount = 0;

      for (const word of words) {
        const cleaned = word.replace(/[^a-z]/g, "");
        if (POSITIVE_WORDS.has(cleaned)) posCount++;
        if (NEGATIVE_WORDS.has(cleaned)) negCount++;
      }

      const total = posCount + negCount;
      if (total > 0) {
        // Score from -1 (all negative) to +1 (all positive)
        const articleScore = (posCount - negCount) / total;
        totalSentiment += articleScore;
        analyzedCount++;
      }
    }

    // Convert average sentiment (-1 to +1) to 0-100 scale
    const avgSentiment = analyzedCount > 0 ? totalSentiment / analyzedCount : 0;
    const score = Math.max(0, Math.min(100, Math.round(50 + avgSentiment * 50)));

    let label: Stock["sentimentLabel"];
    if (score >= 75) label = "very_positive";
    else if (score >= 60) label = "positive";
    else if (score >= 40) label = "neutral";
    else if (score >= 25) label = "negative";
    else label = "very_negative";

    return { score, label, newsCount: news.length };
  } catch (err) {
    return { score: 50, label: "neutral", newsCount: 0 };
  }
}

// ─── Data cache ───

interface CacheEntry {
  stocks: Stock[];
  historyMap: Map<string, PricePoint[]>;
  sectorPerformance: SectorPerformance[];
  timestamp: number;
  loadedCount: number;
  totalCount: number;
}

let dataCache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes (longer for 500 stocks)
let fetchPromise: Promise<CacheEntry> | null = null;
let currentProgress = { loaded: 0, total: 0 };

async function fetchHistorical(nseSymbol: string, days: number = 250): Promise<any[]> {
  try {
    const yf = getYF();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const result = await yf.chart(nseSymbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });
    if (!result || !result.quotes || result.quotes.length === 0) return [];
    return result.quotes.filter((q: any) => q.close != null && q.high != null && q.low != null);
  } catch (err) {
    return [];
  }
}

async function fetchQuote(nseSymbol: string): Promise<any | null> {
  try {
    const yf = getYF();
    const result = await yf.quote(nseSymbol);
    return result;
  } catch (err) {
    return null;
  }
}

function buildStock(symbol: string, sector: string, quote: any, history: any[], sentiment: { score: number; label: Stock["sentimentLabel"]; newsCount: number }): Stock | null {
  if (!quote || history.length < 30) return null;

  const closes = history.map((h: any) => h.close as number);
  const highs = history.map((h: any) => h.high as number);
  const lows = history.map((h: any) => h.low as number);
  const volumes = history.map((h: any) => (h.volume || 0) as number);

  const price = quote.regularMarketPrice ?? closes[closes.length - 1];
  if (!price || price <= 0) return null;

  const change = quote.regularMarketChange ?? 0;
  const changePct = quote.regularMarketChangePercent ?? 0;
  const volume = quote.regularMarketVolume ?? volumes[volumes.length - 1];
  const dayHigh = quote.regularMarketDayHigh ?? highs[highs.length - 1];
  const dayLow = quote.regularMarketDayLow ?? lows[lows.length - 1];
  const open = quote.regularMarketOpen ?? closes[closes.length - 1];
  const prevClose = quote.regularMarketPreviousClose ?? closes[closes.length - 2] ?? price;
  const high52w = quote.fiftyTwoWeekHigh ?? Math.max(...highs);
  const low52w = quote.fiftyTwoWeekLow ?? Math.min(...lows);
  const marketCap = quote.marketCap ? Math.round(quote.marketCap / 10000000) : 0;
  const pe = quote.trailingPE ?? null;
  const eps = quote.epsTrailingTwelveMonths ?? null;

  // Use company name from quote, fallback to symbol
  const name = quote.shortName || quote.longName || symbol;

  const recentVols = volumes.slice(-20);
  const avgVolume = recentVols.length > 0 ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length) : volume;

  // 2-day change % (compare current close to close 2 days ago)
  let change2d = 0;
  if (closes.length >= 3) {
    const close2dAgo = closes[closes.length - 3];
    if (close2dAgo > 0) {
      change2d = round(((price - close2dAgo) / close2dAgo) * 100, 2);
    }
  }

  // Technical indicators
  const rsiArr = calcRSI(closes, 14);
  const rsi14 = last(rsiArr);

  const macd = calcMACD(closes);
  const macdLine = last(macd.macdLine);
  const macdSignal = last(macd.signal);
  const macdHistogram = last(macd.histogram);

  const sma20 = last(calcSMA(closes, 20));
  const sma50 = last(calcSMA(closes, 50));
  const sma200 = last(calcSMA(closes, 200));

  const ema9 = last(calcEMA(closes, 9));
  const ema21 = last(calcEMA(closes, 21));

  const bb = calcBollingerBands(closes, 20, 2);
  const bollingerUpper = last(bb.upper);
  const bollingerMiddle = last(bb.middle);
  const bollingerLower = last(bb.lower);

  const atr14 = last(calcATR(highs, lows, closes, 14));
  const adx14 = last(calcADX(highs, lows, closes, 14));

  const stoch = calcStochastic(highs, lows, closes, 14, 3);
  const stochK = last(stoch.k);
  const stochD = last(stoch.d);

  const obvArr = calcOBV(closes, volumes);
  const obv = obvArr[obvArr.length - 1];

  // Money Flow Index (buying pressure)
  const mfiArr = calcMFI(highs, lows, closes, volumes, 14);
  const mfi14 = mfiArr.length > 0 ? mfiArr[mfiArr.length - 1] : 50;
  const mfiPrev = mfiArr.length > 1 ? mfiArr[mfiArr.length - 2] : mfi14;
  const mfiChange = round(mfi14 - mfiPrev, 2); // +ve = increased buying pressure

  let buyingPressure: Stock["buyingPressure"];
  if (mfi14 >= 80) buyingPressure = "high_buying";
  else if (mfi14 >= 60) buyingPressure = "buying";
  else if (mfi14 >= 40) buyingPressure = "neutral";
  else if (mfi14 >= 20) buyingPressure = "selling";
  else buyingPressure = "high_selling";

  const vwapFinal = quote.vwap ?? ((dayHigh + dayLow + price) / 3);

  // ─── Technical Swing score ───
  let swingScore = 50;
  const patterns: string[] = [];
  const volumeMultiplier = avgVolume > 0 ? volume / avgVolume : 1;

  if (rsi14 < 30) { swingScore += 15; patterns.push("RSI Oversold"); }
  else if (rsi14 > 70) { swingScore -= 15; patterns.push("RSI Overbought"); }
  else if (rsi14 >= 40 && rsi14 <= 60) { swingScore += 5; }

  if (macdHistogram > 0 && macdLine > macdSignal) { swingScore += 12; patterns.push("MACD Bullish Cross"); }
  else if (macdHistogram < 0 && macdLine < macdSignal) { swingScore -= 8; patterns.push("MACD Bearish"); }

  if (price > sma20 && price > sma50) { swingScore += 10; patterns.push("Above SMA 20/50"); }
  if (price > sma200) { swingScore += 5; patterns.push("Above SMA 200"); }
  if (price < sma20 && price < sma50) { swingScore -= 10; }
  if (ema9 > ema21) { swingScore += 8; patterns.push("EMA 9/21 Bullish"); }

  if (volumeMultiplier > 1.5) { swingScore += 10; patterns.push("High Volume Surge"); }
  if (volumeMultiplier > 2.0) { patterns.push("Volume Breakout"); }

  if (adx14 > 25) { swingScore += 8; patterns.push("Strong Trend (ADX)"); }

  if (price < bollingerLower) { swingScore += 12; patterns.push("BB Lower Band Touch"); }
  if (price > bollingerUpper) { swingScore -= 5; patterns.push("BB Upper Band Touch"); }

  if (stochK < 20 && stochD < 20) { swingScore += 8; patterns.push("Stoch Oversold"); }
  if (stochK > 80 && stochD > 80) { swingScore -= 5; }
  if (stochK > stochD && stochK < 50) { swingScore += 5; patterns.push("Stoch Bullish Cross"); }

  if (price > vwapFinal && price < vwapFinal * 1.01) { swingScore += 5; patterns.push("VWAP Support"); }

  // MFI-based buying pressure signals
  if (mfi14 >= 80) { patterns.push("MFI High Buying"); }
  else if (mfi14 <= 20) { swingScore += 10; patterns.push("MFI Oversold"); }
  if (mfiChange > 10) { swingScore += 8; patterns.push("Buying Surge (MFI)"); }
  else if (mfiChange > 5) { swingScore += 4; patterns.push("Buying Increasing"); }

  swingScore = Math.max(0, Math.min(100, Math.round(swingScore)));

  let signal: Stock["signal"];
  if (swingScore >= 75) signal = "strong_buy";
  else if (swingScore >= 60) signal = "buy";
  else if (swingScore >= 40) signal = "neutral";
  else if (swingScore >= 25) signal = "sell";
  else signal = "strong_sell";

  // ─── Fundamental Score ───
  const fundamental = calcFundamentalScore(quote, price, closes);

  // ─── Combined Score (40% Technical + 30% Fundamental + 30% Sentiment) ───
  const combinedScore = Math.round(
    swingScore * 0.40 + fundamental.score * 0.30 + sentiment.score * 0.30
  );

  let combinedSignal: Stock["combinedSignal"];
  if (combinedScore >= 75) combinedSignal = "strong_buy";
  else if (combinedScore >= 60) combinedSignal = "buy";
  else if (combinedScore >= 40) combinedSignal = "neutral";
  else if (combinedScore >= 25) combinedSignal = "sell";
  else combinedSignal = "strong_sell";

  return {
    symbol, name, sector,
    price: round(price), change: round(change), changePct: round(changePct, 2),
    volume, avgVolume, marketCap,
    high52w: round(high52w), low52w: round(low52w),
    dayHigh: round(dayHigh), dayLow: round(dayLow),
    open: round(open), prevClose: round(prevClose),
    pe: pe ? round(pe, 1) : null, eps: eps ? round(eps, 2) : null,
    rsi14: round(rsi14, 1), macdLine: round(macdLine, 2), macdSignal: round(macdSignal, 2), macdHistogram: round(macdHistogram, 2),
    sma20: round(sma20), sma50: round(sma50), sma200: round(sma200),
    ema9: round(ema9), ema21: round(ema21),
    bollingerUpper: round(bollingerUpper), bollingerMiddle: round(bollingerMiddle), bollingerLower: round(bollingerLower),
    atr14: round(atr14, 2), adx14: round(adx14, 1),
    stochK: round(stochK, 1), stochD: round(Math.max(0, Math.min(100, stochD)), 1),
    vwap: round(vwapFinal), obv,
    mfi14: round(mfi14, 1), buyingPressure, mfiChange,
    swingScore, signal, patterns,
    fundamentalScore: fundamental.score,
    fundamentalSignals: fundamental.signals,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    newsCount: sentiment.newsCount,
    combinedScore,
    combinedSignal,
    change2d,
  };
}

function buildSectorPerformance(stocks: Stock[]): SectorPerformance[] {
  const sectorMap = new Map<string, Stock[]>();
  for (const s of stocks) {
    const arr = sectorMap.get(s.sector) || [];
    arr.push(s);
    sectorMap.set(s.sector, arr);
  }

  const sectors: SectorPerformance[] = [];
  for (const [sector, sectorStocks] of sectorMap) {
    const avgChange2d = sectorStocks.reduce((a, s) => a + s.change2d, 0) / sectorStocks.length;
    const avgCombinedScore = sectorStocks.reduce((a, s) => a + s.combinedScore, 0) / sectorStocks.length;
    const bullishCount = sectorStocks.filter(s => s.combinedSignal === "strong_buy" || s.combinedSignal === "buy").length;
    const bearishCount = sectorStocks.filter(s => s.combinedSignal === "sell" || s.combinedSignal === "strong_sell").length;

    // Top 3 stocks in sector by combined score
    const topStocks = [...sectorStocks]
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 3)
      .map(s => ({
        symbol: s.symbol,
        name: s.name,
        changePct: s.changePct,
        combinedScore: s.combinedScore,
      }));

    sectors.push({
      sector,
      change2d: round(avgChange2d, 2),
      stockCount: sectorStocks.length,
      topStocks,
      avgCombinedScore: round(avgCombinedScore, 1),
      bullishCount,
      bearishCount,
    });
  }

  // Sort by 2-day change (best performing first)
  sectors.sort((a, b) => b.change2d - a.change2d);
  return sectors;
}

async function fetchAllData(): Promise<CacheEntry> {
  const total = STOCK_LIST.length;
  console.log(`[Yahoo] Fetching real-time data for ${total} stocks (with fundamentals & sentiment)...`);
  const startTime = Date.now();
  currentProgress = { loaded: 0, total };

  const stocks: Stock[] = [];
  const historyMap = new Map<string, PricePoint[]>();
  let failedCount = 0;

  // Process in batches of 10 (slightly smaller due to sentiment calls)
  const BATCH_SIZE = 10;
  for (let i = 0; i < STOCK_LIST.length; i += BATCH_SIZE) {
    const batch = STOCK_LIST.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (meta) => {
        const nse = toNSE(meta.symbol);
        try {
          const [quote, history, sentiment] = await Promise.all([
            fetchQuote(nse),
            fetchHistorical(nse, 300),
            fetchSentiment(nse),
          ]);

          const stock = buildStock(meta.symbol, meta.sector, quote, history, sentiment);
          if (stock) {
            stocks.push(stock);
          } else {
            failedCount++;
          }

          // Store history
          if (history.length > 0) {
            const pricePoints: PricePoint[] = history.map((h: any) => ({
              date: new Date(h.date).toISOString().split("T")[0],
              open: round(h.open),
              high: round(h.high),
              low: round(h.low),
              close: round(h.close),
              volume: h.volume || 0,
            }));
            historyMap.set(meta.symbol, pricePoints);
          }
        } catch (e) {
          failedCount++;
        }
      })
    );

    // Track and log progress
    const loaded = Math.min(i + BATCH_SIZE, total);
    currentProgress = { loaded: stocks.length, total };
    if ((i / BATCH_SIZE) % 5 === 4 || loaded >= total) {
      const pct = Math.round((loaded / total) * 100);
      console.log(`[Yahoo] Progress: ${loaded}/${total} (${pct}%) - ${stocks.length} successful`);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < STOCK_LIST.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Yahoo] Completed: ${stocks.length}/${total} stocks in ${elapsed}s (${failedCount} failed)`);

  // Build sector performance
  const sectorPerformance = buildSectorPerformance(stocks);
  console.log(`[Yahoo] Sector performance calculated for ${sectorPerformance.length} sectors`);

  return {
    stocks,
    historyMap,
    sectorPerformance,
    timestamp: Date.now(),
    loadedCount: stocks.length,
    totalCount: total,
  };
}

async function getCachedData(): Promise<CacheEntry> {
  if (dataCache && Date.now() - dataCache.timestamp < CACHE_TTL) {
    return dataCache;
  }

  if (!fetchPromise) {
    fetchPromise = fetchAllData().then(data => {
      dataCache = data;
      fetchPromise = null;
      return data;
    }).catch(err => {
      fetchPromise = null;
      throw err;
    });
  }

  return fetchPromise;
}

// ─── Public API ───

export async function getAllStocks(): Promise<Stock[]> {
  const data = await getCachedData();
  return data.stocks;
}

export async function getStockBySymbol(symbol: string): Promise<Stock | undefined> {
  const data = await getCachedData();
  return data.stocks.find(s => s.symbol === symbol);
}

export async function getHistoricalData(symbol: string, days: number = 90): Promise<PricePoint[]> {
  const data = await getCachedData();
  const history = data.historyMap.get(symbol);
  if (!history) return [];
  return history.slice(-days);
}

export async function getSectors(): Promise<string[]> {
  return [...new Set(STOCK_LIST.map(s => s.sector))].sort();
}

export async function getSectorPerformance(): Promise<SectorPerformance[]> {
  const data = await getCachedData();
  return data.sectorPerformance;
}

export async function getTopStocks(limit: number = 10): Promise<Stock[]> {
  const data = await getCachedData();
  return [...data.stocks]
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
}

export async function getLoadingStatus(): Promise<{ loaded: number; total: number; loading: boolean }> {
  if (dataCache) {
    return { loaded: dataCache.loadedCount, total: dataCache.totalCount, loading: false };
  }
  return { loaded: currentProgress.loaded, total: STOCK_LIST.length, loading: !!fetchPromise };
}

// Pre-warm cache on module load
getCachedData().catch(err => console.error("[Yahoo] Pre-warm failed:", err));
