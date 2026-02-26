"use client";

import { useSearchParams } from "next/navigation";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface BranchRow {
  branch: string;
  revenue: number;
}

const ZUMA_TEAL = "#002A3A";

/* Zuma brand–derived flat Dieter Rams palette — no gradients */
const BRANCH_COLORS = [
  "#00E273", // zuma green
  "#002A3A", // zuma teal
  "#4A4A4A", // charcoal
  "#8C8C8C", // mid grey
  "#C4C4C4", // light grey
  "#00B25A", // darker green
  "#1A5C6B", // steel teal
  "#D4D4D4", // pale grey
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fmtRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${Math.round(n).toLocaleString("en-US")}`;
}

export default function BranchPieChart({
  data,
  loading,
  onChartFilter,
}: {
  data?: BranchRow[];
  loading?: boolean;
  onChartFilter?: (param: string, value: string) => void;
}) {
  const searchParams = useSearchParams();
  const activeBranch = searchParams.get("branch") || undefined;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-sm p-5 shadow-sm">
        <div className="h-6 w-48 bg-muted animate-pulse rounded-sm mb-4" />
        <div className="h-56 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#00E273] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data?.length) return null;

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const labels = data.map((d) => d.branch || "Event");
  const activeIdx = activeBranch ? labels.indexOf(activeBranch) : -1;

  const bgColors = BRANCH_COLORS.slice(0, data.length).map((color, i) => {
    if (activeIdx >= 0 && i !== activeIdx) return hexToRgba(color, 0.4);
    return color;
  });

  const chartData = {
    labels,
    datasets: [
      {
        data: data.map((d) => d.revenue),
        backgroundColor: bgColors,
        borderWidth: data.map((_, i) => (activeIdx >= 0 && i === activeIdx ? 3 : 1)),
        borderColor: data.map((_, i) =>
          activeIdx >= 0 && i === activeIdx ? ZUMA_TEAL : "#fff"
        ),
      },
    ],
  };

  const handleClick = onChartFilter
    ? (_event: unknown, elements: { index: number }[]) => {
        if (elements.length > 0) {
          onChartFilter("branch", labels[elements[0].index]);
        }
      }
    : undefined;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          font: { size: 10, family: "Inter, system-ui, sans-serif" },
          usePointStyle: true,
          pointStyle: "rect" as const,
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) => {
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
            return `${ctx.label}: ${fmtRp(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  const handleClearFilter = activeBranch && onChartFilter
    ? () => onChartFilter("branch", activeBranch)
    : undefined;

  return (
    <div className="bg-card border border-border rounded-sm p-5 shadow-sm">
      <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em] mb-3">
        Sales Contribution by Branch
      </h3>
      {activeIdx >= 0 && activeBranch && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-sm bg-[#00E273]/10 text-[#002A3A] border border-[#00E273]/30 font-medium">
            🔍 {activeBranch}
            {handleClearFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="ml-0.5 hover:text-red-600 transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        <div className={`h-56 flex-1 flex items-center justify-center ${onChartFilter ? "cursor-pointer" : ""}`}>
          <div className="h-full w-full max-w-[320px]">
            <Pie data={chartData} options={options} />
          </div>
        </div>
        <div className="flex-shrink-0 min-w-[200px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Branch</th>
                <th className="text-right py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
                <th className="text-right py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.branch} className="border-b border-border/40">
                  <td className="py-1.5 font-medium">{d.branch || "Event"}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtRp(d.revenue)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {total > 0 ? ((d.revenue / total) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
