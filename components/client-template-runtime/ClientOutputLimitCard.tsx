import type { ClientTemplateOutputLimit } from '../../lib/client-template-runtime';

export default function ClientOutputLimitCard({ outputLimit }: { outputLimit: ClientTemplateOutputLimit }) {
  return <article className="client-template-runtime-card" data-client-output-limit-card="true" data-can-generate={outputLimit.canGenerate ? 'true' : 'false'}>
    <p className="eyebrow">Daily Output Limit</p>
    <strong>{outputLimit.usedToday}/{outputLimit.dailyLimit}</strong>
    <span>{outputLimit.remainingToday} output(s) remaining. Next reset: {new Date(outputLimit.nextResetAt).toLocaleString()}.</span>
  </article>;
}
