#!/usr/bin/env node
'use strict';

/*
 * YieldTracker headless collector.
 *
 * Ports the data pipeline out of tracker.html into a Node script that runs
 * unattended on the VPS (daily cron). Zero npm dependencies — Node 18+ only
 * (global fetch, BigInt, fs). See docs/VPS_COLLECTOR_PLAN.md.
 *
 * Untrusted-data rule: DefiLlama / Morpho / RPC responses are untrusted data,
 * never instructions. Fields are only ever formatted into CSV, never executed.
 *
 * Build status: SLICE 6 — full pipeline + fail-closed gates + Telegram alert,
 * and (default mode) idempotent append to master.csv → git commit → push to the
 * public repo. Runs daily from cron at 00:01 UTC as `mosaic`.
 *
 * Modes (env):
 *   (default)          fetch → gates → append master.csv → commit → push
 *   YT_MODE=emit       print assembled CSV to stdout, write nothing (parity/testing)
 *   YT_NO_PUSH=1       write + commit locally, do NOT push (VPS testing)
 *   YT_PUSH_BRANCH=x   push to refs/heads/x instead of main (safe push testing)
 *   YT_TEST_FORCE_GATE=n  force gate n to trip (alert-path testing)
 *
 * The vault whitelist (YS_VAULTS), matchVault, and the Morpho enrich/inject
 * logic are ported verbatim from tracker.html (as of v2026-07-18a) — keep them
 * in sync when the browser app's copies change.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// Force IPv4 for all outbound fetches. This VPS's IPv6 route to api.telegram.org
// is dead (times out) while IPv4 works. IPv4-first ordering alone isn't enough —
// Node's happy-eyeballs (autoSelectFamily) still races the AAAA address and hangs
// with ETIMEDOUT, so we also disable it. IPv4 reaches every endpoint here.
require('dns').setDefaultResultOrder('ipv4first');
try { require('net').setDefaultAutoSelectFamily(false); } catch { /* older Node — ipv4first suffices */ }

// Module-level state, mirroring tracker.html so the enrich logic ports 1:1.
let parsedRows = [];
const morphoData = {};

// ---------- Fail-closed validation + alerting ----------
// A tripped gate throws GateError → main() writes nothing, alerts, exits non-zero.
class GateError extends Error {
  constructor(gate, detail) { super(detail); this.name = 'GateError'; this.gate = gate; }
}

// Telegram alert reuses the portfolio bot. Token/chat_id are read from the
// portfolio config at send time (mosaic reads it via the portfolio group) and
// are NEVER logged, printed, or committed. Errors here log only the message.
const TELEGRAM_CONFIG = process.env.YT_TELEGRAM_CONFIG || '/opt/portfolio/collector_config.json';

async function sendTelegram(text) {
  let bot_token, chat_id;
  try {
    ({ bot_token, chat_id } = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf8')).telegram || {});
  } catch (e) {
    process.stderr.write(`[collector] Telegram config unreadable (${e.message}); alert NOT sent\n`);
    return false;
  }
  if (!bot_token || !chat_id) {
    process.stderr.write('[collector] Telegram bot_token/chat_id missing; alert NOT sent\n');
    return false;
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, disable_web_page_preview: true })
    });
    if (!resp.ok) { process.stderr.write(`[collector] Telegram HTTP ${resp.status}; alert may not have sent\n`); return false; }
    return true;
  } catch (e) {
    process.stderr.write(`[collector] Telegram send failed: ${e.message}\n`);
    return false;
  }
}

// ---------- Config (filter settings only; no secrets) ----------
let defiLlamaConfig = {
  chains: ['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Unichain'],
  minTvl: 500000, maxApy: 50, limit: 100,
  stablecoinOnly: true, excludeOutliers: true
};

function loadConfig() {
  const cfgPath = path.join(__dirname, 'config.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (parsed.defiLlama) defiLlamaConfig = { ...defiLlamaConfig, ...parsed.defiLlama };
  } catch { /* no config.json — use baked defaults */ }
}

// ---------- Vault whitelist (verbatim from tracker.html) ----------
const YS_VAULTS = [
  { name: '40 Acres USDC Vault', match: { pool: /40 acres/i, project: /harvest/i }, morpho: null, type: 'aggregator', blockedReason: 'No exit liquidity — funds cannot be withdrawn' },
  { name: 'Steakhouse High Yield USDC v1.1', match: { project: /morpho/i, pool: /bbqusdc/i }, morpho: { address: '0xBEEFA7B88064FeEF0cEe02AAeBBd95D30df3878F', chainId: 8453 }, type: 'lending' },
  { name: 'Steakhouse Prime USDC', match: { project: /morpho/i, pool: /^steakusdc$/i }, morpho: { address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2', chainId: 8453 }, type: 'lending' },
  { name: 'Aave Base USDC', match: { project: /aave v3/i, pool: /usdc/i, chain: /base/i }, morpho: null, type: 'lending' },
  { name: 'Spark USDC Vault', match: { project: /morpho/i, pool: /sparkusdc/i }, morpho: { address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A', chainId: 8453 }, type: 'lending' },
  { name: 'Gauntlet USDC Frontier', match: { project: /morpho/i, pool: /gtusdcf/i }, morpho: { address: '0x236919F11ff9eA9550A4287696C2FC9e18E6e890', chainId: 8453 }, type: 'lending' },
  { name: 'Revert Lend Base USDC', match: { project: /revert/i, chain: /base/i }, morpho: null, type: 'lending' },
  { name: 'Tokemak baseUSD', match: { project: /tokemak/i, pool: /baseusd/i }, morpho: null, type: 'aggregator' },
  { name: 'Otto Earns ottoUSD', match: { project: /tokemak/i, pool: /ottousd/i }, morpho: null, type: 'aggregator' },
  { name: 'AlphaGrowth USDC', match: { project: /alphagrowth/i }, morpho: null, type: 'lending' },
  { name: 'yoVaultUSD', match: { pool: /yoUSD|yovault/i }, minApy: 16, rewardsUnpriced: 'YO', morpho: null, type: 'aggregator' },
  { name: 'Yearn OG USDC', match: { project: /morpho/i, pool: /ymvog.?usdc|re7usdc/i }, morpho: { address: '0xef417a2512C5a41f69AE4e021648b69a7CdE5D03', chainId: 8453 }, type: 'lending' },
  { name: 'UltraYield USDC', match: { project: /morpho/i, pool: /edgeusdc|ultra.*usdc/i }, morpho: { address: '0x5435BC53f2C61298167cdB11Cdf0Db2BFa259ca0', chainId: 8453 }, type: 'lending' },
  { name: 'Moonwell USDC', match: { project: /moonwell lending/i, pool: /^usdc$/i, chain: /base/i }, type: 'lending' },
  { name: 'Moonwell Ecosystem USDC Vault', match: { project: /morpho/i, pool: /meusdc|mwusdc/i, chain: /base/i }, morpho: { address: '0xE1bA476304255353aEF290e6474A417D06e7b773', chainId: 8453 }, type: 'lending' },
  { name: 'Clearstar USDC Reactor', match: { project: /morpho/i, pool: /^csusdc$/i }, morpho: { address: '0x1D3b1Cd0a0f242d598834b3F2d126dC6bd774657', chainId: 8453 }, type: 'lending' },
  { name: 'Clearstar Boring USDC', match: { project: /morpho/i, pool: /^csborusdc$/i }, morpho: { address: '0x43e623Ff7D14d5b105F7bE9c488F36dbF11D1F46', chainId: 8453 }, type: 'lending' },
  { name: 'Yield Clearstar USDC', match: { project: /morpho/i, pool: /^ycsusdc$/i }, morpho: { address: '0xE74c499fA461AF1844fCa84204490877787cED56', chainId: 8453 }, type: 'lending' },
  { name: 'Gauntlet USDC Core', match: { project: /morpho/i, pool: /^gtusdcc$/i, chain: /base/i }, morpho: { address: '0xc0c5689e6f4D256E861F65465b691aeEcC0dEb12', chainId: 8453 }, type: 'lending' },
  { name: 'Gauntlet USDC Prime', match: { project: /morpho/i, pool: /^gtusdcp$/i, chain: /base/i }, morpho: { address: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61', chainId: 8453 }, type: 'lending' },
  { name: 'Fluid USD Coin', match: { project: /fluid/i, pool: /^usdc$/i, chain: /base/i }, morpho: null, type: 'lending' },
  { name: 'Avantis USDC Vault', match: { project: /avantis/i, chain: /base/i }, morpho: null, type: 'lending', blockedReason: 'Withdrawal fee > 0.005% — last verified 2026-05-25; fee is variable, recheck before entry' },
  { name: 'Compound USDC', match: { project: /compound/i, pool: /^usdc$/i, chain: /base/i }, morpho: null, type: 'lending' },
  { name: 'Spark USDC Vault (SparkFi)', match: { project: /sparkfi/i, pool: /^usdc$/i, chain: /base/i }, morpho: null, type: 'lending' },

  // Morpho Vaults V2 — identified by contract ADDRESS only (symbols collide with V1).
  { name: 'Clearstar cbAssets Vault',           morphoV2: { address: '0x91C056B6d4311a743614FBc03ac32d4E6A2d3a3c', chainId: 8453 }, type: 'lending' },
  { name: 'Gauntlet USDC Frontier (V2)',        morphoV2: { address: '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765', chainId: 8453 }, type: 'lending' },
  { name: 'Moonwell Ecosystem USDC (V2)',       morphoV2: { address: '0xbB2F06CeAE42CBcF5559Ed0713538c8892D977c9', chainId: 8453 }, type: 'lending' },
  { name: 'Yearn OG USDC V2',                   morphoV2: { address: '0xe7D0DBE3493830e2Ab62619211A2BfF0Fc60dB42', chainId: 8453 }, type: 'lending' },
  { name: 'Steakhouse High Yield USDC (V2)',    morphoV2: { address: '0xbeeff7aE5E00Aae3Db302e4B0d8C883810a58100', chainId: 8453 }, type: 'lending' },
  { name: 'ARCHITECT Global Value II',          morphoV2: { address: '0x6022Cbf61352618053d89FD9eEfe78Cb725B3c9d', chainId: 8453 }, type: 'lending' },
  { name: 'Farcaster x Steakhouse Prime',       morphoV2: { address: '0xBeEF00fc6e87dE086A0e29169A2f6e25cF5C11a9', chainId: 8453 }, type: 'lending' },
  { name: 'Gauntlet USDC Prime (V2)',           morphoV2: { address: '0x050cE30b927Da55177A4914EC73480238BAD56f0', chainId: 8453 }, type: 'lending' },
  { name: 'RockawayX Midas USDC Prime',         morphoV2: { address: '0xAE4181CFB5aaA08bbE77d269c6B595672b9F9Edc', chainId: 8453 }, type: 'lending' },
  { name: 'Steakhouse Prime USDC (V2)',         morphoV2: { address: '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9', chainId: 8453 }, type: 'lending' },
  { name: 'Prime USDC',                         morphoV2: { address: '0x5e03f8965e2957291B3c6990C6Cb9023c36d3d30', chainId: 8453 }, type: 'lending' },
  { name: 'Clearstar Boring USDC (V2)',         morphoV2: { address: '0x0282159ecCaabA941bD1f4C518944D8fDCdc0681', chainId: 8453 }, type: 'lending' },
  { name: 'Moonwell Flagship USDC',             morphoV2: { address: '0x48a90E85be5C56b0A669985A12ee7C449fC79965', chainId: 8453 }, type: 'lending' },
  { name: 'Alpha USDC Prime V2',                morphoV2: { address: '0x44dd77d51629987d9555c762bF09903928c70206', chainId: 8453 }, type: 'lending' },
  { name: 'Steakhouse High Yield USDC Edition', morphoV2: { address: '0xbeeff2490FEffa212faC2f6553682C219E6a8845', chainId: 8453 }, type: 'lending' },
  { name: 'Universal USDC',                     morphoV2: { address: '0x0B7ee82ad75B2D3fc7f3A110A51ba68714171D25', chainId: 8453 }, type: 'lending' },
  { name: 'Re7 USDC',                           morphoV2: { address: '0x618495ccC4e751178C4914b1E939C0fe0FB07b9b', chainId: 8453 }, type: 'lending' },
  { name: 'Clearstar CoreUSDC',                 morphoV2: { address: '0x116e1A65717A534B73EcB7d4F6543c65DBCd0E46', chainId: 8453 }, type: 'lending' },
  { name: 'Riva x Steakhouse USDC',             morphoV2: { address: '0xbEeF006fb43820C864894892db0eCFEee3FdF587', chainId: 8453 }, type: 'lending' },
  { name: 'Ethena x Steakhouse USDC',           morphoV2: { address: '0xBeEfF0be997Cca5B1c13A7433c2004637975739e', chainId: 8453 }, type: 'lending' },
  { name: 'Avantgarde USDC Conservative',       morphoV2: { address: '0xE34D43CA9152D198B60654868C8cD197196a492f', chainId: 8453 }, type: 'lending' },
];

function matchVault(row, vault) {
  if (vault.morphoV2) return !!row.v2addr && row.v2addr === vault.morphoV2.address.toLowerCase();
  if (row.v2addr) return false;
  const { match } = vault;
  if (match.pool && !match.pool.test(row.pool)) return false;
  if (match.project && !match.project.test(row.project)) return false;
  if (match.chain && !match.chain.test(row.chain)) return false;
  return true;
}

// ---------- Off-chain vaults (not on DefiLlama) — on-chain ERC4626 fallback ----------
const OFFCHAIN_VAULTS = [
  { name: 'Fluid USD Coin', address: '0xf42f5795D9ac7e9D757dB633D693cD548Cfd9169', network: 'base', chain: 'Base', project: 'Fluid', pool: 'USDC', matchRe: { project: /fluid/i, pool: /^usdc$/i, chain: /base/i }, liquidityRpc: { rpc: 'https://base.drpc.org', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 } },
  { name: 'Avantis USDC Vault', address: '0x944766f715b51967E56aFdE5f0Aa76cEaCc9E7f9', network: 'base', chain: 'Base', project: 'Avantis', pool: 'USDC', matchRe: { project: /avantis/i, chain: /base/i }, probeExitFee: true, liquidityRpc: { rpc: 'https://base.drpc.org', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 } },
  { name: 'Revert Lend Base USDC', address: '0x36AEAe0E411a1E28372e0d66f02E57744EbE7599', network: 'base', chain: 'Base', project: 'Revert Lend', pool: 'USDC', matchRe: { project: /revert/i, chain: /base/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true }, liquidityRpc: { rpc: 'https://base.drpc.org', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 } },
  { name: 'Tokemak baseUSD', address: '0x9c6864105AEC23388C89600046213a44C384c831', network: 'base', chain: 'Base', project: 'Tokemak', pool: 'baseUSD', matchRe: { project: /tokemak/i, pool: /baseusd/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true } },
  { name: 'Otto Earns ottoUSD', address: '0xc8Fdf193f4837BD2c181658488953afC9c044e1F', network: 'base', chain: 'Base', project: 'Tokemak', pool: 'ottoUSD', matchRe: { project: /tokemak/i, pool: /ottousd/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true } },
  { name: '40 Acres USDC Vault', address: '0xB99B6dF96d4d5448cC0a5B3e0ef7896df9507Cf5', network: 'base', chain: 'Base', project: 'Harvest Finance', pool: '40 Acres', matchRe: { pool: /40 acres/i, project: /harvest/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true } },
  { name: 'AlphaGrowth USDC Base Vault', address: '0x4C1aeda9B43EfcF1da1d1755b18802aAbe90f61E', network: 'base', chain: 'Base', project: 'AlphaGrowth', pool: 'USDC', matchRe: { project: /alphagrowth/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, eulerApy: true }, liquidityRpc: { rpc: 'https://base.drpc.org', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 } },
  { name: 'yoVaultUSD', address: '0x0000000f2eB9f69274678c76222B35eEc7588a65', network: 'base', chain: 'Base', project: 'Yo', pool: 'yoVaultUSD', matchRe: { pool: /yovault/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true } },
  { name: 'Spark USDC Vault (SparkFi)', address: '0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858', network: 'base', chain: 'Base', project: 'SparkFi', pool: 'USDC', matchRe: { project: /sparkfi/i, pool: /^usdc$/i, chain: /base/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6, shareApy: true } },
  // Morpho vaults — pool names match on-chain ERC20 symbols; enriched later via Morpho API.
  { name: 'Steakhouse High Yield USDC v1.1', address: '0xBEEFA7B88064FeEF0cEe02AAeBBd95D30df3878F', network: 'base', chain: 'Base', project: 'Morpho', pool: 'bbqUSDC', matchRe: { project: /morpho/i, pool: /bbqusdc/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Steakhouse Prime USDC', address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2', network: 'base', chain: 'Base', project: 'Morpho', pool: 'steakUSDC', matchRe: { project: /morpho/i, pool: /^steakusdc$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Spark USDC Vault', address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A', network: 'base', chain: 'Base', project: 'Morpho', pool: 'sparkUSDC', matchRe: { project: /morpho/i, pool: /sparkusdc/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Yearn OG USDC', address: '0xef417a2512C5a41f69AE4e021648b69a7CdE5D03', network: 'base', chain: 'Base', project: 'Morpho', pool: 'ymvOG-USDC', matchRe: { project: /morpho/i, pool: /ymvog.?usdc/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'UltraYield USDC', address: '0x5435BC53f2C61298167cdB11Cdf0Db2BFa259ca0', network: 'base', chain: 'Base', project: 'Morpho', pool: 'edgeUSDC', matchRe: { project: /morpho/i, pool: /edgeusdc/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Gauntlet USDC Core', address: '0xc0c5689e6f4D256E861F65465b691aeEcC0dEb12', network: 'base', chain: 'Base', project: 'Morpho', pool: 'gtUSDCc', matchRe: { project: /morpho/i, pool: /^gtusdcc$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Gauntlet USDC Prime', address: '0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61', network: 'base', chain: 'Base', project: 'Morpho', pool: 'gtUSDCp', matchRe: { project: /morpho/i, pool: /^gtusdcp$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Clearstar USDC Reactor', address: '0x1D3b1Cd0a0f242d598834b3F2d126dC6bd774657', network: 'base', chain: 'Base', project: 'Morpho', pool: 'CSUSDC', matchRe: { project: /morpho/i, pool: /^csusdc$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Clearstar Boring USDC', address: '0x43e623Ff7D14d5b105F7bE9c488F36dbF11D1F46', network: 'base', chain: 'Base', project: 'Morpho', pool: 'CSBORUSDC', matchRe: { project: /morpho/i, pool: /^csborusdc$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
  { name: 'Yield Clearstar USDC', address: '0xE74c499fA461AF1844fCa84204490877787cED56', network: 'base', chain: 'Base', project: 'Morpho', pool: 'YCSUSDC', matchRe: { project: /morpho/i, pool: /^ycsusdc$/i }, erc4626: { rpc: 'https://base.drpc.org', decimals: 6 } },
];

// Free Base RPC endpoints — tried in order on failure. mainnet.base.org last (429s fastest).
const BASE_RPC_ENDPOINTS = [
  'https://base.drpc.org',
  'https://base-rpc.publicnode.com',
  'https://rpc.ankr.com/base',
  'https://mainnet.base.org',
];

// Low-level eth_call with multi-endpoint fallback + one retry pass.
async function rpcCall(rpc, to, data, blockTag = 'latest') {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ from: '0x0000000000000000000000000000000000000001', to, data }, blockTag] });
  const endpoints = [rpc, ...BASE_RPC_ENDPOINTS.filter(e => e !== rpc)];
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) await new Promise(r => setTimeout(r, 600));
    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (json.error) {
          const msg = (json.error.message ?? '').toLowerCase();
          if (msg.includes('execution reverted') || msg.includes('revert')) return null;
          continue;
        }
        if (!json.result || json.result === '0x') return null;
        return json.result;
      } catch { /* network error — try next endpoint */ }
    }
  }
  return null;
}

// Euler v2 supply APY from on-chain interest-rate model. APY % or null.
async function fetchEulerLendingApy(address, rpc, decimals, usdcToken) {
  const scale = Math.pow(10, decimals);
  const rateHex = await rpcCall(rpc, address, '0x7c3a00fd').catch(() => null); // interestRate()
  if (!rateHex) return null;
  const borrowRatePerSec = Number(BigInt(rateHex)) / 1e27;
  const feeHex = await rpcCall(rpc, address, '0xa75df498').catch(() => null); // interestFee()
  if (!feeHex) return null;
  const interestFee = parseInt(feeHex, 16) / 1e4;
  const assetsHex = await rpcCall(rpc, address, '0x01e1d114').catch(() => null); // totalAssets()
  if (!assetsHex) return null;
  const totalAssets = parseInt(assetsHex, 16) / scale;
  if (totalAssets === 0) return null;
  const cash = await fetchTokenBalance(rpc, usdcToken, address, decimals).catch(() => null);
  if (cash === null) return null;
  const utilisation = Math.max(0, Math.min(1, (totalAssets - cash) / totalAssets));
  const supplyRatePerSec = borrowRatePerSec * utilisation * (1 - interestFee);
  const apy = (Math.pow(1 + supplyRatePerSec, 31_557_600) - 1) * 100;
  return apy > 0 ? apy : null;
}

// Annualised APY from ERC4626 share-price growth. Prefers a 7d window (falls back to 24h).
async function fetchSharePriceApy(address, rpc) {
  const bnPayload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
  let currentBlock = null;
  const endpoints = [rpc, ...BASE_RPC_ENDPOINTS.filter(e => e !== rpc)];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bnPayload });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.result) { currentBlock = parseInt(j.result, 16); break; }
    } catch {}
  }
  if (!currentBlock) return null;
  const callData = '0x07a2d13a0000000000000000000000000000000000000000000000000de0b6b3a7640000'; // convertToAssets(1e18)
  const nowHex = await rpcCall(rpc, address, callData, '0x' + currentBlock.toString(16)).catch(() => null);
  const pNow = nowHex ? BigInt(nowHex) : null;
  if (!pNow) return null;
  const windows = [{ blocks: 302400, days: 7 }, { blocks: 43200, days: 1 }];
  for (const w of windows) {
    if (currentBlock - w.blocks < 0) continue;
    const pastHex = await rpcCall(rpc, address, callData, '0x' + (currentBlock - w.blocks).toString(16)).catch(() => null);
    const pPast = pastHex ? BigInt(pastHex) : null;
    if (!pPast || pPast === 0n) continue;
    const periodReturn = Number(pNow - pPast) / Number(pPast);
    if (periodReturn <= 0) return null;
    return ((1 + periodReturn) ** (365 / w.days) - 1) * 100;
  }
  return null;
}

// ERC20 balanceOf(holder) → token amount in human units.
async function fetchTokenBalance(rpc, tokenAddress, holderAddress, decimals) {
  const data = '0x70a08231' + holderAddress.slice(2).toLowerCase().padStart(64, '0');
  const hex = await rpcCall(rpc, tokenAddress, data);
  return hex === null ? null : parseInt(hex, 16) / Math.pow(10, decimals);
}

// Aave V3 Base USDC — APY / liquidity / utilisation via on-chain reads.
const AAVE_BASE_RPC   = 'https://base.drpc.org';
const AAVE_BASE_USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const AAVE_BASE_aUSDC = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB';
const AAVE_BASE_POOL  = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5';

async function fetchAaveLiquidity() {
  try {
    const balData     = '0x70a08231' + AAVE_BASE_aUSDC.slice(2).padStart(64, '0');
    const supData     = '0x18160ddd';
    const reserveData = '0x35ea6a75' + '000000000000000000000000' + AAVE_BASE_USDC.slice(2).toLowerCase();
    const [balHex, supHex, reserveHex] = await Promise.all([
      rpcCall(AAVE_BASE_RPC, AAVE_BASE_USDC, balData),
      rpcCall(AAVE_BASE_RPC, AAVE_BASE_aUSDC, supData),
      rpcCall(AAVE_BASE_RPC, AAVE_BASE_POOL, reserveData)
    ]);
    let apy = null;
    if (reserveHex && reserveHex.length >= 194) {
      const rateRay = parseInt(reserveHex.slice(130, 194), 16) / 1e27;
      apy = parseFloat(((Math.pow(1 + rateRay / 31536000, 31536000) - 1) * 100).toFixed(4));
    }
    if (!balHex || !supHex) return;
    const available   = parseInt(balHex, 16) / 1e6;
    const totalSupply = parseInt(supHex, 16) / 1e6;
    if (totalSupply <= 0) return;
    const util = parseFloat(((1 - available / totalSupply) * 100).toFixed(2));
    let row = parsedRows.find(r => /aave/i.test(r.project) && /usdc/i.test(r.pool) && /base/i.test(r.chain));
    if (row) {
      row.avail_liquidity = available;
      row.supply_cap_util = util;
      if (apy !== null) { row.apy = apy; row.base_apy = apy; }
    } else {
      const disp = totalSupply >= 1e6 ? `$${(totalSupply/1e6).toFixed(2)}m`
        : totalSupply >= 1e3 ? `$${(totalSupply/1e3).toFixed(1)}k` : `$${totalSupply.toFixed(0)}`;
      parsedRows.push({
        pool: 'USDC', project: 'aave v3', chain: 'Base',
        tvl_display: disp, tvl: totalSupply,
        apy, base_apy: apy, reward_apy: null,
        base_apy_7d: null, il_7d: null,
        avg_30d: null, inception_apy: null, top_10_pct: null,
        total_pool: totalSupply, total_borrowed: null,
        avail_liquidity: available, supply_cap_util: util, collateral_exposure: null,
        raw: ''
      });
    }
  } catch { /* silently fail — DefiLlama data still intact */ }
}

// ERC4626 withdrawal-fee probe: 1 − previewRedeem(1e18)/convertToAssets(1e18), as a %.
// Returns null if the contract doesn't implement the calls or reports no haircut.
async function probeExitFeePct(rpc, address) {
  const arg1e18 = '0000000000000000000000000000000000000000000000000de0b6b3a7640000';
  const grossHex = await rpcCall(rpc, address, '0x07a2d13a' + arg1e18).catch(() => null); // convertToAssets(1e18)
  const netHex   = await rpcCall(rpc, address, '0x4cdad506' + arg1e18).catch(() => null); // previewRedeem(1e18)
  if (grossHex && netHex) {
    const g = Number(BigInt(grossHex)), n = Number(BigInt(netHex));
    if (g > 0 && n <= g) return parseFloat(((1 - n / g) * 100).toFixed(4));
  }
  return null;
}

async function fetchOffchainVaults() {
  let fetched = 0;
  for (const vault of OFFCHAIN_VAULTS) {
    const alreadyIdx = parsedRows.findIndex(r =>
      (!vault.matchRe.project || vault.matchRe.project.test(r.project)) &&
      (!vault.matchRe.pool    || vault.matchRe.pool.test(r.pool)) &&
      (!vault.matchRe.chain   || vault.matchRe.chain.test(r.chain))
    );
    if (alreadyIdx !== -1) {
      try {
        if (vault.erc4626?.eulerApy && vault.liquidityRpc) {
          const derivedApy = await fetchEulerLendingApy(vault.address, vault.erc4626.rpc, vault.erc4626.decimals, vault.liquidityRpc.token).catch(() => null);
          if (derivedApy !== null) { parsedRows[alreadyIdx].apy = derivedApy; parsedRows[alreadyIdx].base_apy = derivedApy; }
        }
        if (vault.liquidityRpc) {
          const liq = await fetchTokenBalance(vault.liquidityRpc.rpc, vault.liquidityRpc.token, vault.address, vault.liquidityRpc.decimals).catch(() => null);
          if (liq !== null) parsedRows[alreadyIdx].avail_liquidity = liq;
        }
        // Exit-fee probe for DefiLlama-passthrough vaults that aren't erc4626 share-price
        // vaults (e.g. Avantis) — otherwise their variable withdrawal fee is never captured.
        if (vault.probeExitFee && vault.address) {
          const fee = await probeExitFeePct(vault.probeRpc || vault.liquidityRpc?.rpc || 'https://base.drpc.org', vault.address).catch(() => null);
          if (fee !== null) parsedRows[alreadyIdx].exit_fee_pct = fee;
        }
      } catch { /* keep DefiLlama values on any RPC error */ }
      fetched++;
      continue;
    }
    if (!vault.erc4626) continue;
    try {
      const { rpc, decimals } = vault.erc4626;
      let tvl;
      if (vault.erc4626.eulerApy) {
        const assetsHex = await rpcCall(rpc, vault.address, '0x01e1d114').catch(() => null); // totalAssets()
        if (!assetsHex) continue;
        tvl = parseInt(assetsHex, 16) / Math.pow(10, decimals);
        const feesHex = await rpcCall(rpc, vault.address, '0xf6e50f58').catch(() => null);
        if (feesHex) tvl -= parseInt(feesHex, 16) / Math.pow(10, decimals);
      } else {
        const supplyHex = await rpcCall(rpc, vault.address, '0x18160ddd').catch(() => null); // totalSupply()
        if (!supplyHex) continue;
        const convertData = '0x07a2d13a' + BigInt(supplyHex).toString(16).padStart(64, '0');
        const assetsHex = await rpcCall(rpc, vault.address, convertData).catch(() => null); // convertToAssets(totalSupply)
        if (!assetsHex) continue;
        tvl = parseInt(assetsHex, 16) / Math.pow(10, decimals);
      }
      const disp = tvl >= 1e6 ? `$${(tvl/1e6).toFixed(2)}m`
        : tvl >= 1e3 ? `$${(tvl/1e3).toFixed(1)}k` : `$${tvl.toFixed(0)}`;
      let derivedApy = null;
      if (vault.erc4626.eulerApy && vault.liquidityRpc) {
        derivedApy = await fetchEulerLendingApy(vault.address, rpc, decimals, vault.liquidityRpc.token).catch(() => null);
      } else if (vault.erc4626.shareApy) {
        derivedApy = await fetchSharePriceApy(vault.address, rpc).catch(() => null);
      }
      // Exit-fee detection — persisted to master.csv (col `exit_fee`) so the withdrawal
      // haircut can be charted over time (variable-fee vaults like Avantis move daily).
      const exit_fee_pct = await probeExitFeePct(rpc, vault.address);
      let avail_liquidity = null;
      if (vault.liquidityRpc) {
        avail_liquidity = await fetchTokenBalance(vault.liquidityRpc.rpc, vault.liquidityRpc.token, vault.address, vault.liquidityRpc.decimals).catch(() => null);
      }
      parsedRows.push({
        pool: vault.pool, project: vault.project, chain: vault.chain,
        tvl_display: disp, tvl,
        apy: derivedApy, base_apy: derivedApy, reward_apy: null,
        base_apy_7d: null, il_7d: null,
        avg_30d: null, inception_apy: null, top_10_pct: null,
        total_pool: tvl, total_borrowed: null,
        avail_liquidity, supply_cap_util: null, collateral_exposure: null,
        exit_fee_pct,
        raw: ''
      });
      fetched++;
    } catch { /* silently skip — vault stays out of today's data */ }
  }
  return fetched;
}

// ---------- Formatting helpers (identical to tracker.html) ----------
function tvlDisplay(tvl) {
  return tvl >= 1e9 ? `$${(tvl / 1e9).toFixed(2)}b`
    : tvl >= 1e6 ? `$${(tvl / 1e6).toFixed(2)}m`
    : tvl >= 1e3 ? `$${(tvl / 1e3).toFixed(1)}k`
    : `$${tvl.toFixed(0)}`;
}

function fmtUsd(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ---------- CSV schema (21 columns; must match README + master.csv) ----------
const MASTER_COLS = [
  'date', 'rank', 'pool', 'project', 'chain', 'tvl', 'tvl_raw',
  'apy', 'base_apy', 'reward_apy', 'base_apy_7d', 'il_7d', 'avg_30d', 'inception_apy', 'top_10_pct',
  'total_pool', 'total_borrowed', 'avail_liquidity',
  'supply_cap_util', 'collateral_exposure', 'exit_fee'
];

function rowsToCSV(rows, date) {
  const cols = MASTER_COLS;
  const lines = [cols.join(',')];
  rows.forEach((r, i) => {
    const isMorpho = /morpho/i.test(r.project);
    const obj = {
      date, rank: i + 1,
      pool: r.pool, project: r.project, chain: r.chain,
      tvl: (isMorpho && r.total_pool != null) ? fmtUsd(r.total_pool) : r.tvl_display,
      tvl_raw: (isMorpho && r.total_pool != null) ? r.total_pool : r.tvl,
      apy: r.apy, base_apy: r.base_apy, reward_apy: r.reward_apy,
      base_apy_7d: r.base_apy_7d, il_7d: r.il_7d, avg_30d: r.avg_30d,
      inception_apy: r.inception_apy, top_10_pct: r.top_10_pct,
      total_pool: r.total_pool, total_borrowed: r.total_borrowed,
      avail_liquidity: r.avail_liquidity,
      supply_cap_util: r.supply_cap_util ?? null,
      collateral_exposure: r.collateral_exposure ?? null,
      exit_fee: r.exit_fee_pct ?? null
    };
    lines.push(cols.map(c => csvEscape(obj[c])).join(','));
  });
  return lines.join('\n');
}

function utcDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC), decision #13
}

// ---------- DefiLlama fetch + row assembly ----------
async function fetchDefiLlama() {
  let resp;
  try { resp = await fetch('https://yields.llama.fi/pools'); }
  catch (e) { throw new GateError(1, `DefiLlama fetch threw: ${e.message}`); }
  if (!resp.ok) throw new GateError(1, `DefiLlama HTTP ${resp.status}`);
  let json;
  try { json = await resp.json(); }
  catch (e) { throw new GateError(1, `DefiLlama invalid JSON: ${e.message}`); }
  const pools = json.data ?? [];
  if (!Array.isArray(pools) || pools.length === 0) throw new GateError(1, 'DefiLlama returned empty/invalid pool array');
  // Gate 2 — schema drift: the fields the row assembler reads must still exist.
  for (const f of ['symbol', 'project', 'chain', 'tvlUsd', 'apy', 'stablecoin']) {
    if (!(f in pools[0])) throw new GateError(2, `DefiLlama pool schema drift: missing "${f}"`);
  }
  const cfg = defiLlamaConfig;
  const chainSet = new Set(cfg.chains.map(c => c.toLowerCase()));
  const filtered = pools.filter(p => {
    if (cfg.stablecoinOnly && !p.stablecoin) return false;
    if (chainSet.size && !chainSet.has((p.chain || '').toLowerCase())) return false;
    if ((p.tvlUsd ?? 0) < cfg.minTvl) return false;
    if (cfg.excludeOutliers && p.outlier) return false;
    if (p.apy === null || p.apy === undefined || p.apy > cfg.maxApy) return false;
    return true;
  });
  filtered.sort((a, b) => b.apy - a.apy);
  const top = filtered.slice(0, cfg.limit);
  parsedRows = top.map(p => {
    const tvl = p.tvlUsd ?? 0;
    return {
      pool: p.symbol ?? '',
      project: (p.project ?? '').replace(/-/g, ' '),
      chain: p.chain ?? '',
      tvl_display: tvlDisplay(tvl), tvl,
      apy: p.apy ?? null,
      base_apy: p.apyBase ?? p.apy ?? null,
      reward_apy: p.apyReward ?? null,
      base_apy_7d: p.apyBase7d ?? null,
      il_7d: p.il7d ?? null,
      avg_30d: p.apyMean30d ?? null,
      inception_apy: null, top_10_pct: null,
      total_pool: tvl,
      total_borrowed: p.totalBorrowUsd ?? null,
      avail_liquidity: (p.totalBorrowUsd != null && tvl > 0) ? Math.max(0, tvl - p.totalBorrowUsd) : null,
      supply_cap_util: null, collateral_exposure: null,
      raw: ''
    };
  });
  return { poolCount: pools.length, matchedCount: filtered.length, dlCount: parsedRows.length };
}

// ---------- Morpho V1 enrich + V1/V2 inject (ported from tracker.html) ----------
async function enrichMorpho() {
  const query = `{
    vaults(first: 900, where: { chainId_in: [8453, 10, 42161, 137, 130, 143, 999, 747474, 480, 4217, 988] }) {
      items {
        address
        chain { id }
        symbol
        state {
          netApy
          totalAssetsUsd
          allocation {
            supplyAssets
            supplyAssetsUsd
            supplyCap
            supplyCapUsd
            market {
              collateralAsset { symbol }
              state { liquidityAssetsUsd }
            }
          }
        }
      }
    }
  }`;

  let resp;
  try { resp = await fetch('https://api.morpho.org/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
  }); } catch (e) { throw new GateError(1, `Morpho V1 fetch threw: ${e.message}`); }
  if (!resp.ok) throw new GateError(1, `Morpho V1 HTTP ${resp.status}`);
  let json;
  try { json = await resp.json(); } catch (e) { throw new GateError(1, `Morpho V1 invalid JSON: ${e.message}`); }
  if (json.errors) throw new GateError(1, `Morpho V1 GraphQL error: ${json.errors[0].message}`);
  const vaultItems = json?.data?.vaults?.items ?? [];
  if (!Array.isArray(vaultItems) || vaultItems.length === 0) throw new GateError(1, 'Morpho V1 returned no vaults');
  // Gate 2 — schema drift on the fields the enricher reads.
  const sv = vaultItems[0];
  if (!('address' in sv) || !sv.chain || !('id' in sv.chain) || !sv.state || !('netApy' in sv.state))
    throw new GateError(2, 'Morpho V1 schema drift: missing address/chain.id/state.netApy');

  const morphoByAddress = {};
  vaultItems.forEach(v => {
    if (v.address && v.chain?.id) morphoByAddress[`${v.address.toLowerCase()}:${v.chain.id}`] = v;
  });

  let enrichedCount = 0;
  const notFound = [];

  parsedRows.forEach(r => {
    if (!/morpho/i.test(r.project)) return;
    const ysVault = YS_VAULTS.find(v => v.morpho?.address && matchVault(r, v));
    if (!ysVault) return;
    const vault = morphoByAddress[`${ysVault.morpho.address.toLowerCase()}:${ysVault.morpho.chainId}`];
    if (!vault) { if (!notFound.includes(r.pool)) notFound.push(r.pool); return; }

    const alloc = vault.state?.allocation ?? [];
    const totalUsd = vault.state?.totalAssetsUsd ?? 0;
    let availLiquidity = 0, totalCap = 0, totalSupplied = 0;
    const exposure = {};
    alloc.forEach(a => {
      const supUsd = parseFloat(a.supplyAssetsUsd ?? 0);
      const cap = parseFloat(a.supplyCap ?? 0);
      const sup = parseFloat(a.supplyAssets ?? 0);
      const marketLiqUsd = parseFloat(a.market?.state?.liquidityAssetsUsd ?? 0);
      availLiquidity += Math.min(supUsd, marketLiqUsd);
      if (cap < 1e27) { totalCap += cap; totalSupplied += sup; }
      const sym = a.market?.collateralAsset?.symbol ?? 'Unknown';
      const pct = totalUsd > 0 ? (supUsd / totalUsd) * 100 : 0;
      if (pct > 0) exposure[sym] = parseFloat(((exposure[sym] ?? 0) + pct).toFixed(2));
    });
    const util = totalCap > 0 ? parseFloat(((totalSupplied / totalCap) * 100).toFixed(2)) : null;

    r.total_pool = totalUsd;
    r.avail_liquidity = (availLiquidity === 0 && totalCap === 0) ? null : parseFloat(availLiquidity.toFixed(2));
    r.supply_cap_util = util;
    r.collateral_exposure = Object.keys(exposure).length ? JSON.stringify(exposure) : null;
    if (vault.state?.netApy != null) {
      const netApy = parseFloat((vault.state.netApy * 100).toFixed(4));
      r.apy = netApy;
      r.base_apy = netApy;
    }
    morphoData[vault.address.toLowerCase()] = vault;
    enrichedCount++;
  });

  // Inject YS_VAULT Morpho V1 vaults DefiLlama didn't return
  let injectedCount = 0;
  for (const ysVault of YS_VAULTS) {
    if (!ysVault.morpho?.address) continue;
    if (parsedRows.find(r => matchVault(r, ysVault))) continue;
    const v = morphoByAddress[`${ysVault.morpho.address.toLowerCase()}:${ysVault.morpho.chainId}`];
    if (!v) continue;
    const tvl = v.state?.totalAssetsUsd ?? 0;
    const apy = v.state?.netApy != null ? parseFloat((v.state.netApy * 100).toFixed(4)) : null;
    const alloc = v.state?.allocation ?? [];
    let availLiquidity = 0, totalCap = 0, totalSupplied = 0;
    const exposure = {};
    alloc.forEach(a => {
      const supUsd = parseFloat(a.supplyAssetsUsd ?? 0);
      const cap = parseFloat(a.supplyCap ?? 0);
      const sup = parseFloat(a.supplyAssets ?? 0);
      const marketLiqUsd = parseFloat(a.market?.state?.liquidityAssetsUsd ?? 0);
      availLiquidity += Math.min(supUsd, marketLiqUsd);
      if (cap < 1e27) { totalCap += cap; totalSupplied += sup; }
      const sym = a.market?.collateralAsset?.symbol ?? 'Unknown';
      const pct = tvl > 0 ? (supUsd / tvl) * 100 : 0;
      if (pct > 0) exposure[sym] = parseFloat(((exposure[sym] ?? 0) + pct).toFixed(2));
    });
    const util = totalCap > 0 ? parseFloat(((totalSupplied / totalCap) * 100).toFixed(2)) : null;
    const avail = (availLiquidity === 0 && totalCap === 0) ? null : parseFloat(availLiquidity.toFixed(2));
    parsedRows.push({
      pool: v.symbol || ysVault.name, project: 'morpho', chain: 'Base',
      tvl_display: tvlDisplay(tvl), tvl,
      apy, base_apy: apy, reward_apy: null,
      base_apy_7d: null, il_7d: null,
      avg_30d: null, inception_apy: null, top_10_pct: null,
      total_pool: tvl, total_borrowed: null,
      avail_liquidity: avail, supply_cap_util: util,
      collateral_exposure: Object.keys(exposure).length ? JSON.stringify(exposure) : null,
      raw: ''
    });
    morphoData[v.address.toLowerCase()] = v;
    injectedCount++;
    enrichedCount++;
  }

  const v2Injected = await injectMorphoV2Vaults();
  injectedCount += v2Injected;
  enrichedCount += v2Injected;

  return { enrichedCount, injectedCount, notFound };
}

async function injectMorphoV2Vaults() {
  const v2Vaults = YS_VAULTS.filter(v => v.morphoV2?.address);
  if (v2Vaults.length === 0) return 0;

  const parts = v2Vaults.map((v, i) =>
    `a${i}: vaultV2ByAddress(address: "${v.morphoV2.address}", chainId: ${v.morphoV2.chainId}) ` +
    `{ address symbol name totalAssetsUsd liquidityUsd netApy listed }`
  );
  const query = `{ ${parts.join(' ')} }`;

  let resp;
  try { resp = await fetch('https://api.morpho.org/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
  }); } catch (e) { throw new GateError(1, `Morpho V2 fetch threw: ${e.message}`); }
  if (!resp.ok) throw new GateError(1, `Morpho V2 HTTP ${resp.status}`);
  let json;
  try { json = await resp.json(); } catch (e) { throw new GateError(1, `Morpho V2 invalid JSON: ${e.message}`); }
  if (json.errors) throw new GateError(1, `Morpho V2 GraphQL error: ${json.errors[0].message}`);
  const data = json?.data ?? {};

  let count = 0;
  v2Vaults.forEach((vault, i) => {
    const v = data[`a${i}`];
    if (!v) return;
    const addr = vault.morphoV2.address.toLowerCase();
    const tvl = v.totalAssetsUsd ?? 0;
    const liq = v.liquidityUsd != null ? parseFloat(Number(v.liquidityUsd).toFixed(2)) : null;
    const apy = v.netApy != null ? parseFloat((v.netApy * 100).toFixed(4)) : null;
    const existing = parsedRows.findIndex(r => r.v2addr === addr);
    if (existing !== -1) parsedRows.splice(existing, 1);
    parsedRows.push({
      pool: vault.name, project: 'morpho', chain: 'Base',
      v2addr: addr,
      tvl_display: tvlDisplay(tvl), tvl,
      apy, base_apy: apy, reward_apy: null,
      base_apy_7d: null, il_7d: null,
      avg_30d: null, inception_apy: null, top_10_pct: null,
      total_pool: tvl, total_borrowed: null,
      avail_liquidity: liq, supply_cap_util: null,
      collateral_exposure: null,
      raw: ''
    });
    morphoData[addr] = v;
    count++;
  });
  if (count === 0) throw new GateError(1, `Morpho V2 resolved 0 of ${v2Vaults.length} vaults`);
  return count;
}

// ---------- Gate 4: CSV safety (sanitize text fields in place) ----------
// Strips control chars (protects line-based append) and neutralises CSV-injection
// leading chars (= + - @) per the project security section. Applies only to TEXT
// columns — numeric columns are computed numbers and left untouched.
function sanitizeText(s) {
  if (s == null) return s;
  let t = String(s).replace(/[\r\n\t]+/g, ' ');
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}
function sanitizeRows(rows) {
  let n = 0;
  for (const r of rows) {
    for (const f of ['pool', 'project', 'chain', 'collateral_exposure']) {
      if (r[f] == null) continue;
      const after = sanitizeText(r[f]);
      if (after !== r[f]) { r[f] = after; n++; }
    }
  }
  return n;
}

// Trailing per-day row counts from an existing master.csv (excludes `today`).
function trailingRowCounts(masterPath, today) {
  try {
    const text = fs.readFileSync(masterPath, 'utf8');
    const counts = {};
    text.split('\n').slice(1).forEach(line => {
      const d = line.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d !== today) counts[d] = (counts[d] || 0) + 1;
    });
    return Object.keys(counts).sort().slice(-14).map(d => counts[d]);
  } catch { return []; }
}

// ---------- Gates 2 & 3: schema / value sanity on the assembled rows ----------
function validate(rows, masterPath, today) {
  const force = process.env.YT_TEST_FORCE_GATE;
  if (force) throw new GateError(Number(force), 'forced test trip (YT_TEST_FORCE_GATE)');

  // Gate 2 — output schema integrity.
  if (MASTER_COLS.length !== 21) throw new GateError(2, `schema drift: MASTER_COLS is ${MASTER_COLS.length}, expected 21`);
  if (!Array.isArray(rows) || rows.length === 0) throw new GateError(2, 'no rows assembled');

  // Gate 3 — value sanity.
  const NUMERIC = ['tvl', 'apy', 'base_apy', 'reward_apy', 'base_apy_7d', 'il_7d',
    'avg_30d', 'total_pool', 'total_borrowed', 'avail_liquidity', 'supply_cap_util'];
  for (const r of rows) {
    for (const f of ['pool', 'project', 'chain']) {
      if (r[f] == null || String(r[f]).trim() === '') throw new GateError(3, `null required cell "${f}" (pool="${r.pool}")`);
    }
    for (const f of NUMERIC) {
      if (r[f] != null && Number.isNaN(Number(r[f]))) throw new GateError(3, `NaN in "${f}" (pool="${r.pool}")`);
    }
    if (r.apy != null && (!Number.isFinite(r.apy) || r.apy < -10 || r.apy > 500))
      throw new GateError(3, `APY out of band: ${r.apy} (pool="${r.pool}")`);
    const tvlRaw = (/morpho/i.test(r.project) && r.total_pool != null) ? r.total_pool : r.tvl;
    if (tvlRaw != null && (!Number.isFinite(tvlRaw) || tvlRaw < 0 || tvlRaw > 1e13))
      throw new GateError(3, `TVL out of band: ${tvlRaw} (pool="${r.pool}")`);
  }

  // Row-count band vs trailing average (falls back to an absolute band if no history).
  const hist = trailingRowCounts(masterPath, today);
  if (hist.length >= 3) {
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    const lo = Math.min(avg * 0.6, avg - 25), hi = Math.max(avg * 1.4, avg + 25);
    if (rows.length < lo || rows.length > hi)
      throw new GateError(3, `row count ${rows.length} outside [${Math.floor(lo)}, ${Math.ceil(hi)}] (trailing avg ${avg.toFixed(1)})`);
  } else if (rows.length < 80 || rows.length > 200) {
    throw new GateError(3, `row count ${rows.length} outside absolute band [80, 200]`);
  }

  // Each normally-present tracked vault should appear; a mass disappearance is a red flag.
  const missing = YS_VAULTS.filter(v => !rows.some(r => matchVault(r, v))).map(v => v.name);
  if (missing.length > 5)
    throw new GateError(3, `${missing.length} tracked vaults missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
}

// ---------- Write master.csv + git commit/push ----------
// Idempotent daily append: preserves history, replaces any rows already dated
// `date` (so a re-run overwrites rather than duplicates today), always ends with
// a trailing newline (keeps daily diffs to a single added block).
function writeMasterAppend(masterPath, rows, date) {
  const header = MASTER_COLS.join(',');
  let existing = [];
  try {
    const text = fs.readFileSync(masterPath, 'utf8').replace(/\r\n/g, '\n');
    existing = text.split('\n').filter(l => l.length > 0);
    if (existing.length && (existing[0] === header || existing[0].startsWith('date,'))) existing.shift();
    existing = existing.filter(l => l.slice(0, 10) !== date); // idempotent for today
  } catch { /* no master yet — create fresh */ }
  const todayBlock = rowsToCSV(rows, date).split('\n').slice(1); // drop header line
  fs.writeFileSync(masterPath, [header, ...existing, ...todayBlock].join('\n') + '\n');
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function gitCommitPush(date, nRows) {
  git(['add', 'master.csv']);
  if (!git(['status', '--porcelain', 'master.csv'])) {
    process.stderr.write('[collector] master.csv unchanged — nothing to commit\n');
    return 'unchanged';
  }
  git(['commit', '-m', `collector: ${date} snapshot (${nRows} rows)`]);
  if (process.env.YT_NO_PUSH) { process.stderr.write('[collector] YT_NO_PUSH — committed locally, not pushed\n'); return 'committed'; }
  const ref = process.env.YT_PUSH_BRANCH ? `HEAD:refs/heads/${process.env.YT_PUSH_BRANCH}` : 'HEAD:main';
  try {
    git(['push', 'origin', ref]);
  } catch (e) {
    // Someone else advanced the branch (e.g. a manual backfill) — rebase and retry once.
    process.stderr.write('[collector] push rejected; pull --rebase + retry\n');
    git(['pull', '--rebase', 'origin', process.env.YT_PUSH_BRANCH || 'main']);
    git(['push', 'origin', ref]);
  }
  process.stderr.write(`[collector] pushed ${ref} to origin\n`);
  return 'pushed';
}

// ---------- Main (fail-closed) ----------
async function main() {
  loadConfig();
  const date = utcDate();
  const masterPath = path.join(__dirname, 'master.csv');
  let dlCount, offchainCount, injectedCount, enrichedCount, notFound;
  try {
    ({ dlCount } = await fetchDefiLlama());
    // Same order as tracker.html: DefiLlama → off-chain + Aave (parallel) → Morpho enrich.
    [offchainCount] = await Promise.all([fetchOffchainVaults(), fetchAaveLiquidity()]);
    ({ enrichedCount, injectedCount, notFound } = await enrichMorpho());
    const sanitized = sanitizeRows(parsedRows);     // gate 4 (soft — sanitise + log)
    if (sanitized > 0) process.stderr.write(`[collector] gate 4: sanitised ${sanitized} text field(s) (possible injection/format) — see security section\n`);
    validate(parsedRows, masterPath, date);         // gates 2 & 3 (hard — throw)
  } catch (e) {
    const names = { 1: '1 (fetch integrity)', 2: '2 (schema drift)', 3: '3 (value sanity)' };
    const gname = (e instanceof GateError) ? names[e.gate] || String(e.gate) : 'unexpected error';
    const msg = `⚠️ YieldTracker collector FAILED — ${date} UTC\nGate ${gname}: ${e.message}\nNo row written; master.csv unchanged. Backfill via tracker.html.`;
    process.stderr.write(`[collector] GATE FAIL — Gate ${gname}: ${e.message}\n`);
    await sendTelegram(msg);
    process.exit(1);
  }

  process.stderr.write(
    `[collector] ${date} UTC · ${parsedRows.length} rows ` +
    `(${dlCount} DefiLlama + ${offchainCount} off-chain-touched + ${injectedCount} Morpho-injected) · ` +
    `Morpho enriched ${enrichedCount} · all gates PASSED` +
    (notFound && notFound.length ? ` · unmatched: ${notFound.join(', ')}` : '') + '\n'
  );

  if (process.env.YT_MODE === 'emit') {
    process.stdout.write(rowsToCSV(parsedRows, date) + '\n');
    return;
  }

  // Default: write master.csv, commit, push (fail-closed — any error here alerts too).
  try {
    const masterPath2 = path.join(__dirname, 'master.csv');
    writeMasterAppend(masterPath2, parsedRows, date);
    const result = gitCommitPush(date, parsedRows.length);
    process.stderr.write(`[collector] ${date} done — ${result}\n`);
  } catch (e) {
    const msg = `⚠️ YieldTracker collector — data OK but WRITE/PUSH failed (${date} UTC)\n${e.message}\nRow computed but not published; check the VPS.`;
    process.stderr.write(`[collector] WRITE/PUSH FAIL: ${e.message}\n`);
    await sendTelegram(msg);
    process.exit(1);
  }
}

main().catch(async e => {
  // Safety net for anything outside the guarded block (should be rare).
  const date = utcDate();
  process.stderr.write(`[collector] FATAL: ${e.message}\n`);
  await sendTelegram(`⚠️ YieldTracker collector FATAL — ${date} UTC\n${e.message}\nNo row written.`);
  process.exit(1);
});
