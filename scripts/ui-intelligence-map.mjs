#!/usr/bin/env node
const graph = {
  generatedAt: new Date().toISOString(),
  propagationGroups: {
    'console-global': {
      contracts: ['console-shell', 'console-header', 'account-menu', 'sidebar-switch-mode', 'render-debugger'],
      routes: ['/admin', '/admin/*', '/manager-workspace', '/manager-workspace/*', '/master', '/master/*'],
      guards: ['npm run ui-intelligence:guard', 'npm run console-shell:guard', 'npm run ui-shell:smoke']
    },
    'template-domain': {
      contracts: ['template-execution'],
      routes: ['/manager-workspace', '/manager-workspace/*'],
      guards: ['npm run template-execution:guard', 'npm run manager-template:roadmap']
    }
  },
  rule: 'Update registry first, generate propagation plan second, change source third, run guards fourth.'
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(graph, null, 2));
} else {
  console.log('UI Intelligence Map');
  Object.entries(graph.propagationGroups).forEach(([group, value]) => {
    console.log(`\n${group}`);
    console.log(`  contracts: ${value.contracts.join(', ')}`);
    console.log(`  routes: ${value.routes.join(', ')}`);
    console.log(`  guards: ${value.guards.join(' && ')}`);
  });
  console.log(`\nRule: ${graph.rule}`);
}
