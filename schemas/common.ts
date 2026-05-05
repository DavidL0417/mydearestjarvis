import { z } from "zod"

export const prioritySchema = z.enum(["low", "medium", "high"])
export const taskStatusSchema = z.enum(["todo", "scheduled", "completed", "missed"])
export const preferredCheckInModeSchema = z.enum(["silent", "quiet", "gentle", "active"])
export const scheduleEventSourceSchema = z.enum(["task", "calendar", "focus"])
export const checkInMoodSchema = z.enum(["good", "okay", "stuck"])
export const checkInOutcomeSchema = z.enum(["completed", "missed", "partial"])
export const checkInEnergySchema = z.enum(["low", "medium", "high"])
export const syncOriginSchema = z.enum(["local", "gcal"])
export const calendarSourceSchema = z.enum(["local", "google", "imported", "task"])
export const calendarSyncPreferenceSchema = z.enum(["active", "pending", "ignored"])
export const memoryKindSchema = z.enum([
  "preference",
  "task_context",
  "source_observation",
  "candidate",
  "observation",
  "rule",
])
export const memoryImportanceSchema = z.enum(["low", "medium", "high", "critical"])
export const memoryStatusSchema = z.enum(["active", "candidate", "stale", "superseded", "archived"])
export const sourceKindSchema = z.enum(["notion", "gmail", "caldav", "google_calendar", "manual", "system"])
export const sourceFreshnessSchema = z.enum(["fresh", "partial", "stale", "failed"])

const hhmmPattern = /^([01]\d|2[0-3]):([0-5]\d)$/
const tagSchema = z.string().trim().min(1)

export const userPreferencesSchema = z.object({
  userId: z.string().uuid(),
  timezone: z.string().min(1),
  sleepPattern: z.string().min(1).nullable(),
  peakEnergyWindow: z.string().min(1).nullable(),
  procrastinationPattern: z.string().min(1).nullable(),
  workdayStart: z.string().regex(hhmmPattern, "Expected HH:MM time"),
  workdayEnd: z.string().regex(hhmmPattern, "Expected HH:MM time"),
  defaultTaskDurationMinutes: z.number().int().positive(),
  breakDurationMinutes: z.number().int().nonnegative(),
  preferredFocusBlockMinutes: z.number().int().positive().nullable(),
  preferredCheckInMode: preferredCheckInModeSchema,
  calendarId: z.string().min(1).nullable(),
})

export const taskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1).nullable(),
  deadline: z.string().datetime({ offset: true }).nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  priority: prioritySchema,
  status: taskStatusSchema,
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  isImmutable: z.boolean(),
  allDay: z.boolean(),
  calendarId: z.string().min(1).nullable(),
  tags: z.array(tagSchema),
})

export const userCalendarSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  calendarKey: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(4),
  source: calendarSourceSchema,
  googleCalendarId: z.string().min(1).nullable(),
  remoteName: z.string().min(1).nullable(),
  isVisible: z.boolean(),
  isImmutable: z.boolean(),
  syncPreference: calendarSyncPreferenceSchema,
  isTaskCalendar: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

export const scheduleEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  title: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  source: scheduleEventSourceSchema,
  priority: prioritySchema,
  status: taskStatusSchema.nullable(),
  location: z.string().min(1).nullable(),
  externalEventId: z.string().min(1).nullable(),
  gcalEventId: z.string().min(1).nullable(),
  lastSyncedFrom: syncOriginSchema,
  isImmutable: z.boolean(),
  isCheckedIn: z.boolean(),
  allDay: z.boolean(),
  calendarId: z.string().min(1).nullable(),
})

export const scheduleEventInputSchema = scheduleEventSchema.omit({ userId: true }).extend({
  userId: z.string().uuid().optional(),
  priority: prioritySchema.optional().default("medium"),
  gcalEventId: z.string().min(1).nullable().optional().default(null),
  lastSyncedFrom: syncOriginSchema.optional().default("local"),
  allDay: z.boolean().optional().default(false),
  isCheckedIn: z.boolean().optional().default(false),
})

export const memoryEntrySummarySchema = z.object({
  id: z.string().uuid(),
  kind: memoryKindSchema,
  category: z.string().min(1),
  insight: z.string().min(1),
  importance: memoryImportanceSchema,
  importanceNote: z.string().min(1).nullable(),
  source: z.string().min(1),
  confidence: z.number().nullable(),
  createdAt: z.string().datetime({ offset: true }),
})

export const sourceSnapshotSummarySchema = z.object({
  id: z.string().uuid(),
  source: sourceKindSchema,
  freshness: sourceFreshnessSchema,
  summary: z.string().min(1),
  capturedAt: z.string().datetime({ offset: true }),
})
