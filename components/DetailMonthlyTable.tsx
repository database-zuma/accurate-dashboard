"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { ChevronUp, ChevronDown, Search, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { toCSV, downloadCSV, downloadXLSX } from "@/lib/export";

interface MonthlyRow {
  year: number;
  month_num: number;
  month_name: string;
  kode_besar: string;
  pairs: number;
  revenue: number;
  avg_price: number;
}

interface MonthlyResponse {
  rows: MonthlyRow[];
  total: number;
  page: number;
  pages: number;
  totals?: { pairs: number; revenue: number };
}

const HEADERS = ["Year", "Month Number", "Month Name", "Kode Besar", "Qty", "Revenue", "ASP"];
const KEYS    = ["year", "month_num", "month_name", "kode_besar", "pairs", "revenue", "avg_price"];

function fmtRp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("en-US");
}

function SortIcon({ col, sort, dir }: { col: string; sort: string; dir: string }) {
  if (sort !== col) return <ChevronUp className="size-3 text-muted-foreground/40" />;
  return dir === "asc"
    ? <ChevronUp className="size-3 text-[#00E273]" />
    : <ChevronDown className="size-3 text-[#00E273]" />;
}

export default function DetailMonthlyTable() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch]     = useState(searchParams.get("q") || "");
  const [exporting, setExporting] = useState(false);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "year";
  const dir  = searchParams.get("dir")  || "desc";

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const detailParams = new URLSearchParams(searchParams.toString());
  if (!detailParams.has("from")) detailParams.set("from", `${new Date().getFullYear()}-01-01`);
  if (!detailParams.has("to"))   detailParams.set("to",   new Date().toISOString().substring(0, 10));
  const apiUrl = `/api/detail-monthly?${detailParams.toString()}`;

  const { data, isLoading } = useSWR<MonthlyResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const push = useCallback(
    (params: URLSearchParams) => router.push(`/?${params.toString()}`),
    [router]
  );

  const setSort = useCallback(
    (col: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("sort") === col) {
        params.set("dir", params.get("dir") === "asc" ? "desc" : "asc");
      } else {
        params.set("sort", col);
        params.set("dir", "desc");
      }
      params.set("page", "1");
      push(params);
    },
    [searchParams, push]
  );

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(p));
      push(params);
    },
    [searchParams, push]
  );

  const applySearch = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val.trim()) params.set("q", val.trim());
      else params.delete("q");
      params.set("page", "1");
      push(params);
    },
    [searchParams, push]
  );

  const handleExport = useCallback(async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const params = new URLSearchParams(detailParams.toString());
      params.set("export", "all");
      const res  = await fetch(`/api/detail-monthly?${params}`);
      const json = await res.json();
      if (!json.rows || !Array.isArray(json.rows)) throw new Error("Export failed: invalid response");
      const rows = json.rows as Record<string, unknown>[];
      if (format === "csv") {
        downloadCSV(toCSV(HEADERS, rows, KEYS), "detail-monthly.csv");
      } else {
        await downloadXLSX(HEADERS, rows, KEYS, "detail-monthly.xlsx");
      }
    } finally {
      setExporting(false);
    }
  }, [detailParams]);

  const Th = ({ col, label, right }: { col: string; label: string; right?: boolean }) => (
    <th
      className={`px-3 py-2.5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em] cursor-pointer select-none hover:text-foreground transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => setSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon col={col} sort={sort} dir={dir} />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search + Export */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 pointer-events-none z-10" />
          <Input
            type="text"
            placeholder="Search kode besar / article..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch(e.currentTarget.value);
            }}
            className="pl-9 h-8 text-xs bg-card rounded-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); applySearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={exporting || !data}
            onClick={() => handleExport("csv")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="size-3" /> CSV
          </button>
          <button
            type="button"
            disabled={exporting || !data}
            onClick={() => handleExport("xlsx")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="size-3" /> XLSX
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th col="year"       label="Year" />
                <Th col="month_num"  label="Month Number" />
                <Th col="month_name" label="Month Name" />
                <Th col="kode_besar" label="Kode Besar" />
                <Th col="pairs"      label="Qty"     right />
                <Th col="revenue"    label="Revenue" right />
                <Th col="avg_price"  label="ASP"     right />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }, (_, idx) => (
                  <tr key={`skel-${String(idx)}`} className="border-b border-border/50">
                    {Array.from({ length: 7 }, (_, cj) => (
                      <td key={`sc-${String(cj)}`} className="px-3 py-2.5">
                        <div className="h-3 bg-muted animate-pulse rounded-sm w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                data?.rows?.map((r, idx) => (
                  <tr
                    key={`${r.year}-${r.month_num}-${r.kode_besar}-${String(idx)}`}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 tabular-nums font-medium">{r.year}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {String(r.month_num).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.month_name}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] font-medium">{r.kode_besar || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.pairs.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(r.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(r.avg_price)}</td>
                  </tr>
                ))
              )}
              {!isLoading && !data?.rows?.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No data</td>
                </tr>
              )}
            </tbody>
            {!isLoading && data?.totals && data.totals.pairs > 0 && (() => {
              const avgAsp = data.totals.pairs > 0 ? data.totals.revenue / data.totals.pairs : 0;
              return (
                <tfoot>
                  <tr className="border-t-2 border-[#00E273]/40 bg-muted/40">
                    <td className="px-3 py-2.5 text-[9px] font-bold text-foreground" colSpan={4}>TOTAL</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-foreground">{data.totals.pairs.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-foreground">{fmtRp(data.totals.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-muted-foreground">{fmtRp(avgAsp)}</td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {data.total.toLocaleString("en-US")} items · Page {page} of {data.pages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px] font-semibold"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px] font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
