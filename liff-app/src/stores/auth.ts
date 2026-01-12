import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/types/liff';

interface AuthState {
  user: {
    role: UserRole | null;
    profileId: string | null;
    lineUserId: string | null;
  };
  context: {
    caregiverId: string | null;
    patientId: string | null;
    groupId: string | null;
  };
  isRegistered: boolean;
  setUser: (user: Partial<AuthState['user']>) => void;
  setContext: (context: Partial<AuthState['context']>) => void;
  setIsRegistered: (value: boolean) => void;
  clear: () => void;
}

const initialState = {
  user: {
    role: null as UserRole | null,
    profileId: null as string | null,
    lineUserId: null as string | null,
  },
  context: {
    caregiverId: null as string | null,
    patientId: null as string | null,
    groupId: null as string | null,
  },
  isRegistered: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      setUser: (user) =>
        set((state) => ({
          user: { ...state.user, ...user },
        })),
      setContext: (context) =>
        set((state) => ({
          context: { ...state.context, ...context },
        })),
      setIsRegistered: (value) => set({ isRegistered: value }),
      clear: () => set(initialState),
    }),
    {
      name: 'oonjai_auth',
    }
  )
);

// Helper to check if store has hydrated (use this instead of _hasHydrated flag)
export const waitForHydration = (): Promise<void> => {
  return new Promise((resolve) => {
    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      console.log('[AuthStore] Already hydrated');
      resolve();
      return;
    }
    // Wait for hydration
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      console.log('[AuthStore] Hydration finished');
      unsub();
      resolve();
    });
  });
};
