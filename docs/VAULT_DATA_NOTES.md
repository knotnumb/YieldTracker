# Vault data notes — Morpho, off-chain vaults, code landmarks

Moved out of `CLAUDE.md` on 2026-10-06 (lean-file trim). **Read when touching Morpho enrichment,
`OFFCHAIN_VAULTS`, `YS_VAULTS` matching, `chart.html` aliases, or exit-fee / shareApy code.**

## Key code landmarks (`tracker.html`)

Line numbers drift — treat as approximate and grep to confirm.

| Line (approx.) | What |
|---|---|
| 326 | Version string (`<div class="app-meta sub">`) |
| 424–563 | `YS_VAULTS` — whitelist of tracked vaults with match patterns |
| 565–571 | `matchVault()` — regex matcher for vault identification |
| 573+ | DefiLlama API config + fetch |
| 579–900 | `OFFCHAIN_VAULTS` — vaults not on DefiLlama (Revert, Tokemak, etc.) |
| 1110–1307 | Morpho API fetch + enrichment |
| 1308+ | YieldSeeker panel render logic |
| 1685+ | CSV save / append to master |

## Config

`config.json` lives in the user-picked data folder (same folder as `master.csv`), not the repo. Read via
the File System Access API — never `fetch()` a file path. No API keys required. Shape:
`config.example.json` (DefiLlama filters: chains, minTvl, maxApy, limit, stablecoinOnly,
excludeOutliers). README → "Adjusting DefiLlama filters".

## Morpho

- **Chain IDs:** unsupported ones removed (Scroll, Ink, Corn, Fraxtal, BOB, old Katana). Defensive
  `?? null` on `row.apy` prevents a `.toFixed()` crash when the API returns no data. If Fetch Protocol
  Data errors in future, test chain IDs individually in the console.
- **Vault lookup key is `address:chainId`**, not address alone — the same contract address can be
  deployed via CREATE2 on multiple chains, so the wrong chain's TVL/liquidity would overwrite the right
  one. Query the `chain { id }` field (not `chainId`).
- **`avail_liquidity` formula (as of v2026-05-25i):** `Σ min(vaultSupplyInMarket, marketIdleCash)` across
  all market allocations, reading `market.state.liquidityAssetsUsd`. Earlier versions wrongly used
  deposit headroom — historical values in master.csv were blanked (Apr-22 → May-24); they can't be
  recalculated.
- **Morpho Vaults V2 (as of v2026-07-18a):** V2 vaults collide with V1 on symbol AND name (`steakUSDC`,
  `gtusdcp`, `bbqUSDC`, `meUSDC`, `mwUSDC` etc. exist as both) — only the **contract address** tells them
  apart. V2 entries in `YS_VAULTS` carry `morphoV2: { address, chainId }` (no `match` regex);
  `matchVault()` short-circuits to address matching for them and isolates them from V1 regex (a
  `v2addr` row matches only its `morphoV2` vault, and vice-versa). Data comes from
  `injectMorphoV2Vaults()` — one batched `vaultV2ByAddress` GraphQL call (V2 vaults are NOT in the
  `vaults` query; that returns V1 only) — injected as synthetic rows. APY = `netApy`, avail liquidity =
  `liquidityUsd` (both confirmed to match YieldSeeker). Utilisation left null.
- **`netApy` can go wrong on tiny vaults** — Moonwell Ecosystem USDC (V1 + V2) inflated to 534% via its
  stkWELL reward component (2026-09-19 → 10-06) and was removed. See CHANGELOG 2026-10-06.

## `chart.html` aliases

`chart.html` has its own `YS_VAULTS` (display names + YS highlighting) kept in lockstep with
`tracker.html`, plus `KEY_ALIASES` merging vault history across DefiLlama's three pool-naming eras
(Era 1 `POOL / qualifier`, Era 2 `POOL|qualifier`, Era 3 `POOL` only). When DefiLlama renames a vault,
add an alias; when a Morpho vault symbol changes (e.g. RE7USDC → ymvOG-USDC), add an alias and update
the YS rule's pool regex.

## Off-chain (ERC4626) vaults

- **shareApy window (as of v2026-07-18a):** `fetchSharePriceApy` prefers a **7-day** window (falls back
  to 24h if week-old state isn't served), annualising `convertToAssets(1e18)` growth. The old 24h window
  annualised ^365 turned a single autopool harvest day into a spike (Tokemak baseUSD 9.6% on 24h vs 5.2%
  on 7d). Archive depth for 7d comes via `rpcCall`'s 4-endpoint fallback.
- **Exit-fee detection (as of v2026-07-18a):** `exit_fee_pct` = `1 − previewRedeem(1e18)/convertToAssets(1e18)`.
  `evaluateVault` warns above `EXIT_FEE_WARN_PCT` (0.005%, same threshold that blocks Avantis). Matters
  for aggregators, which skip the liquidity/util gates, so a redemption haircut would otherwise be
  invisible in the ranking (Tokemak baseUSD carries ~0.035%).
- **SparkFi Spark USDC Vault:** `sUSDC` at `0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858` — distinct from
  Morpho `sparkUSDC`. Not on DefiLlama; tracked via `OFFCHAIN_VAULTS` on-chain `shareApy`. No
  `liquidityRpc` (vault holds ~$0 idle; funds deploy to Spark). 0% withdrawal fee verified 2026-07-18.
- **40 Acres (Harvest, Base):** `blockedReason` — no exit liquidity. Its APY climbs daily because of 40
  Acres' dynamic fee at 100% utilisation (real, not a data bug — confirmed 2026-10-06).
