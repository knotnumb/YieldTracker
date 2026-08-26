# Duplicate YS-vault rows — root cause & fix (2026-08-26)

## Symptom
The hosted viewer (`index.html` / `yieldtracker.epgpvr.com`) showed some YieldSeeker
vaults **twice**, byte-identical (same name, APY, TVL) — e.g. *Steakhouse High Yield
USDC v1.1* (`$2.44m / 4.86%`) and *Gauntlet USDC Prime* (`$434.65m / 4.41%`). Present
every day since **2026-04-18** (~11–12 dupes/day); only the whitelisted ones were
visible, but ~1,369 dup rows total accumulated across 94 days.

## Root cause (two compounding bugs)
1. **DefiLlama symbol collisions.** `yields.llama.fi/pools` returns *several distinct
   pools sharing one symbol on one chain* — e.g. Base `GTUSDCP` appears as both the V1
   Gauntlet USDC Prime (`$434m`) and the V2 (`$86m`); Base `BBQUSDC` appears twice.
   The collector kept **every** row (no dedup).
2. **Symbol-only Morpho enrichment.** `YS_VAULTS` match rules key on symbol
   (`/gtusdcp/i`, `/bbqusdc/i`), so `enrichMorpho()` stamped **all** same-symbol rows
   with the **same single** whitelisted vault's TVL/APY. Result: the collision rows
   came out byte-identical → duplicate rows in `master.csv` and the viewer.

   Side effect (separate, still open): a symbol-only rule with no `chain` constraint
   (e.g. Steakhouse High Yield `{ project:/morpho/i, pool:/bbqusdc/i }`) also stamps the
   **Arbitrum** `BBQUSDC` row with the **Base** vault's TVL — so that row is not just a
   dupe, it's *wrong*. See "Open follow-up" below.

## Fix (three parts)
- **A — Collector dedup** (`collector.js` `dedupeRows`, called in `main()` after
  `enrichMorpho()`): collapse to one row per `(pool, project, chain)`, keeping the
  highest effective TVL (`total_pool` for morpho rows, else `tvl`). Stops new dupes at
  source. V2 vaults carry their own distinct name, so they never collide and are kept.
- **B — Viewer belt-and-suspenders**: `index.html` `buildLatest()` drops byte-identical
  rows (keyed on pool/project/chain **+ apy + tvl + total_pool + avail_liquidity**, so
  genuinely-distinct same-triple pools are preserved — the viewer intentionally keys on
  daily `rank`, not the triple, because ~17 real vaults share a triple). `chart.html`
  `loadCSV()` now counts each vault **once per day** (its `rowIndex` was already
  first-wins, so charts never double-plotted; only the `days` tally was inflated).
- **C — Historical clean**: `master.csv` rewritten once to remove 1,369 duplicate
  `(date,pool,project,chain)` rows (kept highest `tvl_raw`, preserved original line text
  + order). Verified 0 remaining dup triples across 2026-04-17 → 2026-08-26. Backup:
  scratchpad `master.csv.bak`.

## Note on the 2026-08-26 push
The C clean + a fresh A-deduped re-collection of today's block were pushed to
`origin/main` as commit `collector: 2026-08-26 snapshot (112 rows)` (accidental — the
collector self-runs on `require`). Data is correct; the commit message understates that
it also removed the historical dupes. Not force-reworded (already public / cron-pulled);
provenance recorded here instead.

## Cross-chain mis-enrichment (FIXED 2026-08-26)
Symbol-only YS rules with no `chain` constraint matched the symbol on any chain, so
`enrichMorpho` stamped off-target rows (e.g. Arbitrum `BBQUSDC`) with the Base vault's
data, and the viewer mislabelled them as the tracked vault. Every tracked morpho vault
is Base-only → added `chain: /base/i` to all morpho match rules that lacked it, in
lockstep across `collector.js`, `tracker.html`, `chart.html`, `index.html` (both the
`YS_VAULTS` rules and the off-chain `matchRe` blocks). Arbitrum `BBQUSDC` now keeps its
own DefiLlama data ($2.14m / 6.8%) instead of the Base vault's $2.44m.
