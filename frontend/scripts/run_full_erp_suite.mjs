#!/usr/bin/env node
/**
 * Orquestador de la suite E2E completa del ERP.
 * Uso: node scripts/run_full_erp_suite.mjs
 *      node scripts/run_full_erp_suite.mjs --only api,chaos
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_BASE, FRONTEND_BASE, RUN_TAG, SuiteReporter, waitForApi } from '../e2e/helpers/suiteCore.mjs';
import { runApiSuite } from './erp_suite/apiSuite.mjs';
import { runChaosSuite } from './erp_suite/chaosSuite.mjs';
import { runUiSuite } from './erp_suite/uiSuite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'erp-full-suite');

const args = process.argv.slice(2);
let only = null;
const eqFlag = args.find((a) => a.startsWith('--only='));
if (eqFlag) {
  only = eqFlag.split('=')[1]?.split(',').filter(Boolean);
} else {
  const idx = args.indexOf('--only');
  if (idx >= 0 && args[idx + 1]) only = args[idx + 1].split(',').filter(Boolean);
}

function runPythonSeed() {
  return new Promise((resolve) => {
    const script = path.join(ROOT, 'backend', 'scripts', 'e2e_full_suite_seed.py');
    const proc = spawn(process.platform === 'win32' ? 'python' : 'python3', [script], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => resolve(code ?? 1));
    proc.on('error', () => resolve(1));
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const master = new SuiteReporter(OUT_DIR, 'master-suite');
  const steps = [];
  let exitCode = 0;

  console.log('=== MC-LARENS ERP — Suite E2E Completa ===');
  console.log(`Run: ${RUN_TAG}`);
  console.log(`Frontend: ${FRONTEND_BASE}`);
  console.log(`API: ${API_BASE}`);

  try {
    await waitForApi();
    master.record('preflight', 'api-disponible', API_BASE);
  } catch (error) {
    master.record('preflight', 'api-no-disponible', String(error?.message || error), false);
    const { exitCode: code } = master.summary();
    process.exit(code);
  }

  const shouldRun = (name) => !only || only.includes(name);

  if (shouldRun('seed')) {
    console.log('\n--- SEED ---');
    const seedCode = await runPythonSeed();
    master.record('seed', 'datos-prueba', `exit=${seedCode}`, seedCode === 0);
    if (seedCode !== 0) exitCode = 1;
  }

  if (shouldRun('api')) {
    console.log('\n--- API SUITE ---');
    const { exitCode: code, report } = await runApiSuite();
    steps.push({ name: 'api', exitCode, totals: report.totals });
    if (code !== 0) exitCode = 1;
  }

  if (shouldRun('ui')) {
    console.log('\n--- UI SUITE ---');
    const { exitCode: code, report } = await runUiSuite();
    steps.push({ name: 'ui', exitCode, totals: report.totals });
    if (code !== 0) exitCode = 1;
  }

  if (shouldRun('chaos')) {
    console.log('\n--- CHAOS SUITE ---');
    const { exitCode: code, report } = await runChaosSuite();
    steps.push({ name: 'chaos', exitCode, totals: report.totals });
    if (code !== 0) exitCode = 1;
  }

  // Consolidar reportes
  const consolidated = {
    run_tag: RUN_TAG,
    steps,
    reports: {},
  };
  for (const name of ['api-suite', 'ui-suite', 'chaos-suite', 'master-suite']) {
    const file = path.join(OUT_DIR, `${name}-report.json`);
    if (fs.existsSync(file)) {
      consolidated.reports[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
  const bugs = Object.values(consolidated.reports)
    .flatMap((r) => r.bugs || [])
    .concat(
      Object.values(consolidated.reports)
        .flatMap((r) => r.failed || r.results?.filter((x) => !x.ok) || []),
    );
  consolidated.bug_count = bugs.length;
  consolidated.summary = steps.map((s) => `${s.name}: ${s.totals?.passed || 0}/${s.totals?.total || '?'} OK`).join(' | ');

  fs.writeFileSync(path.join(OUT_DIR, 'consolidated-report.json'), JSON.stringify(consolidated, null, 2));

  console.log('\n=== CONSOLIDADO ===');
  console.log(consolidated.summary);
  console.log(`Reporte: ${path.join(OUT_DIR, 'consolidated-report.json')}`);

  master.record('fin', 'suite-completa', consolidated.summary, exitCode === 0);
  master.summary();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});