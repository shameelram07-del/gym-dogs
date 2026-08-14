'use client';

import { useEffect, useRef, useState } from 'react';

// Apple-style reveal: children fade in and rise as they enter the viewport.
// Usage: <Reveal delay={80}> ... </Reveal>  (delay in ms, staggers siblings)
// Respects the user's reduced-motion preference.
//
// `style` merges into the wrapper. It exists because this renders a real div:
// wrapping a flex child without passing its width/flex down collapses the
// layout. Optional — every existing caller is unaffected.
export default function Reveal({ children, delay = 0, y = 20, style }) {
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
      // threshold is a fraction of the ELEMENT, so a requirement like 0.12 is
      // unsatisfiable once the element is taller than ~8 screens — the observer
      // never fires and the content simply stays at opacity 0. The negative
      // bottom margin already expresses the real intent ("once it's properly on
      // screen") in a way that doesn't depend on how tall the content grows.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
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
        ...style,
      }}
    >
      {children}
    </div>
  );
}
