#!/usr/bin/env node
'use strict';

/**
 * QA security sweep: npm audit + OSV batch query.
 *
 * Outputs JSON evidence to test-results/security and prints a short summary.
 * Set QA_SECURITY_FAIL_ON to `low|moderate|high|critical` to enforce thresholds.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RESULTS_DIR = path.join(__dirname, '..', 'test-results', 'security');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const AUDIT_PATH = path.join(RESULTS_DIR, `npm-audit-${TIMESTAMP}.json`);
const OSV_PATH = path.join(RESULTS_DIR, `osv-scan-${TIMESTAMP}.json`);
const SUMMARY_PATH = path.join(RESULTS_DIR, `security-summary-${TIMESTAMP}.json`);
const FAIL_THRESHOLD = (process.env.QA_SECURITY_FAIL_ON || 'none').toLowerCase();
const INCLUDE_DEV = process.env.QA_SECURITY_INCLUDE_DEV === '1';
const OSV_BATCH_SIZE = Number(process.env.QA_SECURITY_OSV_BATCH || 100);
const OSV_DELAY_MS = Number(process.env.QA_SECURITY_OSV_SLEEP_MS || 250);

const SEVERITY_ORDER = ['none', 'info', 'low', 'moderate', 'high', 'critical'];

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function runNpmAudit() {
  console.log('🔍 npm audit を実行します...');
  const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });

  if (result.error) {
    throw result.error;
  }

  if (!result.stdout) {
    throw new Error('npm audit の出力を取得できませんでした');
  }

  fs.writeFileSync(AUDIT_PATH, result.stdout);
  const parsed = JSON.parse(result.stdout);
  return parsed;
}

function packageNameFromKey(key, fallback) {
  if (!key) return fallback || null;
  if (key.startsWith('node_modules/')) {
    return key.replace(/^node_modules\//, '');
  }
  if (key === '') {
    return fallback || null;
  }
  return key;
}

function collectPackages(includeDev) {
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    throw new Error('package-lock.json が見つかりません');
  }

  const lockRaw = fs.readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(lockRaw);
  const packages = lock.packages || {};
  const dedup = new Map();

  for (const [key, meta] of Object.entries(packages)) {
    if (!meta || !meta.version) continue;
    const isDev = Boolean(meta.dev);
    if (!includeDev && isDev) continue;
    const name = meta.name || packageNameFromKey(key, lock.name);
    if (!name) continue;
    const dedupKey = `${name}@${meta.version}`;
    const existing = dedup.get(dedupKey);
    if (existing) {
      existing.dev = existing.dev && isDev;
      continue;
    }
    dedup.set(dedupKey, { name, version: meta.version, dev: isDev });
  }

  return Array.from(dedup.values());
}

function cvssToSeverity(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  if (value >= 9) return 'critical';
  if (value >= 7) return 'high';
  if (value >= 4) return 'moderate';
  if (value > 0) return 'low';
  return 'info';
}

function maxSeverity(a, b) {
  return SEVERITY_ORDER.indexOf(a) > SEVERITY_ORDER.indexOf(b) ? a : b;
}

async function queryOsv(packages) {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch が利用できません。Node.js 18 以上で実行してください。');
  }

  console.log(`🌐 OSV API へ ${packages.length} 件を照会します (バッチサイズ ${OSV_BATCH_SIZE})...`);

  const findings = [];
  for (let i = 0; i < packages.length; i += OSV_BATCH_SIZE) {
    const chunk = packages.slice(i, i + OSV_BATCH_SIZE);
    const payload = {
      queries: chunk.map((pkg) => ({
        package: { name: pkg.name, ecosystem: 'npm' },
        version: pkg.version
      }))
    };

    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OSV API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    data.results.forEach((result, index) => {
      if (!result || !Array.isArray(result.vulns) || result.vulns.length === 0) {
        return;
      }
      findings.push({
        package: chunk[index],
        vulns: result.vulns.map((vuln) => ({
          id: vuln.id,
          summary: vuln.summary,
          details: vuln.details,
          severity: vuln.severity || [],
          aliases: vuln.aliases || [],
          references: vuln.references || [],
          published: vuln.published,
          modified: vuln.modified
        }))
      });
    });

    if (i + OSV_BATCH_SIZE < packages.length) {
      await new Promise((resolve) => setTimeout(resolve, OSV_DELAY_MS));
    }
  }

  const result = { scannedPackages: packages.length, findings };
  fs.writeFileSync(OSV_PATH, JSON.stringify(result, null, 2));
  return result;
}

function determineHighestSeverity(auditData, osvResult) {
  const counts = auditData?.metadata?.vulnerabilities || {};
  let current = 'none';
  for (const level of ['critical', 'high', 'moderate', 'low', 'info']) {
    if ((counts[level] || 0) > 0) {
      current = level;
      break;
    }
  }

  for (const finding of osvResult.findings) {
    for (const vuln of finding.vulns) {
      for (const severity of vuln.severity || []) {
        const derived = cvssToSeverity(severity.score);
        if (derived) {
          current = maxSeverity(current, derived);
        }
      }
    }
  }

  return current;
}

function shouldFail(highest) {
  if (!FAIL_THRESHOLD || FAIL_THRESHOLD === 'none') {
    return false;
  }
  const targetIndex = SEVERITY_ORDER.indexOf(FAIL_THRESHOLD);
  if (targetIndex === -1) {
    console.warn(`⚠️ QA_SECURITY_FAIL_ON=${FAIL_THRESHOLD} は未対応の値です。判定をスキップします。`);
    return false;
  }
  const highestIndex = SEVERITY_ORDER.indexOf(highest);
  return highestIndex >= targetIndex && highestIndex > 0;
}

async function main() {
  ensureResultsDir();
  console.log('🛡️  セキュリティ QA を開始します');

  const auditData = runNpmAudit();
  const packages = collectPackages(INCLUDE_DEV);
  const osvResult = await queryOsv(packages);

  const highestSeverity = determineHighestSeverity(auditData, osvResult);
  const summary = {
    generatedAt: new Date().toISOString(),
    failThreshold: FAIL_THRESHOLD,
    highestSeverity,
    npmAudit: {
      file: path.relative(process.cwd(), AUDIT_PATH),
      totals: auditData?.metadata?.vulnerabilities || {}
    },
    osv: {
      file: path.relative(process.cwd(), OSV_PATH),
      scannedPackages: osvResult.scannedPackages,
      findings: osvResult.findings.length
    }
  };
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));

  console.log('📄  npm audit 集計:', summary.npmAudit.totals);
  console.log(`📄  OSV findings: ${summary.osv.findings}`);
  console.log(`📁  サマリー: ${path.relative(process.cwd(), SUMMARY_PATH)}`);

  if (shouldFail(highestSeverity)) {
    console.error(`❌  最高深刻度 ${highestSeverity} が許容閾値 ${FAIL_THRESHOLD} を上回りました`);
    process.exit(1);
  }

  console.log('✅  セキュリティ QA を完了しました');
}

main().catch((error) => {
  console.error('❌ セキュリティ QA に失敗しました:', error.message);
  process.exit(1);
});

