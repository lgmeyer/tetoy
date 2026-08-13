create table if not exists public.viability_scenarios (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  initial_investment numeric not null check (initial_investment > 0),
  annual_rate numeric not null check (annual_rate >= 0),
  months integer not null check (months between 1 and 600),
  monthly_net_inflow numeric not null check (monthly_net_inflow > 0),
  residual_value numeric not null default 0 check (residual_value >= 0),
  actual_monthly_flows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint viability_scenarios_actual_flows_array
    check (jsonb_typeof(actual_monthly_flows) = 'array')
);

create index if not exists viability_scenarios_created_at_idx
  on public.viability_scenarios (created_at desc);

alter table public.viability_scenarios enable row level security;

drop policy if exists "Public can read viability scenarios" on public.viability_scenarios;
create policy "Public can read viability scenarios"
  on public.viability_scenarios
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create viability scenarios" on public.viability_scenarios;
create policy "Public can create viability scenarios"
  on public.viability_scenarios
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can delete viability scenarios" on public.viability_scenarios;
create policy "Public can delete viability scenarios"
  on public.viability_scenarios
  for delete
  to anon, authenticated
  using (true);

grant select, insert, delete on table public.viability_scenarios to anon, authenticated;
