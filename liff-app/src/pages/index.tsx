import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useLiff, useLiffContext } from '@/lib/liff/provider';
import { Loader2 } from 'lucide-react';

/**
 * Home Page - Fast redirect to appropriate dashboard
 *
 * Design: Minimal loading, fast redirect
 * - liff.state param → navigate to that path (LIFF deep link)
 * - Group context → /dashboard/group
 * - 1:1 context → /dashboard
 * - AuthGuard handles registration check on destination page
 */
export default function HomePage() {
  const [, setLocation] = useLocation();
  const { isInitialized, isLoading } = useLiff();
  const { isGroup } = useLiffContext();

  useEffect(() => {
    // Handle liff.state deep link — LIFF sends path via query param
    // e.g. /liff-v2/?liff.state=%2Frecords → navigate to /records
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get('liff.state');
    if (liffState) {
      const targetPath = liffState.startsWith('/') ? liffState : '/' + liffState;
      console.log('[HomePage] liff.state detected, navigating to:', targetPath);

      // Remove liff.state from URL to prevent re-trigger on re-render
      params.delete('liff.state');
      const cleanSearch = params.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
      window.history.replaceState(null, '', cleanUrl);

      setLocation(targetPath);
      return;
    }

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
