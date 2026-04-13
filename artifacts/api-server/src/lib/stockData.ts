import { logger } from "./logger";
import { yahooFetch, getSession } from "./yahooSession";

export interface StockMetrics {
  ticker: string;
  companyName: string | null;
  currentPrice: number | null;
  peRatioForward: number | null;
  epsGrowthYoy: number | null;
  debtToEquity: number | null;
  ma200: number | null;
  ma50: number | null;
  rsi: number | null;
  shortInterestPct: number | null;
  putCallRatio: number | null;
  beta: number | null;
  impliedVolatility: number | null;
  lastUpdated: string | null;
}

export interface HistoricalDataPoint {
  date: string;
  price: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  volume: number | null;
}

export interface StockHistory {
  ticker: string;
  period: string;
  dataPoints: HistoricalDataPoint[];
}

function calculateRSI(prices: number[], period = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period + 1) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

function calculateSMA(prices: (number | null)[], period: number): (number | null)[] {
  const sma: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1).filter((p): p is number => p !== null);
    if (slice.length === period) {
      sma[i] = slice.reduce((a, b) => a + b, 0) / period;
    }
  }
  return sma;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        fiftyDayAverage?: number;
        twoHundredDayAverage?: number;
        longName?: string;
        shortName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

interface YahooSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: {
        forwardPE?: { raw?: number };
        shortPercentOfFloat?: { raw?: number };
        beta?: { raw?: number };
      };
      financialData?: {
        debtToEquity?: { raw?: number };
        earningsGrowth?: { raw?: number };
      };
    }>;
    error?: { description?: string; code?: string };
  };
}

export async function getStockMetrics(ticker: string): Promise<StockMetrics> {
  const upperTicker = ticker.toUpperCase();

  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperTicker)}?interval=1d&range=2y&includePrePost=false`;

  const chartData = await yahooFetch(chartUrl) as YahooChartResponse;
  const chart = chartData?.chart?.result?.[0];

  if (!chart) {
    throw new Error(`Ticker ${upperTicker} not found`);
  }

  const meta = chart.meta;
  const currentPrice = meta?.regularMarketPrice ?? null;
  const companyName = meta?.longName ?? meta?.shortName ?? null;

  // Compute MA50/MA200 and RSI from historical close prices
  const allCloses = chart.indicators?.quote?.[0]?.close ?? [];
  const closePrices = allCloses.map((c) => (c != null ? c : null));
  const validClosesForRsi = allCloses.filter((c): c is number => c != null);

  const ma50Values = calculateSMA(closePrices, 50);
  const ma200Values = calculateSMA(closePrices, 200);
  const lastMa50 = ma50Values[ma50Values.length - 1];
  const lastMa200 = ma200Values[ma200Values.length - 1];

  const ma50 = lastMa50 != null ? Math.round(lastMa50 * 100) / 100 : (meta?.fiftyDayAverage ?? null);
  const ma200 = lastMa200 != null ? Math.round(lastMa200 * 100) / 100 : (meta?.twoHundredDayAverage ?? null);

  let rsi: number | null = null;
  if (validClosesForRsi.length >= 15) {
    const rsiValues = calculateRSI(validClosesForRsi);
    const lastRsi = rsiValues[rsiValues.length - 1];
    rsi = !isNaN(lastRsi) ? Math.round(lastRsi * 100) / 100 : null;
  }

  // Try to get extra financial data with crumb
  let peRatioForward: number | null = null;
  let beta: number | null = null;
  let shortInterestPct: number | null = null;
  let epsGrowthYoy: number | null = null;
  let debtToEquity: number | null = null;

  try {
    const session = await getSession();
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(upperTicker)}?modules=defaultKeyStatistics,financialData&crumb=${encodeURIComponent(session.crumb)}`;
    const summaryData = await yahooFetch(summaryUrl) as YahooSummaryResponse;
    const summary = summaryData?.quoteSummary?.result?.[0];

    if (summary) {
      const keyStats = summary.defaultKeyStatistics;
      const finData = summary.financialData;

      peRatioForward = keyStats?.forwardPE?.raw ?? null;
      beta = keyStats?.beta?.raw ?? null;
      shortInterestPct = keyStats?.shortPercentOfFloat?.raw != null
        ? Math.round(keyStats.shortPercentOfFloat.raw * 10000) / 100
        : null;
      epsGrowthYoy = finData?.earningsGrowth?.raw != null
        ? Math.round(finData.earningsGrowth.raw * 10000) / 100
        : null;
      debtToEquity = finData?.debtToEquity?.raw != null
        ? Math.round(finData.debtToEquity.raw) / 100
        : null;
    }
  } catch (err) {
    logger.warn({ ticker: upperTicker, err }, "Could not fetch detailed financial data");
  }

  // Fetch options chain for put/call ratio and implied volatility
  let putCallRatio: number | null = null;
  let impliedVolatility: number | null = null;

  try {
    const session = await getSession();
    const optionsUrl = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(upperTicker)}?crumb=${encodeURIComponent(session.crumb)}`;
    const optionsData = await yahooFetch(optionsUrl) as {
      optionChain?: {
        result?: Array<{
          quote?: { regularMarketPrice?: number };
          options?: Array<{
            calls?: Array<{ openInterest?: number; impliedVolatility?: number; strike?: number }>;
            puts?: Array<{ openInterest?: number; impliedVolatility?: number; strike?: number }>;
          }>;
        }>;
      };
    };

    const chainResult = optionsData?.optionChain?.result?.[0];
    if (chainResult?.options?.length) {
      let totalCallsOI = 0;
      let totalPutsOI = 0;

      // Collect ATM options for IV calculation
      const spotPrice = chainResult.quote?.regularMarketPrice ?? currentPrice ?? 0;
      const atmIVs: number[] = [];

      for (const expiry of chainResult.options) {
        for (const call of expiry.calls ?? []) {
          totalCallsOI += call.openInterest ?? 0;
          if (spotPrice > 0 && call.strike != null) {
            const moneyness = Math.abs(call.strike - spotPrice) / spotPrice;
            if (moneyness < 0.05 && call.impliedVolatility != null && call.impliedVolatility > 0) {
              atmIVs.push(call.impliedVolatility);
            }
          }
        }
        for (const put of expiry.puts ?? []) {
          totalPutsOI += put.openInterest ?? 0;
          if (spotPrice > 0 && put.strike != null) {
            const moneyness = Math.abs(put.strike - spotPrice) / spotPrice;
            if (moneyness < 0.05 && put.impliedVolatility != null && put.impliedVolatility > 0) {
              atmIVs.push(put.impliedVolatility);
            }
          }
        }
      }

      if (totalCallsOI > 0) {
        putCallRatio = Math.round((totalPutsOI / totalCallsOI) * 100) / 100;
      }

      if (atmIVs.length > 0) {
        const avgIV = atmIVs.reduce((a, b) => a + b, 0) / atmIVs.length;
        impliedVolatility = Math.round(avgIV * 10000) / 100; // as percentage
      }
    }
  } catch (err) {
    logger.warn({ ticker: upperTicker, err }, "Could not fetch options data");
  }

  return {
    ticker: upperTicker,
    companyName,
    currentPrice,
    peRatioForward: peRatioForward != null ? Math.round(peRatioForward * 100) / 100 : null,
    epsGrowthYoy,
    debtToEquity,
    ma200: ma200 != null ? Math.round(ma200 * 100) / 100 : null,
    ma50: ma50 != null ? Math.round(ma50 * 100) / 100 : null,
    rsi,
    shortInterestPct,
    putCallRatio,
    beta: beta != null ? Math.round(beta * 100) / 100 : null,
    impliedVolatility,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getStockHistory(ticker: string, period: string): Promise<StockHistory> {
  const upperTicker = ticker.toUpperCase();

  const periodDays: Record<string, number> = {
    "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730,
  };

  // Always fetch 2y to have enough data for MA200 calculation
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperTicker)}?interval=1d&range=2y&includePrePost=false`;

  const data = await yahooFetch(url) as YahooChartResponse;
  const result = data?.chart?.result?.[0];

  if (!result?.timestamp) {
    throw new Error(`No historical data for ${upperTicker}`);
  }

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const volumes = result.indicators?.quote?.[0]?.volume ?? [];

  const prices = closes.map((c) => (c != null ? c : null));
  const ma50Values = calculateSMA(prices, 50);
  const ma200Values = calculateSMA(prices, 200);
  const validPrices = prices.map((p) => (p !== null ? p : 0));
  const rsiValues = calculateRSI(validPrices);

  // Filter to requested period
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (periodDays[period] ?? 180));

  const dataPoints: HistoricalDataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000);
    if (date < cutoffDate) continue;
    const dateStr = date.toISOString().split("T")[0];
    const rsiVal = rsiValues[i];
    dataPoints.push({
      date: dateStr,
      price: prices[i],
      ma50: ma50Values[i] != null ? Math.round((ma50Values[i] as number) * 100) / 100 : null,
      ma200: ma200Values[i] != null ? Math.round((ma200Values[i] as number) * 100) / 100 : null,
      rsi: !isNaN(rsiVal) ? Math.round(rsiVal * 100) / 100 : null,
      volume: volumes[i] ?? null,
    });
  }

  return { ticker: upperTicker, period, dataPoints };
}

export async function validateTicker(ticker: string): Promise<boolean> {
  const upperTicker = ticker.toUpperCase().trim();
  // Basic format validation: 1-5 uppercase letters, optionally with dots (e.g. BRK.B)
  const tickerRegex = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/;
  if (!tickerRegex.test(upperTicker)) {
    return false;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperTicker)}?interval=1d&range=5d`;
    const data = await yahooFetch(url) as YahooChartResponse;
    const result = data?.chart?.result?.[0];
    return result?.meta?.regularMarketPrice != null;
  } catch (err) {
    logger.warn({ ticker: upperTicker, err }, "Ticker validation request failed");
    // Accept format-valid tickers if network fails
    return true;
  }
}
