import type { Task } from "@/types"

export const EXCLUDED_SCHEDULE_EVENT_TITLES = new Set(["Office"])

export function isExcludedScheduleEventTitle(title: string | null | undefined): boolean {
  if (!title) return false
  return EXCLUDED_SCHEDULE_EVENT_TITLES.has(title.trim())
}

export const TASKS_CALENDAR_ID = "cal-tasks"
export const TASKS_CALENDAR_NAME = "Task Calendar"
export const TASKS_CALENDAR_COLOR = "#f9a8d4"

export const TASKS_CALENDAR_MEMORY = [
  "# Tasks Calendar Rule",
  `- All tasks are stored in the ${TASKS_CALENDAR_NAME}.`,
  `- Use calendar id \`${TASKS_CALENDAR_ID}\` for tasks.`,
  "- Do not assign tasks to personal, work, class, or other event calendars.",
].join("\n")

export function isTaskCalendarKey(calendarId: string | null | undefined) {
  return calendarId === TASKS_CALENDAR_ID
}

function formatDeadlineTime(deadline: string | null) {
  if (!deadline) {
    return "No due time set"
  }

  return new Date(deadline).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getTaskProgressLabel(task: Pick<Task, "status">) {
  if (task.status === "completed") {
    return "100% complete"
  }

  if (task.status === "scheduled") {
    return "In progress"
  }

  if (task.status === "missed") {
    return "Missed"
  }

  return "0% complete"
}

export function buildTaskReminderDescription(task: Pick<Task, "deadline" | "priority" | "status">) {
  return `Due ${formatDeadlineTime(task.deadline)} · ${getTaskProgressLabel(task)} · ${task.priority} priority`
}

export function getTaskDueTimeLabel(task: Pick<Task, "deadline">) {
  return formatDeadlineTime(task.deadline)
}
