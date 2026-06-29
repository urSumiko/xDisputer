#!/usr/bin/env node
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY_ENV = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function needArg(name, fallback = '') {
  const value = getArg(name, fallback);
  if (!value) {
    console.error(`Missing required argument: ${name}`);
    process.exit(1);
  }
  return value;
}

function needEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function readSummary() {
  try {
    return JSON.parse(getArg('--summary', '{}'));
  } catch (error) {
    console.error(`Invalid --summary JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function groupRows(rows) {
  const grouped = {};
  for (const row of rows) {
    const key = `${row.environment}:${row.group_key}`;
    grouped[key] ||= [];
    grouped[key].push(row);
  }
  return grouped;
}

const mode = process.argv[2];
if (!mode) {
  console.error('Usage: node scripts/mcoder-deployment-gate.mjs <request|pending|approve|reject|cancel|check|consume>');
  process.exit(1);
}

const supabase = createClient(needEnv('NEXT_PUBLIC_SUPABASE_URL'), needEnv(SERVICE_KEY_ENV), {
  auth: { persistSession: false, autoRefreshToken: false }
});

if (mode === 'request') {
  const { data, error } = await supabase.rpc('request_deployment_approval_service', {
    p_group_key: needArg('--group', 'default'),
    p_commit_sha: needArg('--sha', process.env.GITHUB_SHA || ''),
    p_ref_name: needArg('--ref', process.env.GITHUB_REF_NAME || 'local'),
    p_environment: needArg('--environment'),
    p_requested_by_email: needArg('--requested-by'),
    p_summary: readSummary()
  });
  if (error) throw new Error(error.message);
  printJson(data);
  process.exit(0);
}

if (mode === 'pending') {
  const { data, error } = await supabase
    .from('deployment_requests')
    .select('id,group_key,environment,commit_sha,ref_name,requested_by_email,status,requested_at,reviewed_by_email,review_comment')
    .eq('status', getArg('--status', 'pending'))
    .order('environment', { ascending: true })
    .order('group_key', { ascending: true })
    .order('requested_at', { ascending: false });
  if (error) throw new Error(error.message);
  printJson(groupRows(data ?? []));
  process.exit(0);
}

if (mode === 'approve' || mode === 'reject' || mode === 'cancel') {
  const decision = mode === 'approve' ? 'approved' : mode === 'reject' ? 'rejected' : 'cancelled';
  const { data, error } = await supabase.rpc('review_deployment_approval_service', {
    p_request_id: needArg('--request-id'),
    p_decision: decision,
    p_reviewed_by_email: needArg('--reviewed-by'),
    p_comment: getArg('--comment', '')
  });
  if (error) throw new Error(error.message);
  printJson(data);
  process.exit(0);
}

if (mode === 'check') {
  const { data, error } = await supabase.rpc('assert_deployment_approval_service', {
    p_request_id: needArg('--request-id'),
    p_commit_sha: needArg('--sha', process.env.GITHUB_SHA || ''),
    p_environment: needArg('--environment')
  });
  if (error) throw new Error(error.message);
  printJson(data);
  process.exit(data?.approved ? 0 : 1);
}

if (mode === 'consume') {
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '';
  const { data, error } = await supabase.rpc('consume_deployment_approval_service', {
    p_request_id: needArg('--request-id'),
    p_commit_sha: needArg('--sha', process.env.GITHUB_SHA || ''),
    p_environment: needArg('--environment'),
    p_workflow_run_id: Number(needArg('--run-id', process.env.GITHUB_RUN_ID || '0')),
    p_workflow_url: getArg('--run-url', runUrl)
  });
  if (error) throw new Error(error.message);
  printJson(data);
  process.exit(0);
}

console.error(`Unknown mode: ${mode}`);
process.exit(1);
