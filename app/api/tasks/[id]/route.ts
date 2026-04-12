// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER

import { NextResponse } from "next/server"
import { z } from "zod"

import { mapTaskRowToTask, mapTaskToUpdate } from "@/lib/data/mappers"
import {
  isAuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/supabase/auth"
import { TASKS_CALENDAR_ID } from "@/lib/task-calendar-constants"
import {
  deleteTaskResponseSchema,
  taskMutationResponseSchema,
  updateTaskRequestSchema,
} from "@/schemas/tasks"
import type { DeleteTaskResponse, TaskMutationResponse, TaskRow, TaskStatus } from "@/types"

const taskIdSchema = z.string().uuid()

async function getValidatedTaskId(params: Promise<{ id: string }>) {
  const { id } = await params
  return taskIdSchema.safeParse(id)
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsedTaskId = await getValidatedTaskId(context.params)
  const body = await request.json().catch(() => null)
  const parsedBody = updateTaskRequestSchema.safeParse(body)

  if (!parsedTaskId.success) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 })
  }

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid task update request",
        issues: parsedBody.error.flatten(),
      },
      { status: 400 },
    )
  }

  try {
    const { adminClient, user } = await requireAuthenticatedUser()

    const { data: existingTask, error: existingTaskError } = await adminClient
      .from("tasks")
      .select("id, status, scheduled_for")
      .eq("id", parsedTaskId.data)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; status: TaskStatus; scheduled_for: string | null }>()

    if (existingTaskError) {
      throw new Error(existingTaskError.message)
    }

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    if (existingTask.status === "scheduled" || existingTask.scheduled_for) {
      return NextResponse.json(
        {
          error: "Scheduled tasks cannot be deleted.",
          details: "Unschedule the task first to move it back into the unscheduled queue.",
        },
        { status: 409 },
      )
    }

    const { error: deleteScheduleEventsError } = await adminClient
      .from("schedule_events")
      .delete()
      .eq("user_id", user.id)
      .eq("task_id", parsedTaskId.data)

    if (deleteScheduleEventsError) {
      throw new Error(deleteScheduleEventsError.message)
    }

    const { data, error } = await adminClient
      .from("tasks")
      .update({
        ...mapTaskToUpdate(parsedBody.data),
        calendar_id: TASKS_CALENDAR_ID,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsedTaskId.data)
      .eq("user_id", user.id)
      .select(
        "id, user_id, title, description, deadline, duration_minutes, priority, status, scheduled_for, created_at, updated_at, is_immutable, all_day, calendar_id, tags",
      )
      .maybeSingle<TaskRow>()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    const responsePayload: TaskMutationResponse = {
      success: true,
      task: mapTaskRowToTask(data),
    }

    const parsedResponse = taskMutationResponseSchema.safeParse(responsePayload)

    if (!parsedResponse.success) {
      return NextResponse.json(
        {
          error: "Invalid task update response payload",
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
        error: "Failed to update task.",
        details: error instanceof Error ? error.message : "Unknown task update error.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsedTaskId = await getValidatedTaskId(context.params)

  if (!parsedTaskId.success) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 })
  }

  try {
    const { adminClient, user } = await requireAuthenticatedUser()

    const { error: deleteScheduleEventsError } = await adminClient
      .from("schedule_events")
      .delete()
      .eq("user_id", user.id)
      .eq("task_id", parsedTaskId.data)

    if (deleteScheduleEventsError) {
      throw new Error(deleteScheduleEventsError.message)
    }

    const { data, error } = await adminClient
      .from("tasks")
      .delete()
      .eq("id", parsedTaskId.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle<{ id: string }>()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    const responsePayload: DeleteTaskResponse = {
      success: true,
      id: data.id,
    }

    const parsedResponse = deleteTaskResponseSchema.safeParse(responsePayload)

    if (!parsedResponse.success) {
      return NextResponse.json(
        {
          error: "Invalid task delete response payload",
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
        error: "Failed to delete task.",
        details: error instanceof Error ? error.message : "Unknown task delete error.",
      },
      { status: 500 },
    )
  }
}

// ##### END BACKEND #####
