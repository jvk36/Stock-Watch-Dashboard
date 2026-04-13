# Stock Watchlist Supercharger

A professional, terminal-style dashboard for DIY investors. Track your personal stock watchlist with live fundamental and technical metrics, all color-coded at a glance — no spreadsheet wrangling required.

![Stock Watchlist Supercharger](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20PostgreSQL-blue)

---

## Features

- **Color-coded metrics table** — every column is green/yellow/red based on configurable thresholds
- **Live data** — prices, ratios, and technicals fetched in real time from Yahoo Finance
- **11 metrics per stock** — P/E (Forward), EPS Growth, Debt/Equity, 200d MA, 50d MA, RSI, Short Interest, Put/Call Ratio, Beta, and Implied Volatility
- **Add / remove tickers** — type any valid ticker symbol and it appears in seconds
- **Historical charts** — click any ticker to open a price + RSI chart with 1mo / 3mo / 6mo / 1y / 2y views
- **Golden & Death Cross detection** — MA50/MA200 crossovers are marked on the chart with an active status badge in the header
- **Three legend panels** — color meaning, Beta explanation, and IV ranges

---

## Metrics Reference

| Column | What it measures | Green | Yellow | Red |
|---|---|---|---|---|
| P/E (Fwd) | Forward price-to-earnings | < 20 | 20 – 40 | > 40 |
| EPS Gr (YoY) | Year-over-year earnings growth | > 15% | 5 – 15% | < 5% |
| Debt/Eq | Debt-to-equity ratio | < 0.5 | 0.5 – 1.5 | > 1.5 |
| 200d MA | Price vs 200-day moving avg | Above | — | Below |
| 50d MA | Price vs 50-day moving avg | Above | — | Below |
| RSI | 14-day Relative Strength Index | < 30 (oversold) | 30 – 70 | > 70 (overbought) |
| Short Int | Short interest % of float | < 3% | 3 – 5% | > 5% |
| Put/Call | Put/call open interest ratio | < 0.7 | 0.7 – 1.0 | > 1.0 |
| Beta | Market-relative volatility | — | no color coding | — |
| IV | Implied volatility (ATM options avg) | — | no color coding | — |

---

## Golden & Death Cross

Detected automatically in the chart modal from the historical MA50 / MA200 series:

- **☀ Golden Cross** — MA50 crosses *above* MA200. Historically a bullish long-term signal preceding sustained rallies.
- **✕ Death Cross** — MA50 crosses *below* MA200. Historically a bearish long-term signal preceding extended downtrends.

A status badge in the chart header ("★ GOLDEN CROSS ACTIVE" / "✕ DEATH CROSS ACTIVE") reflects the current regime. Vertical dashed lines on the price chart mark each cross event within the selected time window.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Express 5, Node.js, TypeScript, esbuild |
| Database | PostgreSQL + Drizzle ORM |
| API contract | OpenAPI 3 spec → Orval codegen (React Query hooks + Zod) |
| Data source | Yahoo Finance (direct HTTP — chart, quoteSummary, options) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
artifacts/
  api-server/        Express API server
  stock-watchlist/   React + Vite frontend
lib/
  api-spec/          OpenAPI spec + Orval codegen config
  api-client-react/  Generated React Query hooks and Zod schemas
  db/                Drizzle schema and PostgreSQL client
```

---

## Development

**Prerequisites:** Node 24, pnpm

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/stock-watchlist run dev

# Regenerate API client after changing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

---

## Data & Privacy

All stock data is fetched live from Yahoo Finance's public JSON APIs. No data is stored server-side beyond the list of tickers in the watchlist. The app defaults to a single shared `demo_user` — no authentication is required for the MVP.

---

## Deployment

Deployed on Replit. The PostgreSQL database and secrets (`SESSION_SECRET`, `DATABASE_URL`) are managed via Replit's environment.

For a deeper dive into architecture decisions and implementation choices, see [`summary.md`](./summary.md).
