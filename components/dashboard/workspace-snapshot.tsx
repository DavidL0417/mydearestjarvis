"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardStats } from "@/types"

interface StatItemProps {
  label: string
  value: string | number
}

interface WorkspaceSnapshotProps {
  stats?: DashboardStats
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  )
}

function formatCheckIns(value: DashboardStats["checkInMode"]) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function WorkspaceSnapshot({ stats }: WorkspaceSnapshotProps) {
  if (!stats) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
          No dashboard state loaded.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold">Workspace</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0">
        <StatItem label="Tasks" value={stats.tasks} />
        <StatItem label="Loose" value={stats.unscheduled} />
        <StatItem label="Overdue" value={stats.overdue} />
        <StatItem label="Check-ins" value={formatCheckIns(stats.checkInMode)} />
      </CardContent>
    </Card>
  )
}
