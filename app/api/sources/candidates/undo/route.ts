import { NextResponse } from "next/server"

import { undoSourceCandidateApproval } from "@/lib/sources/persistence"
import {
  isAuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/supabase/auth"
import {
  undoCandidatesRequestSchema,
  undoCandidatesResponseSchema,
} from "@/schemas/sources"
import type { UndoCandidatesResponse } from "@/schemas/sources"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsedBody = undoCandidatesRequestSchema.safeParse(body)

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid candidate undo request",
        issues: parsedBody.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const { adminClient, user } = await requireAuthenticatedUser()
    const result = await undoSourceCandidateApproval({
      adminClient,
      userId: user.id,
      candidateIds: parsedBody.data.candidateIds,
    })
    const responsePayload: UndoCandidatesResponse = {
      success: true,
      candidates: result.candidates,
      deletedTaskIds: result.deletedTaskIds,
    }
    const parsedResponse = undoCandidatesResponseSchema.safeParse(responsePayload)

    if (!parsedResponse.success) {
      return NextResponse.json(
        {
          error: "Invalid candidate undo response payload",
          issues: parsedResponse.error.flatten(),
        },
        { status: 500 },
      )
    }

    return NextResponse.json(parsedResponse.data)
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: "Failed to undo source candidate approval.",
        details: error instanceof Error ? error.message : "Unknown candidate undo error.",
      },
      { status: 500 },
    )
  }
}
