export const SCHEDULE_EVENT_SELECT_WITH_PRIORITY =
  "id, user_id, task_id, title, starts_at, ends_at, source, priority, status, location, external_event_id, gcal_event_id, last_synced_from, created_at, updated_at, is_immutable, is_checked_in, all_day, calendar_id"

export const SCHEDULE_EVENT_SELECT_LEGACY =
  "id, user_id, task_id, title, starts_at, ends_at, source, status, location, external_event_id, created_at, updated_at, is_immutable, all_day, calendar_id"

const SCHEDULE_EVENT_OPTIONAL_COLUMNS = [
  "priority",
  "gcal_event_id",
  "last_synced_from",
  "is_checked_in",
] as const

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message
  }

  return String(error)
}

function isMissingScheduleEventColumn(error: unknown, column: typeof SCHEDULE_EVENT_OPTIONAL_COLUMNS[number]) {
  const message = getErrorMessage(error)

  return (
    message.includes(`schedule_events.${column}`) ||
    message.includes(`column schedule_events.${column}`) ||
    message.includes(`'${column}' column of 'schedule_events'`) ||
    message.includes(`column \"${column}\" of relation \"schedule_events\"`)
  )
}

export function isMissingScheduleEventPriorityError(error: unknown) {
  const message = getErrorMessage(error)

  return (
    SCHEDULE_EVENT_OPTIONAL_COLUMNS.some((column) => isMissingScheduleEventColumn(error, column)) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

export function getMissingScheduleEventPriorityHint() {
  return "Schedule-event metadata is unavailable because the live Supabase project has not applied the latest schema yet."
}

export async function runScheduleEventsSelectWithCompat<T>(
  runQuery: (selectClause: string) => Promise<{ data: T | null; error: { message: string } | null }>,
) {
  const primaryResult = await runQuery(SCHEDULE_EVENT_SELECT_WITH_PRIORITY)

  if (primaryResult.error && isMissingScheduleEventPriorityError(primaryResult.error)) {
    return runQuery(SCHEDULE_EVENT_SELECT_LEGACY)
  }

  return primaryResult
}

type ScheduleEventMutationPayload =
  | Record<string, unknown>
  | Array<Record<string, unknown>>

function stripPriorityFromScheduleEventMutation<T extends ScheduleEventMutationPayload>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map(
      ({ priority: _priority, gcal_event_id: _gcalEventId, last_synced_from: _lastSyncedFrom, is_checked_in: _isCheckedIn, ...row }) => row,
    ) as T
  }

  const {
    priority: _priority,
    gcal_event_id: _gcalEventId,
    last_synced_from: _lastSyncedFrom,
    is_checked_in: _isCheckedIn,
    ...row
  } = payload
  return row as T
}

export async function runScheduleEventMutationWithCompat<TData, TPayload extends ScheduleEventMutationPayload>(
  payload: TPayload,
  runMutation: (payload: TPayload) => Promise<{ data: TData | null; error: { message: string } | null }>,
) {
  const primaryResult = await runMutation(payload)

  if (primaryResult.error && isMissingScheduleEventPriorityError(primaryResult.error)) {
    return runMutation(stripPriorityFromScheduleEventMutation(payload))
  }

  return primaryResult
}
