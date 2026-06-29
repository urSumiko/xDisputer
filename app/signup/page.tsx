import Link from 'next/link';

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; message?: string; invite?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const message = params?.message;
  const invite = params?.invite || '';

  return (
    <main className="saas-auth-page native-auth-page" data-auth-surface="sign-up">
      <section className="saas-auth-panel native-auth-card" aria-label="Create xDisputer account">
        <Link href="/" className="saas-auth-home-link">← Back to xDisputer</Link>

        <div className="saas-auth-brand native-auth-brand">
          <span className="saas-auth-logo">xD</span>
          <div>
            <p className="saas-auth-eyebrow">Approval-gated onboarding</p>
            <h1>{invite ? 'Join your manager.' : 'Create your account.'}</h1>
          </div>
        </div>

        <p className="saas-auth-copy">
          {invite
            ? 'Use your manager invite to create a secure account. Workspace access unlocks after approval.'
            : 'Create your secure account first. A manager invite and approval are required before workspace access unlocks.'}
        </p>

        <div className="saas-auth-status-row" aria-label="Onboarding steps">
          <span>Create account</span>
          <span>Manager approval</span>
          <span>Workspace access</span>
        </div>

        {error && <div className="saas-auth-alert error">{error}</div>}
        {message && <div className="saas-auth-alert success">{message}</div>}

        <form action="/auth/sign-up" method="post" className="saas-auth-form native-auth-form">
          <input type="hidden" name="invite" value={invite} />

          <label>
            <span>Full name</span>
            <input name="fullName" type="text" required placeholder="Client full name" autoComplete="name" />
          </label>

          <label>
            <span>Email address</span>
            <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" required minLength={8} placeholder="Minimum 8 characters" autoComplete="new-password" />
          </label>

          <button type="submit">Create secure account</button>
        </form>

        <p className="saas-auth-switch">
          Already have an account? <Link href="/login?next=/account-pending">Sign in</Link>
        </p>
      </section>

      <aside className="saas-auth-hero native-auth-hero" aria-label="xDisputer onboarding preview">
        <p className="saas-auth-eyebrow">Client access control</p>
        <h2>Account creation is clean, protected, and approval-aware before entering the workspace.</h2>

        <div className="saas-auth-feature-grid native-auth-feature-grid">
          <div>
            <strong>Invite aware</strong>
            <span>Clients can join through a manager invite link.</span>
          </div>
          <div>
            <strong>Approval gated</strong>
            <span>New users wait until manager approval unlocks access.</span>
          </div>
          <div>
            <strong>Workspace ready</strong>
            <span>Approved users enter the native xDisputer packet workflow.</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
