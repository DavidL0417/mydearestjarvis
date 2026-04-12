// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER

import { NextResponse } from "next/server"

import { loadGoogleCalendarEventsForUser } from "@/lib/google-calendar-events"
import {
  isAuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/supabase/auth"

export async function GET() {
  try {
    const { user } = await requireAuthenticatedUser()
    const result = await loadGoogleCalendarEventsForUser(user.id)

    if (!result.connected) {
      return NextResponse.json(
        {
          success: false,
          error: "Google Calendar is not connected.",
          events: [],
        },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      events: result.events,
    })
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ success: false, error: "Authentication required.", events: [] }, { status: 401 })
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch Google Calendar events.",
        events: [],
      },
      { status: 500 },
    )
  }
}

// ##### END BACKEND #####
