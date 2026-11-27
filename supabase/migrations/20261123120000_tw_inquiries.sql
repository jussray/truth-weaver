-- Migration: Add tw_inquiries for in-app lead and legal intake
create table if not exists public.tw_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_name text not null,
  contact_email text,
  contact_phone text,
  category text not null default 'general_legal_inquiry',
  jurisdiction text default 'Philadelphia, PA',
  deadline_date date,
  summary text not null,
  urgency text not null default 'normal',
  status text not null default 'new',
  epistemic_status text not null default 'ALLEGED_FACT',
  converted_issue_id uuid references public.issues(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tw_inquiries enable row level security;

create policy "Users can view their own inquiries"
  on public.tw_inquiries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own inquiries"
  on public.tw_inquiries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own inquiries"
  on public.tw_inquiries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own inquiries"
  on public.tw_inquiries for delete
  using (auth.uid() = user_id);
