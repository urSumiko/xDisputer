type ManagerSummary = {
  clients: number;
  pending: number;
  active: number;
};

export default function ManagerKpiGrid({ summary, outputToday }: { summary: ManagerSummary; outputToday: number }) {
  return <section className="manager-console-kpi-grid"><article><span>Assigned users</span><strong>{summary.clients}</strong><small>Manager scope</small></article><article><span>Pending requests</span><strong>{summary.pending}</strong><small>Need confirmation</small></article><article><span>Active users</span><strong>{summary.active}</strong><small>Can generate outputs</small></article><article><span>Outputs today</span><strong>{outputToday}</strong><small>Visible active sample</small></article></section>;
}
