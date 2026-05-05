# Backend Schema And Migration Policy

## Source Of Truth

- Supabase migrations in `supabase/migrations` are authoritative.
- Do not apply manual SQL that is not represented by a migration.
- `sql/schema.sql`, if regenerated, is a snapshot/reference artifact only.

## Security

- Every public table must have RLS enabled.
- User-owned public rows must be scoped to `auth.uid()`.
- OAuth tokens and provider secrets belong in `app_private`, not public tables.
- Public integration rows may expose connection metadata only: provider, account email, status, selected calendar, and sync timestamps.

## Production V1 Tables

- Public: `profiles`, `preferences`, `calendars`, `tasks`, `schedule_events`, `checkins`, `integrations`, `assistant_threads`, `assistant_messages`, `assistant_tool_runs`, `memory_items`, `source_snapshots`, `change_logs`.
- Private: `app_private.integration_tokens`.

## Calendar Source Of Truth

- `schedule_events` is the canonical app event store.
- Imported Google events are mirrored into `schedule_events`.
- JARVIS-created task/focus blocks are persisted first, then synced outward when Google is connected.
