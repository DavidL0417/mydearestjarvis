# Cindy Worklog

## Log

### 2026-04-12 11:45 CDT

- Found why the live queue was stuck at exactly 2 items in [`app/page.tsx`](./../app/page.tsx): those were the only two seed tasks with `NULL` deadlines, so they were the only rows surviving the import into `/api/tasks`.
- Normalized seed-task deadlines to UTC ISO strings before posting them to the task-create API; the rest of the seed rows were previously being rejected because the importer was forwarding raw `-05:00` offset strings into a schema path that expects normalized datetimes.
- Root cause: queue-source mismatch was already fixed, but the seed-to-live importer still had a payload-format bug, so only undated seed tasks ever became live DB tasks.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the deadline normalization fix.
- Next step: reload the dashboard so the remaining 18 seed tasks get imported into the live queue instead of only the two no-deadline tasks.

### 2026-04-12 11:36 CDT

- Fixed the actual queue-source mismatch across [`components/dashboard/task-queue-popover.tsx`](./../components/dashboard/task-queue-popover.tsx), [`components/dashboard/schedule-view.tsx`](./../components/dashboard/schedule-view.tsx), [`components/dashboard/master-input.tsx`](./../components/dashboard/master-input.tsx), and [`app/page.tsx`](./../app/page.tsx): the schedule-side popover now renders the same live `Task[]` data as Master Input instead of the static `sql/seed_demo_data.sql` preview.
- Renamed the popover copy from `Demo Tasks / Seed task queue` to `Live Tasks / Task queue` so the UI no longer implies the static seed file is the live task database.
- Root cause: the right-side queue was still bound to seed-file data while the left-side assistant intro was correctly bound to the real DB-backed task list, which produced the contradictory `2 live tasks` vs `20 seed tasks` state.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after switching the queue popover to live task data.
- Next step: refresh the dashboard and confirm the queue count now matches the assistant’s live-task count instead of the old seed preview count.

### 2026-04-12 11:24 CDT

- Replaced the brittle one-shot demo-task hydration gate in [`app/page.tsx`](./../app/page.tsx): the dashboard now reconciles the seeded demo queue against the actual live task list by title/deadline and imports only missing items, instead of trusting a stale browser `localStorage` flag.
- Added a per-session attempted-import guard so failed demo-task rows do not loop forever on every render, while valid missing demo tasks still get promoted into the real task table for Master Input / scheduling.
- Root cause: the previous `jarvis-demo-tasks-hydrated-v1` browser flag could stay `true` even when the DB-backed task list was still empty, which left the UI showing the seed queue while the assistant kept seeing no actual tasks.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the hydration reconciliation fix.
- Next step: reload the dashboard; missing seed tasks should be imported into the live task list again even if an earlier session already set the old hydration flag.

### 2026-04-12 11:02 CDT

- Fixed the deeper demo-queue mismatch in [`app/page.tsx`](./../app/page.tsx): when the live task table is empty but the seeded demo queue exists, the dashboard now hydrates those seeded items through the real `/api/tasks` path once and reloads from the actual task list.
- This turns the schedule popover’s 20 demo tasks into real dashboard tasks so `MasterInput`, scheduling, and task tools stop disagreeing about whether work exists.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the demo-task hydration pass.
- Next step: hard refresh the dashboard and confirm the assistant no longer reports an empty queue after the live task list has been populated from the seed set.

### 2026-04-12 10:47 CDT

- Fixed the left-side secretary context mismatch in [`components/dashboard/master-input.tsx`](./../components/dashboard/master-input.tsx) and [`app/page.tsx`](./../app/page.tsx): the initial assistant state now derives its queue summary from the same live tasks / seeded demo tasks that power the schedule surface instead of defaulting to a generic empty intro.
- Wired `MasterInput` to receive `tasks` and `seedDemoTasks` from the dashboard shell so demo-task mode and real task mode stay visually consistent.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the task-context sync fix.
- Next step: visually confirm the master-input intro now references the seeded queue on desktop/mobile and no longer implies the queue is empty when the task popover shows demo items.

### 2026-04-12 10:33 CDT

- Moved the task-queue trigger fully into [`components/dashboard/schedule-view.tsx`](./../components/dashboard/schedule-view.tsx) and removed the extra shell banner from [`app/page.tsx`](./../app/page.tsx) so the schedule surface owns that control directly.
- Switched the dropdown data source from live dashboard task state to the actual SQL seed file by adding [`lib/seed-demo-tasks.ts`](./../lib/seed-demo-tasks.ts), [`app/api/demo-tasks/route.ts`](./../app/api/demo-tasks/route.ts), and [`lib/data/seed-demo-tasks.ts`](./../lib/data/seed-demo-tasks.ts); the popover now reflects the current `sql/seed_demo_data.sql` task list.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the schedule-control move + seed-SQL parsing path.
- Next step: visually confirm the schedule-level task queue still feels balanced on mobile and desktop now that it is no longer reading from mutable runtime task state.

### 2026-04-12 10:30 CDT

- Tightened the new task-queue banner for deployable UI in [`app/page.tsx`](./../app/page.tsx) and [`components/dashboard/task-queue-popover.tsx`](./../components/dashboard/task-queue-popover.tsx): removed the temporary explanatory copy and right-aligned the trigger/popover so it drops from the banner’s right edge.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the banner cleanup.
- Next step: visually confirm the popover anchor feels correct on a wide desktop viewport before shipping the branch.

### 2026-04-12 10:28 CDT

- Removed the desktop right-hand context column in [`app/page.tsx`](./../app/page.tsx) and collapsed the main dashboard back to a two-panel left+schedule layout.
- Replaced the old `Open Right Column` desktop banner control with a read-only seeded task dropdown via [`components/dashboard/task-queue-popover.tsx`](./../components/dashboard/task-queue-popover.tsx), so the demo task list is still visible without stealing schedule width.
- Simplified [`components/dashboard/dashboard-header.tsx`](./../components/dashboard/dashboard-header.tsx) to drop the now-dead desktop sidebar toggle, and moved remaining status/check-in access into the existing left/mobile flows instead of a separate right rail.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the right-column removal + task-popover pass.
- Next step: visually confirm the desktop banner popover opens over the schedule cleanly and that the left-panel status tab still feels sufficient without the old right rail.

### 2026-04-12 10:23 CDT

- Hid the visible calendar-registry fallback banner in [`app/page.tsx`](./../app/page.tsx) so the dashboard no longer advertises the missing `public.user_calendars` schema issue in the main shell.
- Kept the underlying fallback behavior intact; this is a presentation-only suppression, not a backend/schema fix.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after removing the alert block.
- Next step: once the live Supabase schema is actually applied, decide whether to restore a softer status indicator or leave the dashboard fully silent.

### 2026-04-12 10:24 CDT

- Fixed the misleading “empty synced calendar” presentation in [`components/dashboard/schedule-view.tsx`](./../components/dashboard/schedule-view.tsx): the day/week grid was opening at midnight inside its own scroll container, which made a week of daytime Google events look blank unless the user manually scrolled down.
- Added an automatic initial scroll to the current daytime band or the earliest visible timed event when the day/week schedule loads, so synced Google events land in view immediately after refresh/sync.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the schedule auto-scroll fix.
- Next step: visually confirm the synced week now opens around the 10am-6pm event window instead of the 12am top-of-grid position.

### 2026-04-12 08:58 CDT

- Removed the live dark/light toggle path and tightened the dashboard into a dark-only visual system: updated [`app/globals.css`](./../app/globals.css), [`app/page.tsx`](./../app/page.tsx), and [`components/dashboard/dashboard-header.tsx`](./../components/dashboard/dashboard-header.tsx) so the app no longer flips into a broken light palette after mount.
- Polished the left-column surfaces and tabs in [`components/dashboard/master-input.tsx`](./../components/dashboard/master-input.tsx), [`components/dashboard/panel-tabs.tsx`](./../components/dashboard/panel-tabs.tsx), [`components/dashboard/what-to-do-now.tsx`](./../components/dashboard/what-to-do-now.tsx), [`components/dashboard/workspace-snapshot.tsx`](./../components/dashboard/workspace-snapshot.tsx), and [`components/dashboard/status-panel.tsx`](./../components/dashboard/status-panel.tsx), and replaced the old placeholder-only left-tab states with live queue/status cards.
- Added a schema-safe calendar fallback in [`lib/tasks-calendar.ts`](./../lib/tasks-calendar.ts) and [`components/dashboard/calendars-sidebar.tsx`](./../components/dashboard/calendars-sidebar.tsx): signed-in dashboard, check-in, and master-input flows now keep working even though the live Supabase project currently returns `PGRST205` for missing `public.user_calendars`; the app now shows a non-silent banner explaining that full calendar management still needs `sql/schema.sql` applied remotely.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the dark-mode removal, UI pass, and schema fallback.
- Next step: apply [`sql/schema.sql`](./../sql/schema.sql) to the live Supabase project so the fallback banner can disappear and real per-user calendar CRUD/sync metadata can be used instead of the temporary task-calendar fallback.

### 2026-04-11 23:31 America/Chicago

- Added a visible all-day lane to `components/dashboard/schedule-view.tsx` so DB-backed `allDay` events render above the timed grid instead of disappearing.
- Added a small `All day` badge in `components/dashboard/task-manager.tsx` and threaded the backend `task.allDay` flag through the page mapper.
- Follow-up: also wired raw DB tasks into `ScheduleView` so unscheduled tasks can appear in the calendar layer instead of only in the task panel.
- Status: frontend now surfaces all-day tasks/events without changing the existing dashboard layout.
- Next step: visually confirm a date-only assistant-created task and event both show the new all-day UI after refresh.

### 2026-04-11 19:08 America/Chicago

- Turned `components/dashboard/master-input.tsx` into a first-pass plain-language input flow with local parsing, async submit simulation, keyboard submit behavior, and inline feedback states.
- Kept the card layout/style close to the existing design while adding interpretable command labels for task/replan/edit/remember/forget/unknown flows.
- Status: `pnpm exec tsc --noEmit` passes and the component is ready to be swapped over to a real `/api/assistant/message` call later.
- Next step: when backend routing is ready, replace the local `submitMessage` simulation and `mockParseMessage` helper with the real API integration.

### 2026-04-11 19:00 America/Chicago

- Fixed the duplicated/compressed time-grid layout in `components/dashboard/schedule-view.tsx` for 1-day, 3-day, and 7-day views.
- Removed the accidental nested second time column/grid and standardized the day-view scale to a single 48px-per-hour layout path.
- Status: `pnpm exec tsc --noEmit` passes after the schedule view cleanup.
- Next step: visually confirm the 1/3/7 day tabs in the browser after refreshing the dev server.

### 2026-04-11 18:52 America/Chicago

- Repaired merge/syntax damage in `app/page.tsx` and `components/dashboard/schedule-view.tsx` that was breaking the Next production build.
- Kept the current dashboard UI structure intact while restoring the shared backend data block to valid component scope and reconnecting the schedule view to its existing helper functions.
- Status: `pnpm exec tsc --noEmit` passes again after the cleanup.
- Next step: if needed, rerun `pnpm build` locally after pulling the fix to confirm the production bundle is clean in your own environment.

### 2026-04-11 17:52 America/Chicago

- Investigated a `ScheduleView` hydration mismatch triggered after the latest frontend calendar/store changes.
- Fixed `lib/stores/calendar-store.ts` to use deterministic mock dates for SSR and client hydration instead of `new Date()`-driven initialization.
- Status: `pnpm exec tsc --noEmit` passes after the fix.
- Next step: hard refresh or restart `pnpm dev` if a stale Next overlay still appears in the browser.

### 2026-04-11 00:00 America/Chicago

- Started contributor-specific worklog structure for Cindy.
- Current focus: general and frontend work unless redirected.
- Status: initial log created as the canonical handoff file for Cindy.
- Next step: append new entries here when Cindy begins or completes meaningful work.
