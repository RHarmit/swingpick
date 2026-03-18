import type { Stock, PricePoint } from "@shared/schema";

interface StockSeed {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
  marketCap: number;
  pe: number | null;
  eps: number | null;
}

const stockSeeds: StockSeed[] = [
  // IT
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT", basePrice: 3845, marketCap: 1400000, pe: 32.5, eps: 118.3 },
  { symbol: "INFY", name: "Infosys Ltd", sector: "IT", basePrice: 1892, marketCap: 785000, pe: 28.7, eps: 65.9 },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "IT", basePrice: 1756, marketCap: 478000, pe: 26.3, eps: 66.8 },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT", basePrice: 572, marketCap: 297000, pe: 24.1, eps: 23.7 },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "IT", basePrice: 1654, marketCap: 160000, pe: 38.2, eps: 43.3 },
  { symbol: "LTIM", name: "LTIMindtree Ltd", sector: "IT", basePrice: 5890, marketCap: 174000, pe: 35.6, eps: 165.4 },
  { symbol: "COFORGE", name: "Coforge Ltd", sector: "IT", basePrice: 7420, marketCap: 46000, pe: 52.3, eps: 141.9 },
  { symbol: "PERSISTENT", name: "Persistent Systems", sector: "IT", basePrice: 5340, marketCap: 82000, pe: 68.5, eps: 77.9 },
  // Banking
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking", basePrice: 1720, marketCap: 1310000, pe: 19.8, eps: 86.9 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Banking", basePrice: 1285, marketCap: 900000, pe: 18.2, eps: 70.6 },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking", basePrice: 832, marketCap: 742000, pe: 10.5, eps: 79.2 },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking", basePrice: 1845, marketCap: 367000, pe: 21.3, eps: 86.6 },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Banking", basePrice: 1178, marketCap: 364000, pe: 14.8, eps: 79.6 },
  { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", sector: "Banking", basePrice: 1045, marketCap: 81000, pe: 11.2, eps: 93.3 },
  { symbol: "BANDHANBNK", name: "Bandhan Bank Ltd", sector: "Banking", basePrice: 198, marketCap: 32000, pe: 12.4, eps: 16.0 },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank", sector: "Banking", basePrice: 72, marketCap: 51000, pe: 22.5, eps: 3.2 },
  // Pharma
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Pharma", basePrice: 1842, marketCap: 442000, pe: 36.8, eps: 50.1 },
  { symbol: "DRREDDY", name: "Dr. Reddy's Labs", sector: "Pharma", basePrice: 6520, marketCap: 109000, pe: 22.4, eps: 291.1 },
  { symbol: "CIPLA", name: "Cipla Ltd", sector: "Pharma", basePrice: 1534, marketCap: 124000, pe: 28.9, eps: 53.1 },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", sector: "Pharma", basePrice: 5780, marketCap: 154000, pe: 68.2, eps: 84.7 },
  { symbol: "BIOCON", name: "Biocon Ltd", sector: "Pharma", basePrice: 345, marketCap: 41000, pe: 42.3, eps: 8.2 },
  // Auto
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Auto", basePrice: 978, marketCap: 360000, pe: 8.9, eps: 109.9 },
  { symbol: "MARUTI", name: "Maruti Suzuki India", sector: "Auto", basePrice: 12450, marketCap: 392000, pe: 28.5, eps: 436.8 },
  { symbol: "M&M", name: "Mahindra & Mahindra", sector: "Auto", basePrice: 3120, marketCap: 388000, pe: 31.2, eps: 100.0 },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", sector: "Auto", basePrice: 9870, marketCap: 277000, pe: 33.8, eps: 292.0 },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd", sector: "Auto", basePrice: 4980, marketCap: 136000, pe: 34.5, eps: 144.3 },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", sector: "Auto", basePrice: 5640, marketCap: 113000, pe: 26.8, eps: 210.4 },
  // FMCG
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG", basePrice: 2580, marketCap: 606000, pe: 56.2, eps: 45.9 },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", basePrice: 472, marketCap: 590000, pe: 28.4, eps: 16.6 },
  { symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "FMCG", basePrice: 2540, marketCap: 245000, pe: 72.5, eps: 35.0 },
  { symbol: "BRITANNIA", name: "Britannia Industries", sector: "FMCG", basePrice: 5720, marketCap: 138000, pe: 58.3, eps: 98.1 },
  { symbol: "DABUR", name: "Dabur India Ltd", sector: "FMCG", basePrice: 548, marketCap: 97000, pe: 52.1, eps: 10.5 },
  { symbol: "GODREJCP", name: "Godrej Consumer Prods", sector: "FMCG", basePrice: 1380, marketCap: 141000, pe: 62.4, eps: 22.1 },
  // Energy
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", basePrice: 2945, marketCap: 1993000, pe: 27.6, eps: 106.7 },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", sector: "Energy", basePrice: 278, marketCap: 350000, pe: 8.2, eps: 33.9 },
  { symbol: "BPCL", name: "Bharat Petroleum", sector: "Energy", basePrice: 345, marketCap: 75000, pe: 5.8, eps: 59.5 },
  { symbol: "IOC", name: "Indian Oil Corporation", sector: "Energy", basePrice: 168, marketCap: 237000, pe: 6.4, eps: 26.3 },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Energy", basePrice: 2870, marketCap: 328000, pe: 78.5, eps: 36.6 },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", sector: "Power", basePrice: 1720, marketCap: 272000, pe: 185.0, eps: 9.3 },
  // Metals
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Metals", basePrice: 152, marketCap: 189000, pe: 58.2, eps: 2.6 },
  { symbol: "HINDALCO", name: "Hindalco Industries", sector: "Metals", basePrice: 648, marketCap: 146000, pe: 11.8, eps: 54.9 },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", sector: "Metals", basePrice: 945, marketCap: 229000, pe: 32.4, eps: 29.2 },
  { symbol: "VEDL", name: "Vedanta Ltd", sector: "Metals", basePrice: 445, marketCap: 166000, pe: 7.5, eps: 59.3 },
  { symbol: "COALINDIA", name: "Coal India Ltd", sector: "Metals", basePrice: 478, marketCap: 295000, pe: 9.8, eps: 48.8 },
  // Telecom
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", basePrice: 1780, marketCap: 1060000, pe: 76.2, eps: 23.4 },
  { symbol: "IDEA", name: "Vodafone Idea Ltd", sector: "Telecom", basePrice: 14.5, marketCap: 100000, pe: null, eps: null },
  // Financial Services
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services", basePrice: 7250, marketCap: 449000, pe: 32.8, eps: 221.0 },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", sector: "Financial Services", basePrice: 1780, marketCap: 284000, pe: 28.5, eps: 62.5 },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Financial Services", basePrice: 1640, marketCap: 164000, pe: 72.3, eps: 22.7 },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Financial Services", basePrice: 678, marketCap: 146000, pe: 82.5, eps: 8.2 },
  // Cement / Infra
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Cement", basePrice: 11250, marketCap: 325000, pe: 40.2, eps: 279.9 },
  { symbol: "SHREECEM", name: "Shree Cement Ltd", sector: "Cement", basePrice: 26800, marketCap: 97000, pe: 42.5, eps: 630.6 },
  { symbol: "LT", name: "Larsen & Toubro", sector: "Infra", basePrice: 3680, marketCap: 506000, pe: 36.8, eps: 100.0 },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ", sector: "Infra", basePrice: 1380, marketCap: 298000, pe: 32.5, eps: 42.5 },
  // Power
  { symbol: "NTPC", name: "NTPC Ltd", sector: "Power", basePrice: 385, marketCap: 374000, pe: 18.5, eps: 20.8 },
  { symbol: "POWERGRID", name: "Power Grid Corp", sector: "Power", basePrice: 325, marketCap: 302000, pe: 18.2, eps: 17.9 },
  { symbol: "TATAPOWER", name: "Tata Power Co Ltd", sector: "Power", basePrice: 438, marketCap: 140000, pe: 38.5, eps: 11.4 },
  // Chemicals
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Chemicals", basePrice: 3180, marketCap: 162000, pe: 82.5, eps: 38.5 },
  { symbol: "SRF", name: "SRF Ltd", sector: "Chemicals", basePrice: 2480, marketCap: 73000, pe: 44.2, eps: 56.1 },
  // Real Estate
  { symbol: "DLF", name: "DLF Ltd", sector: "Real Estate", basePrice: 878, marketCap: 217000, pe: 52.3, eps: 16.8 },
  { symbol: "GODREJPROP", name: "Godrej Properties", sector: "Real Estate", basePrice: 2840, marketCap: 79000, pe: 68.5, eps: 41.5 },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function round(n: number, decimals: number = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function generateStock(seed: StockSeed): Stock {
  const s = seed.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const volatility = 0.02 + seededRandom(s * 1) * 0.04;
  const trend = (seededRandom(s * 2) - 0.45) * 0.08;

  const price = seed.basePrice * (1 + trend + (seededRandom(s * 3) - 0.5) * volatility * 2);
  const change = price * ((seededRandom(s * 4) - 0.45) * 0.04);
  const changePct = (change / price) * 100;

  const dayRange = price * volatility * 0.6;
  const dayLow = price - dayRange * seededRandom(s * 5);
  const dayHigh = price + dayRange * seededRandom(s * 6);
  const open = price + (seededRandom(s * 7) - 0.5) * dayRange * 0.5;
  const prevClose = price - change;

  const range52w = price * (0.25 + seededRandom(s * 8) * 0.2);
  const high52w = price + range52w * (0.3 + seededRandom(s * 9) * 0.7);
  const low52w = price - range52w * (0.3 + seededRandom(s * 10) * 0.5);

  const avgVolume = Math.round(500000 + seededRandom(s * 11) * 10000000);
  const volumeMultiplier = 0.5 + seededRandom(s * 12) * 2.0;
  const volume = Math.round(avgVolume * volumeMultiplier);

  const rsi14 = 20 + seededRandom(s * 13) * 60;

  const macdLine = (seededRandom(s * 14) - 0.45) * price * 0.02;
  const macdSignal = macdLine * (0.7 + seededRandom(s * 15) * 0.3) + (seededRandom(s * 16) - 0.5) * price * 0.003;
  const macdHistogram = macdLine - macdSignal;

  const sma20 = price * (0.97 + seededRandom(s * 17) * 0.06);
  const sma50 = price * (0.94 + seededRandom(s * 18) * 0.12);
  const sma200 = price * (0.88 + seededRandom(s * 19) * 0.24);
  const ema9 = price * (0.985 + seededRandom(s * 20) * 0.03);
  const ema21 = price * (0.975 + seededRandom(s * 21) * 0.05);

  const bbStd = price * (0.02 + seededRandom(s * 22) * 0.03);
  const bollingerMiddle = sma20;
  const bollingerUpper = bollingerMiddle + 2 * bbStd;
  const bollingerLower = bollingerMiddle - 2 * bbStd;

  const atr14 = price * (0.01 + seededRandom(s * 23) * 0.03);
  const adx14 = 10 + seededRandom(s * 24) * 50;

  const stochK = 5 + seededRandom(s * 25) * 90;
  const stochD = stochK * (0.8 + seededRandom(s * 26) * 0.2) + (seededRandom(s * 27) - 0.5) * 10;

  const vwap = price * (0.99 + seededRandom(s * 28) * 0.02);
  const obv = Math.round((seededRandom(s * 29) - 0.4) * 50000000);

  let swingScore = 50;
  const patterns: string[] = [];

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

  if (price > vwap && price < vwap * 1.01) { swingScore += 5; patterns.push("VWAP Support"); }

  swingScore = Math.max(0, Math.min(100, Math.round(swingScore)));

  let signal: Stock["signal"];
  if (swingScore >= 75) signal = "strong_buy";
  else if (swingScore >= 60) signal = "buy";
  else if (swingScore >= 40) signal = "neutral";
  else if (swingScore >= 25) signal = "sell";
  else signal = "strong_sell";

  return {
    symbol: seed.symbol, name: seed.name, sector: seed.sector,
    price: round(price), change: round(change), changePct: round(changePct, 2),
    volume, avgVolume, marketCap: seed.marketCap,
    high52w: round(high52w), low52w: round(low52w),
    dayHigh: round(dayHigh), dayLow: round(dayLow),
    open: round(open), prevClose: round(prevClose),
    pe: seed.pe, eps: seed.eps,
    rsi14: round(rsi14, 1), macdLine: round(macdLine, 2), macdSignal: round(macdSignal, 2), macdHistogram: round(macdHistogram, 2),
    sma20: round(sma20), sma50: round(sma50), sma200: round(sma200),
    ema9: round(ema9), ema21: round(ema21),
    bollingerUpper: round(bollingerUpper), bollingerMiddle: round(bollingerMiddle), bollingerLower: round(bollingerLower),
    atr14: round(atr14, 2), adx14: round(adx14, 1),
    stochK: round(stochK, 1), stochD: round(Math.max(0, Math.min(100, stochD)), 1),
    vwap: round(vwap), obv, swingScore, signal, patterns,
  };
}

let _allStocks: Stock[] | null = null;

export function getAllStocks(): Stock[] {
  if (!_allStocks) {
    _allStocks = stockSeeds.map(seed => generateStock(seed));
  }
  return _allStocks;
}

export function getStockBySymbol(symbol: string): Stock | undefined {
  return getAllStocks().find(s => s.symbol === symbol);
}

export function getHistoricalData(symbol: string, days: number = 90): PricePoint[] {
  const seed = stockSeeds.find(s => s.symbol === symbol);
  if (!seed) return [];

  const points: PricePoint[] = [];
  const today = new Date();
  let currentPrice = seed.basePrice * 0.9;

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const s = seed.symbol.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0) + i;
    const dailyReturn = (seededRandom(s * 100) - 0.48) * 0.03;
    currentPrice = currentPrice * (1 + dailyReturn);

    const volatility = currentPrice * (0.01 + seededRandom(s * 101) * 0.02);
    const open = currentPrice + (seededRandom(s * 102) - 0.5) * volatility;
    const close = currentPrice;
    const high = Math.max(open, close) + seededRandom(s * 103) * volatility;
    const low = Math.min(open, close) - seededRandom(s * 104) * volatility;
    const volume = Math.round(500000 + seededRandom(s * 105) * 10000000);

    points.push({
      date: date.toISOString().split("T")[0],
      open: round(open), high: round(high), low: round(low), close: round(close), volume,
    });
  }
  return points;
}

export function getSectors(): string[] {
  return [...new Set(stockSeeds.map(s => s.sector))].sort();
}
