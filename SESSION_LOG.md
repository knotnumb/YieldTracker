# Session Log

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
