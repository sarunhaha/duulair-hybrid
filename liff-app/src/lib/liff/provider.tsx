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

// === TEMPORARY DEBUG: visible on-screen log for mobile debugging ===
const debugLines: string[] = [];
function debugLog(msg: string) {
  const ts = new Date().toLocaleTimeString('th-TH', { hour12: false });
  debugLines.push(`[${ts}] ${msg}`);
  // Keep max 20 lines
  if (debugLines.length > 20) debugLines.shift();
  // Write to a DOM element if it exists
  const el = document.getElementById('liff-debug');
  if (el) {
    el.textContent = debugLines.join('\n');
  }
}
// Inject debug overlay into DOM immediately
if (typeof document !== 'undefined') {
  const existing = document.getElementById('liff-debug');
  if (!existing) {
    const div = document.createElement('div');
    div.id = 'liff-debug';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow-y:auto;background:rgba(0,0,0,0.85);color:#0f0;font-size:10px;font-family:monospace;padding:8px;z-index:99999;white-space:pre-wrap;pointer-events:auto;';
    document.body?.appendChild(div);
  }
}
// === END DEBUG ===

export function LiffProvider({ children, liffId = LIFF_ID }: LiffProviderProps) {
  const [state, setState] = useState<LiffState>(initialState);

  useEffect(() => {
    let isMounted = true;

    const initLiff = async () => {
      debugLog(`START init, liffId=${liffId}`);
      debugLog(`URL: ${window.location.href}`);
      debugLog(`UA: ${navigator.userAgent.substring(0, 80)}`);

      try {
        if (typeof window.liff === 'undefined') {
          throw new Error('LIFF SDK not loaded - window.liff is undefined');
        }
        debugLog('liff SDK found, calling init...');

        await window.liff.init({ liffId });
        debugLog('liff.init() SUCCESS');

        const isInClient = window.liff.isInClient();
        const isLoggedIn = window.liff.isLoggedIn();
        debugLog(`isInClient=${isInClient}, isLoggedIn=${isLoggedIn}`);

        if (!isLoggedIn) {
          debugLog('NOT logged in, checking guard...');
          const params = new URLSearchParams(window.location.search);
          const hasCode = params.has('code');
          const hasLiffState = params.has('liff.state');
          const loginAttempted = sessionStorage.getItem('liff_login_attempted');
          debugLog(`hasCode=${hasCode}, hasLiffState=${hasLiffState}, loginAttempted=${loginAttempted}`);

          if (hasCode || loginAttempted) {
            debugLog('BLOCKED: auth callback failed or already attempted');
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
            }
            return;
          }

          debugLog('First login attempt, redirecting...');
          sessionStorage.setItem('liff_login_attempted', '1');
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        // Login successful
        sessionStorage.removeItem('liff_login_attempted');
        debugLog('Fetching profile...');

        const profile = await window.liff.getProfile() as LiffProfile;
        debugLog(`Profile: ${profile?.userId}, ${profile?.displayName}`);

        const context = window.liff.getContext() as LiffContext | null;
        debugLog(`Context: type=${context?.type}`);

        if (isMounted) {
          debugLog('Setting state: initialized=true');
          setState({
            isInitialized: true,
            isLoggedIn: true,
            isInClient,
            profile,
            context,
            error: null,
            isLoading: false,
          });
        } else {
          debugLog('WARN: component unmounted before setState');
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        debugLog(`ERROR: ${errMsg}`);
        if (isMounted) {
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
    };
  }, [liffId]);

  // Send message to current chat
  const sendMessage = useCallback(async (message: string) => {
    if (!window.liff || !state.isInClient) {
      return;
    }
    try {
      await window.liff.sendMessages([{ type: 'text', text: message }]);
    } catch (error) {
      throw error;
    }
  }, [state.isInClient]);

  // Share message via target picker
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

  // Share via target picker with custom message objects
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

  // Close LIFF window
  const closeWindow = useCallback(() => {
    if (window.liff && state.isInClient) {
      window.liff.closeWindow();
    } else {
      window.close();
    }
  }, [state.isInClient]);

  // Open URL
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

// Hook to use LIFF context
export function useLiff() {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error('useLiff must be used within LiffProvider');
  }
  return context;
}

// Hook to get LIFF profile
export function useLiffProfile() {
  const { profile, isLoading, error } = useLiff();
  return { profile, isLoading, error };
}

// Hook to get LIFF context (group vs 1:1)
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
