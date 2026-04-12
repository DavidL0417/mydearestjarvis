# Eric Worklog

## Log

### 2026-04-12 12:03 CDT

- Wired real Google calendar events into the actual scheduling context by extracting a shared server helper in [`lib/google-calendar-events.ts`](./../lib/google-calendar-events.ts) and reusing it from [`app/api/google-calendar/events/route.ts`](./../app/api/google-calendar/events/route.ts), [`lib/assistant/context.ts`](./../lib/assistant/context.ts), and [`app/api/schedule/route.ts`](./../app/api/schedule/route.ts).
- `Master Input` / secretary scheduling now reads persisted task events plus the same server-fetched Google events instead of relying only on placeholder calendar blocks; the `Schedule` button now also merges those Google events into `hardEvents` before calling Claude.
- Tightened failure behavior: if one or more Google calendars cannot be fetched, the shared helper now throws a concrete error instead of silently dropping those calendars and scheduling against a partial event set.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the shared Google-event scheduling-context update.
- Next step: reload the dashboard and retry scheduling; Claude should now reason over the real synced calendar set, and any remaining Google fetch problem should surface as a direct backend error instead of a hidden partial schedule context.

### 2026-04-12 11:14 CDT

- Fixed the assistant’s broad scheduling-query bug in [`lib/assistant/secretary.ts`](./../lib/assistant/secretary.ts): `schedule_tasks` no longer treats phrases like `all my tasks` or `task queue` as literal title filters, and it now matches against task tags as well as titles when a real query is present.
- Added prompt guidance so Claude uses the open task set for whole-queue scheduling/replanning requests instead of passing `all my tasks` into `taskQuery`.
- Root cause: the tool only fell back to the open queue when `taskQuery` was absent; if Claude supplied a broad phrase, the title-only filter returned zero matches and surfaced `I couldn't find any tasks to schedule from that request.`
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the scheduling-query fix.
- Next step: refresh the dashboard and retry `Schedule all my tasks for me`; it should now schedule the open queue instead of asking for missing task details.

### 2026-04-12 10:18 CDT

- Fixed the “assistant says created, but schedule does not update” regression in [`lib/data/mappers.ts`](./../lib/data/mappers.ts): legacy `schedule_events` rows without `is_checked_in` now default `isCheckedIn` to `false` instead of producing an invalid dashboard payload during the post-create refresh.
- Fixed the empty calendar drawer and broadened calendar surfacing in [`lib/tasks-calendar.ts`](./../lib/tasks-calendar.ts) and [`schemas/common.ts`](./../schemas/common.ts): fallback/synthetic calendar entries are now valid app responses, and `/api/calendars` now merges connected Google calendars into the sidebar list even when `public.user_calendars` is missing or incomplete.
- Root cause chain: assistant event creation could succeed, but the immediate `/api/dashboard` reload could fail on legacy event rows, while `/api/calendars` was schema-rejecting non-DB fallback calendars because `userCalendarSchema` still required a UUID `id`.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the dashboard-refresh + calendar-sidebar fix.
- Next step: refresh the signed-in dashboard, retry the same event creation, and reopen the calendar drawer to confirm the new event appears in the schedule and the connected Google calendars are listed.

### 2026-04-12 10:13 CDT

- Fixed the actual remaining assistant schedule-event compat bug in [`lib/supabase/schema-compat.ts`](./../lib/supabase/schema-compat.ts): the legacy-column matcher was reading Supabase mutation errors with `String(error)`, so plain PostgREST error objects became `"[object Object]"` and the retry path never ran.
- Added the same message-extraction hardening to [`lib/tasks-calendar.ts`](./../lib/tasks-calendar.ts) so missing-`user_calendars` fallback detection also works reliably against raw Supabase error objects.
- Root cause confirmation: the create-event assistant path already called the compat wrapper, but the wrapper was failing to recognize `column schedule_events.priority does not exist`, so the raw DB error bubbled back into Master Input.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the matcher fix.
- Next step: restart or refresh the dev app and retry the same create-event prompt; it should now retry the legacy insert/update path instead of surfacing the raw missing-column error.

### 2026-04-12 10:13 CDT

- Fixed the follow-on hydration mismatch in [`components/dashboard/master-input.tsx`](./../components/dashboard/master-input.tsx): kept the intro transcript entry deterministic with a stable static id, and reverted the incidental copy-only intro/placeholder edits that had drifted during the schema-warning fix.
- Root cause: the actual functional fix was safe, but the concurrent dev snapshot ended up with server HTML using the older intro copy while the client bundle had the newer copy, which forced a React hydration reset in the left rail.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the hydration cleanup.
- Next step: hard refresh or restart `pnpm dev` so Next rebuilds the server/client pair from the same `MasterInput` source and clears the stale overlay.

### 2026-04-12 10:09 CDT

- Fixed the Master Input schema-warning regression across [`lib/assistant/secretary.ts`](./../lib/assistant/secretary.ts), [`app/api/assistant/message/route.ts`](./../app/api/assistant/message/route.ts), and [`components/dashboard/master-input.tsx`](./../components/dashboard/master-input.tsx): legacy `schedule_events` schema drift no longer replaces a successful assistant action with the fallback warning bubble.
- The secretary now keeps the last good runtime context if a post-mutation refresh hits the old optional schedule-event columns, and the message route no longer returns schema-compat advisories as if they were the assistant's actual reply.
- Hardened the transcript renderer so red inline error text only appears for failed assistant responses, not successful responses that happen to carry backend metadata.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the assistant chat fix.
- Next step: refresh the signed-in dashboard and retry a plain event creation in Master Input to confirm the chat now returns the real action result instead of the schema warning.

### 2026-04-12 10:18 CDT

- Replaced the app’s Google event sync dependency on the browser session token with a server route at [`app/api/google-calendar/events/route.ts`](./../app/api/google-calendar/events/route.ts) that uses the authenticated user’s stored `user_integrations` token instead.
- This was the next targeted fix for the “all-day only” dashboard symptom: the stored integration token path is the one already verified against David’s real timed Northwestern / Academia / personal calendars, so the app now reads Google events through the same proven server-side credential path.
- Updated [`lib/supabase/auth-actions.ts`](./../lib/supabase/auth-actions.ts) so the schedule UI fetches `/api/google-calendar/events` instead of querying Google directly from the browser.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after adding the server-side Google events route.
- Next step: refresh the app and click `Sync with Google` again; if timed events still do not render, inspect the returned `/api/google-calendar/events` payload in the browser network panel to compare the server response against the rendered week view.

### 2026-04-12 10:05 CDT

- Hardened [`app/api/assistant/context/route.ts`](./../app/api/assistant/context/route.ts) so schedule-event schema drift now degrades to fallback assistant context instead of returning `ok: false` with the raw `column schedule_events.priority does not exist` error into Master Input.
- Root cause confirmation: the red left-rail error was specifically the assistant context fetch leaking a backend schema mismatch through the UI, even after the schedule view itself had started rendering Google events again.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the assistant-context fallback patch.
- Next step: full page refresh so the client refetches `/api/assistant/context`; after that, any remaining issue should be about missing schema-backed features rather than the raw sidebar error itself.

### 2026-04-12 09:56 CDT

- Confirmed the live `public.schedule_events` table is older than expected by more than one column: besides `priority`, it is also missing `gcal_event_id`, `last_synced_from`, and `is_checked_in`.
- Expanded the schedule-event compatibility layer accordingly so assistant context, secretary mutations, scheduler persistence, and related event updates can fall back to the legacy column set instead of surfacing raw DB column errors.
- Fixed a separate Google-sync rendering bug in the schedule UI: client-fetched Google events from calendars not present in `user_calendars` were passing the visibility filter but rendering with no fallback colors, which made timed events effectively invisible even after a successful fetch.
- Verified live Google data for David’s account is available: 7 calendars are readable and the current April 12-18 week includes multiple timed events, so the schedule should now show more than the all-day holiday row after refresh/sync.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the broader schema compat + Google event rendering fix.

### 2026-04-12 09:41 CDT

- Extended the `schedule_events.priority` schema-compat layer to writes, not just reads: secretary task/event mutations, `/api/schedule` persistence, and check-in approval updates now retry without the `priority` column when the live Supabase schema is still old.
- Fixed signed-in Google calendar visibility on the dashboard: the transitional client sync now pulls events from every Google calendar in the account instead of just `primary`, and the schedule view no longer filters those Google events out when `public.user_calendars` is missing.
- Added a temporary assistant fallback message for the missing `schedule_events.priority` column so any remaining old-schema path reports a concrete migration issue instead of a raw DB error.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes after the compat + Google calendar display patch.
- Next step: refresh the signed-in dashboard, re-run Google sync, and then apply the latest `sql/schema.sql` so the fallback logic can eventually be removed.

### 2026-04-12 09:22 CDT

- Hardened the Google auth callback in [`app/auth/callback/route.ts`](./../app/auth/callback/route.ts): after `exchangeCodeForSession()` succeeds, profile/integration/task-calendar bootstrap now runs in a guarded block instead of throwing a raw HTTP 500 back to Google consent.
- Verified the live Supabase project still has schema drift: `public.user_calendars` is missing and `public.schedule_events.priority` is missing, while `public.user_integrations` exists. This explains why OAuth-follow-up bootstrap can fail even though the session exchange itself succeeds.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes; Google sign-in should now complete the session redirect instead of dying on callback bootstrap.
- Next step: apply the latest `sql/schema.sql` to Supabase so calendar registry + schedule priority stop relying on compatibility/fallback paths.

### 2026-04-12 08:45 CDT

- Fixed the production build regression on `main`: client code was importing `TASKS_CALENDAR_*` from [`lib/tasks-calendar.ts`](./../lib/tasks-calendar.ts), which now depends on the server-only Supabase helper and pulled `next/headers` into the client bundle.
- Moved the task-calendar constants and display helpers into new shared file [`lib/task-calendar-constants.ts`](./../lib/task-calendar-constants.ts) and rewired the affected client/shared imports to use that boundary-safe module instead.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes again after the import split.
- Next step: finish replacing the remaining placeholder-backed dashboard panels and decide whether Google Calendar should continue using the transitional client fetch path or move fully to server-side mirrored sync.

### 2026-04-12 03:18 CDT

- Fixed a post-merge auth regression in the assistant routes: `app/api/assistant/message` and `app/api/assistant/context` had been reverted to `getOrCreateDemoUser(...)`, so secretary-created tasks/events were writing under the demo account while the dashboard read the authenticated user.
- Both assistant routes now use `requireAuthenticatedUser()` again, which brings Master Input writes back into the same per-user data flow as dashboard/tasks/schedule.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and assistant-created records should now show up for the signed-in user after refresh.
- Next step: re-test a simple event/task from Master Input and confirm it appears both in Supabase under the auth user and in the authenticated dashboard UI.

### 2026-04-12 03:15 CDT

- Removed the legacy placeholder calendar injection from `/api/dashboard`, so the frontend schedule now renders only real `schedule_events` from Supabase plus task-derived overlays instead of the old seeded class/social mocks.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and the dummy calendar blocks should disappear after a refresh.
- Next step: if the team still wants a demo seed mode later, reintroduce it behind an explicit dev-only flag instead of always merging mock events into authenticated user data.

### 2026-04-12 03:12 CDT

- Stabilized the post-merge dashboard shell after David’s secretary/scheduler UI landed: restored the right detail column to open by default and rebalanced desktop panel sizing so the schedule is not visually crowded out.
- Trimmed the merged `MasterInput` transcript footprint so the left rail reads like a dashboard panel again instead of a full chat surface, without removing the new assistant functionality.
- Status: `pnpm exec tsc --noEmit --incremental false` passes after the layout cleanup.
- Next step: if Cindy wants a fuller visual restore, reconcile `app/page.tsx` against her intended component composition rather than letting the merged page keep drifting toward the older placeholder-heavy layout.

### 2026-04-12 02:34 CDT

- Added an authenticated preferences backend path at `app/api/preferences/route.ts` so user settings can now be read and upserted through the app’s Supabase auth context instead of manual SQL editor writes.
- Added shared `UpdatePreferencesRequest` / `PreferencesResponse` contracts plus `schemas/preferences.ts`, and the route initializes a default per-user preferences row on first read if one does not exist yet.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and preferences storage is now properly keyed off the signed-in user id.
- Next step: wire the frontend onboarding/settings UI to `GET`/`PUT /api/preferences` so user preference changes flow through the authenticated backend automatically.

### 2026-04-12 01:34 CDT

- Replaced the demo-user backend path with real Supabase Auth profile resolution: protected routes now require a valid session, create/reuse `public.users` from the authenticated auth user, and scope all task/dashboard/onboarding/schedule/assistant writes by that real user id.
- Added the minimal Google sign-in foundation with `app/auth/callback`, `app/auth/signout`, a shared auth/profile helper in `lib/supabase/auth.ts`, and a compact header auth control so login can be tested without redesigning Cindy’s dashboard.
- Extended the canonical schema for auth-linked users and future account linkage by mapping `public.users.id` to `auth.users.id` and adding `public.user_integrations` for Cindy’s later Google Calendar sync metadata/token work.
- Status: `pnpm exec tsc --noEmit --incremental false` passes and `pnpm build` passes when allowed to fetch Google Fonts outside the sandbox.
- Next step: apply the updated schema in Supabase, enable Google auth in the Supabase dashboard, and then let Cindy build calendar account sync on top of `user_integrations` instead of the old demo-user identity.

### 2026-04-12 01:06 CDT

- Fixed a timezone parsing bug for date-only task input: the assistant write layer was letting JavaScript directly parse strings like `April 20`, which produced a midnight timestamp and shifted some tasks into the previous local day.
- `resolveNaturalDateTime()` now only trusts direct parsing for already-precise timestamp strings; natural-language dates now always flow through the explicit local-date resolver before being stored.
- Status: `pnpm exec tsc --noEmit` passes and date-only tasks should now land on the intended day instead of showing up around 6 PM the day before.
- Next step: retry `Do homework on April 20` and confirm the newest task row has an end-of-day deadline on April 20 local time and renders on the correct day in the calendar.

### 2026-04-12 00:58 CDT

- Simplified task semantics so tasks no longer use all-day mode at all; date-only task input now normalizes to a standard end-of-day deadline instead of `all_day = true`.
- Updated the assistant write layer to always store tasks with `all_day = false`, and updated calendar task rendering so deadline-only tasks display as timed blocks ending at the deadline rather than in the all-day lane.
- Status: `pnpm exec tsc --noEmit` passes and old task `all_day` flags are ignored by the calendar renderer.
- Next step: retry a prompt like `Do homework on April 21st` and confirm the new task row has a populated end-of-day deadline and appears near the end of that day in the calendar.

### 2026-04-12 00:43 CDT

- Fixed a parser-to-DB gap for all-day tasks: if Claude leaves `task.due_at` blank, the parser now backfills the temporal phrase from the raw message before the assistant write layer resolves the deadline.
- This was the root cause behind all-day task rows being inserted with `deadline = NULL` even when the UI summary clearly said something like `on April 20`.
- Status: `pnpm exec tsc --noEmit` passes and date-only task prompts should now persist a real end-of-day deadline instead of a null deadline.
- Next step: retry `Do homework on April 20` and confirm the new task row has a populated deadline and appears in the correct all-day lane.

### 2026-04-12 00:34 CDT

- Split all-day semantics so assistant-created all-day tasks now store an end-of-day deadline, while all-day events store a true full-day range from local 00:00 to next-day 00:00.
- Updated `ScheduleView` task mapping so all-day tasks anchor to the start of their local calendar day instead of using the deadline timestamp as the visible start.
- Status: `pnpm exec tsc --noEmit` passes and the all-day task/event model is now explicit instead of sharing one ambiguous helper.
- Next step: retry a date-only task like `On Monday April 20 I need to do homework` and a date-only event to confirm both land on the intended day in the calendar UI.

### 2026-04-12 00:28 CDT

- Added a shared backend Tasks-calendar policy in `lib/tasks-calendar.ts` and updated scheduler memory loading so Claude now always sees “all tasks are stored in the Tasks calendar (`cal-tasks`).”
- Enforced `cal-tasks` across task creation/update paths in `/api/tasks`, assistant-created tasks, onboarding task inserts, and the page’s optimistic task state so task calendar assignment no longer drifts.
- Status: `pnpm exec tsc --noEmit` passes and the Tasks calendar rule is now true in both persisted data and scheduling memory.
- Next step: optionally remove or lock the task calendar selector in the frontend task form so the UI no longer suggests tasks can live on other calendars.

### 2026-04-12 00:11 CDT

- Hardened the scheduler Claude tool parsing so a missing `summary` field no longer crashes the whole `/api/schedule` flow after the tool payload comes back.
- Relaxed the tool schema requirement for `summary` and added a backend fallback summary synthesizer based on placements/unscheduled counts.
- Status: `pnpm exec tsc --noEmit` passes and the prior `summary is required` planner error should no longer block the Schedule button.
- Next step: retry scheduling in the browser; if it still fails, the next issue should be a real placement/planning constraint rather than missing tool metadata.

### 2026-04-12 00:04 CDT

- Fixed the merged scheduler request contract so `app/page.tsx` now includes `allDay` when posting `hardEvents` to `/api/schedule`.
- Made `scheduleEventInputSchema` tolerate omitted `allDay` values with a safe default to avoid brittle 400s from older callers.
- Status: `pnpm exec tsc --noEmit` passes and the `Invalid schedule request` failure should no longer occur from the missing `allDay` field alone.
- Next step: retry the Schedule button in the browser and confirm any remaining failure is inside planner logic rather than request validation.

### 2026-04-11 23:58 CDT

- Resolved the pull/rebase conflict set across `app/page.tsx`, `components/dashboard/task-manager.tsx`, `lib/ai/claude.ts`, and dashboard schema/contracts after David’s scheduler/task CRUD changes landed on top of the newer dashboard/all-day/calendar-task wiring.
- Kept David’s raw `Task[]` state + task CRUD flow, preserved the dashboard refresh/all-day/calendar task display behavior, and cleaned duplicate `tasks` keys in the shared dashboard type/schema/route payloads.
- Aligned task CRUD with the current shared task contract by threading `allDay` through task request schemas and task route selects/inserts.
- Status: merge markers are gone repo-wide and `pnpm exec tsc --noEmit` passes again.
- Next step: runtime-test task creation/editing/scheduling in the browser now that the merged page is compiling with both the scheduler and the DB-backed calendar/task flow intact.

### 2026-04-11 23:18 CDT

- Changed the assistant parser default so date-only task/event requests now assume all-day instead of treating the missing time as a clarification blocker.
- Updated the Claude parser prompt examples and normalization logic so requests like `shopping with Cindy on April 12` or `finish CS213 homework on April 16` map to `all_day: true` automatically when no time cue is present.
- Status: `pnpm exec tsc --noEmit` passes with the new default-all-day behavior in place.
- Next step: live-test a few date-only requests end to end now that the parser and DB bridge agree on all-day fallback semantics.

### 2026-04-11 23:09 CDT

- Promoted all-day semantics into real persisted schema fields by adding `all_day` to the canonical `tasks` and `schedule_events` SQL definitions, then threading that field through shared TS/Zod contracts, mappers, dashboard/schedule reads, onboarding task input, and assistant DB writes.
- Status: the codebase now expects `public.tasks.all_day` and `public.schedule_events.all_day` to exist, and `pnpm exec tsc --noEmit` passes with the updated schema contract.
- Next step: apply the new `all_day` columns in Supabase before testing all-day writes or dashboard reads against a live database.

### 2026-04-11 23:05 CDT

- Added first-pass all-day parsing support for both tasks and events in the assistant pipeline by extending the parser contract with `task.all_day` / `event.all_day` and teaching Claude explicit all-day examples.
- Updated the DB action bridge to map all-day events into full-day `schedule_events` ranges and all-day tasks into end-of-day task deadlines without requiring a Supabase schema change.
- Status: `all day` phrasing now compiles cleanly through parser validation and DB-write handling using the existing timestamp columns.
- Next step: if we want to preserve all-day semantics explicitly in the database/UI long-term, add real `all_day` columns later instead of only inferring them from stored timestamps.

### 2026-04-11 22:17 CDT

- Extended `/api/dashboard` to return real task rows alongside events, and stopped blanket-filtering persisted `source: "calendar"` events so assistant-created fixed events can come back through the dashboard payload.
- Wired `app/page.tsx` to map dashboard tasks into the existing `TaskManager` shape, hydrate missing calendars from DB task/event calendar IDs, and listen for a lightweight `jarvis-dashboard-refresh` event after successful assistant submissions.
- Status: DB-backed tasks now feed the task panel state instead of `initialTasks`, DB-backed events still feed `ScheduleView`, and successful Master Input writes now trigger a dashboard refetch so new rows can appear back in the UI.
- Next step: persist task-manager add/toggle/delete actions to Supabase too, since that component still edits local state after the initial DB hydration.

### 2026-04-11 21:49 CDT

- Fixed a dashboard 500 caused by Zod rejecting real Supabase `timestamptz` strings with offsets (for example `+00:00`) after assistant-created schedule events started showing up in `schedule_events`.
- Updated the shared task/event datetime schemas to accept offset-bearing timestamps so `/api/dashboard` can validate real DB rows instead of only strict UTC-style strings.
- Status: TypeScript passes again; dashboard payload validation should no longer break just because real scheduled events exist in Supabase.
- Next step: restart the dev server if the stale Turbopack overlay persists, then verify `/api/dashboard` returns 200 with the newly inserted events.

### 2026-04-11 21:47 CDT

- Added a backend-owned current-day helper in `lib/time/current-day.ts` so assistant parsing now has a server-derived local date context instead of relying only on the raw frontend timestamp.
- Wired `/api/assistant/message` to compute `nowIso`, `timezone`, and `currentDay` on the backend before calling Claude, and updated the parser prompt to explicitly include the current local day for relative-time interpretation.
- Status: parser requests now carry a normalized backend current-day context (`YYYY-MM-DD`) into Claude for `today` / `tomorrow` / weekday resolution.
- Next step: if date handling still feels inconsistent, reuse the same helper inside scheduling/planning code so parser and scheduler share one backend time-context model.

### 2026-04-11 21:43 CDT

- Fixed an assistant-input DB write edge case where event requests using ordinal dates like `April 12th at 6 pm` parsed successfully but did not persist because the backend date resolver only matched bare month-day phrases like `April 12`.
- Status: `create_fixed_event` writes now recognize `st`/`nd`/`rd`/`th` suffixes during schedule-event timestamp resolution.
- Next step: surface `actionsTaken` in the Master Input UI so parser success and DB-write success are easier to distinguish during testing.

### 2026-04-11 21:36 CDT

- Integrated the direct-input parser route with a backend action bridge so validated assistant intents now write to Supabase tasks, schedule events, preferences, and memory logs through `lib/assistant/handleParsedInput.ts`.
- Wired `/api/assistant/message` to resolve the MVP demo user, apply DB actions, and return `actionsTaken` alongside the parsed payload without mixing in scheduling logic.
- Adjusted parser behavior so flexible timeboxed blocks can stay `create_fixed_event` with `event.is_immutable = false`, which lets the new handler distinguish soft events from hard commitments.
- Status: `pnpm exec tsc --noEmit` passes and `pnpm build` passes after rerunning outside the sandbox so Next could fetch Google Fonts.
- Next step: pull David’s backend push, compare any assistant/scheduling contract overlap, and then decide which parsed actions should create draft records versus requiring follow-up clarification in the UI.

### 2026-04-11 21:05 CDT

- Hardened the direct-input Claude parser against brittle fallbacks by loosening parser output date fields from strict ISO datetimes to structured strings, adding few-shot event/task examples, and introducing safer JSON extraction plus light normalization before final Zod validation.
- Added development-only parser diagnostics (`validated` vs `fallback` plus error codes) in the route/UI and server-side debug logs for raw Claude text, extracted JSON, and schema issues without exposing secrets.
- Status: obvious event-style requests like shopping/dinner/appointments now have a much stronger best-fit path toward `create_fixed_event` instead of collapsing straight to `unknown`.
- Next step: test a few live phrases against the real Anthropic key and tune any remaining edge cases based on the new debug metadata rather than blind fallback behavior.

### 2026-04-11 19:17 CDT

- Added the first-pass Claude parsing layer for direct dashboard input with a thin `/api/assistant/message` route, shared Zod parser contracts, and a Claude Sonnet 4.6 helper that returns validated structured intent JSON.
- Swapped `MasterInput` from local heuristics to a real backend POST while keeping the UI local-only; no scheduling, DB mutation, or Google Calendar behavior was added in this pass.
- Status: `pnpm exec tsc --noEmit` passes and `pnpm build` passes after allowing external Google Fonts fetch during the build check.
- Next step: set `ANTHROPIC_API_KEY` in local/Vercel, then start consuming the parsed intent object for task/event/memory flows without letting Claude mutate state directly.

### 2026-04-11 18:10 CDT

- Reconciled backend/shared task, schedule event, preferences, and check-in contracts so raw Supabase rows are now explicitly snake_case and app-facing models are explicitly camelCase through centralized mapper functions.
- Added persisted `tasks.tags` support end-to-end in `sql/schema.sql`, shared TS/Zod contracts, onboarding inserts, dashboard/task reads, and schedule preparation reads.
- Status: `pnpm exec tsc --noEmit` passes and `pnpm build` passes after rerunning with network access for Google Fonts.
- Next step: apply the `public.tasks.tags` schema change in Supabase so existing environments match the updated canonical task model.

### 2026-04-11 17:32 CDT

- Added the provided Google OAuth client ID and client secret to local `.env.local`.
- Status: Google client credentials now exist locally, but `GOOGLE_REDIRECT_URI` is still unset and the repo does not yet expose a Google OAuth callback route.
- Next step: add the exact redirect URI from the Google Cloud OAuth client and implement the callback/auth flow before expecting Google sign-in or Calendar consent to work.

### 2026-04-11 17:28 CDT

- Added `is_immutable` and `calendar_id` across the backend scheduling data model for both tasks and schedule events, including SQL schema, shared TS/Zod contracts, DB row mappers, and route read/write points.
- Status: onboarding now persists the new task fields, dashboard/schedule reads now return them, and the scheduler stub preserves them in typed planner context without requiring frontend changes.
- Next step: when David wires real planner logic, make it actively respect `is_immutable` for move/protect decisions and use `calendar_id` when calendar sync is implemented.

### 2026-04-11 16:17 CDT

- Completed the merge-readiness cleanup pass: removed generated build noise from the diff, confirmed `.env.local` stays gitignored, and added README setup notes for env copying plus Supabase schema application.
- Status: branch is now positioned as a backend foundation milestone with intentional docs/setup guidance, explicit demo-user behavior, and an intentionally stubbed `/api/schedule` path.
- Next step: manually apply `sql/schema.sql`, set env vars in local/Vercel, and then decide when to replace the demo-user pattern and schedule stub with full production behavior.

### 2026-04-11 15:36 CDT

- Added the first real backend milestone: MVP Supabase SQL schema in `sql/schema.sql`, demo-user bootstrap helper, DB row mappers, and DB-backed `dashboard`, `onboarding`, and `schedule` route flows.
- Status: `/api/dashboard` now reads live Supabase tables, `/api/onboarding` creates or reuses the MVP demo user and writes preferences/tasks, and `/api/schedule` now reads DB context and returns a validated planner stub for David’s future Claude hookup.
- Next step: apply `sql/schema.sql` in Supabase, set the required env vars, and then wire the validated schedule output into real DB writes plus the remaining `checkin` and `replan` persistence.

### 2026-04-11 15:12 CDT

- Applied backend ownership markers across `app/api/**`, `lib/**`, `schemas/**`, and `types/**`, plus a narrow marked data-fetching section inside `app/page.tsx`.
- Status: backend protection comments now make the shared boundary explicit without changing UI structure or dashboard component code.
- Next step: keep any new backend logic inside marked sections/files so frontend work can continue safely in `components/**` and the UI portions of `app/page.tsx`.

### 2026-04-11 15:00 CDT

- Extracted dashboard fetch responsibility out of `app/page.tsx` into backend-owned `lib/data/dashboard.ts` to reduce shared merge pressure with frontend/UI work.
- Status: `app/page.tsx` is now a thinner shared rendering layer that imports `getDashboardData()` and only manages page-local UI state plus prop passing.
- Next step: keep future dashboard data changes in `lib/data/**` so teammate UI edits in `app/page.tsx` stay low-conflict.

### 2026-04-11 14:56 CDT

- Finalized Eric handoff note for the JARVIS backend foundation pass in the canonical worklog.
- Status: backend API scaffolding, shared schemas/types, service stubs, dependency updates, and minimal dashboard wiring are all recorded here for the next session.
- Next step: begin replacing mock dashboard and placeholder route responses with persisted Supabase-backed data flow.

### 2026-04-11 14:52 CDT

- Built JARVIS backend foundation with typed App Router endpoints in `app/api/*`, shared Zod schemas in `schemas/*`, and shared domain types in `types/index.ts`.
- Added future-facing service stubs for Supabase, Claude, and Google Calendar plus `.env.example` and the required SDK dependencies in `package.json`.
- Kept the existing dashboard UI intact and minimally wired `app/page.tsx` to fetch `/api/dashboard`, feeding live data into `WorkspaceSnapshot`, `WhatToDoNow`, and `StatusPanel`.
- Status: `pnpm exec tsc --noEmit` passes and `pnpm build` passes after allowing external font fetch during the build check.
- Next step: replace mocked dashboard data and placeholder POST success responses with real Supabase persistence, AI scheduling, and calendar sync.

### 2026-04-11 00:00 America/Chicago

- Started contributor-specific worklog structure for Eric.
- Current focus: mostly backend work unless redirected.
- Status: initial log created as the canonical handoff file for Eric.
- Next step: append new entries here when Eric begins or completes meaningful work.
