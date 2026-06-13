import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVND } from "@/utils/formatCurrency.js";

function formatAxisValue(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="sfx-chart-tooltip">
      <strong>{point.label || point.date}</strong>
      <span>{formatVND(point.revenue ?? point.value ?? 0)}</span>
    </div>
  );
}

function RevenueChart({ data = [], dateRange, rangeLabel, showHeader = true }) {
  const chartData = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((point) => ({
        ...point,
        revenue: point.revenue ?? point.value ?? 0,
      })),
    [data]
  );

  const totalRevenue = useMemo(
    () => chartData.reduce((sum, point) => sum + (point.revenue ?? 0), 0),
    [chartData]
  );

  return (
    <div className="sfx-chart">
      {showHeader ? (
        <div className="sfx-chart__head">
          <div>
            <h3 className="sfx-card__title">Revenue Overview</h3>
            <p className="sfx-chart__sub">
              {rangeLabel || "Selected range"} · {formatVND(totalRevenue)} total
            </p>
          </div>
        </div>
      ) : null}

      {chartData.length ? (
        <div className="sfx-chart__recharts">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sfxRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(159, 134, 85, 0.35)" />
                  <stop offset="100%" stopColor="rgba(159, 134, 85, 0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(31, 26, 23, 0.07)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8a8175", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fill: "#8a8175", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(159,134,85,0.35)" }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#9f8655"
                strokeWidth={2.5}
                fill="url(#sfxRevenueFill)"
                dot={chartData.length <= 31 ? { r: 3, fill: "#fff", stroke: "#9f8655", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: "#9f8655", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="sfx-chart__empty">
          <p>No revenue data for the selected range.</p>
        </div>
      )}
    </div>
  );
}

export default RevenueChart;
