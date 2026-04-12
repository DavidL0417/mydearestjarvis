"use client"

import type { ScheduleEvent } from "@/types"

export async function fetchGoogleEvents() {
  const response = await fetch("/api/google-calendar/events", { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; error?: string; events?: ScheduleEvent[] }
    | null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Google Calendar sync failed with status ${response.status}.`)
  }

  return payload.events || []
}
