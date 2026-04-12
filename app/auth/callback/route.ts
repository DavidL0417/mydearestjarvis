// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER

import { NextResponse } from "next/server"

import { getGoogleTokensFromSession, upsertGoogleCalendarIntegration } from "@/lib/supabase/google-calendar-integration"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getOrCreateUserProfile } from "@/lib/supabase/auth"
import { ensureTaskCalendarForUser } from "@/lib/tasks-calendar"

function getSafeRedirectPath(candidate: string | null) {
  if (!candidate || !candidate.startsWith("/")) {
    return "/"
  }

  return candidate
}

async function bootstrapAuthenticatedGoogleUser() {
  const supabase = await createSupabaseServerClient()
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  if (!userData.user) {
    return
  }

  const profile = await getOrCreateUserProfile(userData.user)
  await upsertGoogleCalendarIntegration({
    userId: profile.id,
    authUser: userData.user,
    ...getGoogleTokensFromSession(sessionData.session),
  })
  await ensureTaskCalendarForUser(profile.id)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"))

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      try {
        await bootstrapAuthenticatedGoogleUser()
      } catch (bootstrapError) {
        console.error("Google auth callback bootstrap failed after session exchange.", bootstrapError)
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL("/?authError=callback", requestUrl.origin))
}

// ##### END BACKEND #####
