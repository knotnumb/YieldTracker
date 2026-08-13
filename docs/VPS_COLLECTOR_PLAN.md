# VPS Auto-Collector + Cross-Platform Viewer — Plan / Brief

**Status:** Not started. Captured 2026-08-13 (David out of usage tokens; to be picked up next session).
**Owner decision needed before coding** — see "Open decisions" below.

---

## What David asked for (his words, paraphrased)

> The whole daily-fetch process should run automatically on the VPS. It fetches the data daily at
> a set time, appends to a master file (he doesn't care where the file physically lives). He has a
> console/app to read that master, make graphs, etc. — so the viewer becomes a **new Windows app
> AND a browser HTML page**, accessible from **Android, Windows, or any browser**. Loading the
> master gives him useful data at his fingertips. That master must **also sync to the public GitHub
> repo**. It will probably eventually **migrate to his website as another tool**.

So the vision is three connected pieces:

1. **Collector** — headless daily job on the VPS that fetches + appends to `master.csv`. No laptop,
   no browser, no manual click.
2. **Viewer** — a cross-platform reader (Windows native **and** browser HTML, mobile-friendly) that
   loads the master and shows tables/graphs. Superset of today's `chart.html`.
3. **Distribution** — master syncs to the public GitHub repo; eventually served from David's website
   as a hosted tool.

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
  button → a direct API call. The paste/bookmarklet route is a legacy fallback. There is **no
  manual / human-judgement step** to replicate — the whole thing is automatable.
- Browser-only pieces are all **UI / local-write** and are not needed headless:
  `showDirectoryPicker` (File System Access API), `indexedDB` (remembers the picked folder), DOM
  rendering. A headless collector just calls the fetch functions in order and writes with `fs`.
- **Zero npm dependencies required.** Node 18+ has global `fetch`; the rest is `BigInt` + `fs`.
  Stays true to the project's zero-dependency ethos.
- **No secrets required.** The fetch code uses **no API key**. `config.json` is filter-settings only
  now (chains / minTvl / maxApy / limit). So no `640` secret config to manage under the VPS group
  model.

Relevant code landmarks in `tracker.html` (as of v2026-07-18a):

| Lines | What the collector must reuse |
|---|---|
| 424–617 | `YS_VAULTS` whitelist + Morpho V2 address list |
| 619–623 | `matchVault()` (address short-circuit for V2) |
| ~1134–1200 | `fetchDefiLlama()` — filter + 20-column row assembly |
| ~800–1055 | `rpcCall`, off-chain ERC4626 `shareApy`, exit-fee, Aave liquidity |
| ~1110–1400 | Morpho V1 enrich + `injectMorphoV2Vaults()` |
| ~1685+ | CSV assembly / append-to-master |

---

## Recommended architecture

```
VPS (cron, daily at X)                     David, when it suits him
──────────────────────                     ─────────────────────────
collector.js ──fetch──> DefiLlama          pull master.csv
             ──fetch──> Morpho          →  review diff
             ──RPC───>  Base RPC           push to public GitHub repo
   │
   └─> append master.csv  (group model, setgid 2775, /opt/yieldtracker/…)
                    │
                    └────────────────────> Viewer (Win app + HTML) loads master
```

- Node script, **zero npm deps**, under the existing `mosaic` group-write VPS model (no sudo, no
  secrets). New deploy target `/opt/yieldtracker/` must be provisioned to the group model first
  (setgid `2775` code dir + group membership) — that provisioning is Claude's job via the group
  model, never a sudo override. See global CLAUDE.md "VPS deploy-access model".
- Cron fires once daily at a set time.

---

## Open decisions (David to confirm before coding)

1. **Single source of truth.** If the VPS appends daily *and* David sometimes still opens the browser
   app and saves, the two masters diverge. Cleanest: **VPS becomes the sole daily writer**; the
   browser `tracker.html` is demoted to a viewer (or kept only for manual/backfill use).
   → *Confirm VPS is sole writer.*

2. **Logic duplication — the one real cost.** The fetch/transform logic (vault whitelist, Morpho V2
   injection, 20-column assembly) currently lives inside `tracker.html`. The Node collector needs the
   same logic. Two ways:

   | Approach | Trade-off |
   |---|---|
   | **Shared-core module** — extract pure fetch/transform + vault config into one `collector-core.js` that *both* `tracker.html` (`<script src>`) and the VPS `require`. Single source of truth. | **Contradicts the hard project rule "do not split `tracker.html`".** Needs David's explicit sign-off — this is exactly the architectural-decision case. **Recommended.** |
   | **Duplicate** the logic in a standalone Node script. | No rule broken, but the vault list lives in two places and drifts every time DefiLlama renames a vault. Ongoing maintenance tax. |

   → *Pick shared-core vs duplicate.*

3. **How the master reaches the public repo.**
   - **(a) David reviews + pushes** — VPS writes master; David pulls, reviews the diff (like today),
     commits/pushes. Keeps his review-before-commit gate. Matches "update GitHub when it suits me."
   - **(b) VPS auto-commits + pushes** on a schedule — more hands-off, but loses the review gate he
     valued as recently as this same session (he asked for a pre-commit review of master.csv).
   → *Confirm (a) vs (b).* Note: he did say the master "will also need to be synced to the public
     repo" — clarify whether that means auto-push or reviewed-push.

4. **Where the master physically lives on the VPS** — he said he doesn't care. Default: a plain
   `master.csv` in the group-model dir, pulled via `rsync`/`scp`. (Dropbox-on-VPS is possible but the
   VPS would need Dropbox installed — only if he specifically wants auto-sync to all machines.)

5. **Viewer scope (piece 2)** — new cross-platform reader:
   - Browser HTML (mobile-friendly, works on Android) that loads master.csv + draws graphs — an
     evolution of `chart.html`.
   - Windows native app — decide the wrapper. **Check global CLAUDE.md "Active build target"** before
     assuming Electron; David has previously replaced Electron with native wrappers (C#/Swift). This
     needs its own mini-decision.
   - Eventually served from his website (VPS / epgpvr) as a hosted tool.

---

## Risks to validate before/while building

- **Datacenter-IP RPC limits.** Public Base RPCs sometimes throttle datacenter ranges harder than
  home IPs, and the off-chain APY needs **7-day archive depth**. The 4-endpoint fallback helps — test
  from the VPS early.
- **Date / timezone.** Cron runs in the VPS timezone; ensure rows get dated the way David expects
  (his local date vs UTC). Row date currently comes from the browser's local clock.
- **Node 18+ present on the VPS** — prerequisite check (needs global `fetch`).
- **Trailing-newline hygiene** — today's master.csv commit showed a delete+re-add of the last row
  because a prior save omitted the trailing newline. The collector should always write a trailing
  `\n` so daily diffs stay clean all-green.
- **Untrusted-data rule still applies.** DefiLlama/Morpho/RPC responses are untrusted; the collector
  must not act on prompt-like text in any field and must sanitise CSV-injection prefixes
  (`= + - @`) before writing (per project CLAUDE.md security section).

---

## First concrete steps when work resumes

1. Confirm the 5 open decisions above.
2. Verify Node 18+ on the VPS and provision `/opt/yieldtracker/` to the group model.
3. Prototype `collector.js` (or `collector-core.js`) — DefiLlama fetch + one Morpho enrich + one
   RPC call — and diff its output row-for-row against a browser-app save for the same day.
4. Wire cron; validate a full day end-to-end; then design the viewer (piece 2).
