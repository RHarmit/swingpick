/**
 * Pre-fetch stock data locally and save as static JSON.
 * This runs in our sandbox (no rate-limiting issues) and produces
 * a snapshot that the server loads instantly on startup.
 */

import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

import fs from "fs";
import path from "path";

// Load stock list
const stockListPath = path.resolve("nifty500_stocks.json");
const STOCK_LIST = JSON.parse(fs.readFileSync(stockListPath, "utf8"));
console.log(`Loaded ${STOCK_LIST.length} stocks to fetch`);

function round(n, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function toNSE(symbol) { return `${symbol}.NS`; }

// Simple technical indicators
function calcSMA(closes, period) {
  const result = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = closes[0];
  result.push(ema);
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(closes, period = 14) {
  const result = [NaN];
  const gains = [];
  const losses = [];
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

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, histogram };
}

function calcBollingerBands(closes, period = 20, mult = 2) {
  const sma = calcSMA(closes, period);
  const upper = [], lower = [];
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

function calcATR(highs, lows, closes, period = 14) {
  const trs = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  const result = [];
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

function calcADX(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) return closes.map(() => NaN);
  const trs = [highs[0] - lows[0]], plusDM = [0], minusDM = [0];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
    const up = highs[i] - highs[i-1], down = lows[i-1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  let sTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let sPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  const dx = [];
  const pdi0 = sTR !== 0 ? (sPDM / sTR) * 100 : 0;
  const mdi0 = sTR !== 0 ? (sMDM / sTR) * 100 : 0;
  const sum0 = pdi0 + mdi0;
  dx.push(sum0 !== 0 ? (Math.abs(pdi0 - mdi0) / sum0) * 100 : 0);
  for (let i = period; i < closes.length; i++) {
    sTR = sTR - sTR / period + trs[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];
    const pdi = sTR !== 0 ? (sPDM / sTR) * 100 : 0;
    const mdi = sTR !== 0 ? (sMDM / sTR) * 100 : 0;
    const s = pdi + mdi;
    dx.push(s !== 0 ? (Math.abs(pdi - mdi) / s) * 100 : 0);
  }
  const result = [];
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

function calcStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const kValues = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) { kValues.push(NaN); continue; }
    let hh = -Infinity, ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) { if (highs[j] > hh) hh = highs[j]; if (lows[j] < ll) ll = lows[j]; }
    const range = hh - ll;
    kValues.push(range !== 0 ? ((closes[i] - ll) / range) * 100 : 50);
  }
  const validK = kValues.filter(v => !isNaN(v));
  const dValues = calcSMA(validK, dPeriod);
  const paddedD = [];
  let dIdx = 0;
  for (let i = 0; i < kValues.length; i++) {
    if (isNaN(kValues[i])) { paddedD.push(NaN); continue; }
    paddedD.push(dIdx < dValues.length ? (isNaN(dValues[dIdx]) ? kValues[i] : dValues[dIdx]) : kValues[i]);
    dIdx++;
  }
  return { k: kValues, d: paddedD };
}

function calcMFI(highs, lows, closes, volumes, period = 14) {
  const mfi = [];
  if (closes.length < period + 1) return mfi;
  const tp = [];
  for (let i = 0; i < closes.length; i++) tp.push((highs[i] + lows[i] + closes[i]) / 3);
  for (let i = period; i < closes.length; i++) {
    let pos = 0, neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const raw = tp[j] * volumes[j];
      if (tp[j] > tp[j-1]) pos += raw; else if (tp[j] < tp[j-1]) neg += raw;
    }
    mfi.push(neg === 0 ? 100 : 100 - (100 / (1 + pos / neg)));
  }
  return mfi;
}

function calcOBV(closes, volumes) {
  const obv = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) obv.push(obv[i-1] + volumes[i]);
    else if (closes[i] < closes[i-1]) obv.push(obv[i-1] - volumes[i]);
    else obv.push(obv[i-1]);
  }
  return obv;
}

function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
  return 0;
}

function calcFundamentalScore(quote, price) {
  let score = 50;
  const signals = [];
  const pe = quote.trailingPE ?? null;
  const forwardPe = quote.forwardPE ?? null;
  const eps = quote.epsTrailingTwelveMonths ?? null;
  const priceToBook = quote.priceToBook ?? null;
  const marketCap = quote.marketCap ?? 0;
  const dividendYield = quote.dividendYield ?? 0;
  const profitMargins = quote.profitMargins ?? null;
  const returnOnEquity = quote.returnOnEquity ?? null;
  const debtToEquity = quote.debtToEquity ?? null;
  const earningsGrowth = quote.earningsGrowth ?? null;

  if (pe !== null && pe > 0) {
    if (pe < 15) { score += 12; signals.push("Low PE (<15)"); }
    else if (pe < 25) { score += 6; signals.push("Fair PE"); }
    else if (pe > 50) { score -= 8; signals.push("High PE (>50)"); }
    else if (pe > 35) { score -= 4; }
  }
  if (forwardPe !== null && pe !== null && forwardPe > 0 && pe > 0) {
    if (forwardPe < pe * 0.85) { score += 8; signals.push("Earnings Growth Expected"); }
  }
  if (eps !== null) {
    if (eps > 0) score += 5;
    if (eps > price * 0.05) { score += 5; signals.push("Strong EPS"); }
  }
  if (priceToBook !== null && priceToBook > 0) {
    if (priceToBook < 2) { score += 8; signals.push("Low P/B (<2)"); }
    else if (priceToBook < 4) score += 3;
    else if (priceToBook > 8) { score -= 5; signals.push("High P/B (>8)"); }
  }
  if (marketCap > 500000000000) { score += 5; signals.push("Large Cap"); }
  else if (marketCap > 100000000000) { score += 3; signals.push("Mid Cap"); }
  else if (marketCap < 10000000000) { score -= 3; signals.push("Small Cap"); }
  if (dividendYield > 0.03) { score += 6; signals.push(`Dividend ${(dividendYield * 100).toFixed(1)}%`); }
  else if (dividendYield > 0.01) score += 3;
  if (profitMargins !== null) {
    if (profitMargins > 0.20) { score += 8; signals.push("High Margins (>20%)"); }
    else if (profitMargins > 0.10) score += 4;
    else if (profitMargins < 0) { score -= 8; signals.push("Negative Margins"); }
  }
  if (returnOnEquity !== null) {
    if (returnOnEquity > 0.20) { score += 8; signals.push("High ROE (>20%)"); }
    else if (returnOnEquity > 0.12) score += 4;
    else if (returnOnEquity < 0) { score -= 6; signals.push("Negative ROE"); }
  }
  if (debtToEquity !== null) {
    if (debtToEquity < 0.5) { score += 8; signals.push("Low Debt"); }
    else if (debtToEquity < 1) score += 4;
    else if (debtToEquity > 2) { score -= 6; signals.push("High Debt (>2x)"); }
    else if (debtToEquity > 1.5) score -= 3;
  }
  if (earningsGrowth !== null) {
    if (earningsGrowth > 0.20) { score += 8; signals.push("Earnings Growth >20%"); }
    else if (earningsGrowth > 0.05) score += 4;
    else if (earningsGrowth < -0.10) { score -= 6; signals.push("Earnings Declining"); }
  }
  const high52 = quote.fiftyTwoWeekHigh ?? 0;
  const low52 = quote.fiftyTwoWeekLow ?? 0;
  if (high52 > 0 && low52 > 0) {
    const range52 = high52 - low52;
    if (range52 > 0) {
      const position = (price - low52) / range52;
      if (position < 0.3) { score += 5; signals.push("Near 52w Low"); }
      else if (position > 0.9) { score -= 3; signals.push("Near 52w High"); }
    }
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), signals };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchOne(meta) {
  const nse = toNSE(meta.symbol);
  try {
    const [quote, chartRes] = await Promise.all([
      yf.quote(nse),
      yf.chart(nse, {
        period1: new Date(Date.now() - 300 * 86400000),
        period2: new Date(),
        interval: "1d",
      }),
    ]);
    if (!quote) return null;
    const history = (chartRes?.quotes || []).filter(q => q.close != null && q.high != null && q.low != null);
    if (history.length < 30) return null;

    const closes = history.map(h => h.close);
    const highs = history.map(h => h.high);
    const lows = history.map(h => h.low);
    const volumes = history.map(h => h.volume || 0);

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
    const name = quote.shortName || quote.longName || meta.symbol;
    const recentVols = volumes.slice(-20);
    const avgVolume = recentVols.length > 0 ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length) : volume;

    let change2d = 0;
    if (closes.length >= 3) {
      const close2dAgo = closes[closes.length - 3];
      if (close2dAgo > 0) change2d = round(((price - close2dAgo) / close2dAgo) * 100, 2);
    }

    const rsi14 = last(calcRSI(closes, 14));
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
    const mfiArr = calcMFI(highs, lows, closes, volumes, 14);
    const mfi14 = mfiArr.length > 0 ? mfiArr[mfiArr.length - 1] : 50;
    const mfiPrev = mfiArr.length > 1 ? mfiArr[mfiArr.length - 2] : mfi14;
    const mfiChange = round(mfi14 - mfiPrev, 2);
    let buyingPressure;
    if (mfi14 >= 80) buyingPressure = "high_buying";
    else if (mfi14 >= 60) buyingPressure = "buying";
    else if (mfi14 >= 40) buyingPressure = "neutral";
    else if (mfi14 >= 20) buyingPressure = "selling";
    else buyingPressure = "high_selling";

    const vwapFinal = quote.vwap ?? ((dayHigh + dayLow + price) / 3);

    let swingScore = 50;
    const patterns = [];
    const volumeMultiplier = avgVolume > 0 ? volume / avgVolume : 1;
    if (rsi14 < 30) { swingScore += 15; patterns.push("RSI Oversold"); }
    else if (rsi14 > 70) { swingScore -= 15; patterns.push("RSI Overbought"); }
    else if (rsi14 >= 40 && rsi14 <= 60) swingScore += 5;
    if (macdHistogram > 0 && macdLine > macdSignal) { swingScore += 12; patterns.push("MACD Bullish Cross"); }
    else if (macdHistogram < 0 && macdLine < macdSignal) { swingScore -= 8; patterns.push("MACD Bearish"); }
    if (price > sma20 && price > sma50) { swingScore += 10; patterns.push("Above SMA 20/50"); }
    if (price > sma200) { swingScore += 5; patterns.push("Above SMA 200"); }
    if (price < sma20 && price < sma50) swingScore -= 10;
    if (ema9 > ema21) { swingScore += 8; patterns.push("EMA 9/21 Bullish"); }
    if (volumeMultiplier > 1.5) { swingScore += 10; patterns.push("High Volume Surge"); }
    if (volumeMultiplier > 2.0) patterns.push("Volume Breakout");
    if (adx14 > 25) { swingScore += 8; patterns.push("Strong Trend (ADX)"); }
    if (price < bollingerLower) { swingScore += 12; patterns.push("BB Lower Band Touch"); }
    if (price > bollingerUpper) { swingScore -= 5; patterns.push("BB Upper Band Touch"); }
    if (stochK < 20 && stochD < 20) { swingScore += 8; patterns.push("Stoch Oversold"); }
    if (stochK > 80 && stochD > 80) swingScore -= 5;
    if (stochK > stochD && stochK < 50) { swingScore += 5; patterns.push("Stoch Bullish Cross"); }
    if (price > vwapFinal && price < vwapFinal * 1.01) { swingScore += 5; patterns.push("VWAP Support"); }
    if (mfi14 >= 80) patterns.push("MFI High Buying");
    else if (mfi14 <= 20) { swingScore += 10; patterns.push("MFI Oversold"); }
    if (mfiChange > 10) { swingScore += 8; patterns.push("Buying Surge (MFI)"); }
    else if (mfiChange > 5) { swingScore += 4; patterns.push("Buying Increasing"); }
    swingScore = Math.max(0, Math.min(100, Math.round(swingScore)));

    let signal;
    if (swingScore >= 75) signal = "strong_buy";
    else if (swingScore >= 60) signal = "buy";
    else if (swingScore >= 40) signal = "neutral";
    else if (swingScore >= 25) signal = "sell";
    else signal = "strong_sell";

    const fundamental = calcFundamentalScore(quote, price);
    const sentimentScore = 50; // Neutral default
    const combinedScore = Math.round(swingScore * 0.40 + fundamental.score * 0.30 + sentimentScore * 0.30);
    let combinedSignal;
    if (combinedScore >= 75) combinedSignal = "strong_buy";
    else if (combinedScore >= 60) combinedSignal = "buy";
    else if (combinedScore >= 40) combinedSignal = "neutral";
    else if (combinedScore >= 25) combinedSignal = "sell";
    else combinedSignal = "strong_sell";

    return {
      symbol: meta.symbol, name, sector: meta.sector,
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
      sentimentScore: 50, sentimentLabel: "neutral",
      newsCount: 0,
      combinedScore, combinedSignal, change2d,
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  const BATCH = 15;
  const DELAY = 150;
  const stocks = [];
  let failed = 0;

  for (let i = 0; i < STOCK_LIST.length; i += BATCH) {
    const batch = STOCK_LIST.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(m => fetchOne(m)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) stocks.push(r.value);
      else failed++;
    }
    const pct = Math.round(((i + BATCH) / STOCK_LIST.length) * 100);
    process.stdout.write(`\r[Prefetch] ${Math.min(i + BATCH, STOCK_LIST.length)}/${STOCK_LIST.length} (${pct}%) - ${stocks.length} ok, ${failed} failed`);

    if (i + BATCH < STOCK_LIST.length) await sleep(DELAY);
  }

  console.log(`\n[Prefetch] Done: ${stocks.length} stocks fetched`);

  // Save as JSON
  const outPath = path.resolve("prebaked-stocks.json");
  fs.writeFileSync(outPath, JSON.stringify({
    stocks,
    timestamp: Date.now(),
    generatedAt: new Date().toISOString(),
  }));
  console.log(`Saved to ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(console.error);
