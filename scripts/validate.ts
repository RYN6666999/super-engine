/// <reference types="node" />
/**
 * validate.ts — minimal external caller validation for weblm-driver v0.1.2
 *
 * PURPOSE:
 *   Observe the actual runtime values of every public contract field in a real
 *   Gemini session. This is an exploration script, NOT a test. It prints
 *   structured output so you can see what fields matter and which are dead.
 *
 * PREREQUISITES:
 *   1. npx playwright install chromium
 *   2. Log in: npx playwright open --browser chromium --user-data-dir /tmp/gemini-profile https://gemini.google.com/app
 *   3. export SMOKE_PROFILE_DIR=/tmp/gemini-profile
 *
 * RUN:
 *   npx tsx scripts/validate.ts
 *   npx tsx scripts/validate.ts --headed    # visible browser
 */

import { GeminiWebDriver } from '../src/driver/GeminiWebDriver';
import type { DriverConfig, GenerateOutput, DriverHealth } from '../src/types/index';

// ─── Config ────────────────────────────────────────────────────────────────────

const PROFILE = process.env['SMOKE_PROFILE_DIR'];
const URL = process.env['SMOKE_PROVIDER_URL'] ?? 'https://gemini.google.com/app';
const HEADED = process.argv.includes('--headed');

if (!PROFILE) {
  console.error('ERROR: SMOKE_PROFILE_DIR is not set.');
  console.error('  export SMOKE_PROFILE_DIR=/tmp/gemini-profile');
  process.exit(1);
}

const config: DriverConfig = {
  providerUrl: URL,
  profileDir: PROFILE,
  headless: !HEADED,
  firstTokenTimeoutMs: 30_000,
  stabilityTimeoutMs: 120_000,
  stabilityIntervalMs: 1_500,
  logLevel: 'info',   // structured logs go to stderr so they don't pollute this script's output
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function banner(label: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(60));
}

function printOutput(label: string, out: GenerateOutput, durationMs: number): void {
  console.log(`\n[${label}]`);
  console.log(`  text (first 120 chars): ${JSON.stringify(out.text.slice(0, 120))}`);
  console.log(`  outputKind:             ${out.outputKind}`);
  console.log(`  durationMs:             ${durationMs}`);
  console.log(`  provider:               ${out.provider}`);
  console.log(`  sessionId:              ${out.sessionId}`);
  console.log(`  metadata:               ${JSON.stringify(out.metadata)}`);
  console.log(`  startedAt → completedAt: ${out.startedAt.toISOString()} → ${out.completedAt.toISOString()}`);
}

function printHealth(label: string, h: DriverHealth): void {
  console.log(`\n[${label}]`);
  console.log(`  ok:               ${h.ok}`);
  console.log(`  initialized:      ${h.initialized}`);
  console.log(`  browserRunning:   ${h.browserRunning}`);
  console.log(`  pageReady:        ${h.pageReady}`);
  console.log(`  authenticated:    ${h.authenticated}`);
  console.log(`  providerReachable:${h.providerReachable}  ← proxy for browserRunning, not network probe`);
  console.log(`  mode:             ${h.mode}`);
  console.log(`  lastError:        ${h.lastError ?? '(none)'}`);
  console.log(`  lastErrorCode:    ${h.lastErrorCode ?? '(none)'}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const driver = new GeminiWebDriver(config);

  // ── 1. init ─────────────────────────────────────────────────────────────────
  banner('STEP 1: init()');
  const t0 = Date.now();
  await driver.init();
  console.log(`  init completed in ${Date.now() - t0}ms`);

  // ── 2. health after init ─────────────────────────────────────────────────────
  banner('STEP 2: health() after init');
  printHealth('health', await driver.health());

  // ── 3. generate — plain prompt (observe outputKind, duration) ────────────────
  banner('STEP 3: generate() — plain prompt');
  console.log('  Prompt: "Reply with only the single word PONG. No other text."');
  const t3 = Date.now();
  const out3 = await driver.generate({
    prompt: 'Reply with only the single word PONG. No other text.',
    metadata: { requestId: 'validate-001', step: 3 },
  });
  printOutput('generate plain', out3, Date.now() - t3);

  // ── 4. generate — newConversation timing ────────────────────────────────────
  banner('STEP 4: generate() — newConversation:true (hard reload timing)');
  console.log('  NOTE: this triggers page.goto(providerUrl). Expect +5–15s latency.');
  const t5 = Date.now();
  const out5 = await driver.generate({
    prompt: 'What is 1 + 1?',
    newConversation: true,
    metadata: { requestId: 'validate-003', step: 4 },
  });
  const dur5 = Date.now() - t5;
  printOutput('generate + newConversation', out5, dur5);
  console.log(`\n  VERDICT: reload overhead ≈ ${dur5}ms total.`);
  console.log('           Body of page.goto() cost is inside this number.');
  console.log('           If < 5000ms total, reload is acceptable for callers.');

  // ── 6. health — observe all fields after normal operation ────────────────────
  banner('STEP 6: health() — mid-run field audit');
  printHealth('health mid-run', await driver.health());
  console.log('\n  FIELD AUDIT:');
  console.log('  - providerReachable mirrors browserRunning (confirmed proxy, not network probe)');
  console.log('  - lastError / lastErrorCode should both be (none) after clean run');
  console.log('  - mode should be "idle"');

  // ── 7. simulate a recover() probe ───────────────────────────────────────────
  banner('STEP 7: recover() — probe with "timeout" reason');
  const tR = Date.now();
  const rec = await driver.recover('timeout');
  console.log(`\n[recover result]`);
  console.log(`  ok:         ${rec.ok}`);
  console.log(`  action:     ${rec.action}`);
  console.log(`  message:    ${rec.message}`);
  console.log(`  durationMs: ${Date.now() - tR}`);

  // Health check after recover
  const hAfterRecover = await driver.health();
  console.log(`\n  lastError after recover:     ${hAfterRecover.lastError ?? '(none) ← cleared ✓'}`);
  console.log(`  lastErrorCode after recover: ${hAfterRecover.lastErrorCode ?? '(none) ← cleared ✓'}`);

  // ── 8. generate after recover ────────────────────────────────────────────────
  banner('STEP 8: generate() — after recover (confirm driver still works)');
  const t8 = Date.now();
  const out8 = await driver.generate({
    prompt: 'Reply with only the single word READY.',
    metadata: { requestId: 'validate-004', step: 8 },
  });
  printOutput('generate post-recover', out8, Date.now() - t8);

  // ── 9. shutdown ──────────────────────────────────────────────────────────────
  banner('STEP 9: shutdown()');
  const tS = Date.now();
  await driver.shutdown();
  console.log(`  shutdown completed in ${Date.now() - tS}ms`);

  const hFinal = await driver.health();
  console.log(`  mode after shutdown: ${hFinal.mode}`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  banner('VALIDATION SUMMARY');
  console.log('  Fill this in after observing the run:\n');
  console.log('  outputKind was "normal" for all clean responses? ___');
  console.log('  outputKind was "provider-error" for any response? ___');
  console.log('  outputKind was "unknown" for any response? ___');
  console.log('  newConversation reload total duration: ___ms');
  console.log('  lastErrorCode was present in any health() call? ___');
  console.log('  lastError was cleared after successful recover()? ___');
  console.log('  recover().action was: ___');
  console.log('\n  CONFIRMED DEAD FIELD (removed in v0.1.3):');
  console.log('  - systemPrompt: removed — Gemini Web has no system prompt injection path');
  console.log('\n  KNOWN PROXY (kept, not trusted for network diag):');
  console.log('  - providerReachable: mirrors browserRunning — not a real network probe');
}

main().catch((err: unknown) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
