import type { ClientTemplateAssignment } from '../../lib/client-template-runtime';

export default function ClientTemplateAssignmentCard({ assignment }: { assignment: ClientTemplateAssignment }) {
  return <article className="client-template-runtime-card" data-client-template-assignment-card="true" data-assignment-status={assignment.status}>
    <p className="eyebrow">Manager-approved reusable template</p>
    <strong>{assignment.status === 'assigned' ? 'Assigned and connected' : 'Waiting for assignment'}</strong>
    <span>{assignment.blocker || `Round ${assignment.activeRoundLabel} uses the manager-approved template selected for this client.`}</span>
  </article>;
}
