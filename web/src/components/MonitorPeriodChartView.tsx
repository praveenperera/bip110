import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import type { MonitorPeriod } from "@/lib/monitor";
import {
  formatChartPercent,
  formatNumber,
  periodChartModel,
  type periodChartDatum as PeriodChartDatum,
  type periodChartMetric as PeriodChartMetric,
} from "./MonitorDashboardModel.gen";

type PeriodChartTooltipProps = {
  active?: boolean;
  metric: PeriodChartMetric;
  payload?: Array<{
    payload?: PeriodChartDatum;
  }>;
};

/**
 * Retains Recharts' component and callback surface behind one package-specific
 * view boundary
 */
export function MonitorPeriodChartView({
  currentPeriodNum,
  metric,
  onMetricChange,
  periods,
}: {
  currentPeriodNum: number;
  metric: PeriodChartMetric;
  onMetricChange: (metric: PeriodChartMetric) => void;
  periods: MonitorPeriod[];
}) {
  const model = periodChartModel(periods, currentPeriodNum, metric);

  if (model.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        No period history available for charting.
      </div>
    );
  }

  const {
    data: chartData,
    maximumLabel,
    maxValue,
    metricLabel,
    showingPercentage,
    yTicks,
  } = model;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {metricLabel} by period
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare the signaling count or rate from the period history table.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-3 rounded-full border-2 border-primary bg-background"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{metricLabel}</span>
          </span>
          <span
            className="inline-flex rounded-lg bg-muted p-1"
            role="group"
            aria-label="Chart metric"
          >
            <Button
              aria-pressed={metric === "blocks"}
              onClick={() => onMetricChange("blocks")}
              size="xs"
              type="button"
              variant={metric === "blocks" ? "default" : "ghost"}
            >
              Blocks
            </Button>
            <Button
              aria-pressed={metric === "percentage"}
              onClick={() => onMetricChange("percentage")}
              size="xs"
              type="button"
              variant={metric === "percentage" ? "default" : "ghost"}
            >
              Signaling %
            </Button>
          </span>
        </div>
      </div>

      <div
        className="mt-5 overflow-x-auto"
        role="img"
        aria-label={`${metricLabel} by difficulty adjustment period. Chart maximum is ${maximumLabel}.`}
      >
        <div className="min-w-160">
          <div className="h-72">
            <ResponsiveContainer
              height="100%"
              initialDimension={{ height: 288, width: 640 }}
              width="100%"
            >
              <LineChart
                accessibilityLayer
                data={chartData}
                margin={{ bottom: 12, left: 10, right: 18, top: 24 }}
              >
                <CartesianGrid
                  stroke="currentColor"
                  strokeOpacity={0.16}
                  vertical={false}
                />
                <XAxis
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.28 }}
                  dataKey="label"
                  height={34}
                  interval={0}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.28 }}
                  domain={[0, maxValue]}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={
                    showingPercentage ? formatChartPercent : formatNumber
                  }
                  tickLine={false}
                  ticks={yTicks}
                  width={48}
                />
                <RechartsTooltip
                  content={<PeriodChartTooltip metric={metric} />}
                  cursor={{ stroke: "var(--primary)", strokeOpacity: 0.24 }}
                />
                <Line
                  activeDot={{
                    fill: "var(--primary)",
                    r: 6,
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                  dataKey={showingPercentage ? "pct" : "signalingCount"}
                  dot={{
                    fill: "var(--primary)",
                    r: 4.5,
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                  isAnimationActive={false}
                  key={metric}
                  name={metricLabel}
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            difficulty adjustment period
          </p>
        </div>
      </div>
    </div>
  );
}

function PeriodChartTooltip({
  active,
  metric,
  payload,
}: PeriodChartTooltipProps) {
  const datum = payload?.[0]?.payload;

  if (!active || !datum) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg shadow-foreground/10">
      <p className="font-medium text-popover-foreground">
        Period {datum.periodNum}
      </p>
      <p className="mt-1 font-mono text-primary">
        {metric === "percentage" ? datum.pctLabel : datum.signalingLabel}
      </p>
      <p className="mt-1 text-muted-foreground">
        {metric === "percentage" ? datum.signalingLabel : datum.pctLabel}
      </p>
    </div>
  );
}
