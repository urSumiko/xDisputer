export default function ManagerTemplateWorkspaceChrome() {
  return <style>{`
    .admin-monitor-main[data-console-header-grid="true"][data-console-has-header="true"] > .manager-template-client-flow.manager-workspace-body-shell {
      grid-column: 1 / -1 !important;
      grid-row: auto !important;
      display: grid !important;
      gap: clamp(0.85rem, 1.2vw, 1.05rem) !important;
      margin: 0 !important;
      padding: 0 !important;
      min-width: 0 !important;
    }
    .manager-template-client-flow {
      display: grid;
      gap: clamp(0.85rem, 1.2vw, 1.05rem);
      min-width: 0;
    }
    .manager-template-client-flow > style {
      display: none !important;
    }
    .merged-template-command {
      min-height: clamp(92px, 7vw, 114px) !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      align-items: center !important;
      gap: 12px !important;
      padding: clamp(18px, 1.6vw, 22px) clamp(20px, 1.8vw, 24px) !important;
      border: 1px solid rgba(203, 213, 225, .86) !important;
      border-radius: 24px !important;
      box-shadow: 0 14px 34px rgba(15, 23, 42, .055) !important;
    }
    .merged-template-command-copy {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .merged-template-command-copy .eyebrow {
      margin: 0;
    }
    .merged-template-command-copy strong {
      display: block;
      color: #0f172a;
      font-size: clamp(24px, 2vw, 32px);
      line-height: 1;
      letter-spacing: -0.055em;
    }
    .merged-template-command-copy span {
      display: block;
      max-width: 780px;
      color: #50627a;
      font-size: 14px;
      line-height: 1.45;
    }
    .manager-workspace-body-shell .templates-progressive-workspace {
      display: grid !important;
      gap: clamp(0.85rem, 1.2vw, 1.05rem) !important;
      min-width: 0 !important;
    }
    .manager-workspace-body-shell .template-selection-stage {
      min-height: 0 !important;
      padding: clamp(22px, 2vw, 28px) !important;
      display: grid !important;
      align-content: start !important;
      gap: clamp(18px, 1.5vw, 24px) !important;
      border: 1px solid rgba(203, 213, 225, .9) !important;
      border-radius: 26px !important;
      box-shadow: 0 14px 34px rgba(15, 23, 42, .052) !important;
      overflow: hidden !important;
    }
    .manager-workspace-body-shell .template-stage-heading {
      max-width: 760px !important;
    }
    .manager-workspace-body-shell .template-stage-heading h2 {
      margin-top: 6px !important;
      font-size: clamp(30px, 3vw, 42px) !important;
    }
    .manager-workspace-body-shell .template-stage-heading p:not(.eyebrow) {
      margin-top: 10px !important;
      max-width: 720px !important;
    }
    .manager-workspace-body-shell .template-round-selection-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(170px, 1fr)) !important;
      gap: clamp(10px, 1vw, 13px) !important;
      min-width: 0 !important;
    }
    .manager-workspace-body-shell .template-round-choice {
      min-height: clamp(124px, 10vw, 146px) !important;
      padding: clamp(16px, 1.4vw, 18px) !important;
      border: 1px solid rgba(203, 213, 225, .95) !important;
      border-radius: 20px !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }
    .manager-workspace-body-shell .template-round-choice.current {
      border-color: rgba(71, 85, 105, .8) !important;
      background: rgba(241, 245, 249, .72) !important;
    }
    .merged-template-command-metrics {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
      align-items: stretch;
    }
    .merged-template-command-metrics > span {
      min-height: 64px;
      display: grid !important;
      align-content: center;
      gap: 4px;
      padding: 11px 12px;
      border: 1px solid #dbe3ef;
      border-radius: 16px;
      background: #f8fafc;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
    }
    .merged-template-command-metrics > span b {
      display: block;
      color: #0f172a;
      font-size: 18px;
      line-height: 1;
      letter-spacing: -0.035em;
    }
    .merged-template-command-metrics > span small {
      display: block;
      color: #5b6f89;
      font-size: 10px;
      font-weight: 850;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    .merged-template-command-metrics .manager-round-chip {
      border-color: #b7ead0;
      background: #effaf4;
    }
    .manager-template-direct-actions {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 8px !important;
    }
    .manager-upload-action {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 14px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #0f172a;
      color: white;
      font-size: 12px;
      font-weight: 850;
      letter-spacing: .02em;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(15, 23, 42, .12);
    }
    .manager-upload-action:hover {
      background: #020617;
      border-color: #020617;
    }
    .manager-upload-action input[type=file],
    .manager-upload-input {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      clip: rect(0 0 0 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
      padding: 0 !important;
      margin: -1px !important;
    }
    .manager-template-direct-actions .remove-node {
      min-height: 38px;
      padding: 0 13px !important;
      border-radius: 12px !important;
      font-size: 12px !important;
      font-weight: 800 !important;
    }
    @media (max-width: 1180px) {
      .merged-template-command {
        grid-template-columns: 1fr !important;
      }
      .merged-template-command-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .manager-workspace-body-shell .template-round-selection-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }
    @media (max-width: 640px) {
      .merged-template-command,
      .manager-workspace-body-shell .template-selection-stage {
        padding: 18px !important;
        border-radius: 20px !important;
      }
      .merged-template-command-metrics,
      .manager-workspace-body-shell .template-round-selection-grid {
        grid-template-columns: 1fr !important;
      }
      .manager-template-direct-actions {
        justify-content: flex-start !important;
      }
    }
  `}</style>;
}
