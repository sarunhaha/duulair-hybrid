// Global type declarations

interface LiffSendMessage {
  type: 'text';
  text: string;
}

interface LiffOpenWindowParams {
  url: string;
  external?: boolean;
}

interface Liff {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  logout: () => void;
  getProfile: () => Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  }>;
  getContext: () => {
    type: 'utou' | 'room' | 'group' | 'external' | 'none';
    viewType?: 'full' | 'tall' | 'compact';
    userId?: string;
    utouId?: string;
    roomId?: string;
    groupId?: string;
  } | null;
  isInClient: () => boolean;
  closeWindow: () => void;
  openWindow: (params: LiffOpenWindowParams) => void;
  sendMessages: (messages: LiffSendMessage[]) => Promise<void>;
  shareTargetPicker: (messages: LiffSendMessage[]) => Promise<void>;
  isApiAvailable: (api: string) => boolean;
}

declare global {
  interface Window {
    liff: Liff;
  }
}

export {};
