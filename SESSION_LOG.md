# Session Log

## 2026-08-26 — Duplicate YS-vault rows: root-caused + fixed end-to-end

- **Reported symptom:** viewer showed some YS vaults 2–3× (Steakhouse High Yield v1.1, Gauntlet USDC
  Prime, Steakhouse Prime ×3). Arrays were clean — it was a **data** bug.
- **Root cause:** DefiLlama `/pools` returns several distinct pools under one symbol on one chain;
  the symbol-keyed Morpho enrich stamped them all with the same vault's TVL/APY → byte-identical
  duplicate rows. Persisted daily since 2026-04-18 (~11–12/day, 1,369 total).
- **Fix (3 parts):** collector `dedupeRows` (source), `index.html`/`chart.html` render-time dedup
  (belt-and-suspenders), and a one-off clean of `master.csv` (1,369 rows removed, 2026-04-17 left
  intact per the prior decision). Verified 0 dup triples remain.
- **SW Ctrl+F5 fixed:** `sw.js` HTML pages were cache-first → stale shell after every deploy. Now
  network-first (normal reload gets freshest page); `CACHE_VERSION` → v5.
- **Process note:** accidentally triggered a real collector run via `require('./collector.js')`
  (self-runs `main()`), which pushed the cleaned + re-deduped `master.csv` to `origin/main` as
  `collector: 2026-08-26 snapshot (112 rows)`. Data correct; provenance recorded in
  `docs/DUPLICATE_ROWS_FIX.md`; not force-reworded (already public).
- **Cross-chain mis-enrichment fixed (same session):** added `chain: /base/i` to all morpho match
  rules lacking it (all tracked morpho vaults are Base-only), in lockstep across `collector.js`,
  `tracker.html`, `chart.html`, `index.html`. Arbitrum `BBQUSDC` now keeps its own data
  ($2.14m/6.8%) instead of the Base vault's $2.44m. Verified via `YT_MODE=emit` run.

## 2026-08-17 — Cutover verified, hosting live, comparison viewer + exit-fee tracking

- **Found the cutover was already done** (RESUME note was stale): cron live, collector had pushed
  Aug-16, viewer shipped. This laptop was just 5 commits behind — synced.
- **epgpvr hosting live** — added the Caddy site block (`yieldtracker.epgpvr.com`, docroot =
  `/opt/yieldtracker` clone, gzip, public HTTPS). GitHub Pages was already live on push.
- **Cron bug diagnosed + fixed** — Debian `cron` ignores `CRON_TZ=UTC`, so the job was firing at
  00:01 **Perth** (16:01 UTC). Rescheduled to `1 8 * * *` (08:01 Perth ≡ 00:01 UTC, no DST). Ran
  the collector once to fill the Aug-17 gap.
- **Checked a suspected duplicate** — Aug-16 is clean (131 rows). Only `2026-04-17` has real dupes
  (134 rows = a normal snapshot + an extra Morpho capture, all distinct pools). Left as-is by
  decision — deleting would lose unique data, not copies.
- **Viewer redesigned for comparison** — always-visible aligned columns on the default tabs; the
  YieldSeeker tab rebuilt into Eligible/Ineligible decision cards. (The expand-per-row layout made
  comparison impossible — the whole reason for the redesign.)
- **Exit-fee now tracked** — persisted the already-computed ERC4626 fee as a new `master.csv`
  column (schema 20→21); added a probe so **Avantis** (not an erc4626 vault) is captured too — reads
  0.4975% live. Added an Exit Fee % chart metric. Verified the whole pipeline locally in emit mode.

## 2026-08-16 — Web viewer + PWA built (plan step 5)

- **Built the public hosted viewer** (decisions from the plan): new `index.html` landing —
  best-yields snapshot of the latest `master.csv` day, "as of DATE (UTC)", presets
  (Best APY / By Chain / By Protocol / Blue-chip / YieldSeeker), chain/min-TVL/search/compact
  controls persisted to `localStorage`, tap-to-expand full detail, DefiLlama `↗` links.
- **Re-wired `chart.html`** to auto-`fetch('master.csv')` from its origin (picker fallback kept),
  with two-way nav to/from the landing.
- **Vendored Chart.js** locally (`assets/chart.umd.min.js`) — dropped the `cdnjs` CDN so graphs
  work offline and the zero-CDN rule holds.
- **PWA**: `manifest.json` + `sw.js` (shell cache-first, `master.csv` network-first), new neutral
  green-chart app icon (SVG + generated square PNGs), install screenshots (wide + narrow).
- **Bug caught pre-ship:** landing keyed the latest day by `pool|project|chain`, which collapsed
  131 → 114 (17 vaults share the triple, no address column). Fixed to key by daily `rank`.
- **YS logo scope clarified with David:** fine in *result* badges (refers to YS's own vaults),
  NOT as our app/landing icon — app icon is the neutral glyph. Left `tracker.html` untouched.
- **Tested locally** via a throwaway Node static server (fetch needs an http origin); David verified
  landing, graphs, and a clean PWA manifest in Brave. **Not yet hosted** — next: Namecheap A-record
  + Caddy route on epgpvr, then plan step 6 (native Windows app).
- Recorded the `YS_VAULTS`/`PROTOCOL_SLUG_ALIASES` triple-duplication as a follow-up in
  `docs/VPS_COLLECTOR_PLAN.md`.

## 2026-08-16 — VPS auto-collector LIVE (cutover complete)

- **Went live.** Resumed on ohmnuc mid-cutover. Confirmed the VPS clone's untracked `collector.js`
  was byte-identical (sha256) to the committed one, removed it, fast-forwarded the clone to `main`.
- **First live run:** `emit` dry-run first (131 rows, all gates PASSED, exit 0), then the real run —
  appended the 2026-08-16 snapshot (131 rows) and **pushed to the public repo** (commit `01b4cde`).
  Diff was +132/−1 = 131 new rows + the one-time trailing-newline fix on the old last row; every
  future daily diff is a clean single block. Pulled to ohmnuc.
- **Cron enabled** at 00:01 UTC daily (`CRON_TZ=UTC`; cron daemon confirmed active + enabled).
  First automated run 00:01 UTC 2026-08-17 (08:01 Perth).
- **Docs:** CHANGELOG, this log, and CLAUDE.md updated. Retired the ACTIVE WORK block for the
  collector → the **hosted viewer (PWA) + native Windows app** (plan steps 5–6, not yet built) are
  the new active work.

## 2026-08-13 — VPS auto-collector scoped (no code)

- Reviewed a "different-looking" master.csv commit: benign. Data was normal (131 rows, 20 cols, all
  LF). The one red/deleted line was the prior day's last row re-touched because an earlier save
  omitted a trailing newline; content byte-identical. Git delta +132/−1 confirmed no file rewrite —
  the "new shape" David saw was a GitHub Desktop rendering change, not a content change. Safe to commit.
- **Evaluated moving the whole daily fetch onto the VPS as a headless collector.** Verdict: clean fit.
  Pipeline is 100% HTTP + math (DefiLlama `yields.llama.fi/pools` API, Morpho GraphQL, Base RPC
  `eth_call` with 4-endpoint fallback) — **no browser dependency in the data path**, bookmarklet not
  in the daily flow, **zero npm deps** (Node 18 `fetch`), **no API key** needed. Browser-only bits
  (File System Access API, IndexedDB, DOM) are UI/local-write only.
- David expanded the vision: collector appends a master → synced to public repo → read by a **new
  cross-platform viewer** (Windows app + browser HTML, Android-accessible) → eventually a website tool.
- Full brief + recommended architecture + **5 open decisions** written to `docs/VPS_COLLECTOR_PLAN.md`;
  ⚠️ ACTIVE WORK pointer added to project CLAUDE.md. **No code written** — David out of tokens; resume
  next session after he answers the open decisions. master.csv left unstaged for David to commit.

## 2026-07-18 — Morpho V2 vaults + non-Morpho additions + APY/fee accuracy

- Added 21 Morpho **V2** vaults (address-keyed). Established that V1/V2 collide on both symbol and
  name — contract address is the only unique key. Resolved all 21 authoritatively via Morpho's
  `vaultV2ByAddress` (the `vaults` query returns V1 only). New `injectMorphoV2Vaults()`; `matchVault`
  reworked to address-match and isolate V2 from V1 regex. `chart.html` synced.
- Added **Compound USDC** (DefiLlama) and **Spark USDC Vault (SparkFi)** (`sUSDC`, on-chain
  `shareApy`, distinct from Morpho `sparkUSDC`). Verified SparkFi is a real USDC ERC4626, $7.14m TVL,
  0% withdrawal fee. Skipped three low-TVL AlphaGrowth/Euler vaults.
- **Tokemak baseUSD investigation:** it topped the eligible list on a 14.2% APY that turned out to be
  a 24h-annualised spike (24h 9.6% vs 7d 5.2%), plus a ~0.035% exit haircut and autopool withdrawal
  constraints — none of which the aggregator gating caught. Two fixes shipped:
  1. `shareApy` switched to a **7-day** window (24h fallback) to de-noise autopool harvest steps.
  2. **Exit-fee warning** — offchain ERC4626 vaults now surface a `previewRedeem` haircut above the
     0.005% threshold.
- Verified endpoint choice: `api.morpho.org/graphql` is canonical (`blue-api` is the SDK alias for
  the same backend). All on-chain reads via `base.drpc.org` + `rpcCall` 4-endpoint fallback.
- Docs updated (CHANGELOG, CLAUDE.md, SESSION_LOG, README). No secrets touched; no personal position
  data written to the repo.
