import { NextResponse } from "next/server"

import { getSeedDemoTasks } from "@/lib/seed-demo-tasks"

export async function GET() {
  try {
    const tasks = await getSeedDemoTasks()
    return NextResponse.json({ tasks })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load demo tasks.",
        details: error instanceof Error ? error.message : "Unknown demo task error.",
      },
      { status: 500 },
    )
  }
}
