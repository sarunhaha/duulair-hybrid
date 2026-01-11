import type { ReactNode, ElementType } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
  as?: ElementType;
}

/**
 * Visually hidden component for screen readers only
 * Used to provide accessible text without visual display
 */
export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
}
