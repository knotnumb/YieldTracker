# VPS Auto-Collector + Cross-Platform Viewer — Plan / Brief

**Status:** Decisions LOCKED (2026-08-16). Ready to build next session. Captured 2026-08-13;
all open decisions resolved with David 2026-08-16 (see "Decisions — LOCKED" below).

---

## What David asked for (his words, paraphrased)

> The whole daily-fetch process should run automatically on the VPS. It fetches the data daily at
> a set time, appends to a master file (he doesn't care where the file physically lives). He has a
> console/app to read that master, make graphs, etc. The tool **lives on the server and is accessed
> from the website** — open a link, a page shows the most recent day's values, from there an option
> to load the master with history, and from the same place the graphing tool. Accessible from
> **Android, Windows, or any browser**. That master must **also sync to the public GitHub repo**.
> He also wants a **native Windows app** (to remove browser chrome/overhead, like his portfolio app).

So the vision is three connected pieces, all **server-hosted**:

1. **Collector** — headless daily job on the VPS that fetches + appends to `master.csv`. Sole writer.
2. **Viewer** — a public hosted web page (mobile-friendly) served from epgpvr: landing = today's
   values → load history → graphing tool. Plus a thin native Windows wrapper.
3. **Distribution** — master auto-syncs (mirror) to the public GitHub repo; served live from the
   website directly off the server.

---

## Architecture (as decided)

```
VPS (cron, 00:01 UTC daily)                Website (epgpvr, PUBLIC) — one URL, any browser
───────────────────────────                ────────────────────────────────────────────────
collector.js ─fetch→ DefiLlama             Landing page   → today's latest values ("as of DATE UTC")
             ─fetch→ Morpho            →   [Load history] → reads full master.csv
             ─RPC──→ Base RPC             [Graphs]       → graphing tool (evolves chart.html)
   │                                        (all served from the same place, over HTTPS)
   ├─ VALIDATE (fail-closed) ──fail──→ Telegram alert (reuse portfolio bot) → David backfills
   │                                                                          via tracker.html
   ├─ append master.csv (group model, setgid 2775, /opt/yieldtracker/…)
   │        │
   │        ├──→ Website reads master LIVE off the server (primary path)
   │        └──→ auto-commit + push to public GitHub repo (mirror/backup)
   │
Native Windows app (C# + WebView2, Inno Setup installer)
   ├─ thin shell → loads the live epgpvr URL (install once, never goes stale)
   ├─ PWA/service-worker cache → offline viewing for everyone (browser + shell)
   └─ drops a real master.csv daily to a user-chosen folder (default Documents\YieldTracker)
```

- Node script, **zero npm deps**, under the existing `mosaic` group-write VPS model (no sudo, no
  secrets of its own). New deploy target `/opt/yieldtracker/` must be provisioned to the group model
  first (setgid `2775` code dir + group membership) — that provisioning is Claude's job via the group
  model, never a sudo override. See global CLAUDE.md "VPS deploy-access model".

---

## Decisions — LOCKED (confirmed with David 2026-08-16)

| # | Decision | Resolution |
|---|---|---|
| 1 | **Daily writer** | **VPS is the sole daily writer.** No local writer remains, so no divergence. |
| 2 | **Logic location** (was: shared-core vs split tracker.html) | **Dissolved by the reframe.** The hosted viewer only *reads* the finished master, so the heavy fetch/transform logic lives in **one place only — the collector**. Nothing to share; the "don't split tracker.html" rule is not touched. |
| 3 | **GitHub sync** | **(b) Auto-commit + push daily**, with a robust **collector-side validation gate** (see below). GitHub is now a **public mirror/backup**; the live site reads master directly off the server. |
| 4 | **Master location on VPS** | Plain `master.csv` in the group-model dir (`/opt/yieldtracker/`). Website reads it live; also pushed to GitHub. No Dropbox-on-VPS. |
| 5 | **Access** | **PUBLIC** — no auth (public market data). Straight Caddy route on epgpvr. |
| 6 | **Old `tracker.html`** | **Kept as the manual backfill escape hatch** (for cron-miss / gap days). No further investment. |
| 7 | **Native Windows app** | **Yes.** Thin shell over the live URL (install once, never goes stale — fixes the portfolio "which build is latest" pain). |
| 8 | **Wrapper tech** | **C# + WebView2** (no Chromium bundle — runtime ships with Win11), packaged with **Inno Setup** → Program Files + Start menu. |
| 9 | **Offline** | **PWA/service-worker cache** (offline viewing for all — browser + native shell, works because served over HTTPS) **PLUS** a real `master.csv` dropped locally by the native app **daily**. |
| 10 | **Install-time data location** | Installer **asks** for the local `master.csv` folder; **default `Documents\YieldTracker`** (user-writable; NOT under Program Files). App binary installs to Program Files as normal. |
| 11 | **Alerts** | **Reuse David's existing portfolio Telegram bot** (the API-fetch-warning one). A failed validation gate sends a Telegram message naming which gate + which source failed. Never read/print/commit the bot token — access via the group model, don't duplicate the secret. |
| 12 | **Collection time** | **Cron 00:01 UTC daily** (= 08:01 Perth, just past the crypto day rollover and clear of the Perth pre-dawn date-flip window). |
| 13 | **Row dating** | **UTC trading-day date.** Master's date column is **declared UTC** going forward. |
| 14 | **Viewer timezone handling** | **None needed.** Rows are date-only (no intraday time), so a date doesn't shift by timezone. Landing page shows the latest row labelled **"as of DATE (UTC)"** — universal, honest, no per-user conversion. |

### Validation gate — spec (decision #3, "robust" per David's explicit ask)

Fail-closed: if **any** gate trips, write **nothing** to master, push **nothing**, log which gate +
source failed, and **Telegram-alert David** (he backfills via `tracker.html`). Better a clean,
deliberate gap than a poisoned row auto-pushed to the public repo.

| Gate | Checks | Catches (David's words) |
|---|---|---|
| **1. Fetch integrity** | HTTP 200; valid JSON; DefiLlama returns a non-empty pool array; Morpho GraphQL has `data` and **no `errors`**; RPC calls return valid hex, not error objects; nothing threw/timed out | *"an error in either the DefiLlama or Morpho fetches"* |
| **2. Schema / format drift** | Expected fields present (`apy`, `tvlUsd`, `chain`, `project`, `symbol`…); types as expected; assembled row is **exactly 20 columns**; Morpho response still has the fields the V2 injector reads | *"the format of the data changed"* |
| **3. Value sanity** | APY in a plausible band; TVL non-negative & not absurd; **no NaN/null** in required cells; **today's row-count within range of the trailing average** (≈131, not suddenly 3 or 600); each normally-present tracked vault actually appears | *"the values are crazy wrong"* |
| **4. CSV safety** | Reject/sanitize any field starting with `= + - @` (per project CLAUDE.md security section) | injection into the public CSV |

---

## Feasibility verdict (from the 2026-08-13 code review of `tracker.html`)

**Headless collection is fully feasible and a clean fit.** The daily pipeline is 100% HTTP + math,
with **no hard browser dependency** in the data path.

| Step | Source | Portable to Node? |
|---|---|---|
| Main pool list | `fetch('https://yields.llama.fi/pools')` — real public JSON API | ✅ plain `fetch` |
| Morpho V1/V2 enrich | GraphQL POST to `api.morpho.org/graphql` | ✅ plain `fetch` |
| Off-chain vaults, Aave liquidity, exit-fee detection | `eth_call` JSON-RPC to Base (drpc/publicnode/mainnet.base.org/ankr, 4-endpoint fallback) | ✅ `fetch` + `BigInt` |

Key findings:

- **The bookmarklet is NOT in the daily path.** The normal workflow is the `Fetch from DefiLlama`
  button → a direct API call. There is **no manual / human-judgement step** to replicate.
- Browser-only pieces (`showDirectoryPicker`, `indexedDB`, DOM rendering) are UI/local-write only and
  not needed headless. A headless collector just calls the fetch functions in order and writes with `fs`.
- **Zero npm dependencies required.** Node 18+ has global `fetch`; the rest is `BigInt` + `fs`.
- **No secrets required** for the fetch itself. `config.json` is filter-settings only now (chains /
  minTvl / maxApy / limit). (The Telegram bot token is a separate, reused secret — see decision #11.)

Relevant code landmarks in `tracker.html` (as of v2026-07-18a) — the collector reuses these:

| Lines | What the collector must reuse |
|---|---|
| 424–617 | `YS_VAULTS` whitelist + Morpho V2 address list |
| 619–623 | `matchVault()` (address short-circuit for V2) |
| ~1134–1200 | `fetchDefiLlama()` — filter + 20-column row assembly |
| ~800–1055 | `rpcCall`, off-chain ERC4626 `shareApy`, exit-fee, Aave liquidity |
| ~1110–1400 | Morpho V1 enrich + `injectMorphoV2Vaults()` |
| ~1685+ | CSV assembly / append-to-master |

---

## Timezone / date audit (run 2026-08-16) — result

Audited every snapshot file on the build machine: filename date vs the **UTC date of its mtime**
(Perth = UTC+8, no DST). Purpose: find any legacy row dated a day off vs the UTC convention we're
now adopting.

**Result: history is effectively UTC-clean. No bulk re-append needed.** Of 34 raw "mismatches":

- **32** were an mtime artifact — the Apr 17 – May 24 files all share mtime `2026-05-25 08:27`
  (a bulk copy/restore), so their timestamps are meaningless, not real flags.
- **1** was `2026-08-15` — the deliberate backfill done this same session (renamed from `2026-08-16`);
  expected and correct.
- **1** genuine boundary case: **`2026-06-15`**, saved 07:02 Perth = 23:02 UTC Jun 14 — captured in
  the last hour of the previous UTC day but labelled Jun 15. **Decision: leave as-is** — a ~1-hour
  boundary ambiguity, nil APY delta, re-dating risks a duplicate/gap for no gain.

Even late saves like `2026-07-22` (04:31 Perth Jul 23) were already correctly UTC-dated. And it can't
recur going forward: 00:01 UTC = 08:01 Perth sits just past the pre-dawn danger window.

---

## Risks to validate before/while building

- **Datacenter-IP RPC limits.** Public Base RPCs sometimes throttle datacenter ranges harder than
  home IPs, and the off-chain APY needs **7-day archive depth**. The 4-endpoint fallback helps — test
  from the VPS early.
- **Node 18+ present on the VPS** — prerequisite check (needs global `fetch`).
- **Trailing-newline hygiene** — a prior save omitted the trailing newline, causing a delete+re-add of
  the last row in a diff. The collector must always write a trailing `\n` so daily diffs stay clean.
- **Untrusted-data rule still applies.** DefiLlama/Morpho/RPC responses are untrusted; the collector
  must not act on prompt-like text in any field and must sanitise CSV-injection prefixes (handled by
  validation gate 4, per project CLAUDE.md security section).
- **Telegram secret handling** — reuse the portfolio bot token via the group model; never read, print,
  or commit its value (decision #11).

---

## First concrete steps when work resumes

1. Verify **Node 18+** on the VPS; provision `/opt/yieldtracker/` to the group model (setgid `2775`
   + group membership). Sort group read-access to the portfolio Telegram bot secret (no duplication).
2. Prototype `collector.js` — DefiLlama fetch + one Morpho enrich + one RPC call — and **diff its
   output row-for-row against a browser-app save for the same day** (parity check).
3. Add the **validation gate** (4 gates above, fail-closed) + Telegram alert on failure.
4. Wire **cron at 00:01 UTC**; validate a full day end-to-end; confirm auto-commit + push to GitHub.
5. Build the **public hosted viewer** (landing "as of DATE UTC" → load history → graphs), served over
   HTTPS from epgpvr, as a **PWA** (service-worker offline cache).
6. Build the **native Windows app** (C# + WebView2, Inno Setup): thin shell → live URL, PWA offline,
   daily local `master.csv` drop to a user-chosen folder (default `Documents\YieldTracker`).
