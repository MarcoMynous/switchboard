import Link from 'next/link';
import { useId } from 'react';

export interface SwitchboardLogoProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
  iconOnly?: boolean;
  className?: string;
}

export function SwitchboardIconSvg({ className = 'w-9 h-9' }: { className?: string }) {
  const uid = useId();
  const bgId = `sb-bg-${uid}`;
  const smileId = `sb-smile-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 select-none transition-transform duration-200 group-hover:scale-105 group-active:scale-95 ${className}`}
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="35%" r="70%" fx="50%" fy="35%">
          <stop offset="0%" stopColor="#1E2778" />
          <stop offset="55%" stopColor="#141A56" />
          <stop offset="100%" stopColor="#0B0F38" />
        </radialGradient>
        <linearGradient
          id={smileId}
          x1="28"
          y1="120"
          x2="132"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="152" height="152" rx="40" fill={`url(#${bgId})`} />
      <rect
        x="4.75"
        y="4.75"
        width="150.5"
        height="150.5"
        rx="39.25"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />

      {/* 5 Symmetrical White Signal Bars */}
      <rect x="24" y="68" width="15" height="34" rx="7.5" fill="#FFFFFF" />
      <rect x="48" y="51" width="15" height="58" rx="7.5" fill="#FFFFFF" />
      <rect x="72.5" y="32" width="15" height="84" rx="7.5" fill="#FFFFFF" />
      <rect x="97" y="51" width="15" height="58" rx="7.5" fill="#FFFFFF" />
      <rect x="121" y="68" width="15" height="34" rx="7.5" fill="#FFFFFF" />

      {/* Golden Amber Smile Arc */}
      <path
        d="M33 116.5C31 114.8 33.4 111.5 36.2 113.1C50.5 121.2 65.8 124.8 81.5 124.6C98.2 124.4 114.2 119.5 126.4 112.4C128.5 111.2 130.6 113.6 128.8 115.6C116.8 129.1 99.1 136.5 79.8 136.8C60.2 137.1 43.2 129.4 33 116.5Z"
        fill={`url(#${smileId})`}
      />
    </svg>
  );
}

function SwitchboardWordmarkSvg({
  theme = 'light',
  className = 'h-6 w-auto',
}: {
  theme?: 'light' | 'dark';
  className?: string;
}) {
  const textColor = theme === 'dark' ? '#FFFFFF' : '#0C1233';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 530 110"
      fill="none"
      role="img"
      aria-label="Switchboard"
      className={`select-none ${className}`}
    >
      <text
        x="2"
        y="84"
        fill={textColor}
        fontFamily="var(--font-sans), Geist, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="82"
        fontWeight="800"
        letterSpacing="-2.5"
      >
        Sw
      </text>
      <rect x="122" y="40" width="14.5" height="44" rx="2.5" fill={textColor} />
      <circle cx="129.25" cy="24" r="9.5" fill="#F59E0B" />
      <text
        x="143"
        y="84"
        fill={textColor}
        fontFamily="var(--font-sans), Geist, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="82"
        fontWeight="800"
        letterSpacing="-2.5"
      >
        tchboard
      </text>
    </svg>
  );
}

export function SwitchboardLogo({
  href = '/',
  size = 'md',
  theme = 'light',
  iconOnly = false,
  className = '',
}: SwitchboardLogoProps) {
  const iconSizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const wordmarkSizeClass =
    size === 'sm' ? 'h-5 w-auto' : size === 'lg' ? 'h-7 w-auto' : 'h-6 w-auto';

  const content = (
    <span
      className={`group inline-flex items-center gap-2.5 transition-transform duration-150 active:scale-[0.97] ${className}`.trim()}
    >
      <SwitchboardIconSvg className={iconSizeClass} />
      {!iconOnly && <SwitchboardWordmarkSvg theme={theme} className={wordmarkSizeClass} />}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
