import React, { useState } from "react";
import { useGetStockHistory, GetStockHistoryPeriod } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartModalProps {
  ticker: string | null;
  companyName?: string | null;
  onClose: () => void;
}

const periods: { label: string; value: GetStockHistoryPeriod }[] = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
];

export function ChartModal({ ticker, companyName, onClose }: ChartModalProps) {
  const [period, setPeriod] = useState<GetStockHistoryPeriod>("6mo");

  const { data, isLoading, isError } = useGetStockHistory(
    ticker || "",
    { period },
    { query: { enabled: !!ticker } }
  );

  const open = !!ticker;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl bg-card border-border text-foreground font-sans">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-baseline gap-3">
            <span className="font-mono text-primary font-bold">{ticker}</span>
            {companyName && <span className="text-sm text-muted-foreground font-normal">{companyName}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Historical charts for {ticker}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setPeriod(p.value)}
              data-testid={`btn-period-${p.value}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[150px] w-full" />
          </div>
        ) : isError || !data ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Failed to load history data
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-[300px] w-full">
              <h4 className="text-xs font-mono text-muted-foreground mb-2">PRICE & MA</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dataPoints} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickMargin={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(val) => `$${val}`}
                    width={50}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ fontFamily: 'monospace' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}
                  />
                  <Line type="monotone" dataKey="price" stroke="hsl(var(--foreground))" dot={false} strokeWidth={2} name="Price" />
                  <Line type="monotone" dataKey="ma50" stroke="hsl(45,93%,47%)" dot={false} strokeWidth={1} name="50 MA" />
                  <Line type="monotone" dataKey="ma200" stroke="hsl(199,89%,48%)" dot={false} strokeWidth={1} name="200 MA" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[150px] w-full">
              <h4 className="text-xs font-mono text-muted-foreground mb-2">RSI (14)</h4>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dataPoints} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} ticks={[30, 70]} stroke="hsl(var(--muted-foreground))" fontSize={11} width={50} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--primary))', fontFamily: 'monospace' }}
                  />
                  <Area type="monotone" dataKey="rsi" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="RSI" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
