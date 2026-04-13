import { logger } from "./logger";

interface YahooSession {
  cookie: string;
  crumb: string;
  expiresAt: number;
}

let cachedSession: YahooSession | null = null;

async function fetchSession(): Promise<YahooSession> {
  const consentRes = await fetch("https://fc.yahoo.com", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  const setCookieHeaders = consentRes.headers.getSetCookie?.() ?? [];
  const cookieStr = setCookieHeaders
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!cookieStr) {
    throw new Error("Failed to obtain Yahoo Finance session cookie");
  }

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Cookie": cookieStr,
    },
  });

  const crumb = await crumbRes.text();

  if (!crumb || crumb.includes('"error"')) {
    throw new Error(`Failed to obtain Yahoo Finance crumb: ${crumb}`);
  }

  return {
    cookie: cookieStr,
    crumb: crumb.trim(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  };
}

export async function getSession(): Promise<YahooSession> {
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession;
  }

  logger.info("Refreshing Yahoo Finance session");
  try {
    cachedSession = await fetchSession();
    logger.info({ crumb: cachedSession.crumb.substring(0, 8) + "..." }, "Yahoo Finance session established");
    return cachedSession;
  } catch (err) {
    logger.error({ err }, "Failed to establish Yahoo Finance session");
    throw err;
  }
}

export async function yahooFetch(url: string, retries = 1): Promise<unknown> {
  const session = await getSession();

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": session.cookie,
    },
  });

  if (res.status === 401 && retries > 0) {
    // Session expired, clear and retry
    cachedSession = null;
    return yahooFetch(url, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned ${res.status}: ${res.statusText} for ${url}`);
  }

  return res.json();
}
