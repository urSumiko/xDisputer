import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function once(content, search, replacement, label) {
  if (content.includes(replacement.trim())) return content;
  if (!content.includes(search)) {
    throw new Error(`Phase 14 repair missing anchor: ${label}`);
  }
  return content.replace(search, replacement);
}

function removeDuplicateSnapshotDeclarations(content) {
  const declaration = `    const sourceSnapshot = body?.sourceSnapshot ?? body?.source ?? null;
    const templateSnapshot = body?.templateSnapshot ?? body?.template ?? null;
    const rulesSnapshot = body?.rulesSnapshot ?? body?.rules ?? null;
    const outputSnapshot = body?.outputSnapshot ?? body?.output ?? null;
`;

  const first = content.indexOf(declaration);
  if (first < 0) return content;

  let next = content;
  let index = next.indexOf(declaration, first + declaration.length);
  while (index >= 0) {
    next = next.slice(0, index) + next.slice(index + declaration.length);
    index = next.indexOf(declaration, first + declaration.length);
  }
  return next;
}

function patchGenerationRunsRoute() {
  const file = 'app/api/generation-runs/route.ts';
  let c = read(file);
  c = removeDuplicateSnapshotDeclarations(c);

  if (!c.includes("../../../lib/saas/generation-snapshots")) {
    c = c.replace(
      "import { logSystemEvent, requestIdFrom, safeErrorMessage } from '../../../lib/saas/system-observability';",
      "import { logSystemEvent, requestIdFrom, safeErrorMessage } from '../../../lib/saas/system-observability';\nimport { recordGenerationErrorEvent, recordGenerationRunSnapshot } from '../../../lib/saas/generation-snapshots';"
    );
  }

  c = once(c, "    const manifest = body?.manifest;\n", "    const manifest = body?.manifest;\n    const sourceSnapshot = body?.sourceSnapshot ?? body?.source ?? null;\n    const templateSnapshot = body?.templateSnapshot ?? body?.template ?? null;\n    const rulesSnapshot = body?.rulesSnapshot ?? body?.rules ?? null;\n    const outputSnapshot = body?.outputSnapshot ?? body?.output ?? null;\n", 'snapshot request body');

  c = once(c,
`    const integrityError = await recordGenerationIntegrity(supabase, {
      generationRunId: data.id,
      eventType: 'generation_run_recorded',
      manifest,
      rules: {
        allowedRounds,
        allowedStatuses,
        selectedRound: round,
        selectedStatus: status
      },
      status: status === 'failed' ? 'failed' : 'recorded',
      metadata: { clientName, round, status }
    });
`,
`    const integrityRules = rulesSnapshot || {
      allowedRounds,
      allowedStatuses,
      selectedRound: round,
      selectedStatus: status
    };

    const integrityError = await recordGenerationIntegrity(supabase, {
      generationRunId: data.id,
      eventType: 'generation_run_recorded',
      source: sourceSnapshot,
      template: templateSnapshot,
      manifest,
      output: outputSnapshot,
      rules: integrityRules,
      status: status === 'failed' ? 'failed' : 'recorded',
      metadata: { clientName, round, status }
    });

    const snapshotError = await recordGenerationRunSnapshot(supabase, {
      generationRunId: data.id,
      source: sourceSnapshot,
      template: templateSnapshot,
      rules: integrityRules,
      manifest,
      output: outputSnapshot,
      status: status === 'failed' ? 'failed' : 'recorded',
      metadata: { clientName, round, status }
    });
`, 'snapshot insert');

  c = c.replace("      eventStatus: integrityError ? 'warning' : 'success',", "      eventStatus: integrityError || snapshotError ? 'warning' : 'success',");
  c = c.replace("      safeMessage: integrityError,", "      safeMessage: integrityError || snapshotError,");

  const catchAnchor = `  } catch (error) {
    await logSystemEvent(supabase, {
      requestId,
      routePath: '/api/generation-runs',
      eventType: 'generation_run_create',`;
  if (c.includes(catchAnchor) && !c.includes("phase: 'generation_run_create'")) {
    c = c.replace(catchAnchor, `  } catch (error) {
    await recordGenerationErrorEvent(supabase, {
      requestId,
      routePath: '/api/generation-runs',
      error,
      metadata: { phase: 'generation_run_create' }
    });

    await logSystemEvent(supabase, {
      requestId,
      routePath: '/api/generation-runs',
      eventType: 'generation_run_create',`);
  }

  write(file, removeDuplicateSnapshotDeclarations(c));
}

function patchWorkspace() {
  const file = 'components/LetterGeneratorWorkspaceV2.tsx';
  let c = read(file);

  c = once(c, "  contract_json: unknown;\n};", "  contract_json: unknown;\n  version_number?: number | null;\n  updated_at?: string | null;\n  cache_key?: string | null;\n  file_url?: string | null;\n};", 'registry asset cache fields');

  if (!c.includes('const remoteTemplateBlobCache = new Map')) {
    c = once(c,
`function toTemplateFile(value: Blob, name: string): File {
  if (value instanceof File) return value;
  return new File([value], name, {
    type: value.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now()
  });
}
`,
`function toTemplateFile(value: Blob, name: string): File {
  if (value instanceof File) return value;
  return new File([value], name, {
    type: value.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now()
  });
}

const remoteTemplateBlobCache = new Map<string, Promise<Blob>>();

async function loadCachedTemplateAssetBlob(cacheKey: string, url: string, label: string) {
  const key = cacheKey || url;
  const existing = remoteTemplateBlobCache.get(key);
  if (existing) return existing;

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(` + "`Could not load ${label}: ${await response.text()}`" + `);
      return response.blob();
    })
    .catch((error) => {
      remoteTemplateBlobCache.delete(key);
      throw error;
    });

  remoteTemplateBlobCache.set(key, request);
  return request;
}
`, 'template cache helper');
  }

  c = c.replace("fetch(`/api/template-assets?round=${encodeURIComponent(round)}`)", "fetch(`/api/template-assets/manifest?round=${encodeURIComponent(round)}`)");
  c = once(c,
`      .then((payload) => {
        if (!cancelled) setRegistryAssets(Array.isArray(payload.assets) ? payload.assets : []);
      })`,
`      .then((payload) => {
        const assets = Array.isArray(payload.assets)
          ? payload.assets
          : Array.isArray(payload.manifest?.assets)
            ? payload.manifest.assets
            : [];
        if (!cancelled) setRegistryAssets(assets);
      })`, 'template manifest hydration');

  c = once(c,
"    const response = await fetch(`/api/template-assets/file?round=${encodeURIComponent(round)}&templateKind=EXHIBIT&exhibitKind=${kind}`);\n    if (!response.ok) throw new Error(`Could not load ${kind} template: ${await response.text()}`);\n    return await response.blob();",
"    const url = registryAsset.file_url || `/api/template-assets/file?round=${encodeURIComponent(round)}&templateKind=EXHIBIT&exhibitKind=${kind}`;\n    const cacheKey = registryAsset.cache_key || `${registryAsset.id}:${registryAsset.version_number || 'current'}:${registryAsset.updated_at || ''}`;\n    return await loadCachedTemplateAssetBlob(cacheKey, url, `${kind} template`);", 'exhibit blob cache');

  c = once(c,
"    const response = await fetch(`/api/template-assets/file?round=${encodeURIComponent(round)}&templateKind=LETTER&letterType=${type}`);\n    if (!response.ok) throw new Error(`Could not load ${labels[type]}: ${await response.text()}`);\n    return await response.blob();",
"    const url = registryAsset.file_url || `/api/template-assets/file?round=${encodeURIComponent(round)}&templateKind=LETTER&letterType=${type}`;\n    const cacheKey = registryAsset.cache_key || `${registryAsset.id}:${registryAsset.version_number || 'current'}:${registryAsset.updated_at || ''}`;\n    return await loadCachedTemplateAssetBlob(cacheKey, url, labels[type]);", 'letter blob cache');

  c = once(c,
"      const response = await fetch('/api/generation-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientName: manifest.clientName, round: manifest.round, manifest, status: 'generated' }) });",
`      const response = await fetch('/api/generation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: manifest.clientName,
          round: manifest.round,
          manifest,
          status: 'generated',
          sourceSnapshot: { normalized, length: source.length, routeCount: routes.length, diagnostics: parsed.diagnostics.length },
          templateSnapshot: {
            round,
            localReferences: refs.map((item) => ({ id: item.id, type: item.type, file: Boolean(item.file), contract: Boolean(item.contract) })),
            registryAssets: registryAssets.map((asset) => ({ id: asset.id, slot: asset.cache_key || asset.id, kind: asset.template_kind, letterType: asset.letter_type, exhibitKind: asset.exhibit_kind }))
          },
          rulesSnapshot: { strictValidation: preferences.strictValidation, ftcEnabled: isFtcEnabled(), requiredExhibits: requirements, preflightReady: preflight.ready },
          outputSnapshot: { outputCount: manifest.outputs.length, warningCount: manifest.warnings.length, outputPaths: manifest.outputs.map((item) => item.path) }
        })
      });`, 'generation snapshot persistence payload');

  write(file, c);
}

patchGenerationRunsRoute();
patchWorkspace();
console.log('Phase 14 generation snapshot/cache integration repair complete.');
