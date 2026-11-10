'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import React, { type ReactNode, useEffect, useRef } from 'react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  scale?: number;
  ease?: string;
  staggerChildren?: boolean;
  staggerDelay?: number;
  childSelector?: string;
  triggerOffset?: string;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delay = 0.2,
  duration = 1.0,
  yOffset = 32,
  scale = 0.98,
  ease = 'back.out(0.85)',
  staggerChildren = false,
  staggerDelay = 0.16,
  childSelector,
  triggerOffset = 'top 78%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (staggerChildren) {
        const targets = childSelector
          ? el.querySelectorAll(childSelector)
          : Array.from(el.children);

        if (targets.length > 0) {
          gsap.fromTo(
            targets,
            {
              opacity: 0,
              y: yOffset,
              scale: scale,
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration,
              delay,
              stagger: staggerDelay,
              ease,
              scrollTrigger: {
                trigger: el,
                start: triggerOffset,
                once: true,
              },
            },
          );
          return;
        }
      }

      gsap.fromTo(
        el,
        {
          opacity: 0,
          y: yOffset,
          scale: scale,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration,
          delay,
          ease,
          scrollTrigger: {
            trigger: el,
            start: triggerOffset,
            once: true,
          },
        },
      );
    });

    return () => mm.revert();
  }, [
    delay,
    duration,
    yOffset,
    scale,
    ease,
    staggerChildren,
    staggerDelay,
    childSelector,
    triggerOffset,
  ]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};
