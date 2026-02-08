import { useEffect, useRef } from 'react';
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
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Prevent double navigation
    if (hasNavigated.current) return;

    // Handle liff.state deep link — LIFF sends path via query param
    // e.g. /liff-v2/?liff.state=%2Frecords → navigate to /records
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get('liff.state');
    if (liffState) {
      hasNavigated.current = true;
      const targetPath = liffState.startsWith('/') ? liffState : '/' + liffState;

      // Clean URL to prevent re-trigger
      params.delete('liff.state');
      const cleanSearch = params.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
      window.history.replaceState(null, '', cleanUrl);

      setLocation(targetPath);
      return;
    }

    // Wait for LIFF to fully initialize before redirecting
    if (!isInitialized || isLoading) return;

    hasNavigated.current = true;
    if (isGroup) {
      setLocation('/dashboard/group');
    } else {
      setLocation('/dashboard');
    }
  }, [isInitialized, isLoading, isGroup, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
