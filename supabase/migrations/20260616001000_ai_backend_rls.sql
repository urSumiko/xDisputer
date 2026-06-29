-- AI Backend RLS Policies
-- Repeatable ownership model: authenticated users only access rows where owner_id = auth.uid().

alter table public.ai_requests enable row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_documents enable row level security;
alter table public.ai_chunks enable row level security;
alter table public.ai_jobs enable row level security;

drop policy if exists "Users can read own ai requests" on public.ai_requests;
drop policy if exists "Users can insert own ai requests" on public.ai_requests;
drop policy if exists "Users can update own ai requests" on public.ai_requests;
drop policy if exists "Users can read own ai action logs" on public.ai_tool_calls;
drop policy if exists "Users can insert own ai action logs" on public.ai_tool_calls;
drop policy if exists "Users can manage own ai documents" on public.ai_documents;
drop policy if exists "Users can manage own ai chunks" on public.ai_chunks;
drop policy if exists "Users can read own ai jobs" on public.ai_jobs;
drop policy if exists "Users can create own ai jobs" on public.ai_jobs;

create policy "Users can read own ai requests" on public.ai_requests for select using (auth.uid() = owner_id);
create policy "Users can insert own ai requests" on public.ai_requests for insert with check (auth.uid() = owner_id);
create policy "Users can update own ai requests" on public.ai_requests for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Users can read own ai action logs" on public.ai_tool_calls for select using (auth.uid() = owner_id);
create policy "Users can insert own ai action logs" on public.ai_tool_calls for insert with check (auth.uid() = owner_id);

create policy "Users can manage own ai documents" on public.ai_documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users can manage own ai chunks" on public.ai_chunks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Users can read own ai jobs" on public.ai_jobs for select using (auth.uid() = owner_id);
create policy "Users can create own ai jobs" on public.ai_jobs for insert with check (auth.uid() = owner_id);

notify pgrst, 'reload schema';
