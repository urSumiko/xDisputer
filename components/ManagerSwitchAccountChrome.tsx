export default function ManagerSwitchAccountChrome() {
  return <style>{`
    .admin-monitor-account .account-switch-mode {
      width: 100%;
      min-height: 52px;
      display: flex !important;
      align-items: center;
      gap: 10px;
      margin: 12px 0 10px;
      padding: 11px 12px;
      border-radius: 16px;
      color: #eff6ff !important;
      text-decoration: none !important;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      box-shadow: 0 14px 30px rgba(37, 99, 235, .30);
    }
    .admin-monitor-account .account-switch-mode .manager-workspace-switch-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .admin-monitor-account .account-switch-mode .manager-workspace-switch-copy strong {
      font-size: 12px;
      line-height: 1.1;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .admin-monitor-account .account-switch-mode .manager-workspace-switch-copy small {
      color: rgba(239,246,255,.9);
      font-size: 11px;
      line-height: 1.2;
    }
    .admin-monitor-account .account-switch-mode .manager-workspace-switch-arrow {
      color: rgba(239,246,255,.95);
      font-weight: 900;
    }
  `}</style>;
}
