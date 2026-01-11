import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock LIFF SDK
const mockLiff = {
  init: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn().mockReturnValue(true),
  login: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn().mockResolvedValue({
    userId: 'test-user-id',
    displayName: 'Test User',
    pictureUrl: 'https://example.com/pic.jpg',
    statusMessage: 'Test status',
  }),
  getContext: vi.fn().mockReturnValue({
    type: 'utou',
    userId: 'test-user-id',
  }),
  closeWindow: vi.fn(),
  openWindow: vi.fn(),
  sendMessages: vi.fn().mockResolvedValue(undefined),
  isApiAvailable: vi.fn().mockReturnValue(true),
  shareTargetPicker: vi.fn().mockResolvedValue(undefined),
};

// Assign to window
Object.defineProperty(window, 'liff', {
  value: mockLiff,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia for dark mode
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors/warnings in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
