alter table public.buyers add column if not exists first_name text;
alter table public.buyers add column if not exists last_name text;
alter table public.buyers add column if not exists email text;
alter table public.buyers add column if not exists phone text;
alter table public.buyers add column if not exists city text;
alter table public.buyers add column if not exists state text;
alter table public.buyers add column if not exists application_status text default 'Inquiry';
alter table public.buyers add column if not exists preferred_sex text;
alter table public.buyers add column if not exists preferred_color text;
alter table public.buyers add column if not exists household_notes text;
alter table public.buyers add column if not exists notes text;
alter table public.buyers add column if not exists created_at text;
alter table public.buyers add column if not exists updated_at text;

update public.buyers
set
  first_name = coalesce(
    nullif(first_name, ''),
    split_part(coalesce(nullif(full_name, ''), nullif(name, ''), nullif(email, ''), 'Unknown'), ' ', 1)
  ),
  last_name = coalesce(
    nullif(last_name, ''),
    nullif(trim(regexp_replace(coalesce(nullif(full_name, ''), nullif(name, ''), ''), '^\S+\s*', '')), '')
  ),
  email = coalesce(email, ''),
  application_status = coalesce(nullif(application_status, ''), 'Inquiry'),
  created_at = coalesce(created_at, now()::text),
  updated_at = now()::text;

create index if not exists buyers_email_idx on public.buyers(email);
