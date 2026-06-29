-- Output activity per-output workflow metadata.
-- Purpose:
--   - Let client users mark generated letters as payable per-output before generation.
--   - Let managers see all generated outputs, filter payable/non-payable, and confirm only payable outputs.
--   - Keep existing manager_disputer_output_approvals rows and payroll behavior intact.

alter table public.manager_disputer_output_approvals
  add column if not exists generation_run_id uuid null references public.generation_runs(id) on delete set null,
  add column if not exists round_label text null,
  add column if not exists letter_route text null,
  add column if not exists client_name text null,
  add column if not exists is_per_output boolean not null default true;

alter table public.manager_disputer_output_approvals
  drop constraint if exists manager_disputer_output_approvals_status_check;

alter table public.manager_disputer_output_approvals
  add constraint manager_disputer_output_approvals_status_check
  check (status in ('recorded', 'pending', 'approved', 'rejected', 'paid'));

update public.manager_disputer_output_approvals
set is_per_output = true
where is_per_output is null;

create index if not exists manager_output_approvals_pay_filter_idx
  on public.manager_disputer_output_approvals(manager_id, is_per_output, status, created_at desc);

create index if not exists manager_output_approvals_generation_run_idx
  on public.manager_disputer_output_approvals(generation_run_id);

notify pgrst, 'reload schema';
