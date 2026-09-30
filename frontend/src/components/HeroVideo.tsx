"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Looping background video for the hero (generated with Higgsfield, MiniMax H3, from the hero key art;
 * first and last frame are the same image, so the loop is seamless). The still image stays underneath
 * as poster and fallback; the video is skipped on small screens, data-saver and reduced-motion.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 799px)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setEnabled(!reduce && !small && !saveData);
  }, []);

  if (!enabled) return null;
  return (
    <video
      ref={ref}
      className={`hero-video ${ready ? "ready" : ""}`}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/img/hero-2400.webp"
      onCanPlay={() => setReady(true)}
      aria-hidden
    >
      <source src="/video/hero.webm" type="video/webm" />
      <source src="/video/hero.mp4" type="video/mp4" />
    </video>
  );
}
