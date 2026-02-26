"use client";

import { useSearchParams } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { toCSV, downloadCSV, downloadXLSX } from "@/lib/export";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface SkuData {
  bySeries: { series: string; pairs: number }[];
  byGender: { gender: string; pairs: number }[];
  byTier: { tier: string; pairs: number }[];
  byTipe: { tipe: string; pairs: number }[];
  bySize: { size: string; pairs: number }[];
  byPrice: { label: string; pairs: number }[];
  rankByArticle: { article: string; kode_mix: string; pairs: number; revenue: number }[];
  kpis?: { revenue: number; pairs: number; asp: number };
}

const ZUMA_GREEN = "#00E273";
const ZUMA_TEAL = "#002A3A";

const PIE_PALETTE = [
  "#00E273",
  "#002A3A",
  "#4A4A4A",
  "#8C8C8C",
  "#C4C4C4",
  "#00B25A",
  "#1A5C6B",
  "#D4D4D4",
  "#006B3A",
  "#3D3D3D",
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtRp(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${Math.round(n).toLocaleString("en-US")}`;
}

function ChartCard({
  children,
  title,
  filterLabel,
  onClearFilter,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  filterLabel?: string;
  onClearFilter?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-sm p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">
          {title}
        </h3>
        {actions}
      </div>
      {filterLabel && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-sm bg-[#00E273]/10 text-[#002A3A] border border-[#00E273]/30 font-medium">
            🔍 {filterLabel}
            {onClearFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                className="ml-0.5 hover:text-red-600 transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-56 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#00E273] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PieChart({
  labels,
  values,
  title,
  onSegmentClick,
  activeValue,
}: {
  labels: string[];
  values: number[];
  title: string;
  onSegmentClick?: (label: string) => void;
  activeValue?: string;
}) {
  const total = values.reduce((s, v) => s + v, 0);
  const activeIdx = activeValue ? labels.indexOf(activeValue) : -1;

  const bgColors = PIE_PALETTE.slice(0, labels.length).map((color, i) => {
    if (activeIdx >= 0 && i !== activeIdx) return hexToRgba(color, 0.4);
    return color;
  });

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: bgColors,
        borderWidth: labels.map((_, i) => (activeIdx >= 0 && i === activeIdx ? 3 : 1)),
        borderColor: labels.map((_, i) =>
          activeIdx >= 0 && i === activeIdx ? ZUMA_TEAL : "#fff"
        ),
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: onSegmentClick
      ? (_event: unknown, elements: { index: number }[]) => {
          if (elements.length > 0) {
            onSegmentClick(labels[elements[0].index]);
          }
        }
      : undefined,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          font: { size: 9, family: "Inter, system-ui, sans-serif" },
          usePointStyle: true,
          pointStyle: "rect" as const,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) => {
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
            return `${ctx.label}: ${fmtNum(ctx.parsed)} prs (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <ChartCard
      title={title}
      filterLabel={activeIdx >= 0 ? activeValue : undefined}
      onClearFilter={activeIdx >= 0 && onSegmentClick ? () => onSegmentClick(activeValue!) : undefined}
    >
      <div className={`h-52 flex items-center justify-center ${onSegmentClick ? "cursor-pointer" : ""}`}>
        <div className="h-full w-full max-w-[300px]">
          <Pie data={chartData} options={options} />
        </div>
      </div>
    </ChartCard>
  );
}

function BarChart({
  labels,
  values,
  title,
  horizontal,
  onSegmentClick,
  activeValue,
}: {
  labels: string[];
  values: number[];
  title: string;
  horizontal?: boolean;
  onSegmentClick?: (label: string) => void;
  activeValue?: string;
}) {
  const activeIdx = activeValue ? labels.indexOf(activeValue) : -1;

  const bgColors = activeIdx >= 0
    ? labels.map((_, i) => (i === activeIdx ? ZUMA_TEAL : hexToRgba(ZUMA_GREEN, 0.4)))
    : ZUMA_GREEN;

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: bgColors,
        borderRadius: 1,
      },
    ],
  };

  const handleBarClick = onSegmentClick
    ? (_event: unknown, elements: { index: number }[]) => {
        if (elements.length > 0) {
          onSegmentClick(labels[elements[0].index]);
        }
      }
    : undefined;

  const options = horizontal
    ? {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y" as const,
        onClick: handleBarClick,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { parsed: { x: number | null } }) =>
                `${fmtNum(ctx.parsed.x ?? 0)} pairs`,
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, callback: (v: number | string) => fmtNum(Number(v)) },
            grid: { color: "rgba(0,0,0,0.04)" },
          },
          y: { ticks: { font: { size: 9 } }, grid: { display: false } },
        },
      }
    : {
        responsive: true,
        maintainAspectRatio: false,
        onClick: handleBarClick,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: { parsed: { y: number | null } }) =>
                `${fmtNum(ctx.parsed.y ?? 0)} pairs`,
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: {
            ticks: { font: { size: 9 }, callback: (v: number | string) => fmtNum(Number(v)) },
            grid: { color: "rgba(0,0,0,0.04)" },
          },
        },
      };

  return (
    <ChartCard
      title={title}
      filterLabel={activeIdx >= 0 ? activeValue : undefined}
      onClearFilter={activeIdx >= 0 && onSegmentClick ? () => onSegmentClick(activeValue!) : undefined}
    >
      <div className={`h-52 ${onSegmentClick ? "cursor-pointer" : ""}`}>
        <Bar data={chartData} options={options} />
      </div>
    </ChartCard>
  );
}

function RankTable({
  rows,
  grandTotals,
}: {
  rows: { article: string; kode_mix: string; gender?: string; series?: string; color?: string; pairs: number; revenue: number }[];
  grandTotals?: { pairs: number; revenue: number };
}) {
  const exportHeaders = ["#", "Kode Mix", "Gender", "Series", "Color", "Qty Sold", "Revenue", "ASP"];
  const exportKeys = ["rank", "kode_mix", "gender", "series", "color", "pairs", "revenue", "asp"];

  const getExportRows = (): Record<string, unknown>[] =>
    rows.map((r, idx) => ({
      rank: idx + 1,
      kode_mix: r.kode_mix || r.article || "",
      gender: r.gender || "",
      series: r.series || "",
      color: r.color || "",
      pairs: r.pairs,
      revenue: r.revenue,
      asp: r.pairs > 0 ? Math.round(r.revenue / r.pairs) : 0,
    }));

  const handleCSV = () => {
    const csv = toCSV(exportHeaders, getExportRows(), exportKeys);
    downloadCSV(csv, "rank_by_article.csv");
  };

  const handleXLSX = () => {
    void downloadXLSX(exportHeaders, getExportRows(), exportKeys, "rank_by_article.xlsx");
  };

  return (
    <ChartCard
      title="Rank by Article"
      actions={
        rows.length > 0 ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleCSV}
              className="text-[9px] px-2 py-0.5 rounded-sm border border-border hover:bg-muted transition-colors font-medium"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={handleXLSX}
              className="text-[9px] px-2 py-0.5 rounded-sm border border-border hover:bg-muted transition-colors font-medium"
            >
              XLSX
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider w-10">#</th>
              <th className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Kode Mix</th>
              <th className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Gender</th>
              <th className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Series</th>
              <th className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Color</th>
              <th className="text-right px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Qty Sold</th>
              <th className="text-right px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
              <th className="text-right px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">ASP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const asp = r.pairs > 0 ? r.revenue / r.pairs : 0;
              return (
                <tr key={r.kode_mix || `rank-${String(idx)}`} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium max-w-[180px] truncate">{r.kode_mix || r.article || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.gender || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.series || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.color || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.pairs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtRp(r.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(asp)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No data</td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (() => {
            const totQty = grandTotals?.pairs ?? rows.reduce((s, r) => s + r.pairs, 0);
            const totRev = grandTotals?.revenue ?? rows.reduce((s, r) => s + r.revenue, 0);
            const avgAsp = totQty > 0 ? totRev / totQty : 0;
            return (
              <tfoot className="sticky bottom-0">
                <tr className="border-t-2 border-[#00E273]/40 bg-card">
                  <td className="px-3 py-2 text-[9px] font-bold text-foreground" colSpan={5}>TOTAL</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-foreground">{fmtNum(totQty)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-foreground">{fmtRp(totRev)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-muted-foreground">{fmtRp(avgAsp)}</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </ChartCard>
  );
}

export default function SkuCharts({
  data,
  loading,
  onChartFilter,
}: {
  data?: SkuData;
  loading?: boolean;
  onChartFilter?: (param: string, value: string) => void;
}) {
  const searchParams = useSearchParams();
  const activeTipe = searchParams.get("tipe") || undefined;
  const activeGender = searchParams.get("gender") || undefined;
  const activeSeries = searchParams.get("series") || undefined;
  const activeTierParam = searchParams.get("tier");
  const activeTierLabel = activeTierParam ? `T${activeTierParam}` : undefined;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((k) => (
            <div key={k} className="bg-card border border-border rounded-sm p-4 shadow-sm">
              <Spinner />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[4, 5, 6].map((k) => (
            <div key={k} className="bg-card border border-border rounded-sm p-4 shadow-sm">
              <Spinner />
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-sm p-4 shadow-sm">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PieChart
          title="Qty Sold by Tipe (Jepit vs Fashion)"
          labels={(data?.byTipe ?? []).filter((d) => d.tipe).map((d) => d.tipe)}
          values={(data?.byTipe ?? []).filter((d) => d.tipe).map((d) => d.pairs)}
          activeValue={activeTipe}
          onSegmentClick={onChartFilter ? (label: string) => onChartFilter("tipe", label) : undefined}
        />
        <PieChart
          title="Qty Sold by Gender"
          labels={(data?.byGender ?? []).filter((d) => d.gender).map((d) => d.gender)}
          values={(data?.byGender ?? []).filter((d) => d.gender).map((d) => d.pairs)}
          activeValue={activeGender}
          onSegmentClick={onChartFilter ? (label: string) => onChartFilter("gender", label) : undefined}
        />
        <PieChart
          title="Qty Sold by Series"
          labels={(data?.bySeries ?? []).filter((d) => d.series).map((d) => d.series)}
          values={(data?.bySeries ?? []).filter((d) => d.series).map((d) => d.pairs)}
          activeValue={activeSeries}
          onSegmentClick={onChartFilter ? (label: string) => onChartFilter("series", label) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BarChart
          title="Qty Sold by Size"
          labels={(data?.bySize ?? []).filter((d) => d.size).map((d) => d.size)}
          values={(data?.bySize ?? []).filter((d) => d.size).map((d) => d.pairs)}
        />
        <BarChart
          title="Qty Sold by Price Range (RSP)"
          labels={data?.byPrice.map((d) => d.label) ?? []}
          values={data?.byPrice.map((d) => d.pairs) ?? []}
        />
        <BarChart
          title="Qty Sold by Tier"
          labels={(data?.byTier ?? []).filter((d) => d.tier).map((d) => `T${d.tier}`)}
          values={(data?.byTier ?? []).filter((d) => d.tier).map((d) => d.pairs)}
          activeValue={activeTierLabel}
          onSegmentClick={onChartFilter ? (label: string) => onChartFilter("tier", label.replace("T", "")) : undefined}
        />
      </div>

      <RankTable rows={data?.rankByArticle ?? []} grandTotals={data?.kpis ? { pairs: data.kpis.pairs, revenue: data.kpis.revenue } : undefined} />
    </div>
  );
}
