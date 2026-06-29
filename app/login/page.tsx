import Link from 'next/link';

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next || '/dashboard';
  const error = params?.error;
  const message = params?.message;

  return (
    <main className="saas-auth-page native-auth-page" data-auth-surface="sign-in">
      <section className="saas-auth-panel native-auth-card" aria-label="Sign in to xDisputer">
        <Link href="/" className="saas-auth-home-link">← Back to xDisputer</Link>

        <div className="saas-auth-brand native-auth-brand">
          <span className="saas-auth-logo">xD</span>
          <div>
            <p className="saas-auth-eyebrow">Secure account access</p>
            <h1>Welcome back.</h1>
          </div>
        </div>

        <p className="saas-auth-copy">
          Continue into your protected document operations workspace with a verified xDisputer session.
        </p>

        <div className="saas-auth-status-row" aria-label="Security highlights">
          <span>Role-aware routing</span>
          <span>Protected session</span>
          <span>Native workspace</span>
        </div>

        {error && <div className="saas-auth-alert error">{error}</div>}
        {message && <div className="saas-auth-alert success">{message}</div>}

        <form action="/auth/sign-in" method="post" className="saas-auth-form native-auth-form">
          <input type="hidden" name="next" value={next} />

          <label>
            <span>Email address</span>
            <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" required placeholder="Enter your password" autoComplete="current-password" />
          </label>

          <button type="submit">Sign in to workspace</button>
        </form>

        <p className="saas-auth-switch">
          New to xDisputer? <Link href="/signup">Create an account</Link>
        </p>
      </section>

      <aside className="saas-auth-hero native-auth-hero" aria-label="xDisputer workspace preview">
        <p className="saas-auth-eyebrow">Document operations platform</p>
        <h2>One secure entry point for packets, templates, source data, and filing workflows.</h2>

        <div className="saas-auth-feature-grid native-auth-feature-grid">
          <div>
            <strong>Manager console</strong>
            <span>Approve clients, monitor cases, and manage output workflows.</span>
          </div>
          <div>
            <strong>Client workspace</strong>
            <span>Access packet workflows through a clean approval-gated experience.</span>
          </div>
          <div>
            <strong>Native design</strong>
            <span>Matches the rounded, high-contrast xDisputer console system.</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
