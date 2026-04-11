"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// API Hook: Replace mockTabs with fetch call here if tabs are dynamic
// Example: const { data: tabs } = useSWR('/api/panels/tabs', fetcher)
const mockTabs = [
  { id: "focus", label: "Focus" },
  { id: "tasks", label: "Tasks" },
  { id: "inbox", label: "Inbox" },
  { id: "status", label: "Status" },
]

export function PanelTabs() {
  const [activeTab, setActiveTab] = useState("focus")
  // API Hook: Replace mockTabs with fetched data
  const tabs = mockTabs

  return (
    <Card className="bg-card border-border">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground">Panel</CardTitle>
          <span className="text-xs text-muted-foreground capitalize font-semibold">{activeTab}</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-2">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs h-7 px-2.5 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-7 px-2.5 font-semibold"
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-tight font-medium">
          Master input, now-task guidance, and quick actions.
        </p>
      </CardContent>
    </Card>
  )
}
