import { existsSync, readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { managerRuntimeSourceSyncSnapshot } from '../../../../lib/manager-runtime-source-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const legacyWorkspaceAutowrite = ['apply-manager-workspace-nav', '-wiring.mjs'].join('');
const legacyTemplateAutowrite = ['apply-manager-template-generation', '-wiring.mjs'].join('');

function read(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

export async function GET() {
  const consoleShell = read('components/console/ConsoleShell.tsx');
  const renderDebugger = read('components/console/RenderDebugger.tsx');
  const registry = read('components/console/ui-shell-registry.ts');
  const workspace = read('components/LetterGeneratorWorkspaceV2.tsx');
  const orchestrator = read('lib/template-execution/template-execution-orchestrator.ts');
  const pkg = read('package.json');

  const snapshot = managerRuntimeSourceSyncSnapshot([
    { key: 'console_shell_contract', ok: consoleShell.includes('data-console-shell="true"'), label: 'ConsoleShell owns shell contract' },
    { key: 'console_shell_owns_account_menu', ok: consoleShell.includes('<AccountMenu'), label: 'ConsoleShell owns account menu placement' },
    { key: 'debugger_template_execution_store', ok: renderDebugger.includes('__xdisputerTemplateExecution'), label: 'Render debugger reads template execution store' },
    { key: 'registry_template_execution_signal', ok: registry.includes('templateExecutionStore'), label: 'UI registry declares template execution signal' },
    { key: 'workspace_uses_orchestrator', ok: workspace.includes('executeTemplateGeneration({'), label: 'Client workspace calls TemplateExecutionOrchestrator' },
    { key: 'orchestrator_resolves_manager_templates', ok: orchestrator.includes('ManagerTemplateResolver'), label: 'TemplateExecutionOrchestrator resolves manager template authority' },
    { key: 'orchestrator_publishes_runtime_debug', ok: orchestrator.includes('window.__xdisputerTemplateExecution'), label: 'TemplateExecutionOrchestrator publishes runtime debug snapshot' },
    { key: 'package_no_autowrite_lifecycle', ok: !pkg.includes(legacyWorkspaceAutowrite) && !pkg.includes(legacyTemplateAutowrite), label: 'package lifecycle is verification-only and contains no UI autowrite scripts' },
    { key: 'package_template_execution_guard', ok: pkg.includes('template-execution:guard'), label: 'package lifecycle includes template execution guard' }
  ]);

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'x-manager-switch-contract': snapshot.contractVersion,
      'x-manager-source-sync': snapshot.allPassed ? 'pass' : 'fail'
    }
  });
}
