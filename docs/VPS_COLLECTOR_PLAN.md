# VPS Auto-Collector + Cross-Platform Viewer — Plan / Brief

**Status:** Decisions LOCKED (2026-08-16). Ready to build next session. Captured 2026-08-13;
all open decisions resolved with David 2026-08-16 (see "Decisions — LOCKED" below).

---

## ✅ CUTOVER COMPLETE — collector is LIVE (2026-08-16, done on ohmnuc)

**The collector went live 2026-08-16.** All four cutover steps done:
1. VPS clone fast-forwarded to `main` (untracked `collector.js` confirmed sha256-identical, removed).
2. First live run: `emit` dry-run (131 rows, all gates PASSED) → real run appended the **Aug 16
   snapshot (131 rows)** and **pushed to origin** (commit `01b4cde`). Diff +132/−1 = 131 new rows +
   one-time trailing-newline fix; future daily diffs are a clean single block. Pulled to ohmnuc.
3. **Cron enabled** on the `mosaic` crontab at 00:01 UTC (`CRON_TZ=UTC`; daemon active+enabled).
   First automated run 00:01 UTC 2026-08-17 (08:01 Perth).
4. Docs updated (CHANGELOG, SESSION_LOG, CLAUDE.md — ACTIVE WORK moved to viewer + native app).

**Remaining work = plan steps 5–6 (viewer + native app), NOT yet built.** See "First concrete steps
when work resumes". The historical build/verify notes below are kept as the collector's operational
reference.

### Original resume notes (collector build — now closed)

### Done & verified (all on VPS 103.16.131.237, as `mosaic`)
- Bootstrap: Node v22.23.2 system-wide; `/opt/yieldtracker` group-model dir (setgid `2775`,
  `mosaic:yieldtracker`), passwordless. One-time sudo already spent.
- `collector.js` — full pipeline ported from tracker.html (DefiLlama + off-chain ERC4626/RPC + Aave +
  Morpho V1 enrich + V2 inject). **Parity vs browser save: mean |Δapy| 0.0008 pp, 131/131 rows.** ~24s run.
- 4 fail-closed validation gates + Telegram alert (reuses portfolio bot). Pass + fail-closed paths
  tested; a real alert reached David's phone.
- Idempotent `master.csv` append (trailing newline) → git commit → **push to origin proven** (deploy
  key over 443, tested on a throwaway branch then deleted). `/opt/yieldtracker` is a clone of the repo.

### Remaining cutover steps (to go live)
1. **Ship to `main`:** merge `wip/vps-collector` (collector.js + this doc). Finish docs: CHANGELOG.md,
   SESSION_LOG.md, CLAUDE.md (retire the ACTIVE WORK block → make the hosted viewer + native app the new
   active work; those are plan steps 5–6, NOT yet built).
2. **Aug 16 → origin:** run the collector once at resume (`cd /opt/yieldtracker && node collector.js`
   after step 3) — it appends Aug 16 + pushes. Gives the wanted time gap from the earlier browser saves.
3. **VPS sync:** on the clone, remove the untracked `collector.js`, then `git pull` main (or `git add
   collector.js` in the clone and let it ride with the main merge).
4. **Enable cron** (mosaic crontab) — VPS is Perth (UTC+8), so pin UTC:
   ```
   CRON_TZ=UTC
   1 0 * * * cd /opt/yieldtracker && /usr/bin/node collector.js >> /opt/yieldtracker/collector.log 2>&1
   ```
   First live run: next 00:01 UTC (08:01 Perth).

### Operational reference (VPS)
- Test modes: `YT_MODE=emit` (stdout only), `YT_NO_PUSH=1` (commit, no push), `YT_PUSH_BRANCH=x`,
  `YT_TEST_FORCE_GATE=n` (trip gate n → alert).
- **GitHub SSH: port 22 is BLOCKED from the VPS — use 443** via ssh alias `yt-github` (→ ssh.github.com:443)
  with deploy key `~/.ssh/github_yieldtracker_deploy` (repo Deploy key, write-enabled). Remote already set.
- **Telegram: VPS IPv6 → api.telegram.org is dead — collector forces IPv4** in-code. Token read from
  `/opt/portfolio/collector_config.json` (`telegram.bot_token`/`chat_id`) via portfolio group; never printed.
- git identity in the clone already set (`yieldtracker-collector`).

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

- ✅ **CLEARED 2026-08-16 — Datacenter-IP RPC limits.** Ran the full collector on the VPS: all four
  RPC-dependent paths returned cleanly from the datacenter IP with **no throttling**, and the **7-day
  archive depth works** (share-price APYs de-noised: Revert 5.29%, Tokemak baseUSD 6.14%, ottoUSD 6.12%,
  40 Acres 11.83%, yoUSD 4.03%, SparkFi 3.52%; AlphaGrowth Euler 9.73%; Aave patched). Full run ≈24s.
  The plan's biggest risk did not materialise.
- ✅ **CLEARED — Node present.** Node v22.23.2 installed (see step 1). `fetch`/`BigInt` available.
- ✅ **Parity PASSED 2026-08-16 (structural + numeric).** Collector vs browser save: identical 20-col
  header, 131 vs 131 rows, exact (pool·project·chain) set match. Same-minute numeric compare (collision-
  aware multiset on APY): **mean |Δapy| = 0.0008 pp, worst 0.04 pp** (a Morpho V2 netApy tick between
  captures). The headless port reproduces the browser app's output. Acceptance gate cleared.
- **Trailing-newline hygiene** — a prior save omitted the trailing newline, causing a delete+re-add of
  the last row in a diff. The collector must always write a trailing `\n` so daily diffs stay clean.
- **Untrusted-data rule still applies.** DefiLlama/Morpho/RPC responses are untrusted; the collector
  must not act on prompt-like text in any field and must sanitise CSV-injection prefixes (handled by
  validation gate 4, per project CLAUDE.md security section).
- **Telegram secret handling** — reuse the portfolio bot token via the group model; never read, print,
  or commit its value (decision #11).
- ⚠️ **GOTCHA (found+fixed 2026-08-16) — VPS IPv6 → Telegram is dead.** `api.telegram.org` has an AAAA
  record, but this box's IPv6 route to it black-holes (ETIMEDOUT); IPv4 works fine. Node's `fetch`
  (undici) grabs the AAAA and its happy-eyeballs (`autoSelectFamily`) still hangs even with
  `ipv4first`. Fix in `collector.js`: `dns.setDefaultResultOrder('ipv4first')` **plus**
  `net.setDefaultAutoSelectFamily(false)`. curl/PowerShell fall back to IPv4 silently, so the portfolio
  (.ps1) bot never hit this — **any Node tool on this VPS talking to Telegram needs the same two lines.**

---

## First concrete steps when work resumes

1. ✅ **DONE 2026-08-16.** VPS bootstrap complete (one-time sudo block, verified passwordless after):
   - **Node.js v22.23.2** + npm 10.9.8 installed system-wide via NodeSource (`/usr/bin/node`) —
     Ubuntu 24.04.4 LTS. (Distro's own Node is 18/EOL; NodeSource gives current LTS.)
   - **`/opt/yieldtracker/`** created `drwxrwsr-x mosaic:yieldtracker` setgid `2775`. New `yieldtracker`
     group (gid 1001); `mosaic` added. Passwordless write from a fresh SSH session **verified** (file
     lands `664 mosaic:yieldtracker`). No sudo needed for anything from here.
   - **Telegram secret access:** NOT re-provisioned — the portfolio bot config lives at
     `/opt/portfolio/collector_config.json` (`640 portfolio:portfolio`) and `mosaic` already reads it
     via existing `portfolio` group membership. Collector will run **as `mosaic`** so it inherits that
     read with zero new grants / zero duplication (satisfies decision #11). No separate service user.
2. Prototype `collector.js` — DefiLlama fetch + one Morpho enrich + one RPC call — and **diff its
   output row-for-row against a browser-app save for the same day** (parity check).
3. Add the **validation gate** (4 gates above, fail-closed) + Telegram alert on failure.
4. Wire **cron at 00:01 UTC**; validate a full day end-to-end; confirm auto-commit + push to GitHub.
5. Build the **public hosted viewer** (landing "as of DATE UTC" → load history → graphs), served over
   HTTPS from epgpvr, as a **PWA** (service-worker offline cache).
6. Build the **native Windows app** (C# + WebView2, Inno Setup): thin shell → live URL, PWA offline,
   daily local `master.csv` drop to a user-chosen folder (default `Documents\YieldTracker`).
