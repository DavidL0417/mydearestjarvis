import { NextResponse } from "next/server"

import {
  isAuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/supabase/auth"

interface DedupeResult {
  success: true
  removedCandidates: number
  removedTasks: number
  removedEvents: number
}

export async function POST() {
  try {
    const { adminClient, user } = await requireAuthenticatedUser()

    const { data: losers, error: losersError } = await adminClient
      .from("source_candidates")
      .select("id, kind, title, due_at, course, status, approved_task_id, created_at")
      .eq("user_id", user.id)
      .neq("status", "dismissed")

    if (losersError) {
      throw new Error(losersError.message)
    }

    type Row = {
      id: string
      kind: string
      title: string
      due_at: string | null
      course: string | null
      status: string
      approved_task_id: string | null
      created_at: string
    }
    const rows = (losers || []) as Row[]
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      const key = [row.kind, row.title.trim(), row.due_at ?? "", row.course?.trim() ?? ""].join("|")
      const bucket = groups.get(key) ?? []
      bucket.push(row)
      groups.set(key, bucket)
    }

    const loserCandidateIds: string[] = []
    const loserTaskIds: string[] = []
    for (const bucket of groups.values()) {
      if (bucket.length <= 1) continue
      bucket.sort((a, b) => {
        const aApproved = a.status === "approved" ? 0 : 1
        const bApproved = b.status === "approved" ? 0 : 1
        if (aApproved !== bApproved) return aApproved - bApproved
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      for (let i = 1; i < bucket.length; i += 1) {
        loserCandidateIds.push(bucket[i].id)
        if (bucket[i].approved_task_id) {
          loserTaskIds.push(bucket[i].approved_task_id as string)
        }
      }
    }

    let removedEvents = 0
    let removedTasks = 0

    if (loserTaskIds.length > 0) {
      const { data: deletedEvents, error: eventErr } = await adminClient
        .from("schedule_events")
        .delete()
        .eq("user_id", user.id)
        .in("task_id", loserTaskIds)
        .select("id")

      if (eventErr) {
        throw new Error(eventErr.message)
      }

      removedEvents = (deletedEvents || []).length

      const { data: deletedTasks, error: taskErr } = await adminClient
        .from("tasks")
        .delete()
        .eq("user_id", user.id)
        .in("id", loserTaskIds)
        .select("id")

      if (taskErr) {
        throw new Error(taskErr.message)
      }

      removedTasks = (deletedTasks || []).length
    }

    let removedCandidates = 0
    if (loserCandidateIds.length > 0) {
      const { data: deletedCandidates, error: candidateErr } = await adminClient
        .from("source_candidates")
        .delete()
        .eq("user_id", user.id)
        .in("id", loserCandidateIds)
        .select("id")

      if (candidateErr) {
        throw new Error(candidateErr.message)
      }

      removedCandidates = (deletedCandidates || []).length
    }

    const response: DedupeResult = {
      success: true,
      removedCandidates,
      removedTasks,
      removedEvents,
    }

    return NextResponse.json(response)
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: "Failed to dedupe source candidates.",
        details: error instanceof Error ? error.message : "Unknown dedupe error.",
      },
      { status: 500 },
    )
  }
}
