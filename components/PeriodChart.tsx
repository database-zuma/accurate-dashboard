"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TimeSeriesPoint {
  period: string;
  revenue: number;
  pairs: number;
}

export default function PeriodChart({
  data,
  loading,
}: {
  data?: TimeSeriesPoint[];
  loading?: boolean;
}) {
  const labels = data?.map((d) => d.period) ?? [];
  const revenueData = data?.map((d) => d.revenue / 1_000_000) ?? [];
  const pairsData = data?.map((d) => d.pairs) ?? [];

  const chartData = {
    labels,
    datasets: [
      {
        label: "Revenue (Rp juta)",
        data: revenueData,
        backgroundColor: "#00E273",
        borderRadius: 1,
        yAxisID: "y",
      },
      {
        label: "Pairs Sold",
        data: pairsData,
        backgroundColor: "#1a1a1a",
        borderRadius: 1,
        yAxisID: "y1",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "top" as const,
        labels: { font: { size: 10, family: "Inter" }, usePointStyle: true, pointStyle: "rect" as const },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const y = ctx.parsed.y ?? 0;
            if (ctx.dataset.label?.includes("Revenue")) {
              return `Revenue: Rp ${(y * 1_000_000).toLocaleString("en-US")}`;
            }
            return `Pairs: ${y.toLocaleString("en-US")}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 9 } }, grid: { display: false } },
      y:  { type: "linear" as const, position: "left"  as const, ticks: { font: { size: 9 } }, grid: { color: "rgba(0,0,0,0.04)" } },
      y1: { type: "linear" as const, position: "right" as const, ticks: { font: { size: 9 } }, grid: { drawOnChartArea: false } },
    },
  };

  return (
    <div className="bg-card border border-border rounded-sm p-5 flex flex-col gap-3 shadow-sm">
      <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">Sales Over Time</h3>
      <div className="h-56 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#00E273] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
