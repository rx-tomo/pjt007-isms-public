#!/usr/bin/env node
'use strict';

/**
 * Lighthouse based performance regression runner for primary routes.
 * Requires a running dev server (recommendation: E2E_MODE=1) and
 * stores artifacts under test-results/lighthouse/<timestamp>.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const HOST = process.env.QA_SERVER_HOST || process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.QA_SERVER_PORT || process.env.PORT || 3007);
const BASE_URL = process.env.QA_BASE_URL || `http://${HOST}:${PORT}`;
const RUNS_PER_ROUTE = Number(process.env.QA_LH_RUNS || 1);
const DEFAULT_PRESET = process.env.QA_LH_PRESET || 'desktop';
const FORM_FACTOR = process.env.QA_LH_FORM_FACTOR || 'desktop';
const ROUTE_PATHS = (process.env.QA_LIGHTHOUSE_ROUTES
  ? process.env.QA_LIGHTHOUSE_ROUTES.split(',')
  : ['/ja/home', '/ja/risks', '/ja/tasks', '/ja/audits', '/ja/documents']
).map((value) => value.trim()).filter(Boolean);

const SCORE_THRESHOLDS = {
  performance: Number(process.env.QA_LH_THRESHOLD_PERFORMANCE || 85),
  accessibility: Number(process.env.QA_LH_THRESHOLD_ACCESSIBILITY || 90),
  bestPractices: Number(process.env.QA_LH_THRESHOLD_BEST_PRACTICES || 90),
  seo: Number(process.env.QA_LH_THRESHOLD_SEO || 90)
};

const RESULTS_ROOT = path.join(__dirname, '..', 'test-results', 'lighthouse');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(RESULTS_ROOT, `lighthouse-${TIMESTAMP}`);
const LHCI_DIR = path.join(process.cwd(), '.lighthouseci');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function waitForServer() {
  const retryLimit = Number(process.env.QA_SERVER_RETRY_LIMIT || 20);
  const retryInterval = Number(process.env.QA_SERVER_RETRY_INTERVAL_MS || 1000);

  return new Promise((resolve) => {
    let attempts = 0;

    const tryConnect = () => {
      const request = http.request({
        hostname: HOST,
        port: PORT,
        path: '/',
        method: 'HEAD',
        timeout: 1000
      }, () => resolve(true));

      request.on('error', () => {
        attempts += 1;
        if (attempts >= retryLimit) {
          resolve(false);
          return;
        }
        setTimeout(tryConnect, retryInterval);
      });

      request.on('timeout', () => {
        request.destroy();
        attempts += 1;
        if (attempts >= retryLimit) {
          resolve(false);
          return;
        }
        setTimeout(tryConnect, retryInterval);
      });

      request.end();
    };

    tryConnect();
  });
}

function createSlug(routePath) {
  const normalized = routePath.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'root';
}

const ROUTES = ROUTE_PATHS.map((routePath) => ({
  path: routePath,
  slug: createSlug(routePath),
  label: routePath
}));

function getLhciBin() {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  return path.join(process.cwd(), 'node_modules', '.bin', `lhci${ext}`);
}

function resetLhciDir() {
  fs.rmSync(LHCI_DIR, { recursive: true, force: true });
}

function collectArtifacts(routeSlug) {
  if (!fs.existsSync(LHCI_DIR)) {
    throw new Error('Lighthouse output directory (.lighthouseci) not found.');
  }

  const files = fs.readdirSync(LHCI_DIR);
  const jsonFile = files.find((file) => file.startsWith('lhr-') && file.endsWith('.json'));
  const htmlFile = files.find((file) => file.startsWith('lhr-') && file.endsWith('.html'));

  if (!jsonFile || !htmlFile) {
    throw new Error('Lighthouse run did not produce JSON/HTML artifacts.');
  }

  const jsonSource = path.join(LHCI_DIR, jsonFile);
  const htmlSource = path.join(LHCI_DIR, htmlFile);
  const jsonTarget = path.join(RUN_DIR, `${routeSlug}.lhr.json`);
  const htmlTarget = path.join(RUN_DIR, `${routeSlug}.report.html`);

  fs.copyFileSync(jsonSource, jsonTarget);
  fs.copyFileSync(htmlSource, htmlTarget);

  const lhr = JSON.parse(fs.readFileSync(jsonSource, 'utf8'));
  return { lhr, jsonPath: jsonTarget, htmlPath: htmlTarget };
}

function evaluateScores(scores) {
  const failures = [];
  for (const [metric, threshold] of Object.entries(SCORE_THRESHOLDS)) {
    if (!Number.isFinite(threshold) || threshold <= 0) continue;
    const value = scores[metric];
    if (typeof value === 'number' && value < threshold) {
      failures.push({ metric, expected: threshold, actual: value });
    }
  }
  return failures;
}

function toScore(category) {
  if (!category || typeof category.score !== 'number') {
    return null;
  }
  return Math.round(category.score * 100);
}

function summarize(route, lhr, artifacts) {
  const categories = lhr.categories || {};
  const scores = {
    performance: toScore(categories.performance),
    accessibility: toScore(categories.accessibility),
    bestPractices: toScore(categories['best-practices']),
    seo: toScore(categories.seo)
  };

  const failures = evaluateScores(scores);
  const summary = {
    route: route.path,
    slug: route.slug,
    url: lhr.requestedUrl,
    fetchTime: lhr.fetchTime,
    scores,
    metrics: {
      lcp: lhr.audits?.['largest-contentful-paint']?.displayValue || null,
      inp: lhr.audits?.['interaction-to-next-paint']?.displayValue || null,
      cls: lhr.audits?.['cumulative-layout-shift']?.displayValue || null
    },
    artifacts,
    failures
  };

  const summaryPath = path.join(RUN_DIR, `${route.slug}.summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  return summary;
}

function runLighthouse(route) {
  resetLhciDir();
  const url = new URL(route.path, BASE_URL).toString();
  console.log(`\n🚀 Lighthouse: ${route.label} (${url})`);

  const result = spawnSync(getLhciBin(), ['collect', '--url', url, `--numberOfRuns=${RUNS_PER_ROUTE}`], {
    stdio: 'inherit',
    env: {
      ...process.env,
      LHCI_COLLECT__SETTINGS__PRESET: route.preset || DEFAULT_PRESET,
      LHCI_COLLECT__SETTINGS__FORM_FACTOR: route.formFactor || FORM_FACTOR,
      LHCI_COLLECT__SETTINGS__THROTTLING_METHOD: 'provided'
    }
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`lhci collect exited with code ${result.status}`);
  }

  const artifacts = collectArtifacts(route.slug);
  return summarize(route, artifacts.lhr, {
    json: path.relative(process.cwd(), artifacts.jsonPath),
    html: path.relative(process.cwd(), artifacts.htmlPath)
  });
}

async function main() {
  if (!ROUTES.length) {
    console.error('❌ 対象ルートが設定されていません (QA_LIGHTHOUSE_ROUTES が空です)。');
    process.exit(1);
  }

  ensureDir(RUN_DIR);
  console.log('🌐 Lighthouse QA を開始します');
  console.log(`    サーバー: ${BASE_URL}`);
  console.log(`    ルート: ${ROUTES.map((route) => route.path).join(', ')}`);

  const ready = await waitForServer();
  if (!ready) {
    console.error('❌ 対象サーバーに接続できませんでした。`npm run dev` などで起動してから再実行してください。');
    process.exit(1);
  }

  const summaries = [];
  let hasFailures = false;

  for (const route of ROUTES) {
    try {
      const summary = runLighthouse(route);
      summaries.push(summary);
      if (summary.failures.length > 0) {
        hasFailures = true;
        console.warn(`⚠️  ${route.label} のスコアが閾値を下回りました:`, summary.failures);
      } else {
        console.log(`✅  ${route.label} は全ての閾値を満たしました`);
      }
    } catch (error) {
      console.error(`❌ ${route.label} で Lighthouse 実行に失敗しました: ${error.message}`);
      process.exit(1);
    }
  }

  const finalSummary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    server: { host: HOST, port: PORT },
    thresholds: SCORE_THRESHOLDS,
    runsPerRoute: RUNS_PER_ROUTE,
    results: summaries
  };
  const summaryPath = path.join(RUN_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(finalSummary, null, 2));
  console.log(`\n📁 Lighthouse サマリー: ${path.relative(process.cwd(), summaryPath)}`);

  if (hasFailures) {
    console.error('❌ 一部のルートでスコアが閾値未満です。結果を確認してください。');
    process.exit(1);
  }

  console.log('🎉 Lighthouse QA を完了しました');
}

main();
