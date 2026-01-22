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

export function LiffProvider({ children, liffId = LIFF_ID }: LiffProviderProps) {
  const [state, setState] = useState<LiffState>(initialState);

  useEffect(() => {
    const initLiff = async () => {
      console.log('[LiffProvider] Starting LIFF init with ID:', liffId);
      try {
        // Check if liff is available (loaded from script tag)
        if (typeof window.liff === 'undefined') {
          throw new Error('LIFF SDK not loaded');
        }

        await window.liff.init({ liffId });
        console.log('[LiffProvider] LIFF init complete');

        // Check login status
        if (!window.liff.isLoggedIn()) {
          console.log('[LiffProvider] Not logged in, redirecting to login');
          window.liff.login();
          return;
        }

        console.log('[LiffProvider] Logged in, fetching profile...');
        // Get profile and context
        const profile = await window.liff.getProfile() as LiffProfile;
        const context = window.liff.getContext() as LiffContext | null;
        const isInClient = window.liff.isInClient();

        console.log('[LiffProvider] Profile fetched:', {
          userId: profile?.userId,
          displayName: profile?.displayName,
          contextType: context?.type,
          isInClient
        });

        setState({
          isInitialized: true,
          isLoggedIn: true,
          isInClient,
          profile,
          context,
          error: null,
          isLoading: false,
        });
      } catch (error) {
        console.error('[LiffProvider] LIFF initialization error:', error);
        setState(prev => ({
          ...prev,
          error: error as Error,
          isLoading: false,
        }));
      }
    };

    initLiff();
  }, [liffId]);

  // Send message to current chat
  const sendMessage = useCallback(async (message: string) => {
    if (!window.liff || !state.isInClient) {
      console.warn('sendMessage only works in LINE app');
      return;
    }

    try {
      await window.liff.sendMessages([
        {
          type: 'text',
          text: message,
        },
      ]);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, [state.isInClient]);

  // Share message via target picker (simple string message)
  const shareMessage = useCallback(async (message: string) => {
    if (!window.liff) return false;

    try {
      if (window.liff.isApiAvailable('shareTargetPicker')) {
        await window.liff.shareTargetPicker([
          {
            type: 'text',
            text: message,
          },
        ]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to share message:', error);
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
    } catch (error) {
      console.error('Failed to share via target picker:', error);
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
