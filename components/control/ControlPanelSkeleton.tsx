export default function ControlPanelSkeleton({ label = 'Loading console panel' }: { label?: string }) {
  return <section className="control-panel-skeleton" aria-label={label} aria-busy="true">
    <div className="hero" />
    <div className="metrics">
      <div className="metric" />
      <div className="metric" />
      <div className="metric" />
      <div className="metric" />
    </div>
    <div className="card" />
  </section>;
}
