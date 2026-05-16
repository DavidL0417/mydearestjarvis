create unique index if not exists source_candidates_user_dedup_key
on public.source_candidates (user_id, kind, title, due_at, course)
nulls not distinct
where status <> 'dismissed';
