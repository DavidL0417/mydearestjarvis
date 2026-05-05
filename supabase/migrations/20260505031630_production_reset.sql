create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  timezone text not null default 'America/Chicago',
  sleep_pattern text,
  peak_energy_window text,
  procrastination_pattern text,
  workday_start time not null default '09:00',
  workday_end time not null default '17:00',
  default_task_duration_minutes integer not null default 50 check (default_task_duration_minutes > 0),
  break_duration_minutes integer not null default 10 check (break_duration_minutes >= 0),
  preferred_focus_block_minutes integer check (preferred_focus_block_minutes is null or preferred_focus_block_minutes > 0),
  preferred_checkin_mode text not null default 'quiet' check (preferred_checkin_mode in ('silent', 'quiet', 'gentle', 'active')),
  calendar_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_key text not null,
  name text not null,
  color text not null default '#9ca3af',
  source text not null default 'local' check (source in ('local', 'google', 'imported', 'task')),
  google_calendar_id text,
  remote_name text,
  is_visible boolean not null default true,
  is_immutable boolean not null default false,
  sync_preference text not null default 'active' check (sync_preference in ('active', 'pending', 'ignored')),
  is_task_calendar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, calendar_key)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  deadline timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'scheduled', 'completed', 'missed')),
  scheduled_for timestamptz,
  is_immutable boolean not null default false,
  all_day boolean not null default false,
  calendar_id text,
  tags text[] not null default '{}'::text[],
  source_snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  calendar_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'task' check (source in ('task', 'calendar', 'focus')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text check (status in ('todo', 'scheduled', 'completed', 'missed')),
  location text,
  external_event_id text,
  gcal_event_id text,
  last_synced_from text not null default 'local' check (last_synced_from in ('local', 'gcal')),
  is_immutable boolean not null default false,
  is_checked_in boolean not null default false,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  event_id uuid references public.schedule_events(id) on delete set null,
  mood text check (mood in ('good', 'okay', 'stuck')),
  energy text check (energy in ('low', 'medium', 'high')),
  outcome text not null default 'partial' check (outcome in ('completed', 'missed', 'partial')),
  note text,
  blockers text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_account_email text,
  provider_user_id text,
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'disconnected', 'error')),
  selected_calendar_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table app_private.integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.assistant_tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  tool_name text not null,
  status text not null check (status in ('completed', 'clarification', 'error', 'pending_approval')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'observation' check (kind in ('preference', 'task_context', 'source_observation', 'candidate', 'observation', 'rule')),
  category text not null default 'general',
  content text not null,
  importance text not null default 'medium' check (importance in ('low', 'medium', 'high', 'critical')),
  importance_note text,
  confidence numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_label text not null default 'manual',
  source_ref text,
  status text not null default 'active' check (status in ('active', 'candidate', 'stale', 'superseded', 'archived')),
  supersedes_id uuid references public.memory_items(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('notion', 'gmail', 'caldav', 'google_calendar', 'manual', 'system')),
  source_ref text,
  captured_at timestamptz not null default now(),
  freshness text not null default 'fresh' check (freshness in ('fresh', 'partial', 'stale', 'failed')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor text not null default 'assistant' check (actor in ('user', 'assistant', 'system')),
  action text not null,
  target_table text,
  target_id uuid,
  summary text not null,
  before_value jsonb,
  after_value jsonb,
  source_label text,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_source_snapshot_id_fkey
  foreign key (source_snapshot_id) references public.source_snapshots(id) on delete set null;

create index profiles_email_idx on public.profiles(email);
create index preferences_user_id_idx on public.preferences(user_id);
create index calendars_user_id_idx on public.calendars(user_id);
create unique index calendars_user_google_calendar_id_idx on public.calendars(user_id, google_calendar_id) where google_calendar_id is not null;
create unique index calendars_user_task_calendar_idx on public.calendars(user_id) where is_task_calendar = true;
create index tasks_user_id_idx on public.tasks(user_id);
create index tasks_deadline_idx on public.tasks(deadline);
create index schedule_events_user_id_idx on public.schedule_events(user_id);
create index schedule_events_task_id_idx on public.schedule_events(task_id);
create index schedule_events_time_idx on public.schedule_events(user_id, starts_at, ends_at);
create unique index schedule_events_user_gcal_event_id_idx on public.schedule_events(user_id, gcal_event_id) where gcal_event_id is not null;
create unique index schedule_events_user_task_source_key on public.schedule_events(user_id, task_id, source) where task_id is not null and source = 'task';
create index checkins_user_id_idx on public.checkins(user_id);
create index integrations_user_id_idx on public.integrations(user_id);
create index assistant_threads_user_id_idx on public.assistant_threads(user_id);
create index assistant_messages_thread_id_idx on public.assistant_messages(thread_id);
create index assistant_tool_runs_user_id_idx on public.assistant_tool_runs(user_id);
create index memory_items_user_status_idx on public.memory_items(user_id, status);
create index source_snapshots_user_source_idx on public.source_snapshots(user_id, source, captured_at desc);
create index change_logs_user_id_idx on public.change_logs(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.calendars enable row level security;
alter table public.tasks enable row level security;
alter table public.schedule_events enable row level security;
alter table public.checkins enable row level security;
alter table public.integrations enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_tool_runs enable row level security;
alter table public.memory_items enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.change_logs enable row level security;
alter table app_private.integration_tokens enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy preferences_select_own on public.preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy preferences_insert_own on public.preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy preferences_update_own on public.preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preferences_delete_own on public.preferences for delete to authenticated using ((select auth.uid()) = user_id);

create policy calendars_select_own on public.calendars for select to authenticated using ((select auth.uid()) = user_id);
create policy calendars_insert_own on public.calendars for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendars_update_own on public.calendars for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendars_delete_own on public.calendars for delete to authenticated using ((select auth.uid()) = user_id);

create policy tasks_select_own on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks for update to authenticated using ((select auth.uid()) = user_id and is_immutable = false) with check ((select auth.uid()) = user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated using ((select auth.uid()) = user_id and is_immutable = false);

create policy schedule_events_select_own on public.schedule_events for select to authenticated using ((select auth.uid()) = user_id);
create policy schedule_events_insert_own on public.schedule_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy schedule_events_update_own on public.schedule_events for update to authenticated using ((select auth.uid()) = user_id and is_immutable = false) with check ((select auth.uid()) = user_id);
create policy schedule_events_delete_own on public.schedule_events for delete to authenticated using ((select auth.uid()) = user_id and is_immutable = false);

create policy checkins_select_own on public.checkins for select to authenticated using ((select auth.uid()) = user_id);
create policy checkins_insert_own on public.checkins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy checkins_update_own on public.checkins for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy checkins_delete_own on public.checkins for delete to authenticated using ((select auth.uid()) = user_id);

create policy integrations_select_own on public.integrations for select to authenticated using ((select auth.uid()) = user_id);
create policy integrations_insert_own on public.integrations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy integrations_update_own on public.integrations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy integrations_delete_own on public.integrations for delete to authenticated using ((select auth.uid()) = user_id);

create policy assistant_threads_select_own on public.assistant_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy assistant_threads_insert_own on public.assistant_threads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assistant_threads_update_own on public.assistant_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assistant_threads_delete_own on public.assistant_threads for delete to authenticated using ((select auth.uid()) = user_id);

create policy assistant_messages_select_own on public.assistant_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy assistant_messages_insert_own on public.assistant_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assistant_messages_update_own on public.assistant_messages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assistant_messages_delete_own on public.assistant_messages for delete to authenticated using ((select auth.uid()) = user_id);

create policy assistant_tool_runs_select_own on public.assistant_tool_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy assistant_tool_runs_insert_own on public.assistant_tool_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assistant_tool_runs_update_own on public.assistant_tool_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assistant_tool_runs_delete_own on public.assistant_tool_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy memory_items_select_own on public.memory_items for select to authenticated using ((select auth.uid()) = user_id);
create policy memory_items_insert_own on public.memory_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy memory_items_update_own on public.memory_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy memory_items_delete_own on public.memory_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy source_snapshots_select_own on public.source_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy source_snapshots_insert_own on public.source_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy source_snapshots_update_own on public.source_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy source_snapshots_delete_own on public.source_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create policy change_logs_select_own on public.change_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy change_logs_insert_own on public.change_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy change_logs_update_own on public.change_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy change_logs_delete_own on public.change_logs for delete to authenticated using ((select auth.uid()) = user_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.preferences for each row execute function public.set_updated_at();
create trigger calendars_set_updated_at before update on public.calendars for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger schedule_events_set_updated_at before update on public.schedule_events for each row execute function public.set_updated_at();
create trigger integrations_set_updated_at before update on public.integrations for each row execute function public.set_updated_at();
create trigger assistant_threads_set_updated_at before update on public.assistant_threads for each row execute function public.set_updated_at();
create trigger memory_items_set_updated_at before update on public.memory_items for each row execute function public.set_updated_at();
create trigger integration_tokens_set_updated_at before update on app_private.integration_tokens for each row execute function public.set_updated_at();
