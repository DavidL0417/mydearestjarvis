// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER

import { z } from "zod"

const assistantIntentValues = [
  "create_task",
  "create_fixed_event",
  "replan",
  "edit_task",
  "remember_preference",
  "forget_memory",
  "unknown",
] as const

const taskEditOperationValues = [
  "rename",
  "complete",
  "delete",
  "change_due_date",
  "change_priority",
  "change_duration",
] as const

const memoryOperationValues = ["remember", "forget"] as const

export const assistantIntentSchema = z.enum(assistantIntentValues)
export const taskEditOperationSchema = z.enum(taskEditOperationValues)
export const memoryOperationSchema = z.enum(memoryOperationValues)
export const assistantParserStageSchema = z.enum(["validated", "fallback"])
export const assistantParserErrorCodeSchema = z.enum([
  "parse_error",
  "json_extraction_error",
  "schema_validation_error",
])

export const assistantMessageRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required."),
  now: z.string().datetime().nullable().optional(),
  timezone: z.string().trim().min(1).nullable().optional(),
  currentDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export const parsedAssistantInputSchema = z
  .object({
    primary_intent: assistantIntentSchema,
    secondary_intents: z.array(assistantIntentSchema),
    needs_clarification: z.boolean(),
    clarification_reason: z.string().nullable(),
    user_facing_summary: z.string(),
    task: z
      .object({
        title: z.string().nullable(),
        duration_minutes: z.number().int().positive().nullable(),
        due_at: z.string().trim().min(1).nullable(),
        priority: z.enum(["low", "medium", "high"]).nullable(),
        tags: z.array(z.string()),
        all_day: z.boolean(),
        is_immutable: z.boolean(),
      })
      .strict(),
    event: z
      .object({
        title: z.string().nullable(),
        start_at: z.string().trim().min(1).nullable(),
        end_at: z.string().trim().min(1).nullable(),
        calendar_id: z.string().nullable(),
        all_day: z.boolean(),
        is_immutable: z.boolean(),
      })
      .strict(),
    task_edit: z
      .object({
        target_task_text: z.string().nullable(),
        operation: taskEditOperationSchema.nullable(),
        new_value: z.string().nullable(),
      })
      .strict(),
    memory: z
      .object({
        operation: memoryOperationSchema.nullable(),
        content: z.string().nullable(),
      })
      .strict(),
  })
  .strict()

export const assistantMessageResponseSchema = z.object({
  ok: z.boolean(),
  parsed: parsedAssistantInputSchema,
  rawMessage: z.string(),
  actionsTaken: z.array(z.string()).optional(),
  error: z.string().optional(),
  debug: z
    .object({
      parserStage: assistantParserStageSchema,
      errorCode: assistantParserErrorCodeSchema.optional(),
    })
    .optional(),
})

export type AssistantMessageRequest = z.infer<typeof assistantMessageRequestSchema>
export type ParsedAssistantInput = z.infer<typeof parsedAssistantInputSchema>
export type AssistantMessageResponse = z.infer<typeof assistantMessageResponseSchema>
export type AssistantIntent = z.infer<typeof assistantIntentSchema>
export type AssistantParserStage = z.infer<typeof assistantParserStageSchema>
export type AssistantParserErrorCode = z.infer<typeof assistantParserErrorCodeSchema>

export function createFallbackParsedAssistantInput(): ParsedAssistantInput {
  return {
    primary_intent: "unknown",
    secondary_intents: [],
    needs_clarification: true,
    clarification_reason: "Could not confidently parse the request.",
    user_facing_summary: "I could not confidently parse that request.",
    task: {
      title: null,
      duration_minutes: null,
      due_at: null,
      priority: null,
      tags: [],
      all_day: false,
      is_immutable: false,
    },
    event: {
      title: null,
      start_at: null,
      end_at: null,
      calendar_id: null,
      all_day: false,
      is_immutable: true,
    },
    task_edit: {
      target_task_text: null,
      operation: null,
      new_value: null,
    },
    memory: {
      operation: null,
      content: null,
    },
  }
}

// ##### END BACKEND #####
