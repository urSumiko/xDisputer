export type ClientDashboardSurface = {
  primaryTitle: string;
  primarySubtitle: string;
  entitlementSurface: 'retired';
  headerEntitlementSurface: 'retired';
  accountSurface: 'canonical-account-dock';
};

export const clientDashboardSurface: ClientDashboardSurface = {
  primaryTitle: 'Continue active packet',
  primarySubtitle: 'Resume the active packet workflow from the dashboard command card.',
  entitlementSurface: 'retired',
  headerEntitlementSurface: 'retired',
  accountSurface: 'canonical-account-dock'
};

export function explainClientDashboardSurface() {
  return 'Client dashboard and header limit surfaces are retired. Account actions live in the canonical account dock.';
}
