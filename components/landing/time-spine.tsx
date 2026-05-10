"use client"

import { useEffect, useRef, useState } from "react"

import type { LandingMotionState } from "@/components/landing/landing-motion"

interface TimeSpineProps {
  motion: LandingMotionState
}

const HOURS = ["06", "09", "12", "15", "18", "21"]

function formatScrollClock(progress: number) {
  const minutes = Math.round(6 * 60 + progress * (21 - 6) * 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function TimeSpine({ motion }: TimeSpineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLDivElement | null>(null)
  const scrubberRef = useRef<HTMLDivElement | null>(null)
  const clockRef = useRef<HTMLSpanElement | null>(null)
  const labelRefs = useRef<Array<HTMLDivElement | null>>([])
  const blocksAnimatedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    const fill = fillRef.current
    const scrubber = scrubberRef.current
    const clock = clockRef.current
    if (!container || !fill || !scrubber || !clock || motion.sections.length === 0) return

    if (motion.reducedMotion) {
      const labels = labelRefs.current.filter(Boolean) as HTMLDivElement[]
      labels.forEach((el) => {
        el.style.opacity = "1"
        el.style.transform = "translate3d(0,0,0)"
      })
      scrubber.style.opacity = "1"
      fill.style.opacity = "1"
      const blocks = container.querySelectorAll<HTMLElement>("[data-section-block]")
      blocks.forEach((el) => {
        el.style.opacity = "1"
      })
      return
    }

    let cancelled = false
    void (async () => {
      const { animate, stagger, eases } = await import("animejs")
      if (cancelled) return

      if (!blocksAnimatedRef.current) {
        const labels = labelRefs.current.filter(Boolean) as HTMLDivElement[]
        animate(labels, {
          opacity: [0, 1],
          translateY: [-6, 0],
          duration: 540,
          delay: stagger(70, { start: 80 }),
          ease: eases.outQuart,
        })
        const blocks = container.querySelectorAll<HTMLElement>("[data-section-block]")
        animate(Array.from(blocks), {
          opacity: [0, 1],
          translateX: [-8, 0],
          duration: 600,
          delay: stagger(60, { start: 200 }),
          ease: eases.outQuart,
        })
        animate(fill, {
          opacity: [0, 1],
          duration: 480,
          delay: 720,
          ease: eases.outQuart,
        })
        animate(scrubber, {
          opacity: [0, 1],
          scale: [0.6, 1],
          duration: 500,
          delay: 740,
          ease: eases.outQuart,
        })
        blocksAnimatedRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [motion.reducedMotion, motion.sections.length])

  const handleSectionClick = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const fillHeight = motion.overallProgress * 100
  const scrubberTop = fillHeight

  return (
    <aside
      className="time-spine pointer-events-none fixed left-0 top-14 z-20 hidden h-[calc(100vh-56px)] w-16 md:flex"
      data-active-scene={motion.activeId}
    >
      <div className="relative ml-auto h-full w-full">
        {/* vertical rule */}
        <span className="time-spine-rule absolute left-[34px] top-3 bottom-3 w-px bg-[var(--rule)]" aria-hidden="true" />

        <div ref={containerRef} className="absolute inset-y-3 left-0 right-0">
          {/* hour ticks crossing the rule */}
          {HOURS.map((label, index) => {
            const top = (index / (HOURS.length - 1)) * 100
            return (
              <div
                key={label}
                ref={(el) => {
                  labelRefs.current[index] = el
                }}
                className="absolute left-0 right-0 flex items-center opacity-0"
                style={{ top: `${top}%`, transform: "translateY(-50%)" }}
              >
                <span
                  aria-hidden="true"
                  className="absolute h-px bg-[var(--rule-strong)]"
                  style={{ left: 28, width: 14 }}
                />
                <span
                  className="landing-mark absolute text-[9.5px] font-medium leading-none text-muted-foreground"
                  style={{ left: 46 }}
                >
                  {label}
                </span>
              </div>
            )
          })}

          {/* section blocks (track lanes) */}
          {motion.sections.map((section) => {
            const isActive = section.id === motion.activeId
            const isHovered = section.id === hoveredId
            const top = section.topRatio * 100
            const height = Math.max(section.heightRatio * 100, 4)
            const targetWidth = isHovered ? 16 : 6
            return (
              <button
                type="button"
                key={section.id}
                data-section-block={section.id}
                onMouseEnter={() => setHoveredId(section.id)}
                onMouseLeave={() => setHoveredId((id) => (id === section.id ? null : id))}
                onClick={() => handleSectionClick(section.elementId)}
                aria-label={`Jump to section ${section.index} ${section.label}`}
                tabIndex={0}
                className="pointer-events-auto absolute cursor-pointer rounded-[2px] opacity-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--copper)] focus-visible:ring-offset-1"
                style={{
                  left: `${34 - targetWidth + 1}px`,
                  top: `${top}%`,
                  height: `${height}%`,
                  width: `${targetWidth}px`,
                  background: isActive
                    ? "color-mix(in oklab, var(--copper) 24%, var(--rule-strong))"
                    : isHovered
                    ? "oklch(0.40 0.018 35)"
                    : "var(--rule)",
                  transition:
                    "width 380ms cubic-bezier(0.22, 1, 0.36, 1), background-color 360ms ease-out, left 380ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {section.label ? (
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-center"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      opacity: isHovered ? 1 : 0,
                      transition: "opacity 220ms ease-out",
                    }}
                  >
                    <span className="landing-mark text-[8.5px] font-semibold leading-none text-foreground/90 whitespace-nowrap">
                      {section.index} / {section.label}
                    </span>
                  </span>
                ) : null}
              </button>
            )
          })}

          {/* continuous copper fill — grows from top as user scrolls through the doc */}
          <div
            ref={fillRef}
            data-fill
            aria-hidden="true"
            className="pointer-events-none absolute left-[7px] top-0 w-[28px] origin-top opacity-0"
            style={{
              height: `${fillHeight}%`,
              background:
                "linear-gradient(to bottom, var(--signal-copper), var(--signal-teal))",
              borderRadius: "2px 2px 0 0",
              boxShadow:
                "0 0 0 1px oklch(0.84 0.12 50 / 0.45) inset, 0 8px 24px -8px oklch(0.74 0.14 42 / 0.7)",
              transition: "opacity 180ms ease-out",
              willChange: "height",
            }}
          />

          {/* scrubber pill — anchored to the bottom edge of the fill */}
          <div
            ref={scrubberRef}
            className="pointer-events-none absolute left-0 flex items-center gap-1 opacity-0"
            style={{
              top: `${scrubberTop}%`,
              transform: "translate3d(0, -8px, 0)",
              transition: "opacity 180ms ease-out",
              willChange: "top",
            }}
          >
            <span className="landing-mark inline-flex items-center rounded-[2px] bg-[var(--copper)] px-1 py-[2px] text-[9px] font-semibold leading-none text-[var(--background)] whitespace-nowrap shadow-[0_4px_12px_-4px_oklch(0.74_0.14_42_/_0.6)]">
              <span ref={clockRef}>{formatScrollClock(motion.overallProgress)}</span>
            </span>
            <span className="block h-[1.5px] w-2 bg-[var(--copper)]" aria-hidden="true" />
          </div>
        </div>
      </div>
    </aside>
  )
}
