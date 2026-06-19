#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHECKSHEET_PATH = path.join(ROOT, 'docs/02-project/release-readiness/checksheet.yaml');
const MODEL_PATH = path.join(ROOT, 'docs/02-project/release-readiness/scoring-model.yaml');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function parsePhaseScores(checksheetText) {
  const phases = [];
  const phaseBlocks = checksheetText.split(/\n(?=  - phase_id: )/g).filter((block) => block.includes('phase_id:'));

  for (const block of phaseBlocks) {
    const id = Number(block.match(/phase_id:\s*(\d+)/)?.[1] ?? 0);
    const name = block.match(/phase_name:\s*(.+)/)?.[1]?.trim() ?? `Phase ${id}`;
    const status = block.match(/\n    status:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    const decision = block.match(/\n    decision:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    const max = Number(block.match(/\n      max:\s*(\d+)/)?.[1] ?? 0);
    const actual = Number(block.match(/\n      actual:\s*(\d+)/)?.[1] ?? 0);
    const ownerReviewNeeded = (block.match(/\n    owner_review_needed:\s*(.+)/)?.[1]?.trim() ?? 'false') === 'true';
    phases.push({ id, name, status, decision, max, actual, ownerReviewNeeded });
  }

  return phases.sort((a, b) => a.id - b.id);
}

function parseRequiredGates(modelText) {
  const gates = [];
  const section = modelText.split(/\nrequired_gates:\n/)[1]?.split(/\nseverity_rules:\n/)[0] ?? '';
  const gateBlocks = section.split(/(?:^|\n)  - id: /g).slice(1);

  for (const rawBlock of gateBlocks) {
    const block = `id: ${rawBlock}`;
    const id = block.match(/^id:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    const name = block.match(/\n    name:\s*(.+)/)?.[1]?.trim() ?? id;
    const status = block.match(/\n    status:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    gates.push({ id, name, status });
  }

  return gates;
}

function parseCategories(modelText) {
  const categories = [];
  const blocks = modelText.split(/(?:^|\n)  - id: /g).slice(1);

  for (const rawBlock of blocks) {
    const block = `id: ${rawBlock}`;
    if (!block.includes('\n    weight:')) continue;
    const id = block.match(/^id:\s*(.+)/)?.[1]?.trim() ?? 'unknown';
    const name = block.match(/\n    name:\s*(.+)/)?.[1]?.trim() ?? id;
    const weight = Number(block.match(/\n    weight:\s*(\d+)/)?.[1] ?? 0);
    const checks = countMatches(block, /\n      - id: /g);
    categories.push({ id, name, weight, checks });
  }

  return categories;
}

function detectArtifacts() {
  const requiredDocs = [
    'docs/01-business/spec-dsl/README.md',
    'docs/01-business/spec-dsl/process.md',
    'docs/01-business/spec-dsl/decision_rules.yaml',
    'docs/01-business/spec-dsl/data_schema.json',
    'docs/01-business/spec-dsl/api_spec.yaml',
    'docs/01-business/spec-dsl/exception_policy.yaml',
    'docs/01-business/spec-dsl/glossary.md',
    'docs/02-project/release-readiness/README.md',
    'docs/02-project/release-readiness/checksheet.yaml',
    'docs/02-project/release-readiness/scoring-model.yaml',
    'docs/02-project/release-readiness/owner-decision-policy.md',
    'docs/02-project/release-readiness/goal-prompts.md',
    'docs/02-project/release-readiness/iteration-log.md',
    'docs/02-project/12_uc-checklist.md',
    'docs/05-quality/uc/uc-coverage-matrix.md',
    'docs/05-quality/testing-strategy.md',
    'docs/03-architecture/security-requirements.md',
    'package.json',
  ];

  return requiredDocs.map((relativePath) => ({
    path: relativePath,
    exists: fileExists(relativePath),
  }));
}

function packageScripts() {
  const packagePath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(packagePath)) return { available: [], missing: ['package.json'] };

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = pkg.scripts ?? {};
  const important = [
    'lint',
    'typecheck',
    'build',
    'test:unit',
    'test:e2e',
    'test:e2e:smoke',
    'test:journey',
    'qa:all',
    'qa:security',
    'qa:lighthouse',
    'qa:rbac:matrix',
    'qa:tenant-provision',
  ];

  return {
    available: important.filter((name) => Boolean(scripts[name])),
    missing: important.filter((name) => !scripts[name]),
  };
}

function buildReport() {
  const checksheetText = readText(CHECKSHEET_PATH);
  const modelText = readText(MODEL_PATH);
  const phases = parsePhaseScores(checksheetText);
  const gates = parseRequiredGates(modelText);
  const categories = parseCategories(modelText);
  const artifacts = detectArtifacts();
  const scripts = packageScripts();

  const phaseScore = phases.reduce((sum, phase) => sum + phase.actual, 0);
  const phaseMax = phases.reduce((sum, phase) => sum + phase.max, 0);
  const normalizedScore = phaseMax > 0 ? Math.round((phaseScore / phaseMax) * 1000) / 10 : 0;
  const failedGates = gates.filter((gate) => gate.status === 'fail');
  const unknownGates = gates.filter((gate) => gate.status === 'unknown');
  const gatesPass = gates.length > 0 && failedGates.length === 0 && unknownGates.length === 0;
  const targetScore = Number(modelText.match(/target_score:\s*(\d+)/)?.[1] ?? 90);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      targetScore,
      releaseCandidate: normalizedScore >= targetScore && gatesPass,
      scoringMode: 'checksheet_phase_score',
    },
    score: {
      raw: phaseScore,
      max: phaseMax,
      normalized: normalizedScore,
    },
    categories,
    phases,
    requiredGates: {
      pass: gatesPass,
      gates,
      failed: failedGates,
      unknown: unknownGates,
    },
    artifacts: {
      total: artifacts.length,
      present: artifacts.filter((artifact) => artifact.exists).length,
      missing: artifacts.filter((artifact) => !artifact.exists),
      items: artifacts,
    },
    validationScripts: scripts,
    recommendations: makeRecommendations({ phases, failedGates, unknownGates, scripts, artifacts, normalizedScore, targetScore }),
  };
}

function makeRecommendations({ phases, failedGates, unknownGates, scripts, artifacts, normalizedScore, targetScore }) {
  const recommendations = [];
  const notEvaluated = phases.filter((phase) => phase.status === 'not_started' || phase.decision === 'not_evaluated');
  const missingArtifacts = artifacts.filter((artifact) => !artifact.exists);

  if (notEvaluated.length > 0) {
    recommendations.push(`工程${notEvaluated.map((phase) => phase.id).join(', ')}が未評価です。初回ゴールで証跡とスコアを更新してください。`);
  }

  if (failedGates.length > 0) {
    recommendations.push(`必須品質ゲートに失敗があります: ${failedGates.map((gate) => gate.id).join(', ')}。リリース候補にできません。`);
  }

  if (unknownGates.length > 0) {
    recommendations.push(`必須品質ゲートが未判定です: ${unknownGates.map((gate) => gate.id).join(', ')}。採点前に証跡を確認してください。`);
  }

  if (scripts.missing.length > 0) {
    recommendations.push(`重要な検証scriptが未定義です: ${scripts.missing.join(', ')}。代替検証を記録してください。`);
  }

  if (missingArtifacts.length > 0) {
    recommendations.push(`参照成果物が不足しています: ${missingArtifacts.map((artifact) => artifact.path).join(', ')}。`);
  }

  if (normalizedScore < targetScore) {
    recommendations.push(`現在のチェックシート採点は${normalizedScore}点です。${targetScore}点以上にするには未評価工程の証跡化が必要です。`);
  }

  return recommendations;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Release Readiness Score');
  lines.push('');
  lines.push(`Generated: ${report.metadata.generatedAt}`);
  lines.push(`Target score: ${report.metadata.targetScore}`);
  lines.push(`Current score: ${report.score.normalized} / 100`);
  lines.push(`Release candidate: ${report.metadata.releaseCandidate ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Phase Scores');
  lines.push('');
  lines.push('| Phase | Name | Status | Decision | Score | Owner Review |');
  lines.push('| ---: | --- | --- | --- | ---: | --- |');
  for (const phase of report.phases) {
    lines.push(`| ${phase.id} | ${phase.name} | ${phase.status} | ${phase.decision} | ${phase.actual}/${phase.max} | ${phase.ownerReviewNeeded ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## Required Gates');
  lines.push('');
  lines.push('| Gate | Status |');
  lines.push('| --- | --- |');
  for (const gate of report.requiredGates.gates) {
    lines.push(`| ${gate.name} | ${gate.status} |`);
  }
  lines.push('');
  lines.push('## Validation Scripts');
  lines.push('');
  lines.push(`Available: ${report.validationScripts.available.join(', ') || 'none'}`);
  lines.push(`Missing: ${report.validationScripts.missing.join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Artifact Check');
  lines.push('');
  lines.push(`Present: ${report.artifacts.present}/${report.artifacts.total}`);
  if (report.artifacts.missing.length > 0) {
    lines.push('');
    lines.push('Missing artifacts:');
    for (const artifact of report.artifacts.missing) {
      lines.push(`- ${artifact.path}`);
    }
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  if (report.recommendations.length === 0) {
    lines.push('- No immediate recommendations.');
  } else {
    for (const recommendation of report.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

const report = buildReport();

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(renderMarkdown(report));
}
