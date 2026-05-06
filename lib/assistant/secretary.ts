import type { SupabaseClient } from "@supabase/supabase-js"

import { loadAssistantRuntimeContext } from "@/lib/assistant/context"
import { generateSecretaryDialogueReply } from "@/lib/assistant/dialogue"
import { TASKS_CALENDAR_ID } from "@/lib/task-calendar-constants"
import { assistantMessageResponseSchema } from "@/schemas/assistant"
import type {
  AssistantConversationEntry,
  AssistantMessageResponse,
  AssistantToolCallResult,
  Priority,
} from "@/types"

interface RunSecretaryTurnInput {
  supabase: SupabaseClient
  userId: string
  message: string
  now: string | null
  timezone: string | null
  history: AssistantConversationEntry[]
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function makeReceipt(
  tool: string,
  status: AssistantToolCallResult["status"],
  summary: string,
): AssistantToolCallResult {
  return {
    id: crypto.randomUUID(),
    tool,
    status,
    summary,
  }
}

async function createThread(supabase: SupabaseClient, userId: string, title: string) {
  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({
      user_id: userId,
      title: title.slice(0, 80),
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create assistant thread.")
  }

  return data.id
}

async function insertMessage(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    role: "user" | "assistant"
    content: string
  },
) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      user_id: input.userId,
      thread_id: input.threadId,
      role: input.role,
      content: input.content,
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to record assistant message.")
  }

  return data.id
}

async function insertToolRun(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    messageId: string | null
    receipt: AssistantToolCallResult
    payload?: Record<string, unknown>
    requiresApproval?: boolean
  },
) {
  const { error } = await supabase.from("assistant_tool_runs").insert({
    user_id: input.userId,
    thread_id: input.threadId,
    message_id: input.messageId,
    tool_name: input.receipt.tool,
    status: input.receipt.status,
    summary: input.receipt.summary,
    payload: input.payload ?? {},
    requires_approval: input.requiresApproval ?? input.receipt.status === "pending_approval",
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function insertChangeLog(
  supabase: SupabaseClient,
  input: {
    userId: string
    action: string
    targetTable: string
    targetId: string
    summary: string
    afterValue?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from("change_logs").insert({
    user_id: input.userId,
    actor: "assistant",
    action: input.action,
    target_table: input.targetTable,
    target_id: input.targetId,
    summary: input.summary,
    before_value: null,
    after_value: input.afterValue ?? null,
    source_label: "master_input",
  })

  if (error) {
    throw new Error(error.message)
  }
}

function parseTaskTitle(message: string) {
  const normalized = normalizeText(message)
  const taskPatterns = [
    /^(?:add|create)\s+(?:a\s+)?(?:task|todo|to-do)\s+(?:to\s+)?(?<title>.+)$/i,
    /^(?:todo|task):\s*(?<title>.+)$/i,
    /^remind me to\s+(?<title>.+)$/i,
  ]

  for (const pattern of taskPatterns) {
    const match = normalized.match(pattern)
    const title = match?.groups?.title?.trim()

    if (title) {
      return title
    }
  }

  return null
}

function parsePriority(message: string): Priority {
  const normalized = message.toLowerCase()

  if (/\b(high|urgent|important|critical)\b/.test(normalized)) {
    return "high"
  }

  if (/\b(low|someday|backlog)\b/.test(normalized)) {
    return "low"
  }

  return "medium"
}

function parseMemoryContent(message: string) {
  const normalized = normalizeText(message)
  const memoryPatterns = [
    /^remember(?: that)?\s+(?<content>.+)$/i,
    /^note(?: that)?\s+(?<content>.+)$/i,
  ]

  for (const pattern of memoryPatterns) {
    const match = normalized.match(pattern)
    const content = match?.groups?.content?.trim()

    if (content) {
      return content
    }
  }

  return null
}

function requiresExternalApproval(message: string) {
  const normalized = message.toLowerCase()
  const destructiveOrExternal = /\b(delete|remove|cancel|move|reschedule|send|invite|email)\b/.test(normalized)
  const externalTarget = /\b(google|calendar|event|meeting|gmail|notion|caldav)\b/.test(normalized)
  return destructiveOrExternal && externalTarget
}

async function handleRemember(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    assistantMessageId: string | null
    content: string
  },
) {
  const { data, error } = await supabase
    .from("memory_items")
    .insert({
      user_id: input.userId,
      kind: "preference",
      category: "user_instruction",
      content: input.content,
      importance: "medium",
      source_label: "master_input",
      status: "active",
      confidence: 0.9,
    })
    .select("id")
    .single<{ id: string }>()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save memory.")
  }

  const receipt = makeReceipt("remember", "completed", "Saved one durable memory item.")
  await insertToolRun(supabase, {
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.assistantMessageId,
    receipt,
    payload: { memoryId: data.id, content: input.content },
  })
  await insertChangeLog(supabase, {
    userId: input.userId,
    action: "memory.create",
    targetTable: "memory_items",
    targetId: data.id,
    summary: "Saved memory from Master Input.",
    afterValue: { content: input.content },
  })

  return receipt
}

async function handleCreateTask(
  supabase: SupabaseClient,
  input: {
    userId: string
    threadId: string
    assistantMessageId: string | null
    title: string
    message: string
  },
) {
  const priority = parsePriority(input.message)
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: input.userId,
      title: input.title,
      description: null,
      deadline: null,
      duration_minutes: null,
      priority,
      status: "todo",
      scheduled_for: null,
      is_immutable: false,
      all_day: false,
      calendar_id: TASKS_CALENDAR_ID,
      tags: [],
    })
    .select("id, title, priority")
    .single<{ id: string; title: string; priority: Priority }>()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create task.")
  }

  const receipt = makeReceipt("create_task", "completed", `Created "${data.title}".`)
  await insertToolRun(supabase, {
    userId: input.userId,
    threadId: input.threadId,
    messageId: input.assistantMessageId,
    receipt,
    payload: { taskId: data.id, title: data.title, priority: data.priority },
  })
  await insertChangeLog(supabase, {
    userId: input.userId,
    action: "task.create",
    targetTable: "tasks",
    targetId: data.id,
    summary: `Created task "${data.title}" from Master Input.`,
    afterValue: { title: data.title, priority: data.priority },
  })

  return receipt
}

export async function runSecretaryTurn(input: RunSecretaryTurnInput): Promise<AssistantMessageResponse> {
  const cleanMessage = normalizeText(input.message)
  const runtimeBefore = await loadAssistantRuntimeContext(input.supabase, input.userId)
  const threadId = await createThread(input.supabase, input.userId, cleanMessage || "Master Input")
  await insertMessage(input.supabase, {
    userId: input.userId,
    threadId,
    role: "user",
    content: cleanMessage,
  })

  const toolCalls: AssistantToolCallResult[] = []
  let reply: string
  let ok = true
  let error: string | undefined
  let model: string | undefined
  let needsRefresh = false
  let clarification: string | null = null

  if (requiresExternalApproval(cleanMessage)) {
    const receipt = makeReceipt(
      "approval_required",
      "pending_approval",
      "External or destructive calendar action requires an explicit approval plan.",
    )
    toolCalls.push(receipt)
    reply = "I need an explicit approval step before changing external calendars or destructive events."
    clarification = "Confirm the exact event, target time, and whether I should write to Google Calendar."
  } else {
    const memoryContent = parseMemoryContent(cleanMessage)
    const taskTitle = parseTaskTitle(cleanMessage)

    if (memoryContent) {
      reply = "Remembered."
      needsRefresh = true
    } else if (taskTitle) {
      reply = `Added "${taskTitle}".`
      needsRefresh = true
    } else {
      const dialogue = await generateSecretaryDialogueReply({
        message: cleanMessage,
        now: input.now,
        timezone: input.timezone,
        history: input.history,
        runtime: runtimeBefore,
      })
      reply = dialogue.reply
      ok = dialogue.ok
      error = dialogue.error
      model = dialogue.model
    }
  }

  const assistantMessageId = await insertMessage(input.supabase, {
    userId: input.userId,
    threadId,
    role: "assistant",
    content: reply,
  })

  if (toolCalls.length > 0) {
    await insertToolRun(input.supabase, {
      userId: input.userId,
      threadId,
      messageId: assistantMessageId,
      receipt: toolCalls[0],
      requiresApproval: true,
    })
  } else {
    const memoryContent = parseMemoryContent(cleanMessage)
    const taskTitle = parseTaskTitle(cleanMessage)

    if (memoryContent) {
      toolCalls.push(
        await handleRemember(input.supabase, {
          userId: input.userId,
          threadId,
          assistantMessageId,
          content: memoryContent,
        }),
      )
    } else if (taskTitle) {
      toolCalls.push(
        await handleCreateTask(input.supabase, {
          userId: input.userId,
          threadId,
          assistantMessageId,
          title: taskTitle,
          message: cleanMessage,
        }),
      )
    }
  }

  const runtimeAfter = needsRefresh
    ? await loadAssistantRuntimeContext(input.supabase, input.userId)
    : runtimeBefore

  return assistantMessageResponseSchema.parse({
    ok,
    reply,
    toolCalls,
    needsRefresh,
    clarification,
    context: runtimeAfter.context,
    error,
    debug: model ? { model } : undefined,
  })
}
