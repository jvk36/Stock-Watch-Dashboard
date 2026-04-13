import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, watchlistTable } from "@workspace/db";
import {
  GetWatchlistQueryParams,
  AddToWatchlistBody,
  RemoveFromWatchlistParams,
  GetWatchlistMetricsQueryParams,
} from "@workspace/api-zod";
import { getStockMetrics, validateTicker } from "../lib/stockData";

const router: IRouter = Router();

router.get("/watchlist", async (req, res): Promise<void> => {
  const parsed = GetWatchlistQueryParams.safeParse(req.query);
  const username = parsed.success ? (parsed.data.username ?? "demo") : "demo";

  const entries = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.username, username))
    .orderBy(watchlistTable.addedAt);

  res.json(
    entries.map((e) => ({
      id: e.id,
      username: e.username,
      ticker: e.ticker,
      addedAt: e.addedAt.toISOString(),
    }))
  );
});

router.post("/watchlist/add", async (req, res): Promise<void> => {
  const parsed = AddToWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const username = parsed.data.username ?? "demo";
  const ticker = parsed.data.ticker.toUpperCase().trim();

  if (!ticker) {
    res.status(400).json({ error: "Ticker symbol is required" });
    return;
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(watchlistTable)
    .where(and(eq(watchlistTable.username, username), eq(watchlistTable.ticker, ticker)));

  if (existing.length > 0) {
    res.status(409).json({ error: `${ticker} is already in your watchlist` });
    return;
  }

  // Validate the ticker exists
  const isValid = await validateTicker(ticker);
  if (!isValid) {
    res.status(400).json({ error: `Invalid ticker symbol: ${ticker}` });
    return;
  }

  const [entry] = await db
    .insert(watchlistTable)
    .values({ username, ticker })
    .returning();

  res.status(201).json({
    id: entry.id,
    username: entry.username,
    ticker: entry.ticker,
    addedAt: entry.addedAt.toISOString(),
  });
});

router.delete("/watchlist/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RemoveFromWatchlistParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(watchlistTable)
    .where(eq(watchlistTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Watchlist entry not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/watchlist/bulk-metrics", async (req, res): Promise<void> => {
  const parsed = GetWatchlistMetricsQueryParams.safeParse(req.query);
  const username = parsed.success ? (parsed.data.username ?? "demo") : "demo";

  const entries = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.username, username))
    .orderBy(watchlistTable.addedAt);

  if (entries.length === 0) {
    res.json([]);
    return;
  }

  const metricsResults = await Promise.allSettled(
    entries.map((e) => getStockMetrics(e.ticker))
  );

  const metrics = metricsResults.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    req.log.warn({ ticker: entries[i].ticker }, "Failed to fetch metrics for ticker");
    return {
      ticker: entries[i].ticker,
      companyName: null,
      currentPrice: null,
      peRatioForward: null,
      epsGrowthYoy: null,
      debtToEquity: null,
      ma200: null,
      ma50: null,
      rsi: null,
      shortInterestPct: null,
      putCallRatio: null,
      beta: null,
      lastUpdated: null,
    };
  });

  res.json(metrics);
});

export default router;
