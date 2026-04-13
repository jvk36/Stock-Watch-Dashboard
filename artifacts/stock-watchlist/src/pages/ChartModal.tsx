import { useState } from "react";
import {
  useGetStockHistory,
  getGetStockHistoryQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y"] as const;
type Period = (typeof PERIODS)[number];

interface ChartModalProps {
  ticker: string | null;
  companyName?: string | null;
  onClose: () => void;
}

export function ChartModal({ ticker, companyName, onClose }: ChartModalProps) {
  const [period, setPeriod] = useState<Period>("6mo");

  const { data: history, isLoading } = useGetStockHistory(
    ticker ?? "",
    { query: { enabled: !!ticker, queryKey: getGetStockHistoryQueryKey(ticker ?? "", { period }), params: { period } } }
  );

  const dataPoints = history?.dataPoints ?? [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const priceMin = dataPoints.length
    ? Math.floor(
        Math.min(
          ...dataPoints.flatMap((d) =>
            [d.price, d.ma50, d.ma200].filter((v): v is number => v != null)
          )
        ) * 0.97
      )
    : undefined;

  const priceMax = dataPoints.length
    ? Math.ceil(
        Math.max(
          ...dataPoints.flatMap((d) =>
            [d.price, d.ma50, d.ma200].filter((v): v is number => v != null)
          )
        ) * 1.03
      )
    : undefined;

  return (
    <Dialog open={!!ticker} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg text-white">
            {ticker}
            {companyName && (
              <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                {companyName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              data-testid={`period-${p}`}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[220px] w-full bg-muted" />
            <Skeleton className="h-[120px] w-full bg-muted" />
          </div>
        ) : dataPoints.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground font-mono text-sm">
            No historical data available for {ticker}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
                Price / Moving Averages
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dataPoints} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 20%)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "hsl(215 28% 25%)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[priceMin ?? "auto", priceMax ?? "auto"]}
                    tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "hsl(215 28% 25%)" }}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222 47% 11%)",
                      border: "1px solid hsl(215 28% 25%)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                    labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    formatter={(value: number, name: string) => [`$${value?.toFixed(2)}`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(210 100% 66%)"
                    strokeWidth={2}
                    dot={false}
                    name="Price"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ma50"
                    stroke="hsl(45 93% 60%)"
                    strokeWidth={1.5}
                    dot={false}
                    name="MA 50"
                    strokeDasharray="5 3"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ma200"
                    stroke="hsl(142 76% 50%)"
                    strokeWidth={1.5}
                    dot={false}
                    name="MA 200"
                    strokeDasharray="8 4"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
                RSI (14)
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={dataPoints} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 20%)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "hsl(215 28% 25%)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 30, 50, 70, 100]}
                    tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "hsl(215 28% 25%)" }}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222 47% 11%)",
                      border: "1px solid hsl(215 28% 25%)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                    labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    formatter={(value: number) => [value?.toFixed(1), "RSI"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rsi"
                    stroke="hsl(280 100% 65%)"
                    fill="hsl(280 100% 65% / 0.15)"
                    strokeWidth={1.5}
                    dot={false}
                    name="RSI"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1 px-10">
                <span className="text-green-500">Oversold &lt;30</span>
                <span className="text-yellow-500">Neutral 30-70</span>
                <span className="text-red-500">Overbought &gt;70</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
