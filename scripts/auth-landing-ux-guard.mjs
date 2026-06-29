#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
function read(path) {
  if (!existsSync(path)) {
    failures.push(`missing ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}
function must(source, marker, label) {
  if (!source.includes(marker)) failures.push(label);
}
function mustNot(source, marker, label) {
  if (source.includes(marker)) failures.push(label);
}

const landing = read('app/page.tsx');
const login = read('app/login/page.tsx');
const signup = read('app/signup/page.tsx');
const authCss = read('app/saas-auth-center.css');
const publicCss = read('app/saas-public.css');

must(landing, 'saas-public-actions', 'landing page must keep one top navigation auth action group');
must(landing, 'saas-public-flow-summary', 'landing hero must use non-clickable workflow summary instead of duplicate auth buttons');
mustNot(landing, 'saas-public-cta', 'landing page must not render duplicate hero auth CTA buttons');

must(login, 'native-auth-page', 'login page must use native auth page shell');
must(login, 'native-auth-card', 'login page must use native auth card');
must(login, 'native-auth-hero', 'login page must keep hero markup available for future responsive previews');
must(login, 'Sign in to workspace', 'login primary action must be explicit and workspace-oriented');

must(signup, 'native-auth-page', 'signup page must use native auth page shell');
must(signup, 'native-auth-card', 'signup page must use native auth card');
must(signup, 'native-auth-hero', 'signup page must keep hero markup available for future responsive previews');
must(signup, 'Create secure account', 'signup primary action must be explicit and secure');

must(authCss, '--native-auth-centered-card-max: 560px', 'auth CSS must define centered auth card max width');
must(authCss, 'grid-template-columns: minmax(0, var(--native-auth-centered-card-max))', 'auth CSS must center login/signup as single-card layout');
must(authCss, 'place-content: center !important', 'auth CSS must center the auth card on the page');
must(authCss, '.saas-auth-page[data-auth-surface="sign-in"] .saas-auth-hero', 'auth CSS must scope sign-in hero retirement');
must(authCss, '.saas-auth-page[data-auth-surface="sign-up"] .saas-auth-hero', 'auth CSS must scope sign-up hero retirement');
must(authCss, 'display: none !important', 'auth CSS must hide auth side hero for centered login/signup');
must(authCss, '.saas-auth-status-row', 'auth CSS must style native status row');
must(publicCss, '.saas-public-cta{display:none!important}', 'public CSS must hard-retire duplicate hero CTA styling');
must(publicCss, '.saas-public-flow-summary', 'public CSS must style non-clickable workflow summary');

if (failures.length) {
  console.error(`auth-landing-ux-guard failed: ${failures.length} check(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('auth-landing-ux-guard: ok');
