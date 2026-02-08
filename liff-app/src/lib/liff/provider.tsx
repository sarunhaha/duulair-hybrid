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

export function LiffProvider({ children, liffId = LIFF_ID }: LiffProviderProps) {
  const [state, setState] = useState<LiffState>(initialState);

  useEffect(() => {
    let isMounted = true;

    const initLiff = async () => {
      try {
        if (typeof window.liff === 'undefined') {
          throw new Error('LIFF SDK not loaded');
        }

        // Call liff.init() exactly once — SDK warns against multiple calls
        if (!liffInitPromise) {
          liffInitPromise = window.liff.init({ liffId });
        }
        await liffInitPromise;

        const isInClient = window.liff.isInClient();
        const isLoggedIn = window.liff.isLoggedIn();

        if (!isLoggedIn) {
          if (isInClient) {
            // Inside LINE app — user is always authenticated by LINE itself.
            // isLoggedIn() can briefly return false due to SDK timing; treat as logged in.
            // getProfile() will work because LINE provides the access token.
          } else {
            // External browser — handle login redirect
            const params = new URLSearchParams(window.location.search);
            const hasCode = params.has('code');
            const loginAttempted = sessionStorage.getItem('liff_login_attempted');

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
              }
              return;
            }

            sessionStorage.setItem('liff_login_attempted', '1');
            window.liff.login({ redirectUri: window.location.href });
            return;
          }
        }

        // Login successful (or inside LINE client)
        sessionStorage.removeItem('liff_login_attempted');

        const profile = await window.liff.getProfile() as LiffProfile;
        const context = window.liff.getContext() as LiffContext | null;

        if (isMounted) {
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
        console.error('[LiffProvider] Init error:', error);
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
