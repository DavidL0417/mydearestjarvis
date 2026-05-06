import { getClaudeClient } from "@/lib/ai/claude"
import type { AssistantRuntimeContext } from "@/lib/assistant/context"
import type { AssistantConversationEntry } from "@/types"

const DEFAULT_DIALOGUE_MODEL = "claude-sonnet-4-6"
const SECRETARY_DIALOGUE_PROMPT = [
  "You are JARVIS, a trusted personal secretary with access to the user's working context.",
  "Reply directly to the user's latest message like a capable secretary, not a command parser or generic chatbot.",
  "Use the supplied tasks, events, availability, memory, source state, and available scheduling tools when relevant.",
  "You can discuss, plan, capture tasks, remember preferences, and help coordinate the next scheduling move.",
  "If the data is missing or stale, say what you cannot know instead of inventing it.",
  "Do not claim to create, update, delete, sync, email, invite, or move anything unless tool results say it happened.",
  "Destructive actions and external calendar writes require explicit approval.",
  "Sound attentive and operational. Keep the reply spare and useful: one to three short sentences unless the user asks for detail.",
].join("\n")

interface GenerateSecretaryDialogueReplyInput {
  message: string
  history: AssistantConversationEntry[]
  now: string | null
  timezone: string | null
  runtime: AssistantRuntimeContext
}

interface SecretaryDialogueReply {
  ok: boolean
  reply: string
  error?: string
  model?: string
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function buildTaskSnapshot(runtime: AssistantRuntimeContext) {
  return runtime.tasks
    .filter((task) => task.status !== "completed" && task.status !== "missed")
    .slice(0, 8)
    .map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      scheduledFor: task.scheduledFor,
      durationMinutes: task.durationMinutes,
      immutable: task.isImmutable,
    }))
}

function buildEventSnapshot(runtime: AssistantRuntimeContext) {
  return runtime.events.slice(0, 8).map((event) => ({
    title: event.title,
    start: event.start,
    end: event.end,
    source: event.source,
    immutable: event.isImmutable,
    calendarId: event.calendarId,
  }))
}

function buildDialoguePayload(input: GenerateSecretaryDialogueReplyInput) {
  return {
    now: input.now,
    timezone: input.timezone,
    latestUserMessage: input.message,
    recentConversation: input.history.slice(-8),
    availability: input.runtime.context.availability,
    availabilityWindows: input.runtime.context.availabilityWindows.slice(0, 8),
    openTasks: buildTaskSnapshot(input.runtime),
    upcomingEvents: buildEventSnapshot(input.runtime),
    memorySummary: input.runtime.context.memorySummary,
    memoryEntries: input.runtime.context.memoryEntries.slice(0, 8),
    sourceSnapshots: input.runtime.context.sourceSnapshots.slice(0, 8),
  }
}

function getTextFromClaudeMessage(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export function buildLocalDialogueFallback(
  message: string,
  runtime: Pick<AssistantRuntimeContext, "tasks" | "events" | "sourceSnapshots">,
) {
  const cleanMessage = normalizeText(message).toLowerCase()

  if (/^(hey|hi|hello|yo|good (morning|afternoon|evening))\b/.test(cleanMessage)) {
    return "Here. I have the schedule, tasks, and memory in front of me; tell me what needs handling."
  }

  if (/\bhow are (you|u)\b/.test(cleanMessage) || /\bhow's it going\b/.test(cleanMessage)) {
    return "Steady. I have the day in view and I'm ready to help with the next plan, task, or tradeoff."
  }

  if (/^(thanks|thank you|ty)\b/.test(cleanMessage)) {
    return "Anytime."
  }

  if (/\b(what can you do|help)\b/.test(cleanMessage)) {
    return "I can talk through the plan, capture tasks or memory, schedule the work, and flag approval before anything destructive or external changes."
  }

  if (/\b(status|ready|state)\b/.test(cleanMessage)) {
    const openTasks = runtime.tasks.filter((task) => task.status !== "completed" && task.status !== "missed")
    const failedSources = runtime.sourceSnapshots.filter(
      (snapshot) => snapshot.freshness === "failed" || snapshot.freshness === "stale",
    )
    const sourceNote =
      failedSources.length > 0 ? ` ${failedSources.length} source ${failedSources.length === 1 ? "warning" : "warnings"}.` : ""

    return `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}, ${runtime.events.length} calendar ${runtime.events.length === 1 ? "event" : "events"} loaded.${sourceNote}`
  }

  return null
}

export async function generateSecretaryDialogueReply(
  input: GenerateSecretaryDialogueReplyInput,
): Promise<SecretaryDialogueReply> {
  const localFallback = buildLocalDialogueFallback(input.message, input.runtime)
  const client = getClaudeClient()

  if (!client) {
    if (localFallback) {
      return {
        ok: true,
        reply: localFallback,
      }
    }

    return {
      ok: false,
      reply: "Claude is not configured in this environment, so I cannot give a real secretary answer yet.",
      error: "ANTHROPIC_API_KEY is missing. Dialogue cannot run until the Claude client is configured.",
    }
  }

  const model = process.env.ANTHROPIC_DIALOGUE_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_DIALOGUE_MODEL
  const payload = buildDialoguePayload(input)
  const message = await client.messages.create({
    model,
    max_tokens: 420,
    temperature: 0.3,
    system: SECRETARY_DIALOGUE_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify(payload, null, 2),
      },
    ],
  })
  const reply = getTextFromClaudeMessage(message.content)

  if (!reply) {
    return {
      ok: false,
      reply: "The dialogue model returned an empty reply.",
      error: "Claude returned no text for the secretary dialogue turn.",
      model,
    }
  }

  return {
    ok: true,
    reply,
    model,
  }
}
