"use client"

import { useEffect, useRef } from "react"

export function ParallaxGlow() {
  const topRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let targetY = window.scrollY
    let cameraY = targetY

    const update = () => {
      cameraY += (targetY - cameraY) * 0.075
      if (topRef.current) {
        topRef.current.style.transform = `translate3d(0, ${cameraY * -0.18}px, 0)`
      }
      if (bottomRef.current) {
        bottomRef.current.style.transform = `translate3d(0, ${cameraY * -0.34}px, 0)`
      }

      if (Math.abs(targetY - cameraY) > 0.15) {
        raf = window.requestAnimationFrame(update)
      } else {
        raf = 0
      }
    }

    const onScroll = () => {
      targetY = window.scrollY
      if (!raf) {
        raf = window.requestAnimationFrame(update)
      }
    }

    raf = window.requestAnimationFrame(update)
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="landing-parallax-glow pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        ref={topRef}
        className="absolute -left-[20%] -top-[30%] h-[140vh] w-[140vw] will-change-transform"
        style={{
          background:
            "radial-gradient(60rem 40rem at 30% 20%, var(--copper-glow), transparent 62%)",
        }}
      />
      <div
        ref={bottomRef}
        className="absolute -right-[10%] top-[10%] h-[160vh] w-[120vw] will-change-transform"
        style={{
          background:
            "radial-gradient(48rem 36rem at 70% 28%, oklch(0.55 0.14 38 / 0.10), transparent 66%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-[-20%] h-[80vh] will-change-transform"
        style={{
          background:
            "radial-gradient(50rem 28rem at 50% 80%, oklch(0.74 0.14 42 / 0.06), transparent 70%)",
        }}
      />
    </div>
  )
}
