// LIFF SDK Types
export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffContext {
  type: 'utou' | 'room' | 'group' | 'external' | 'none';
  viewType?: 'full' | 'tall' | 'compact';
  userId?: string;
  utouId?: string;
  roomId?: string;
  groupId?: string;
}

export interface LiffState {
  isInitialized: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  profile: LiffProfile | null;
  context: LiffContext | null;
  error: Error | null;
  isLoading: boolean;
}

export interface LiffContextValue extends LiffState {
  sendMessage: (message: string) => Promise<void>;
  shareMessage: (message: string) => Promise<boolean>;
  shareTargetPicker: (messages: Array<{ type: 'text'; text: string }>) => Promise<boolean>;
  closeWindow: () => void;
  openUrl: (url: string, external?: boolean) => void;
}

// User types
export type UserRole = 'patient' | 'caregiver';

export interface UserData {
  role: UserRole | null;
  profileId: string | null;
  lineUserId: string | null;
}

export interface ContextData {
  caregiverId: string | null;
  patientId: string | null;
}
