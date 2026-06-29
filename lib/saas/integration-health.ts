export type IntegrationHealthStatus = 'connected' | 'missing' | 'warning';

export type IntegrationHealthItem = {
  id: 'supabase' | 'vercel' | 'github';
  label: string;
  status: IntegrationHealthStatus;
  detail: string;
  configured: boolean;
};

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim());
}

export function getStaticIntegrationHealth(): IntegrationHealthItem[] {
  const supabaseConfigured = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL) && hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const vercelConfigured = hasValue(process.env.VERCEL) || hasValue(process.env.NEXT_PUBLIC_SITE_URL);
  const githubConfigured = hasValue(process.env.GITHUB_REPOSITORY) || hasValue(process.env.GITHUB_REPOSITORY_FULL_NAME);

  return [
    {
      id: 'supabase',
      label: 'Supabase',
      status: supabaseConfigured ? 'connected' : 'missing',
      detail: supabaseConfigured ? 'Auth and database environment variables are configured.' : 'Set Supabase project URL and anon key.',
      configured: supabaseConfigured
    },
    {
      id: 'vercel',
      label: 'Vercel',
      status: vercelConfigured ? 'connected' : 'missing',
      detail: vercelConfigured ? 'Site/deployment environment is configured.' : 'Connect the GitHub repo to Vercel and set the site URL.',
      configured: vercelConfigured
    },
    {
      id: 'github',
      label: 'GitHub',
      status: githubConfigured ? 'connected' : 'warning',
      detail: githubConfigured ? 'Repository metadata is available.' : 'Repository metadata is not exposed in this runtime.',
      configured: githubConfigured
    }
  ];
}
