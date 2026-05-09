# JARVIS Design

Current snapshot after the landing motion overhaul. JARVIS should feel like operational software with a secretary-second-brain posture: spare, precise, schedule-first, and honest about limits.

## Color

Dark, warm, restrained. The core identity is copper on tinted near-black neutrals, with limited signal colors used only when they communicate source intake or scheduling state.

- landing background: oklch(0.135 0.012 35)
- landing foreground: oklch(0.96 0.014 70)
- copper: oklch(0.74 0.14 42)
- copper bright: oklch(0.84 0.13 50)
- signal teal: oklch(0.70 0.09 185)
- signal blue: oklch(0.68 0.08 250)
- signal green: oklch(0.72 0.08 132)
- rule: oklch(0.26 0.014 35)

Signal colors are not decorative palette expansion. They represent abstract source channels flowing into a plan.

## Typography

- Sans: Geist Sans for product UI.
- Display: Bricolage Grotesque for landing display moments.
- Mono: Geist Mono, reserved for compact marks, numerals, and technical contexts.
- Numerals use tabular settings where alignment matters without turning ordinary labels into terminal cosplay.

## Landing Motion

The landing uses two motion layers: a full-viewport hero ambient field, then a scroll-synced "sources to plan" system.

- The hero owns the first viewport. Its faint polygon field is visible on load, gently pulses/displaces, and receives only subtle pointer illumination before scrolling away with the page.
- The fixed source-to-plan system should not show fragmented geometry on first load; it begins as the user leaves the hero and continues through the final CTA.
- Abstract source channels enter from the edges, converge into a central sorting point, then resolve into schedule geometry.
- The left time spine shares the same section/progress model as the background, so it reads as the scheduler rail for the animation.
- The final CTA may dim the background toward black while accenting the action phrase, reinforcing the move from planning to doing.
- Motion uses SVG/CSS with light JS and selective animejs entrance choreography.
- Reduced-motion mode keeps a static source-to-plan composition instead of hiding the visual system.
- Source names and logos are intentionally absent to avoid overpromising specific integrations.

## Product Layout

- Main authenticated surface remains schedule-first.
- Daily command strip and schedule are primary.
- Source intake, review ledger, risk/source context, command input, task queue, and sync state are supporting regions.
- Controls keep stable dimensions to avoid layout shift.
- Empty, auth, error, backend, source-refresh, and calendar-sync states must stay honest.

## Components In Use

Next.js App Router, Tailwind v4, shadcn/ui baseline, lucide icons, animejs for targeted motion. Custom surfaces include the landing motion system, time spine, dashboard preview, schedule view, task manager, master input, calendars sidebar, and secretary overlay.

## Constraints

- Do not migrate frameworks.
- Do not hide backend, auth, source-refresh, or calendar-sync failures behind placeholders.
- Do not add fake/demo content to landing or dashboard previews beyond explicit illustrative static marketing mockups.
- Keep repeated controls icon-first with tooltips where recognition needs help.
- Avoid nested cards, marketing clutter inside the product surface, glassmorphism, gradient text, side-stripe accents, and generic SaaS hero metrics.
