"use client"

import { useEffect, useRef } from "react"

import { WaitlistForm } from "@/components/landing/waitlist-form"

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement | null>(null)
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null)
  const headlineRef = useRef<HTMLHeadingElement | null>(null)
  const subheadRef = useRef<HTMLParagraphElement | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)
  const keywordRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const targets = [eyebrowRef.current, headlineRef.current, subheadRef.current, formRef.current].filter(
      Boolean,
    ) as HTMLElement[]
    const keyword = keywordRef.current

    const revealNow = () => {
      targets.forEach((el) => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
      if (keyword) {
        keyword.style.clipPath = "inset(0 0% 0 0)"
        keyword.style.opacity = "1"
        keyword.style.transform = "none"
      }
    }

    const revealWhenVisible = () => {
      if (document.visibilityState === "visible") revealNow()
    }

    window.addEventListener("pageshow", revealNow)
    document.addEventListener("visibilitychange", revealWhenVisible)

    if (reduced) {
      revealNow()
      return () => {
        window.removeEventListener("pageshow", revealNow)
        document.removeEventListener("visibilitychange", revealWhenVisible)
      }
    }

    let cancelled = false
    const fallback = window.setTimeout(revealNow, 1800)
    void (async () => {
      const { eases, stagger, createTimeline } = await import("animejs")
      if (cancelled) return

      const tl = createTimeline({ defaults: { ease: eases.outExpo } })

      tl.add(
        targets,
        {
          opacity: [0, 1],
          translateY: [22, 0],
          duration: 800,
          delay: stagger(110, { start: 60 }),
        },
        0,
      )

      if (keyword) {
        tl.add(
          keyword,
          {
            "clip-path": ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
            opacity: [0, 1],
            duration: 720,
            ease: eases.outExpo,
          },
          440,
        )
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      window.removeEventListener("pageshow", revealNow)
      document.removeEventListener("visibilitychange", revealWhenVisible)
    }
  }, [])

  return (
    <div ref={heroRef} className="landing-hero relative min-h-[100svh] overflow-hidden">
      <div aria-hidden="true" className="hero-ambient-field">
        <span className="hero-ambient-wash" />
        <span className="hero-ambient-orb hero-ambient-orb-a" />
        <span className="hero-ambient-orb hero-ambient-orb-b" />
        <svg className="hero-ambient-svg" viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice">
          <path className="hero-ambient-poly hero-ambient-poly-a" d="M 272 176 L 686 42 L 1044 186 L 914 492 L 394 548 Z" />
          <path className="hero-ambient-poly hero-ambient-poly-b" d="M 442 136 L 842 84 L 1018 358 L 704 612 L 318 448 Z" />
          <path className="hero-ambient-poly hero-ambient-poly-c" d="M 126 460 L 496 216 L 800 398 L 566 686 L 174 624 Z" />
          <ellipse className="hero-ambient-ring hero-ambient-ring-a" cx="720" cy="330" rx="315" ry="168" />
          <ellipse className="hero-ambient-ring hero-ambient-ring-b" cx="720" cy="330" rx="214" ry="112" />
          <circle className="hero-ambient-core" cx="720" cy="330" r="4" />
        </svg>
      </div>
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1180px] flex-col justify-center gap-7 px-[var(--landing-px)] pb-[clamp(72px,10vh,132px)] pt-[calc(56px+clamp(28px,5vh,76px))] md:pl-[calc(var(--landing-px)+72px)]">
        <p
          ref={eyebrowRef}
          className="landing-mark flex items-center gap-2 text-[10.5px] text-muted-foreground opacity-0"
        >
          <span aria-hidden="true" className="inline-flex items-center text-[var(--copper)]">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="0.8" />
            </svg>
          </span>
          <span className="text-[var(--copper)]">01</span>
          <span aria-hidden="true">·</span>
          <span>A secretary that connects to everything</span>
        </p>

        <h1
          id="hero-heading"
          ref={headlineRef}
          className="landing-display max-w-[20ch] text-[clamp(2.6rem,8vw,6rem)] font-semibold leading-[0.96] text-foreground opacity-0"
        >
          Stop deciding{" "}
          <span
            ref={keywordRef}
            data-bloom-dim
            className="landing-keyword opacity-0"
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            what to do
          </span>
          .
        </h1>

        <p
          ref={subheadRef}
          className="max-w-[52ch] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.5] text-foreground/75 opacity-0"
        >
          Jarvis connects to your Gmail, Canvas, Notion, and everything else — then autonomously decides what you should do next. Full context. Zero effort.
        </p>

        <div ref={formRef} className="flex flex-col gap-3 opacity-0">
          <WaitlistForm variant="compact" id="hero-waitlist" />
          <p className="landing-mark text-[10.5px] text-muted-foreground">
            Invites in order. No spam. No setup. It just knows.
          </p>
        </div>
      </div>
    </div>
  )
}
