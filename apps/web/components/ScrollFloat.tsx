import type React from 'react';
import type { ReactNode, RefObject } from 'react';

type ScrollFloatEffect = 'float' | 'flip' | 'scatter' | 'blur' | 'wave';
type ScrollFloatSplit = 'chars' | 'words';
type ScrollFloatDirection = 'up' | 'down';
type ScrollFloatOrder = 'start' | 'end' | 'center' | 'edges' | 'random';

export interface ScrollFloatProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  effect?: ScrollFloatEffect;
  splitBy?: ScrollFloatSplit;
  direction?: ScrollFloatDirection;
  order?: ScrollFloatOrder;
  fromColor?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  distance?: number;
  stretch?: number;
  smoothing?: number;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'div';
}

export const ScrollFloat: React.FC<ScrollFloatProps> = ({
  children,
  containerClassName = '',
  textClassName = '',
  as: Component = 'h2',
}) => {
  return (
    <Component className={`my-5 ${containerClassName}`.trim()}>
      <span className={textClassName}>{children}</span>
    </Component>
  );
};
