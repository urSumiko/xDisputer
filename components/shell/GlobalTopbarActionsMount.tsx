import NotificationBell from '../notifications/NotificationBell';
import ClientMenuPopover from './ClientMenuPopover';

export default function GlobalTopbarActionsMount() {
  return <div className="global-topbar-actions-mount" data-global-topbar-actions="true" aria-label="Global account actions">
    <NotificationBell />
    <ClientMenuPopover />
  </div>;
}
