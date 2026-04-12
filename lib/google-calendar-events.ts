import { getStoredGoogleIntegration } from "@/lib/supabase/google-calendar-integration"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import type { ScheduleEvent } from "@/types"

const DAY_IN_MS = 24 * 60 * 60 * 1000
const GOOGLE_EVENT_LOOKBACK_DAYS = 90
const GOOGLE_EVENT_LOOKAHEAD_DAYS = 180
const GOOGLE_CALENDAR_ID_PREFIX = "google-calendar:"

interface GoogleCalendarListItem {
  id?: string
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItem[]
}

interface GoogleCalendarEventDateTime {
  date?: string
  dateTime?: string
}

interface GoogleCalendarEventItem {
  id: string
  summary?: string
  location?: string
  start?: GoogleCalendarEventDateTime
  end?: GoogleCalendarEventDateTime
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEventItem[]
}

function toEventTimestamp(value: GoogleCalendarEventDateTime | undefined, fallbackHour: string) {
  if (!value) {
    return null
  }

  if (value.dateTime) {
    return new Date(value.dateTime).toISOString()
  }

  if (value.date) {
    return new Date(`${value.date}T${fallbackHour}:00`).toISOString()
  }

  return null
}

function toAllDayEndTimestamp(value: GoogleCalendarEventDateTime | undefined) {
  if (!value?.date) {
    return null
  }

  return new Date(new Date(`${value.date}T00:00:00`).getTime() - 60_000).toISOString()
}

function mapGoogleEventToScheduleEvent(
  item: GoogleCalendarEventItem,
  googleCalendarId: string,
  userId: string,
): ScheduleEvent | null {
  const start = toEventTimestamp(item.start, "00:00")
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime)
  const end = isAllDay ? toAllDayEndTimestamp(item.end) : toEventTimestamp(item.end, "23:59")

  if (!start || !end) {
    return null
  }

  return {
    id: `google-${googleCalendarId}-${item.id}`,
    userId,
    taskId: null,
    title: item.summary?.trim() || "Untitled event",
    start,
    end,
    source: "calendar",
    priority: "medium",
    status: null,
    location: item.location?.trim() || null,
    externalEventId: `${googleCalendarId}:${item.id}`,
    gcalEventId: `${googleCalendarId}:${item.id}`,
    lastSyncedFrom: "gcal",
    isImmutable: true,
    isCheckedIn: false,
    allDay: isAllDay,
    calendarId: `${GOOGLE_CALENDAR_ID_PREFIX}${googleCalendarId}`,
  }
}

async function refreshGoogleAccessToken(userId: string, refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token) {
    return null
  }

  const expiresAt =
    typeof payload.expires_in === "number"
      ? new Date(Date.now() + payload.expires_in * 1_000).toISOString()
      : null

  const adminClient = createSupabaseAdminClient()
  await adminClient
    .from("user_integrations")
    .update({
      access_token: payload.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google")

  return payload.access_token
}

async function getValidGoogleAccessToken(userId: string) {
  const integration = await getStoredGoogleIntegration(userId)

  if (!integration) {
    return null
  }

  if (integration.access_token) {
    const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : null

    if (!expiresAt || expiresAt > Date.now() + 60_000) {
      return integration.access_token
    }
  }

  if (!integration.refresh_token) {
    return integration.access_token
  }

  return refreshGoogleAccessToken(userId, integration.refresh_token)
}

async function fetchGoogleCalendarList(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(errorText || `Google calendar list failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as GoogleCalendarListResponse
  return (payload.items || [])
    .map((item) => item.id)
    .filter((calendarId): calendarId is string => typeof calendarId === "string" && calendarId.length > 0)
}

async function fetchGoogleEventsForCalendar(accessToken: string, googleCalendarId: string, userId: string) {
  const now = Date.now()
  const timeMin = new Date(now - GOOGLE_EVENT_LOOKBACK_DAYS * DAY_IN_MS).toISOString()
  const timeMax = new Date(now + GOOGLE_EVENT_LOOKAHEAD_DAYS * DAY_IN_MS).toISOString()
  const searchParams = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(errorText || `Google calendar events failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as GoogleCalendarEventsResponse
  return (payload.items || [])
    .map((item) => mapGoogleEventToScheduleEvent(item, googleCalendarId, userId))
    .filter((event): event is ScheduleEvent => event !== null)
}

async function updateGoogleLastSyncedAt(userId: string) {
  const adminClient = createSupabaseAdminClient()
  await adminClient
    .from("user_integrations")
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google")
}

export async function loadGoogleCalendarEventsForUser(userId: string) {
  const accessToken = await getValidGoogleAccessToken(userId)

  if (!accessToken) {
    return {
      connected: false,
      events: [] as ScheduleEvent[],
    }
  }

  const calendarIds = await fetchGoogleCalendarList(accessToken)
  const eventResults = await Promise.allSettled(
    calendarIds.map((calendarId) => fetchGoogleEventsForCalendar(accessToken, calendarId, userId)),
  )
  const failedResults = eventResults.filter((result): result is PromiseRejectedResult => result.status === "rejected")

  if (failedResults.length > 0) {
    const firstReason = failedResults[0].reason
    const detail = firstReason instanceof Error ? firstReason.message : String(firstReason)
    throw new Error(
      `Failed to fetch Google Calendar events for ${failedResults.length} calendar(s). ${detail}`,
    )
  }

  const events = eventResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  await updateGoogleLastSyncedAt(userId)

  return {
    connected: true,
    events,
  }
}
