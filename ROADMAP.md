# 🔮 Metis AI — Accurate Sales Dashboard Integration

> **Branch:** `feature/metis-ai` (main tetap untouched)
> **Deploy:** Vercel preview link terpisah dari production

---

## Current State

```
accurate-dashboard/
├── app/
│   ├── api/
│   │   ├── dashboard/route.ts      # Summary data (KPI, charts, stores)
│   │   ├── detail/route.ts         # Detail table (kode/kode_besar)
│   │   └── filter-options/route.ts # Filter dropdown options
│   ├── HomeInner.tsx               # Main component — URL-based filters via useSearchParams
│   ├── layout.tsx                  # Root layout (minimal, no providers)
│   └── page.tsx                    # Wrapper with Suspense
├── components/
│   ├── FilterBar.tsx               # Filter controls
│   ├── KpiCards.tsx, PeriodChart.tsx, BranchPieChart.tsx, StoreTable.tsx, SkuCharts.tsx, DetailTable.tsx
│   └── ui/                         # shadcn primitives
├── lib/
│   ├── db.ts                       # pg Pool (DATABASE_URL)
│   ├── fetcher.ts                  # SWR fetcher
│   └── format.ts, utils.ts, cache.ts, query-helpers.ts, export.ts
└── package.json                    # Next.js 16, React 19, SWR, Tailwind 4, Chart.js, Radix UI
```

**Filter state:** Semua via URL `searchParams` — `from`, `to`, `branch`, `store`, `entity`, `gender`, `series`, `color`, `tier`, `tipe`, `version`, `q`, `tab`.

**Data fetching:** SWR → `/api/dashboard?v=3&{params}` → returns `DashboardData` (kpis, timeSeries, stores, byBranch, bySeries, byGender, byTier, byTipe, bySize, byPrice, rankByArticle).

---

## What We're Building

Floating AI chat widget (Metis) yang:
1. Muncul sebagai ✨ bubble 56px di bottom-right
2. Klik → expand jadi chat panel 380×600px (spring animation)
3. **Context-aware** — tahu user lagi lihat filter/data apa
4. Bisa query database langsung (SQL tool, read-only)
5. Jawab dalam Bahasa Indonesia, insight actionable
6. (Later) Connect ke Iris di Mac Mini untuk kirim ke WA/PPT

---

## Tech Decisions

| What | Choice | Why |
|------|--------|-----|
| LLM | Kimi K2.5 via OpenRouter | Proven di iris-ai, bagus SQL, murah |
| Chat SDK | `ai` + `@ai-sdk/react` v6 | Streaming, tool calling, same as iris-ai |
| Animation | `framer-motion` | Spring physics, AnimatePresence, 25KB |
| Widget mount | Portal to `document.body` | Escape z-index/overflow issues |
| Context capture | Structured JSON from `searchParams` + SWR data | Fast, accurate, no vision model |
| DB access | Same `lib/db.ts` Pool | Already exists, reuse |
| Chat persistence | `localStorage` | Simple, no backend needed |

---

## Implementation Roadmap

### Phase 1: Backend — Chat API
> File baru, zero risk ke existing code

```
NEW  lib/metis/db.ts               # Read-only query executor (SELECT/WITH only, 30s timeout, 500 row cap)
NEW  lib/metis/system-prompt.ts     # System prompt (Zuma context, SQL rules, dashboard awareness)
NEW  lib/metis/tools.ts             # queryDatabase tool definition (zod schema)
NEW  app/api/metis/chat/route.ts    # POST endpoint — streamText + tool calling
```

**What it does:**
- `/api/metis/chat` receives messages + `dashboardContext` JSON
- Injects dashboard state into system prompt ("User sedang lihat Branch: Bali, Gender: Ladies...")
- LLM can call `queryDatabase` tool → runs read-only SQL → returns results
- Streams response back via `toUIMessageStreamResponse()`

**Security:**
- SQL: SELECT/WITH only, blocked keywords (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE)
- Timeout: 30 seconds per query
- Row cap: 500 rows max
- Only server-side (API route), no client-side DB access

---

### Phase 2: Frontend — Floating Widget
> Semua file baru di `components/metis/`, zero touch ke existing components

```
NEW  components/metis/portal.tsx          # createPortal wrapper (SSR-safe)
NEW  components/metis/metis-widget.tsx    # Bubble + AnimatePresence toggle
NEW  components/metis/metis-bubble.tsx    # 56px circle trigger (✨ icon)
NEW  components/metis/metis-panel.tsx     # Expanding chat panel (380×600)
NEW  components/metis/metis-header.tsx    # Panel header (title, minimize, clear)
NEW  components/metis/metis-messages.tsx  # Message list (auto-scroll, markdown render)
NEW  components/metis/metis-input.tsx     # Chat input + send button
NEW  components/metis/metis-message.tsx   # Single message bubble (user vs AI)
NEW  components/metis/metis-context-bar.tsx  # Shows active filters as chips
```

**UX Flow:**
1. Bubble `fixed bottom-6 right-6 z-[9999]` — always visible
2. Click → `scale(0.8→1) + opacity(0→1)` spring animation → panel opens
3. Panel: header + context bar + messages + input
4. Mobile (`< md`): full-screen takeover (`inset-0`)
5. Desktop: floating panel bottom-right
6. Minimize → reverse animation → back to bubble

---

### Phase 3: Context Wiring
> 1 file baru (provider), 2 file modified (layout + HomeInner)

```
NEW  providers/metis-provider.tsx     # React Context: dashboard state + open/close
MOD  app/layout.tsx                   # Wrap children with MetisProvider + mount MetisWidget
MOD  app/HomeInner.tsx                # Push filter state + SWR data ke MetisProvider
```

**How context flows:**
```
HomeInner.tsx                           MetisProvider (React Context)
├── searchParams (filters)  ──push──►  { filters, visibleData, activePage }
├── SWR data (kpis, charts) ──push──►        │
└── activeTab               ──push──►        ▼
                                       metis-panel.tsx
                                       ├── Shows context bar ("Branch: Bali · Ladies")
                                       └── Sends with every chat message to /api/metis/chat
```

**Changes to existing files (minimal):**
- `layout.tsx`: Wrap `{children}` with `<MetisProvider>`, add `<MetisWidget />` as sibling
- `HomeInner.tsx`: Add `useEffect` to push `searchParams` + `data` ke context (~10 lines)

---

### Phase 4: Polish & Deploy
> Quality of life features + deploy

```
ADD  Suggestion chips ("Top artikel", "Stok rendah", "Revenue trend")
ADD  Chat history (localStorage sessions)
ADD  Loading skeleton saat AI thinking
ADD  Error states (API down, query failed)
ADD  Unread dot on bubble saat ada response baru
ADD  Scroll-to-bottom on new messages
```

**Deploy:**
1. Push `feature/metis-ai` branch ke GitHub
2. Vercel auto-creates preview deployment (separate URL dari production)
3. Test in browser
4. Share preview link

---

## File Change Summary

| Type | Count | Files |
|------|-------|-------|
| **NEW** | ~15 | All `components/metis/*`, `lib/metis/*`, `app/api/metis/*`, `providers/*` |
| **MODIFIED** | 2 | `app/layout.tsx` (wrap provider), `app/HomeInner.tsx` (push context) |
| **EXISTING** | 0 | Semua file existing TIDAK diubah logic-nya |

**Risk to existing dashboard: MINIMAL** — hanya 2 file dimodif (layout wrapping + context push), semua Metis code di folder terpisah.

---

## Env Vars Needed (Vercel)

```env
# Already exists:
DATABASE_URL=postgresql://openclaw_app:****@76.13.194.120:5432/openclaw_ops

# New (add to Vercel for this branch):
OPENROUTER_API_KEY=<from iris-ai .env.local>
```

---

## Phase 5 (Later — setelah Stock Dashboard juga done)
- Iris A2A communication (kirim summary ke WA/Gmail)
- PPT generation via Eos
- Screenshot mode (html2canvas + vision model)
- Shared Metis widget as npm package (kalau mau DRY)
