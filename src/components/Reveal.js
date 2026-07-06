'use client';

import { useEffect, useRef, useState } from 'react';

// Apple-style reveal: children fade in and rise as they enter the viewport.
// Usage: <Reveal delay={80}> ... </Reveal>  (delay in ms, staggers siblings)
// Respects the user's reduced-motion preference.
export default function Reveal({ children, delay = 0, y = 20 }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    // Accessibility: skip the animation entirely if the user prefers reduced motion.
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.75s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
