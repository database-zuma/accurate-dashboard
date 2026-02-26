"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toCSV, downloadCSV, downloadXLSX } from "@/lib/export";

interface StoreRow {
  toko: string;
  branch: string;
  pairs: number;
  revenue: number;
  transactions: number;
  atu: number;
  asp: number;
  atv: number;
}

function fmtRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return "Rp " + Math.round(n).toLocaleString("en-US");
}

const ROWS_PER_PAGE = 10;

export default function StoreTable({ stores, loading }: { stores?: StoreRow[]; loading?: boolean }) {
  const [page, setPage] = useState(1);

  const totalRows = stores?.length ?? 0;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  const currentRows = stores?.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE) ?? [];

  const thClass = "text-left px-3 py-2.5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]";
  const thRight = `text-right px-3 py-2.5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]`;

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden flex flex-col shadow-sm h-full">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">Store Performance</h3>
          {!loading && stores && stores.length > 0 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const headers = ["#", "Store", "Branch", "Qty", "Revenue", "Txn", "ATU", "ASP", "ATV"];
                  const keys = ["rank", "toko", "branch", "pairs", "revenue", "transactions", "atu", "asp", "atv"];
                  const rows: Record<string, unknown>[] = (stores ?? []).map((s, idx) => ({
                    rank: idx + 1, toko: s.toko, branch: s.branch, pairs: s.pairs,
                    revenue: s.revenue, transactions: s.transactions,
                    atu: Number(s.atu.toFixed(1)), asp: Math.round(s.asp), atv: Math.round(s.atv),
                  }));
                  downloadCSV(toCSV(headers, rows, keys), "store_performance.csv");
                }}
                className="text-[9px] px-2 py-0.5 rounded-sm border border-border hover:bg-muted transition-colors font-medium"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  const headers = ["#", "Store", "Branch", "Qty", "Revenue", "Txn", "ATU", "ASP", "ATV"];
                  const keys = ["rank", "toko", "branch", "pairs", "revenue", "transactions", "atu", "asp", "atv"];
                  const rows: Record<string, unknown>[] = (stores ?? []).map((s, idx) => ({
                    rank: idx + 1, toko: s.toko, branch: s.branch, pairs: s.pairs,
                    revenue: s.revenue, transactions: s.transactions,
                    atu: Number(s.atu.toFixed(1)), asp: Math.round(s.asp), atv: Math.round(s.atv),
                  }));
                  void downloadXLSX(headers, rows, keys, "store_performance.xlsx");
                }}
                className="text-[9px] px-2 py-0.5 rounded-sm border border-border hover:bg-muted transition-colors font-medium"
              >
                XLSX
              </button>
            </div>
          )}
        </div>
        {!loading && totalRows > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {totalRows} stores · Page {page}/{totalPages}
          </span>
        )}
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={`text-center px-2 py-2.5 text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em] w-8`}>#</th>
              <th className={thClass}>Store</th>
              <th className={thClass}>Branch</th>
              <th className={thRight}>Qty</th>
              <th className={thRight}>Revenue</th>
              <th className={thRight}>Txn</th>
              <th className={thRight}>ATU</th>
              <th className={thRight}>ASP</th>
              <th className={thRight}>ATV</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={`skel-${String(i)}`} className="border-b border-border/50">
                  {Array.from({ length: 9 }, (_, j) => (
                    <td key={`sc-${String(j)}`} className="px-3 py-2.5">
                      <div className="h-3 bg-muted animate-pulse rounded-sm w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : currentRows.length ? (
              currentRows.map((s, idx) => {
                const rank = (page - 1) * ROWS_PER_PAGE + idx + 1;
                return (
                  <tr key={s.toko} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-2.5 text-center tabular-nums text-xs text-muted-foreground font-medium">{rank}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate text-xs">{s.toko}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{s.branch || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{Math.round(s.pairs).toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{fmtRp(s.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{s.transactions.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{s.atu.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{fmtRp(s.asp)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{fmtRp(s.atv)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-xs">No data</td>
              </tr>
            )}
          </tbody>
          {!loading && stores && stores.length > 0 && (() => {
            const totQty = stores.reduce((s, r) => s + r.pairs, 0);
            const totRev = stores.reduce((s, r) => s + r.revenue, 0);
            const totTxn = stores.reduce((s, r) => s + r.transactions, 0);
            const avgAtu = totTxn > 0 ? totQty / totTxn : 0;
            const avgAsp = totQty > 0 ? totRev / totQty : 0;
            const avgAtv = totTxn > 0 ? totRev / totTxn : 0;
            return (
              <tfoot>
                <tr className="border-t-2 border-[#00E273]/40 bg-muted/40">
                  <td className="px-2 py-2.5 text-center text-[9px] font-bold text-foreground" colSpan={3}>TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-foreground">{Math.round(totQty).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-foreground">{fmtRp(totRev)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-foreground">{totTxn.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-muted-foreground">{avgAtu.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-muted-foreground">{fmtRp(avgAsp)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-muted-foreground">{fmtRp(avgAtv)}</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-semibold rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="size-3" /> Prev
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-semibold rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
