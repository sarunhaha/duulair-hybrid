import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { LiffState, LiffContextValue, LiffProfile, LiffContext } from '@/types/liff';

// LIFF ID from environment or fallback
const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2008278683-5k69jxNq';

const initialState: LiffState = {
  isInitialized: false,
  isLoggedIn: false,
  isInClient: false,
  profile: null,
  context: null,
  error: null,
  isLoading: true,
};

const LiffContext = createContext<LiffContextValue | null>(null);

interface LiffProviderProps {
  children: ReactNode;
  liffId?: string;
}

// Module-level singleton to prevent double init (StrictMode / re-mount protection)
let liffInitPromise: Promise<void> | null = null;
let liffInitDone = false;

// === TEMPORARY DEBUG: visible on-screen log for mobile debugging ===
const debugLines: string[] = [];
function debugLog(msg: string) {
  const ts = new Date().toLocaleTimeString('th-TH', { hour12: false });
  debugLines.push(`[${ts}] ${msg}`);
  if (debugLines.length > 30) debugLines.shift();
  const el = document.getElementById('liff-debug');
  if (el) {
    el.textContent = debugLines.join('\n');
  }
  console.log(`[LIFF] ${msg}`);
}

if (typeof document !== 'undefined') {
  const existing = document.getElementById('liff-debug');
  if (!existing) {
    const div = document.createElement('div');
    div.id = 'liff-debug';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow-y:auto;background:rgba(0,0,0,0.85);color:#0f0;font-size:10px;font-family:monospace;padding:8px;z-index:99999;white-space:pre-wrap;pointer-events:auto;';
    document.body?.appendChild(div);
  }
}
let renderCount = 0;
// === END DEBUG ===

// Retry liff.init() with fresh promise for "Unable to load client features" error
async function initWithRetry(liffId: string, maxAttempts: number): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      debugLog(`liff.init() attempt ${attempt}/${maxAttempts}...`);
      // Each retry must create a fresh promise — the SDK rejects the old one
      liffInitPromise = window.liff.init({ liffId });
      await liffInitPromise;
      debugLog(`liff.init() succeeded on attempt ${attempt}`);
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      debugLog(`attempt ${attempt} failed: ${msg}`);
      if (attempt < maxAttempts && msg.includes('Unable to load client features')) {
        // Wait before retrying — give the WebView time to settle
        const delay = attempt * 1500;
        debugLog(`retrying in ${delay}ms...`);
        liffInitPromise = null; // Reset so next attempt creates fresh promise
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

export function LiffProvider({ children, liffId = LIFF_ID }: LiffProviderProps) {
  const [state, setState] = useState<LiffState>(initialState);

  debugLog(`LiffProvider render #${++renderCount} state=${JSON.stringify({init: state.isInitialized, login: state.isLoggedIn, loading: state.isLoading, err: state.error?.message || null})}`);

  useEffect(() => {
    debugLog(`useEffect fired, liffInitDone=${liffInitDone}`);

    if (liffInitDone) {
      debugLog('skipping — already done');
      return;
    }

    let isMounted = true;

    const initLiff = async () => {
      try {
        if (typeof window.liff === 'undefined') {
          throw new Error('LIFF SDK not loaded');
        }

        // Retry up to 3 times for "Unable to load client features" (common on mobile)
        await initWithRetry(liffId, 3);

        const isInClient = window.liff.isInClient();
        const isLoggedIn = window.liff.isLoggedIn();
        debugLog(`isInClient=${isInClient} isLoggedIn=${isLoggedIn}`);

        if (!isLoggedIn) {
          if (isInClient) {
            debugLog('in-client but not logged in — skipping liff.login(), proceeding');
          } else {
            const params = new URLSearchParams(window.location.search);
            const hasCode = params.has('code');
            const loginAttempted = sessionStorage.getItem('liff_login_attempted');

            debugLog(`external browser: hasCode=${hasCode} loginAttempted=${loginAttempted}`);

            if (hasCode || loginAttempted) {
              if (isMounted) {
                setState({
                  isInitialized: true,
                  isLoggedIn: false,
                  isInClient,
                  profile: null,
                  context: null,
                  error: new Error('LINE login failed. Please close and reopen.'),
                  isLoading: false,
                });
                liffInitDone = true;
              }
              return;
            }

            debugLog('redirecting to liff.login()...');
            sessionStorage.setItem('liff_login_attempted', '1');
            window.liff.login({ redirectUri: window.location.href });
            return;
          }
        }

        sessionStorage.removeItem('liff_login_attempted');

        debugLog('calling getProfile()...');
        const profile = await window.liff.getProfile() as LiffProfile;
        debugLog(`profile: ${profile?.userId} ${profile?.displayName}`);
        const context = window.liff.getContext() as LiffContext | null;
        debugLog(`context: ${JSON.stringify(context)}`);

        if (isMounted) {
          liffInitDone = true;
          debugLog('setState → initialized, loggedIn');
          setState({
            isInitialized: true,
            isLoggedIn: true,
            isInClient,
            profile,
            context,
            error: null,
            isLoading: false,
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        debugLog(`INIT ERROR (final): ${errMsg}`);
        console.error('[LiffProvider] Init error:', error);
        if (isMounted) {
          liffInitDone = true;
          setState({
            isInitialized: true,
            isLoggedIn: false,
            isInClient: false,
            profile: null,
            context: null,
            error: error as Error,
            isLoading: false,
          });
        }
      }
    };

    initLiff();

    return () => {
      isMounted = false;
      debugLog('useEffect cleanup (unmounted)');
    };
  }, [liffId]);

  // Send message to current chat
  const sendMessage = useCallback(async (message: string) => {
    if (!window.liff || !state.isInClient) return;
    try {
      await window.liff.sendMessages([{ type: 'text', text: message }]);
    } catch (error) {
      throw error;
    }
  }, [state.isInClient]);

  const shareMessage = useCallback(async (message: string) => {
    if (!window.liff) return false;
    try {
      if (window.liff.isApiAvailable('shareTargetPicker')) {
        await window.liff.shareTargetPicker([{ type: 'text', text: message }]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const shareTargetPicker = useCallback(async (messages: Array<{ type: 'text'; text: string }>) => {
    if (!window.liff) return false;
    try {
      if (window.liff.isApiAvailable('shareTargetPicker')) {
        await window.liff.shareTargetPicker(messages);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const closeWindow = useCallback(() => {
    if (window.liff && state.isInClient) {
      window.liff.closeWindow();
    } else {
      window.close();
    }
  }, [state.isInClient]);

  const openUrl = useCallback((url: string, external = false) => {
    if (window.liff && state.isInClient) {
      window.liff.openWindow({ url, external });
    } else {
      window.open(url, external ? '_blank' : '_self');
    }
  }, [state.isInClient]);

  const value: LiffContextValue = {
    ...state,
    sendMessage,
    shareMessage,
    shareTargetPicker,
    closeWindow,
    openUrl,
  };

  return (
    <LiffContext.Provider value={value}>
      {children}
    </LiffContext.Provider>
  );
}

export function useLiff() {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error('useLiff must be used within LiffProvider');
  }
  return context;
}

export function useLiffProfile() {
  const { profile, isLoading, error } = useLiff();
  return { profile, isLoading, error };
}

export function useLiffContext() {
  const { context } = useLiff();
  return {
    isGroup: context?.type === 'group',
    isRoom: context?.type === 'room',
    is1on1: context?.type === 'utou',
    isExternal: context?.type === 'external',
    groupId: context?.type === 'group' ? context.groupId : null,
    roomId: context?.type === 'room' ? context.roomId : null,
    viewType: context?.viewType || null,
  };
}
