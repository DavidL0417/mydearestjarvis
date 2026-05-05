drop index if exists public.schedule_events_user_gcal_event_id_idx;
drop index if exists public.schedule_events_user_task_source_key;

create unique index schedule_events_user_gcal_event_id_idx
  on public.schedule_events(user_id, gcal_event_id);

create unique index schedule_events_user_task_source_key
  on public.schedule_events(user_id, task_id, source);
