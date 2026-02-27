# Accurate Dashboard — Bug Fixes & AI Handoff Notes

> **For future AI agents working on this codebase.**  
> This document records every bug found, its root cause, and the fix applied.  
> Ordered chronologically. DB = PostgreSQL on `76.13.194.120:5432 / openclaw_ops`.

---

## Summary of All Fixes

| # | Area | Bug | Fix | Commit |
|---|------|-----|-----|--------|
| 1 | API | Rank By Article showing duplicate kode_mix rows | Remove `kode_besar` from GROUP BY | `0602ffc` |
| 2 | API | Detail Kode showing duplicate kode rows | Remove `kode_besar` from kode-mode GROUP BY | `4127bcb` |
| 3 | Frontend | Default date range was hardcoded 2024 | Dynamic current YTD | `893e711` |
| 4 | Frontend | Searchbox only triggered on Enter key | Debounced `onChange` (400ms) | `36902b7` |
| 5 | Frontend | HTTP errors swallowed silently | Added `!r.ok` throw in fetcher | `36902b7` |
| 6 | Frontend | StoreTable page didn't reset on new data | `useEffect` to reset page when `stores` prop changes | `36902b7` |
| 7 | Frontend | Tab switch kept stale page number in URL | `params.delete("page")` on tab change | `36902b7` |
| 8 | Frontend | RankTable rows had non-unique React keys | Add `idx` suffix to key string | `36902b7` |
| 9 | Frontend | Detail table CSV export crashed when data empty | Guard `json.rows` before mapping | `36902b7` |
| 10 | Frontend | BranchPieChart crashed when >10 branches | Use `i % PIE_PALETTE.length` (modulo) | `36902b7` |
| 11 | Frontend | StoreTable columns not sortable | Full sort implementation with `useMemo` | `58713fa` |
| 12 | Frontend | RankTable columns not sortable | Full sort implementation with `useMemo` | `58713fa` |
| 13 | API | `version` filter ignored in store query | Add `["version","version"]` to store filter loop | `58713fa` |
| 14 | DB | 30 store types mapping to branch `NULL`/Unknown | Fix view JOIN + insert 30 rows into `portal.store` | DB-only |
| 15 | DB | `refresh_accurate_marts()` unusable by app user | Add `SECURITY DEFINER`, set owner to `postgres` | DB-only |
| 16 | API | Search box `q` param ignored by dashboard API | Add `q` ILIKE to `buildMvFilters` + store filter block | `64390d4` |

---

## Detailed Fix Log

---

### FIX 1 — Rank By Article: Duplicate kode_mix rows

**File:** `app/api/dashboard/route.ts`  
**Symptom:** The "Rank by Article" table showed the same kode_mix (e.g., `SJ1ACAV201`) multiple times — once per size variant — instead of aggregated totals.  
**Root Cause:** The `rankByArticle` SQL grouped by `d.article, d.kode_mix, d.gender, d.series, d.color, d.kode_besar`. Including `d.kode_besar` (which encodes size) split what should be one row into many.  
**Fix:** Remove `d.kode_besar` from the GROUP BY clause.

```sql
-- BEFORE (wrong):
GROUP BY d.article, d.kode_mix, d.gender, d.series, d.color, d.kode_besar

-- AFTER (correct):
GROUP BY d.article, d.kode_mix, d.gender, d.series, d.color
```

---

### FIX 2 — Detail Kode: Duplicate rows

**File:** `app/api/detail/route.ts`  
**Symptom:** In "Detail (Kode)" tab, each article appeared multiple times split by size.  
**Root Cause:** Same as Fix 1 — `kode_besar` was in GROUP BY for kode-level aggregation.  
**Fix:** Remove `kode_besar` from GROUP BY in the `kode` mode query.

---

### FIX 3 — Default Date Range Was Hardcoded to 2024

**File:** `components/FilterBar.tsx` (or wherever defaults are set)  
**Symptom:** Dashboard always opened with 2024 dates, not the current year.  
**Fix:** Compute default `from` as `YYYY-01-01` (current year Jan 1) and `to` as today dynamically using `new Date()`.

```ts
// Dynamic YTD defaults
const today = new Date();
const defaultFrom = `${today.getFullYear()}-01-01`;
const defaultTo = today.toISOString().slice(0, 10);
```

---

### FIX 4 — Searchbox Only Triggered on Enter

**File:** `components/FilterBar.tsx`  
**Symptom:** Typing in the search box did nothing until pressing Enter. UX felt broken.  
**Fix:** Replace Enter-only handler with debounced `onChange` (400ms). Uses `useRef` for debounce timer.

```tsx
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    // apply search filter
  }, 400);
};
```

---

### FIX 5 — HTTP Errors Swallowed Silently

**File:** `lib/fetcher.ts`  
**Symptom:** When the API returned a 500, the frontend showed stale data or blank with no error message.  
**Root Cause:** `fetch()` does not throw on non-2xx responses. The response was being parsed as JSON even on error.  
**Fix:**

```ts
const r = await fetch(url);
if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
return r.json();
```

---

### FIX 6 — StoreTable Pagination Didn't Reset on Filter Change

**File:** `components/StoreTable.tsx`  
**Symptom:** Changing a filter while on page 3 of stores would show an empty page (page 3 of a now-smaller dataset).  
**Fix:** Add `useEffect` that resets `currentPage` to 1 whenever the `stores` prop changes.

```ts
useEffect(() => {
  setCurrentPage(1);
}, [stores]);
```

---

### FIX 7 — Tab Switch Kept Stale Page in URL

**File:** `app/HomeInner.tsx`  
**Symptom:** Switching tabs kept `?page=5` in the URL, causing the new tab's table to try to load page 5.  
**Fix:**

```ts
const handleTabChange = (tab: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", tab);
  params.delete("page"); // <-- clear stale page
  router.push(`?${params.toString()}`);
};
```

---

### FIX 8 — RankTable Non-Unique React Keys

**File:** `components/SkuCharts.tsx`  
**Symptom:** Console warnings about duplicate keys. Possible rendering glitches on re-sort.  
**Root Cause:** Key was built from `kode_mix + gender + series + color` which could collide if two rows had identical attributes but different sizes.  
**Fix:** Append `idx` (row index) to the key to guarantee uniqueness.

```tsx
<tr key={`${r.kode_mix || r.article}-${r.gender || ""}-${r.series || ""}-${r.color || ""}-${String(idx)}`}>
```

---

### FIX 9 — Detail Table Export Crashed on Empty Data

**File:** `components/DetailTable.tsx`  
**Symptom:** Clicking CSV/XLSX export when no data was loaded caused a crash.  
**Root Cause:** Export handler called `.map()` on `json.rows` without checking if `rows` existed.  
**Fix:**

```ts
const rows = json.rows ?? [];
```

---

### FIX 10 — BranchPieChart Crash When >10 Branches

**File:** `components/BranchPieChart.tsx`  
**Symptom:** When the branch list exceeded 10 items, the color array went out of bounds causing a crash or transparent slices.  
**Fix:** Use modulo to cycle colors:

```ts
const color = PIE_PALETTE[i % PIE_PALETTE.length];
```

---

### FIX 11 — StoreTable Columns Not Sortable

**File:** `components/StoreTable.tsx`  
**Symptom:** Store performance table had no sort — always sorted by revenue desc from server.  
**Fix:** Full client-side sort implementation:

- Added `sortKey` state (default: `"revenue"`) and `sortDir` state (default: `"desc"`)
- `useMemo` to produce `sortedStores` from the `stores` prop
- `SortIcon` component: shows `↑`/`↓` for active column, `⇅` for inactive
- `handleSort`: toggles direction if same column, resets to smart default if new column (text → asc, numeric → desc)
- All `<th>` headers are clickable with `cursor-pointer` styling
- Export uses `sortedStores` (respects current sort order)

**Columns:** Store, Branch, Qty, Revenue, TXN, ATU, ASP, ATV

---

### FIX 12 — RankTable Columns Not Sortable

**File:** `components/SkuCharts.tsx` (inside `RankTable` function)  
**Symptom:** Rank by Article table couldn't be sorted by any column.  
**Fix:** Same pattern as Fix 11:

- `RankSortKey` type union for all 7 sortable columns
- `SortIcon` component defined inside the file
- `sortKey` default: `"pairs"` desc (by qty sold, matching original server sort)
- `sortedRows` useMemo — special handling for `"asp"` (computed: `revenue/pairs`) and `"kode_mix"` (falls back to `article` if empty)
- Grand totals (`tfoot`) always computed from original `rows` (not `sortedRows`) so totals never change
- Export uses `sortedRows`

**Columns:** Kode Mix, Gender, Series, Color, Qty Sold, Revenue, ASP

```ts
// ASP sort special case:
if (sortKey === "asp") {
  av = a.pairs > 0 ? a.revenue / a.pairs : 0;
  bv = b.pairs > 0 ? b.revenue / b.pairs : 0;
}
```

---

### FIX 13 — `version` Filter Ignored in Store Query

**File:** `app/api/dashboard/route.ts`  
**Location:** Line ~161 (store-specific filter loop)  
**Symptom:** Filtering by VERSION in the filter bar had no effect on the Store Performance table, even though it worked on all other charts.  
**Root Cause:** The store query has its own manual filter-building loop (separate from `buildMvFilters`) that was missing `["version","version"]`.  
**Fix:**

```ts
// BEFORE:
for (const [param, col] of [
  ["series","series"],["gender","gender"],["tier","tier"],
  ["color","color"],["tipe","tipe"]
] as [string,string][]) {

// AFTER:
for (const [param, col] of [
  ["series","series"],["gender","gender"],["tier","tier"],
  ["color","color"],["tipe","tipe"],["version","version"]  // <-- added
] as [string,string][]) {
```

> **Note:** The main `buildMvFilters` function already had `version`. Only the store-specific loop was missing it.

---

### FIX 14 — Branch "Unknown": 30 Stores Unmapped

**Type:** Database fix (no frontend changes needed)  
**Symptom:** ~35% of revenue (Rp 4.2B for YTD 2026) appeared under branch "Unknown" in all charts.

**Root Cause (two-part):**

**Part A — Empty `matched_store_name`:**  
For wholesale, online, and event/pameran transactions, the ETL pipeline left `matched_store_name` as `''` (empty string). The JOIN condition was:

```sql
ON s.matched_store_name = st.nama_accurate
```

An empty string never matches any `nama_accurate` → branch comes back NULL → frontend treats NULL/empty as "Unknown".

**Part B — Stores missing from `portal.store`:**  
Even if the JOIN was fixed to fall back to `store_name_raw`, 30 store names had no corresponding row in `portal.store`.

**Fix Part A — View JOIN fix (applied to both `core.sales_with_product` and `core.sales_with_store`):**

```sql
-- BEFORE (wrong):
ON s.matched_store_name = st.nama_accurate

-- AFTER (correct — falls back to store_name_raw, normalizes case+whitespace):
ON TRIM(BOTH FROM lower(
  COALESCE(NULLIF(s.matched_store_name, ''), s.store_name_raw)
)) = st.nama_accurate
```

The right side (`st.nama_accurate`) was already normalized via `TRIM(BOTH FROM lower(...))` in the subquery. Only the left side needed fixing.

**Fix Part B — Insert 30 missing stores into `portal.store`:**

```sql
INSERT INTO portal.store (nama_accurate, branch, area, category) VALUES
  ('online',                           'Online',    'Online',    'NON-RETAIL'),
  ('wholesale bali',                   'Bali',      'Bali',      'WHOLESALE'),
  ('wholesale jakarta',                'Jakarta',   'Jakarta',   'WHOLESALE'),
  ('wholesale lombok',                 'Lombok',    'Lombok',    'WHOLESALE'),
  ('wholesale ntt',                    'Sulawesi',  'Sulawesi',  'WHOLESALE'),
  ('wholesale jatim',                  'Jatim',     'Jatim',     'WHOLESALE'),
  ('wholesale baby',                   'Bali',      'Bali',      'WHOLESALE'),
  ('wholesale papua',                  'Sulawesi',  'Sulawesi',  'WHOLESALE'),
  ('wholesale gorontalo',              'Sulawesi',  'Sulawesi',  'WHOLESALE'),
  ('wholesale ntb',                    'Lombok',    'Lombok',    'WHOLESALE'),
  ('pusat',                            'Bali',      'Bali',      'NON-RETAIL'),
  ('unknown',                          'Unknown',   'Unknown',   'NON-RETAIL'),
  ('zuma imbex',                       'Bali',      'Bali',      'EVENT'),
  ('zuma bazar jkt',                   'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma event toy story (jatim)',     'Jatim',     'Jatim',     'EVENT'),
  ('zuma k square batam',              'Batam',     'Batam',     'EVENT'),
  ('zuma pameran',                     'Bali',      'Bali',      'EVENT'),
  ('zuma event bape',                  'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma pameran ptc',                 'Jatim',     'Jatim',     'EVENT'),
  ('zuma pekan raya jakarta (prj)',    'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma aeon',                        'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma bazar royal plaza',           'Jatim',     'Jatim',     'EVENT'),
  ('zuma rambla bandung',              'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma bazar bigbang jkt',           'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma pameran cieie jakarta',       'Jakarta',   'Jakarta',   'EVENT'),
  ('zuma jastip',                      'Online',    'Online',    'NON-RETAIL'),
  ('bazar jakcloth',                   'Jakarta',   'Jakarta',   'EVENT'),
  ('bazar la piazza',                  'Jakarta',   'Jakarta',   'EVENT'),
  ('lebaran fair jakarta',             'Jakarta',   'Jakarta',   'EVENT'),
  ('the park sawangan',                'Jakarta',   'Jakarta',   'EVENT')
ON CONFLICT DO NOTHING;
```

> **IMPORTANT:** `portal.store.nama_accurate` values must be **lowercase + trimmed** because the view subquery normalizes with `TRIM(BOTH FROM lower(...))`. If you insert mixed-case values, the JOIN will miss.

**After fix — Branch breakdown (YTD 2026):**

| Branch | Before | After |
|--------|--------|-------|
| Bali | 40.6% | 46.9% |
| Unknown | **35.6%** | **~0%** |
| Online | 0.0% | 25.7% |
| Jatim | 12.0% | 12.5% |
| Lombok | 6.3% | 8.6% |

---

### FIX 15 — `refresh_accurate_marts()` Unusable by App User

**Type:** Database fix  
**Symptom:** Calling `SELECT mart.refresh_accurate_marts()` as `openclaw_app` failed with:
```
ERROR: must be owner of materialized view mv_accurate_summary
```

**Root Cause:** `mv_accurate_summary` is owned by `postgres`. The function `refresh_accurate_marts()` was not `SECURITY DEFINER`, so it ran as the calling user (`openclaw_app`) which lacks ownership.

**Fix (run as postgres via SSH):**

```sql
-- Step 1: Recreate function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION mart.refresh_accurate_marts()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW mart.mv_accurate_summary;
  REFRESH MATERIALIZED VIEW mart.mv_accurate_txn_agg;
END;
$function$;

-- Step 2: Set owner to postgres (SECURITY DEFINER runs as the owner)
ALTER FUNCTION mart.refresh_accurate_marts() OWNER TO postgres;

-- Step 3: Grant execute to app user
GRANT EXECUTE ON FUNCTION mart.refresh_accurate_marts() TO openclaw_app;
```

**After fix:** `openclaw_app` can call `SELECT mart.refresh_accurate_marts();` directly after any ETL run.

---

## Architecture Notes for Future AI

### Database Connection

```
host:     76.13.194.120:5432
database: openclaw_ops
user:     openclaw_app
password: Zuma-0psCl4w-2026!
```

`postgres` superuser is blocked by `pg_hba.conf` for external hosts. Use SSH:
```bash
ssh root@76.13.194.120 "sudo -u postgres psql -d openclaw_ops -c 'YOUR SQL'"
```

### Key Tables / Views

```
fact_sales_unified              — raw unified sales fact table (all entities)
portal.store                    — store master: nama_accurate → branch/area/category
portal.kodemix                  — SKU master: kode_besar → kode_mix/article/series/gender/tier
dim_product                     — product master: kode_besar → series/gender/tier/color/rsp

core.sales_with_product         — VIEW: fact_sales_unified + kodemix + dim_product + portal.store
core.sales_with_store           — VIEW: fact_sales_unified + portal.store (no product join)

mart.mv_accurate_summary        — MATERIALIZED VIEW (owner: postgres): aggregated sales
mart.mv_accurate_txn_agg        — MATERIALIZED VIEW (owner: openclaw_app): transaction counts
```

### Critical Schema Facts

1. **`portal.store.nama_accurate` must be lowercase+trimmed** — the view JOIN normalizes the right side. Mixed-case entries in `portal.store` will miss the JOIN.

2. **`tier` is stored as `"1"`, `"2"`, `"3"`, `"4"`** — NOT `"T1"`, `"T2"`. The frontend adds the "T" prefix for display: `T${r.tier}`.

3. **`kodemix_*` columns = aliases of `gender/series/tier/color`** — they are identical values. Do not be confused by the duplication in `mv_accurate_summary`.

4. **`matched_store_name` can be empty string for wholesale/online/events** — the ETL doesn't always populate it. Always use `COALESCE(NULLIF(matched_store_name,''), store_name_raw)` when joining to `portal.store`.

5. **Materialized view must be refreshed after any ETL or `portal.store` changes:**
   ```sql
   SELECT mart.refresh_accurate_marts();  -- works as openclaw_app after Fix 15
   ```

### API Route Structure

```
app/api/dashboard/route.ts     — Main dashboard data (KPIs, charts, store table, rank table)
app/api/detail/route.ts        — Detail Kode / Detail Size (Kode Besar) table
app/api/filter-options/route.ts — Dropdown values for filter bar
```

**Filter parameter flow in `dashboard/route.ts`:**
- Most filters go through `buildMvFilters()` for charts/KPIs
- Store table has a **separate manual filter loop** (lines ~130–170) that must mirror `buildMvFilters`
- If you add a new filter param, add it to **both** `buildMvFilters` AND the store-specific loop

### Frontend Component Map

```
app/HomeInner.tsx              — Main layout, tab routing, filter URL state
components/FilterBar.tsx       — Date pickers + all filter dropdowns + search box
components/KpiCards.tsx        — Revenue/Pairs/TXN/ATU/ASP/ATV tiles
components/TimeSeriesChart.tsx — Sales Over Time line chart
components/BranchTable.tsx     — Branch contribution table (left of chart)
components/BranchPieChart.tsx  — Branch pie chart
components/StoreTable.tsx      — Store Performance paginated+sortable table
components/SkuCharts.tsx       — All SKU charts (pie/bar) + RankTable
components/DetailTable.tsx     — Detail Kode / Detail Size table with export
lib/fetcher.ts                 — Fetch wrapper (throws on !r.ok)
lib/export.ts                  — CSV/XLSX export utilities
lib/cache.ts                   — In-memory cache (5 min TTL, server-side only)
```

### Deployment

```bash
# Build check (always run before push)
npm run build

# Push to GitHub
git add <specific files>   # NEVER git add -A blindly
git commit -m "feat/fix: description"
git push origin main

# Deploy to Vercel
npx vercel --prod --yes --token=WNWvm9fjTerfhyG9zqiSEzdx

# Live URL
https://accurate-dashboard.vercel.app
```

**Vercel cache:** API responses are cached `s-maxage=300` (5 min CDN) + in-memory cache in `lib/cache.ts`. After a DB-only fix, append `?_bust=<anything>` to the URL to force a fresh API call and bypass both caches.

### FIX 16 — Search Box Had No Effect on Summary / SKU / Store Tabs

**File:** `app/api/dashboard/route.ts`
**Symptom:** Typing in the search box and pressing Enter updated the URL (`?q=...`) but data never changed on the Summary, SKU Chart, or Store tabs. Search only worked on Detail tabs.
**Root Cause:** `buildMvFilters()` handled all filter params (branch, store, gender, series, tier, etc.) but silently ignored the `q` parameter. `/api/dashboard` was called with `q` in the URL, but no SQL condition was generated.
**Fix:** Added `q` ILIKE search to `buildMvFilters()` (covers KPIs, time series, all charts, rank table) and to the store-specific filter block:

```ts
const q = sp.get("q");
if (q) {
  conds.push(`(${p}kode ILIKE $${i} OR ${p}kode_mix ILIKE $${i} OR ${p}article ILIKE $${i})`);
  vals.push(`%${q}%`);
  i++;
}
```

> Note: same `$N` placeholder is reused for the three OR conditions — valid PostgreSQL syntax (same parameter, referenced multiple times).

**Scope of fix:** KPIs, Sales Over Time chart, Branch/Series/Gender/Tier/Tipe/Size/Price charts, Rank by Article, Store Performance table — all now correctly filter by `q`.

---

---

## Known Remaining Issues (as of Feb 2026)

### 1. Wholesale Branch Shows Negative Revenue
`wholesale bali`, `wholesale lombok`, etc. occasionally show negative revenue (e.g., `Rp -1,076,800`). This is likely a return/credit note in Accurate that wasn't filtered. Not a dashboard bug — reflects actual DB data.

### 2. `online` Store Shows Branch "Unknown" in Old Cache
With a fresh load, `online` correctly shows branch "Online". This was a cache artifact from before Fix 14.

### 3. ETL Must Normalize `matched_store_name`
The ETL scripts (`pull_accurate_sales.py`) should ideally populate `matched_store_name` consistently. Currently, wholesale/online/events leave it blank. The view now handles this via COALESCE fallback, but the ETL should be improved to write the normalized name directly.

### 4. New Stores Added to Accurate → Need `portal.store` Entry
When Zuma opens a new store or event, it will appear as branch "Unknown" until a row is inserted into `portal.store`. Use this query to find new unmapped stores:

```sql
SELECT DISTINCT TRIM(BOTH FROM lower(COALESCE(NULLIF(matched_store_name,''), store_name_raw))) AS effective_name,
       COUNT(*) as rows
FROM fact_sales_unified
WHERE TRIM(BOTH FROM lower(COALESCE(NULLIF(matched_store_name,''), store_name_raw)))
  NOT IN (SELECT TRIM(BOTH FROM lower(nama_accurate)) FROM portal.store)
GROUP BY 1 ORDER BY 2 DESC;
```

Then insert into `portal.store` and run `SELECT mart.refresh_accurate_marts();`.

---

## How to Debug "Unknown Branch" in Future

1. Run the query above to find unmapped store names
2. Insert into `portal.store` (lowercase, trimmed names)
3. `SELECT mart.refresh_accurate_marts();`
4. Reload dashboard with cache-bust: `https://accurate-dashboard.vercel.app/?_bust=1`

---

*Last updated: 2026-02-27 — All fixes above are live in production.*
