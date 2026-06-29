import { NextResponse } from 'next/server';
import { getSessionContext } from '../../../lib/saas/session';

export async function GET() {
  const session = await getSessionContext();

  if (!session.user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      profile: null,
      role: null,
      isMaster: false,
      isManager: false,
      isAdmin: false,
      isClient: false,
      managerId: null,
      managerInviteCode: null,
      dashboard: null
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email
    },
    profile: session.profile,
    role: session.role,
    isMaster: session.isMaster,
    isManager: session.isManager,
    isAdmin: session.isAdmin,
    isClient: session.isClient,
    managerId: session.profile?.manager_id || null,
    managerInviteCode: session.profile?.manager_invite_code || null,
    dashboard: session.dashboardPath
  });
}
