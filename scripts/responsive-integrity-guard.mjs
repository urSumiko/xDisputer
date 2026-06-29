#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
const failures=[];
function read(path){if(!existsSync(path)){failures.push(`Missing required file: ${path}`);return '';}return readFileSync(path,'utf8');}
function has(path,term){const source=read(path);if(source&&!source.includes(term))failures.push(`${path} must include ${term}`);}
function hasInAny(paths,term,label=term){const sources=paths.map((path)=>[path,read(path)]);if(!sources.some(([,source])=>source.includes(term)))failures.push(`${paths.join(' or ')} must include ${label}`);}
function notHas(path,term){const source=read(path);if(source&&source.includes(term))failures.push(`${path} must not include ${term}`);}
has('app/layout.tsx',"import './final-responsive-integrity.css';");
has('app/final-responsive-integrity.css','--xdisputer-responsive-integrity');
has('app/final-responsive-integrity.css','--client-sidebar-width');
has('app/final-responsive-integrity.css','overflow-x:clip');
has('app/final-responsive-integrity.css','@media(max-width:980px)');
has('app/final-responsive-integrity.css','@media(max-width:760px)');
has('app/final-responsive-integrity.css','.admin-monitor-page.native-console');
has('app/final-responsive-integrity.css','.app-shell');
has('app/final-responsive-integrity.css','.app-shell>.main-area');
has('app/final-responsive-integrity.css','.saas-auth-form');
has('app/final-responsive-integrity.css','.client-template-runtime-grid');
has('app/final-responsive-integrity.css','.dynamic-template-rule-layout');
hasInAny(['app/final-responsive-integrity.css','app/ui-collapse-recovery.css','app/master-directory-fix.css'],'.directory-filter-form');
hasInAny(['app/final-responsive-integrity.css','app/ui-collapse-recovery.css','app/master-directory-fix.css'],'.access-workflow-grid');
has('app/globals.css','--sidebar-collapsed');
has('app/globals.css','--duration-fast');
has('app/globals.css','--radius-lg');
has('app/globals.css','box-sizing');
has('components/console/RenderDebugger.tsx','detectHorizontalOverflow');
has('components/console/RenderDebugger.tsx','largestOverflowSelector');
has('components/console/RenderDebugger.tsx','finalResponsiveIntegrityLoaded');
has('components/console/RenderDebugger.tsx','ClientWorkspaceShell');
has('components/console/RenderDebugger.tsx','findClientWorkspaceShell');
has('lib/ui-intelligence/registry.ts','master-console-integrity');
has('lib/ui-intelligence/registry.ts','manager-console-integrity');
has('lib/ui-intelligence/registry.ts','manager-template-workspace-integrity');
has('lib/ui-intelligence/registry.ts','client-workspace-integrity');
has('lib/ui-intelligence/registry.ts','client-template-handoff');
has('lib/ui-intelligence/registry.ts','auth-interface-integrity');
has('package.json','responsive:guard');
notHas('app/final-responsive-integrity.css','min-width:1200px');
notHas('app/final-responsive-integrity.css','width:1600px');
if(failures.length){console.error('\nResponsive integrity guard failed.');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Responsive integrity guard passed.');