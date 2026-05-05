"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardCurrentTask } from "@/types"

interface WhatToDoNowProps {
  currentTask?: DashboardCurrentTask | null
}

function getTaskSubtitle(status: DashboardCurrentTask["status"]) {
  if (status === "scheduled") {
    return "Scheduled"
  }

  if (status === "completed") {
    return "Complete"
  }

  if (status === "missed") {
    return "Missed"
  }

  return "Todo"
}

export function WhatToDoNow({ currentTask }: WhatToDoNowProps) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold">Now</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {currentTask ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{currentTask.title}</p>
            <p className="text-xs text-muted-foreground">{getTaskSubtitle(currentTask.status)}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No active task.</p>
        )}
      </CardContent>
    </Card>
  )
}
