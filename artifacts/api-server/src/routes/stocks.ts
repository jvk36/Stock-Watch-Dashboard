import { Router, type IRouter } from "express";
import {
  GetStockMetricsParams,
  GetStockHistoryParams,
  GetStockHistoryQueryParams,
} from "@workspace/api-zod";
import { getStockMetrics, getStockHistory } from "../lib/stockData";

const router: IRouter = Router();

router.get("/stocks/:ticker/metrics", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.ticker) ? req.params.ticker[0] : req.params.ticker;
  const parsed = GetStockMetricsParams.safeParse({ ticker: raw });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ticker" });
    return;
  }

  try {
    const metrics = await getStockMetrics(parsed.data.ticker);
    res.json(metrics);
  } catch {
    res.status(404).json({ error: `Ticker ${parsed.data.ticker} not found or data unavailable` });
  }
});

router.get("/stocks/:ticker/history", async (req, res): Promise<void> => {
  const rawTicker = Array.isArray(req.params.ticker) ? req.params.ticker[0] : req.params.ticker;
  const tickerParsed = GetStockHistoryParams.safeParse({ ticker: rawTicker });
  if (!tickerParsed.success) {
    res.status(400).json({ error: "Invalid ticker" });
    return;
  }

  const queryParsed = GetStockHistoryQueryParams.safeParse(req.query);
  const period = queryParsed.success ? (queryParsed.data.period ?? "6mo") : "6mo";

  try {
    const history = await getStockHistory(tickerParsed.data.ticker, period);
    res.json(history);
  } catch {
    res.status(404).json({ error: `Historical data for ${tickerParsed.data.ticker} not available` });
  }
});

export default router;
