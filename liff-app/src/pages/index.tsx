import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useLiff, useLiffContext } from '@/lib/liff/provider';
import { Loader2 } from 'lucide-react';

/**
 * Home Page - Fast redirect to appropriate dashboard
 *
 * Design: Minimal loading, fast redirect
 * - Group context → /dashboard/group
 * - 1:1 context → /dashboard
 * - AuthGuard handles registration check on destination page
 */
export default function HomePage() {
  const [, setLocation] = useLocation();
  const { isInitialized, isLoading } = useLiff();
  const { isGroup } = useLiffContext();

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    // Immediate redirect based on context
    if (isGroup) {
      setLocation('/dashboard/group');
    } else {
      setLocation('/dashboard');
    }
  }, [isInitialized, isLoading, isGroup, setLocation]);

  // Minimal loading - just a spinner
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
