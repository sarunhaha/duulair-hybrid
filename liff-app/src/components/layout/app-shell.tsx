import type { ReactNode } from 'react';
import { BottomNav } from './bottom-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  /** Page title shown in header */
  title?: string;
  /** Right action button in header */
  headerAction?: {
    label: string;
    onClick: () => void;
  };
  /** Show bottom navigation (default: true) */
  showNav?: boolean;
  /** Show header (default: true) */
  showHeader?: boolean;
  /** Additional class for main content area */
  className?: string;
  /** Use full height without bottom padding */
  fullHeight?: boolean;
}

export function AppShell({
  children,
  title,
  headerAction,
  showNav = true,
  showHeader = true,
  className,
  fullHeight = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background font-sans relative z-10">
      {/* Header */}
      {showHeader && title && (
        <header className="bg-card pt-12 pb-4 px-6 sticky top-0 z-20 flex justify-between items-center border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {headerAction && (
            <Button
              variant="ghost"
              size="sm"
              className="text-accent font-bold h-auto p-0"
              onClick={headerAction.onClick}
            >
              {headerAction.label}
            </Button>
          )}
        </header>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'max-w-md mx-auto px-4 py-6',
          showNav && !fullHeight && 'pb-32',
          className
        )}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      {showNav && <BottomNav />}
    </div>
  );
}

// Export a simple wrapper for pages that just need nav
export function PageWithNav({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-screen bg-background pb-32 font-sans', className)}>
      {children}
      <BottomNav />
    </div>
  );
}
