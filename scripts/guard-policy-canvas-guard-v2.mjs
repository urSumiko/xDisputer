#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const failures = [];
const warnings = [];

function read(path) {
  const fullPath = join(ROOT, path);
  if (!existsSync(fullPath)) return '';
  return readFileSync(fullPath, 'utf8');
}

function exists(path) {
  return existsSync(join(ROOT, path));
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function walk(dir, predicate, files = []) {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return files;

  for (const entry of readdirSync(absolute)) {
    const fullPath = join(absolute, entry);
    const relative = fullPath.slice(ROOT.length + 1).replaceAll('\\', '/');
    const stats = statSync(fullPath);
    if (stats.isDirectory()) walk(relative, predicate, files);
    else if (predicate(relative)) files.push(relative);
  }

  return files;
}

function mustInclude(source, marker, label) {
  if (!source.includes(marker)) fail(label);
}

function checkCanvasCompleteness() {
  const canvas = read('docs/guard-policy-contradiction-resolution-canvas.md');
  if (!canvas) {
    fail('missing docs/guard-policy-contradiction-resolution-canvas.md');
    return;
  }

  for (const marker of [
    'Guard Policy Contradiction Resolution Canvas',
    'one active policy must win',
    'Next.js App Router CSS policy',
    'Supabase query and schema policy',
    'npm install policy',
    'Current active repo contracts',
    'Permanent contradiction prevention model',
    'Guard contradiction decision tree',
    'Backend policy',
    'Frontend policy',
    'Guard authoring rules',
    'Definition of done'
  ]) {
    mustInclude(canvas, marker, `guard policy canvas missing marker: ${marker}`);
  }
}

function checkMachinePolicyWiring() {
  const runner = read('scripts/guard-bundle-runner.mjs');
  const consistency = read('scripts/guard-policy-consistency.mjs');
  const pkg = read('package.json');

  mustInclude(runner, 'scripts/guard-policy-canvas-guard-v2.mjs', 'guard bundle runner must execute canvas guard v2 before module guards');
  mustInclude(runner, 'scripts/guard-policy-consistency.mjs', 'guard bundle runner must execute consistency guard before module guards');
  mustInclude(consistency, 'checkNotificationSchemaPolicy', 'consistency guard must check notification schema policy');
  mustInclude(consistency, 'checkRootCssImportContracts', 'consistency guard must check root CSS import contracts');
  mustInclude(consistency, 'checkPackageLockPolicy', 'consistency guard must check package-lock policy');
  mustInclude(pkg, 'guard-policy:guard', 'package.json must expose guard-policy:guard');
}

function checkNotificationPolicy() {
  const contract = read('src/features/notifications/notification-ui-contract.ts');
  const readService = read('lib/notifications/notification-service.ts');
  const writeService = read('lib/notifications/notification-write-service.ts');
  const canonicalMigration = read('supabase/migrations/20260617133000_create_notifications.sql');
  const roleMigration = read('supabase/migrations/20260620123000_notifications_recipient_role_safe_schema.sql');

  mustInclude(contract, 'strict-canonical-columns', 'notification contract must use strict canonical schema mode');
  mustInclude(readService, ".select('id,title,body,href,severity,read_at,created_at')", 'notification reads must use explicit canonical projection');
  mustInclude(readService, '.limit(', 'notification reads must cap result rows');
  mustInclude(writeService, 'recipient_role: input.recipientRole || null', 'notification writes must include canonical recipient_role');
  mustInclude(canonicalMigration, 'create table if not exists public.notifications', 'notification canonical table migration must exist');
  mustInclude(canonicalMigration, 'recipient_role text', 'notification canonical migration must define recipient_role');
  mustInclude(roleMigration, "notify pgrst, 'reload schema'", 'notification role migration must reload schema cache');

  for (const marker of ['missingOptionalColumn', 'isMissingOptionalColumn', 'fallbackSelect', 'MinimalNotificationRow', 'canonical-read-with-compatibility-fallback']) {
    if (contract.includes(marker) || readService.includes(marker) || writeService.includes(marker)) {
      fail(`notification strict policy must not keep fallback marker: ${marker}`);
    }
  }
}

function collectRequiredRootCssImports() {
  const cssFiles = new Set();
  const patterns = [
    /must\(layout,\s*['"]import '\.\/([^'"]+\.css)';['"]/g,
    /has\(\s*['"]app\/layout\.tsx['"]\s*,\s*['"]import '\.\/([^'"]+\.css)';['"]\s*\)/g
  ];

  for (const script of walk('scripts', (file) => file.endsWith('.mjs'))) {
    const source = read(script);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) cssFiles.add(match[1]);
    }
  }

  return cssFiles;
}

function checkRootCssPolicy() {
  const layout = read('app/layout.tsx');
  for (const cssFile of collectRequiredRootCssImports()) {
    if (!exists(`app/${cssFile}`)) fail(`script requires missing app CSS file: app/${cssFile}`);
    if (!layout.includes(`import './${cssFile}';`)) fail(`root layout missing required CSS import: ${cssFile}`);
  }
}

function checkPackageLockPolicy() {
  const packageJson = read('package.json');
  const packageLock = read('package-lock.json');
  if (!packageJson || !packageLock) {
    fail('package.json and package-lock.json are required');
    return;
  }

  const pkg = JSON.parse(packageJson);
  const lock = JSON.parse(packageLock);
  const declared = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {})
  };
  const locked = {
    ...(lock.packages?.['']?.dependencies || {}),
    ...(lock.packages?.['']?.devDependencies || {}),
    ...(lock.packages?.['']?.optionalDependencies || {})
  };

  for (const [name, range] of Object.entries(declared)) {
    if (locked[name] !== range) fail(`package-lock root drift: ${name}`);
    if (!lock.packages?.[`node_modules/${name}`]) fail(`package-lock missing node_modules entry: ${name}`);
  }
}

function reviewSchemaChangingSqlPolicy() {
  for (const file of walk('supabase/migrations', (candidate) => candidate.endsWith('.sql'))) {
    const source = read(file).toLowerCase();
    const changesSchema = source.includes('create table') || source.includes('alter table') || source.includes('drop table');
    const isKnownBaseSchema = file.endsWith('20260617133000_create_notifications.sql');
    if (changesSchema && !isKnownBaseSchema && !source.includes("notify pgrst, 'reload schema'")) {
      warn(`${file} changes schema without an explicit schema reload marker; review when it touches API-exposed objects.`);
    }
  }
}

checkCanvasCompleteness();
checkMachinePolicyWiring();
checkNotificationPolicy();
checkRootCssPolicy();
checkPackageLockPolicy();
reviewSchemaChangingSqlPolicy();

for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length) {
  console.error(`guard-policy-canvas-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('guard-policy-canvas-guard: ok');
