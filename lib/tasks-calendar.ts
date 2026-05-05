import { mapUserCalendarRowToUserCalendar, USER_CALENDAR_SELECT } from "@/lib/data/mappers"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import {
  buildTaskReminderDescription,
  getTaskDueTimeLabel,
  isTaskCalendarKey,
  TASKS_CALENDAR_COLOR,
  TASKS_CALENDAR_ID,
  TASKS_CALENDAR_NAME,
} from "@/lib/task-calendar-constants"
import type { UserCalendar, UserCalendarRow } from "@/types"

function buildTaskCalendarRow(userId: string) {
  return {
    user_id: userId,
    calendar_key: TASKS_CALENDAR_ID,
    name: TASKS_CALENDAR_NAME,
    color: TASKS_CALENDAR_COLOR,
    source: "task" as const,
    google_calendar_id: null,
    remote_name: null,
    is_visible: true,
    is_immutable: false,
    sync_preference: "active" as const,
    is_task_calendar: true,
    updated_at: new Date().toISOString(),
  }
}

export async function ensureTaskCalendarForUser(userId: string): Promise<UserCalendar> {
  const adminClient = createSupabaseAdminClient()
  const { data, error } = await adminClient
    .from("calendars")
    .upsert(buildTaskCalendarRow(userId), { onConflict: "user_id,calendar_key" })
    .select(USER_CALENDAR_SELECT)
    .single<UserCalendarRow>()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to initialize the Task Calendar.")
  }

  return mapUserCalendarRowToUserCalendar(data)
}

export async function listUserCalendars(userId: string) {
  const adminClient = createSupabaseAdminClient()
  await ensureTaskCalendarForUser(userId)

  const { data, error } = await adminClient
    .from("calendars")
    .select(USER_CALENDAR_SELECT)
    .eq("user_id", userId)
    .order("is_task_calendar", { ascending: false })
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => mapUserCalendarRowToUserCalendar(row as UserCalendarRow))
}

export { buildTaskReminderDescription, getTaskDueTimeLabel, isTaskCalendarKey }
