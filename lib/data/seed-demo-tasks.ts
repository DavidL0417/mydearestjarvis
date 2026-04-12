import type { SeedDemoTask } from "@/lib/seed-demo-tasks"

export async function getSeedDemoTasksData(): Promise<SeedDemoTask[]> {
  try {
    const response = await fetch("/api/demo-tasks", { cache: "no-store" })

    if (!response.ok) {
      console.warn(`Demo tasks request failed with status ${response.status}`)
      return []
    }

    const data = (await response.json()) as { tasks?: SeedDemoTask[] }
    return Array.isArray(data.tasks) ? data.tasks : []
  } catch (error) {
    console.warn("Failed to load demo tasks", error)
    return []
  }
}
