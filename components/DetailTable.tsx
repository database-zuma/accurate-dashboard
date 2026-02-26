"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { ChevronUp, ChevronDown, Search, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import { toCSV, downloadCSV, downloadXLSX } from "@/lib/export";

type Mode = "kode" | "kode_besar";

interface DetailRow {
  toko: string;
  kode?: string;
  kode_besar?: string;
  article: string;
  gender: string;
  series: string;
  color: string;
  tipe: string;
  tier: string;
  pairs: number;
  revenue: number;
  avg_price: number;
}

interface DetailResponse {
  rows: DetailRow[];
  total: number;
  page: number;
  pages: number;
  totals?: { pairs: number; revenue: number };
}

const KODE_HEADERS = ["Store", "Kode", "Article", "Gender", "Series", "Color", "Tipe", "Tier", "Qty", "Revenue", "ASP"];
const KODE_KEYS = ["toko", "kode", "article", "gender", "series", "color", "tipe", "tier", "pairs", "revenue", "avg_price"];
const KB_HEADERS = ["Store", "Kode Besar", "Article", "Gender", "Series", "Color", "Tipe", "Tier", "Qty", "Revenue", "ASP"];
const KB_KEYS = ["toko", "kode_besar", "article", "gender", "series", "color", "tipe", "tier", "pairs", "revenue", "avg_price"];

function fmtRp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("en-US");
}

function SortIcon({ col, sort, dir }: { col: string; sort: string; dir: string }) {
  if (sort !== col) return <ChevronUp className="size-3 text-muted-foreground/40" />;
  return dir === "asc" ? <ChevronUp className="size-3 text-[#00E273]" /> : <ChevronDown className="size-3 text-[#00E273]" />;
}

export default function DetailTable({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [exporting, setExporting] = useState(false);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "revenue";
  const dir = searchParams.get("dir") || "desc";

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const detailParams = new URLSearchParams(searchParams.toString());
  if (!detailParams.has("from")) detailParams.set("from", "2024-01-01");
  if (!detailParams.has("to")) detailParams.set("to", new Date().toISOString().substring(0, 10));
  const apiUrl = `/api/detail?v=2&mode=${mode}&${detailParams.toString()}`;

  const { data, isLoading } = useSWR<DetailResponse>(apiUrl, fetcher, {
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
      params.set("mode", mode);
      const res = await fetch(`/api/detail?${params}`);
      const json = await res.json();
      const rows = json.rows as Record<string, unknown>[];
      const headers = mode === "kode_besar" ? KB_HEADERS : KODE_HEADERS;
      const keys = mode === "kode_besar" ? KB_KEYS : KODE_KEYS;
      const filename = `accurate-detail-${mode}`;
      if (format === "csv") {
        downloadCSV(toCSV(headers, rows, keys), `${filename}.csv`);
      } else {
        await downloadXLSX(headers, rows, keys, `${filename}.xlsx`);
      }
    } finally {
      setExporting(false);
    }
  }, [detailParams, mode]);

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
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5 pointer-events-none z-10" />
          <Input
            type="text"
            placeholder={mode === "kode_besar" ? "Search kode besar / article / store..." : "Search kode / article / store..."}
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

      <div className="bg-card border border-border rounded-sm overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th col="toko" label="Store" />
                {mode === "kode" ? (
                  <Th col="kode" label="Kode" />
                ) : (
                  <Th col="kode_besar" label="Kode Besar" />
                )}
                <Th col="article" label="Article" />
                <Th col="gender" label="Gender" />
                <Th col="series" label="Series" />
                <Th col="color" label="Color" />
                <Th col="tipe" label="Tipe" />
                <Th col="tier" label="Tier" />
                <Th col="pairs" label="Qty" right />
                <Th col="revenue" label="Revenue" right />
                <Th col="avg_price" label="ASP" right />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }, (_, idx) => (
                  <tr key={`skel-${String(idx)}`} className="border-b border-border/50">
                    {Array.from({ length: 11 }, (_, cj) => (
                      <td key={`sc-${String(cj)}`} className="px-3 py-2.5">
                        <div className="h-3 bg-muted animate-pulse rounded-sm w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                data?.rows?.map((r, idx) => (
                  <tr key={`${r.toko}-${mode === "kode" ? r.kode : r.kode_besar}-${String(idx)}`} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-medium max-w-[150px] truncate" title={r.toko}>{r.toko || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] font-medium max-w-[100px] truncate" title={mode === "kode" ? r.kode : r.kode_besar}>
                      {mode === "kode" ? r.kode || "—" : r.kode_besar || "—"}
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate" title={r.article}>{r.article || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.gender || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate" title={r.series}>{r.series || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[100px] truncate" title={r.color}>{r.color || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.tipe || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.tier && r.tier !== "Unknown" ? `T${r.tier}` : r.tier || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.pairs.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(r.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(r.avg_price)}</td>
                  </tr>
                ))
              )}
              {!isLoading && !data?.rows?.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No data</td>
                </tr>
              )}
            </tbody>
            {!isLoading && data?.totals && data.totals.pairs > 0 && (() => {
              const avgAsp = data.totals.pairs > 0 ? data.totals.revenue / data.totals.pairs : 0;
              return (
                <tfoot>
                  <tr className="border-t-2 border-[#00E273]/40 bg-muted/40">
                    <td className="px-3 py-2.5 text-[9px] font-bold text-foreground" colSpan={8}>TOTAL</td>
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

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{data.total.toLocaleString("en-US")} items · Page {page} of {data.pages}</span>
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
