type MasterSummary = {
  total: number;
  managers: number;
  pending: number;
};

export default function MasterKpiGrid({ summary, attentionTotal }: { summary: MasterSummary; attentionTotal: number }) {
  return <section className="admin-monitor-stats master-monitoring-stats" aria-label="Monitoring metrics"><article><p>Total users</p><strong>{summary.total}</strong></article><article><p>Managers</p><strong>{summary.managers}</strong></article><article><p>Pending clients</p><strong>{summary.pending}</strong></article><article><p>Attention</p><strong>{attentionTotal}</strong></article></section>;
}
