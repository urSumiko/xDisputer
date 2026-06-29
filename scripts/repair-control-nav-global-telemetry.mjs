#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/layout.tsx';
let source = readFileSync(file, 'utf8');
let changed = false;

if (!source.includes("ControlNavGlobalTelemetry from '../components/control/ControlNavGlobalTelemetry'")) {
  source = source.replace(
    "import './professional-console-layout.css';",
    "import './professional-console-layout.css';\nimport ControlNavGlobalTelemetry from '../components/control/ControlNavGlobalTelemetry';"
  );
  changed = true;
  console.log('Repaired control nav telemetry import.');
}

if (!source.includes('<ControlNavGlobalTelemetry />')) {
  source = source.replace(
    '<body>{children}</body>',
    '<body><ControlNavGlobalTelemetry />{children}</body>'
  );
  changed = true;
  console.log('Repaired control nav telemetry mount.');
}

if (changed) writeFileSync(file, source);
else console.log('Control nav global telemetry repair not needed.');
