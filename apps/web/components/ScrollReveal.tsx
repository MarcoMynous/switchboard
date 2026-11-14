'use client';

import type React from 'react';
import { type ReactNode, useEffect, useRef } from 'react';

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

type RevealCallback = () => void;
const callbacks = new WeakMap<Element, RevealCallback>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = callbacks.get(entry.target);
            if (cb) {
              cb();
              callbacks.delete(entry.target);
            }
            sharedObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -8% 0px' },
    );
  }
  return sharedObserver;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
  yOffset = 20,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) return;

    const observer = getSharedObserver();
    if (!observer) return;

    el.style.opacity = '0';
    el.style.transform = `translate3d(0, ${Math.min(yOffset, 24)}px, 0)`;
    el.style.transitionProperty = 'opacity, transform';
    el.style.transitionDuration = `${Math.min(duration, 0.6)}s`;
    el.style.transitionTimingFunction = 'cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transitionDelay = `${Math.min(delay, 0.2)}s`;

    callbacks.set(el, () => {
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0, 0, 0)';
    });
    observer.observe(el);

    return () => {
      callbacks.delete(el);
      observer.unobserve(el);
    };
  }, [delay, duration, yOffset]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};
