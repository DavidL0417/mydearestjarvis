"use client"

import type { GoogleCalendarSyncResponse } from "@/types"

export async function fetchGoogleEvents() {
  const response = await fetch("/api/google-calendar/events", {
    method: "POST",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as GoogleCalendarSyncResponse | null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Google Calendar sync failed with status ${response.status}.`)
  }

  return payload.events || []
}
