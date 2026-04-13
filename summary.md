# Stock Watchlist Supercharger — Project Summary

## Project Goal

A single-screen dashboard for DIY investors: a color-coded spreadsheet showing key fundamental and technical metrics for a personal stock watchlist. Users can add/remove tickers, see live data color-coded green/yellow/red, and click any ticker to open a historical chart with moving averages, RSI, and Golden/Death Cross markers.

---

## Architecture

### Monorepo Layout

```
artifacts/
  api-server/          — Express 5 backend (Node/TypeScript, esbuild)
  stock-watchlist/     — React + Vite frontend (TypeScript, Tailwind, shadcn/ui)
  mockup-sandbox/      — Canvas component preview server (unused in prod)
lib/
  api-spec/            — OpenAPI YAML spec + Orval codegen config
  api-client-react/    — Auto-generated React Query hooks + Zod schemas
  db/                  — Drizzle ORM schema + PostgreSQL client
```

### Data Flow

1. Frontend calls generated React Query hooks (`useGetWatchlistMetrics`, `useGetStockHistory`, etc.)
2. Hooks hit Express API routes on `/api/*`
3. API fetches live data from Yahoo Finance, returns it to the client
4. No server-side caching of stock data — every request fetches fresh from Yahoo Finance

---

## Key Technical Decisions

### Data Source: Yahoo Finance (Direct HTTP, No Library)

**Decision:** Use direct `fetch()` calls to Yahoo Finance's undocumented JSON APIs instead of the `yahoo-finance2` npm package.

**Why:** `yahoo-finance2` caused esbuild bundling errors due to Deno test files (`.ts` files importing `@std/` and `@gadicc/` Deno modules) that esbuild couldn't resolve. Direct HTTP calls to the same underlying Yahoo Finance endpoints avoided all bundling conflicts.

**Endpoints used:**
- `v8/finance/chart/{ticker}` — price history, MA50, MA200 from meta fields, OHLCV data
- `v10/finance/quoteSummary/{ticker}?modules=defaultKeyStatistics,financialData` — P/E, Beta, Short Interest, EPS growth, Debt/Equity
- `v7/finance/options/{ticker}` — options chain for Put/Call ratio and Implied Volatility

### Yahoo Finance Authentication (Crumb + Cookie Session)

**Decision:** Implement a server-side session manager (`yahooSession.ts`) that fetches a cookie from `fc.yahoo.com` and exchanges it for a crumb token via `/v1/test/getcrumb`.

**Why:** Yahoo Finance's `v10/quoteSummary` and `v7/options` endpoints require a valid crumb (CSRF token) passed as a query parameter, or they return `{"error": {"code": "Unauthorized", "description": "Invalid Crumb"}}`. The crumb is paired with a session cookie. The session is cached for 30 minutes and auto-refreshes on expiry or 401.

### Moving Averages Computed Server-Side

**Decision:** Fetch 2 years of daily OHLCV data and compute MA50 and MA200 server-side from the close prices rather than relying on Yahoo's `fiftyDayAverage` / `twoHundredDayAverage` meta fields.

**Why:** The meta fields only return the current-day value, not the full historical series needed to plot MA lines on the chart. Server-side SMA computation from the full history provides both the current scalar (for the dashboard table) and the full series (for the chart).

### Put/Call Ratio — Real Options Data

**Decision:** Compute the Put/Call ratio from the full options chain open interest: `sum(puts OI) / sum(calls OI)`.

**Why:** Yahoo Finance has no dedicated endpoint returning a pre-computed aggregate P/C ratio. The options chain endpoint (`v7/finance/options`) provides full chains; summing open interest across all expirations gives a meaningful whole-market P/C ratio for that ticker.

### Implied Volatility — ATM Average

**Decision:** Compute IV as the average `impliedVolatility` of all near-the-money options (strikes within ±5% of spot price) from the nearest expiration.

**Why:** A single-number IV figure for a stock is inherently a simplification. ATM options best reflect the market's forward-looking uncertainty for the underlying. Averaging both ATM calls and puts reduces the bid/ask spread effect on IV.

### API Contract: OpenAPI → Orval Codegen

**Decision:** All API shapes are defined in `lib/api-spec/openapi.yaml`. Running `pnpm --filter @workspace/api-spec run codegen` regenerates typed React Query hooks and Zod validators into `lib/api-client-react/`.

**Why:** Keeps the frontend and backend in sync via a single source of truth. Adding a new field (e.g., `impliedVolatility`) requires updating the YAML, running codegen, and the TypeScript type flows through automatically.

---

## Features Built

### Dashboard Table

| Column | Source | Color Coding |
|---|---|---|
| Price | Yahoo chart meta | None |
| P/E (Fwd) | quoteSummary `defaultKeyStatistics.forwardPE` | <20 green, 20-40 yellow, >40 red |
| EPS Gr (YoY) | quoteSummary `financialData.earningsGrowth` | >15% green, 5-15% yellow, <5% red |
| Debt/Eq | quoteSummary `financialData.debtToEquity` | <0.5 green, 0.5-1.5 yellow, >1.5 red |
| 200d MA | Computed SMA(200) from 2y history | Price > MA green, else yellow |
| 50d MA | Computed SMA(50) from 2y history | Price > MA green, else yellow |
| RSI | Computed RSI(14) from 3mo closes | <30 green, 30-70 yellow, >70 red |
| Short Int | quoteSummary `shortPercentOfFloat` | <3% green, 3-5% yellow, >5% red |
| Put/Call | Options chain OI (puts/calls) | <0.7 green, 0.7-1.0 yellow, >1.0 red |
| Beta | quoteSummary `beta` | No color coding |
| IV | ATM options impliedVolatility avg | No color coding |

### Three Legend Panels

1. **Color Legend** — green/yellow/red meaning
2. **Beta** — explains market-relative volatility (= 1.0 tandem, < 1.0 low vol, > 1.0 high vol, = 0 independent, < 0 inverse)
3. **Implied Volatility (IV)** — explains annualized expected move (<30% low/cheap, 30-50% moderate, >50% high/expensive)

### Chart Modal

Opened by clicking any ticker in the table. Contains:

- **Period selector** — 1mo / 3mo / 6mo / 1y / 2y
- **Price chart** — price line + MA50 (yellow dashed) + MA200 (green dashed)
- **Golden/Death Cross markers** — vertical dashed reference lines at every cross event in the visible window, labeled ☀ (golden, gold color) or ✕ (death, red color)
- **Current cross state badge** — "★ GOLDEN CROSS ACTIVE" or "✕ DEATH CROSS ACTIVE" shown in the modal title
- **Cross legend panel** — explains both signals in plain language
- **RSI(14) chart** — area chart with reference lines at 30 (oversold) and 70 (overbought)

### Cross Detection Logic

```ts
// Detects where MA50 crosses MA200 in the historical dataPoints array
for each consecutive pair (prev, curr):
  if prev.ma50 <= prev.ma200 AND curr.ma50 > curr.ma200 → Golden Cross
  if prev.ma50 >= prev.ma200 AND curr.ma50 < curr.ma200 → Death Cross
```

---

## Database Schema

```ts
// lib/db/src/schema/watchlist.ts
watchlistTable {
  id:        serial primary key
  username:  text (default "demo_user" for MVP)
  ticker:    text
  addedAt:   timestamp (default now())
}
```

Default username is `demo_user` — hardcoded in the frontend for the MVP. No authentication layer.

---

## esbuild Notes

The API server bundles with esbuild via a custom `build.mjs`. A plugin ignores unresolvable Deno-style imports that appeared transitively from `yahoo-finance2` test files:

```js
// Ignore patterns: yahoo-finance2/esm/tests/*, @std/*, @gadicc/*
```

This plugin is no longer strictly necessary since `yahoo-finance2` was removed, but is kept as a safety net.

---

## Deployment

Published as a Replit deployment. The API server and frontend are served behind Replit's mTLS proxy. The PostgreSQL database is Replit's managed PostgreSQL, accessed via the `DATABASE_URL` environment variable. `SESSION_SECRET` is stored as a Replit secret.
