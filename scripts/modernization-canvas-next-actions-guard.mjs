#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : (failures.push(`missing ${path}`), '');
const must = (source, text, label) => { if (!source.includes(text)) failures.push(label); };

const layout = read('app/layout.tsx');
const queryProvider = read('src/features/app-providers/QueryProvider.tsx');
const queryContract = read('src/features/admin/modernization-status-query.ts');
const route = read('app/api/template-assets/route.ts');
const service = read('src/server/services/template-assets-service.ts');
const repository = read('src/server/repositories/template-assets-repository.ts');
const contract = read('src/server/contracts/template-assets-contract.ts');
const sourceFlow = read('components/GuidedSourceDataFlow.tsx');
const header = read('src/features/client-workspace/components/ClientWorkspaceHeader.tsx');
const nav = read('src/features/client-workspace/components/ClientWorkspaceNavigation.tsx');
const brand = read('src/features/client-workspace/components/ClientWorkspaceBrand.tsx');
const cssGuard = read('scripts/css-ownership-guard.mjs');
const cssMap = read('docs/css-retirement-map.md');

must(layout, '<QueryProvider>', 'root layout must include query provider foundation');
must(queryProvider, 'xdisputer-query-foundation', 'query provider foundation marker missing');
must(queryContract, 'modernizationStatusQuery', 'modernization status query contract missing');
must(route, 'jsonFromServiceResult', 'template-assets route must use service result response');
must(route, 'readTemplateAssetsForRequest', 'template-assets route must call service layer');
must(service, 'readTemplateAssetsForRequest', 'template-assets service missing');
must(repository, 'listActiveTemplateAssets', 'template-assets repository missing');
must(contract, 'parseTemplateAssetRound', 'template-assets contract parser missing');
must(sourceFlow, 'LazyEvidenceStage', 'GuidedSourceDataFlow must use lazy evidence stage');
must(sourceFlow, 'packetIsReady', 'GuidedSourceDataFlow must use generation readiness contract');
must(sourceFlow, 'firstSourceDataReadinessBlocker', 'GuidedSourceDataFlow must use source readiness contract');
must(header, 'ClientWorkspaceHeader', 'client workspace header split component missing');
must(nav, 'ClientWorkspaceNavigation', 'client workspace navigation split component missing');
must(brand, 'ClientWorkspaceBrand', 'client workspace brand split component missing');
must(cssGuard, 'css-ownership-guard', 'CSS ownership guard missing');
must(cssMap, 'CSS Retirement Map', 'CSS retirement map missing');

if (failures.length) {
  console.error(`modernization-canvas-next-actions-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('modernization-canvas-next-actions-guard: ok');
