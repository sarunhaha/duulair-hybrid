import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../utils';
import SettingsPage from '@/pages/settings';

// Mock the hooks
vi.mock('@/lib/liff/provider', () => ({
  useLiff: () => ({
    profile: {
      displayName: 'Test User',
      pictureUrl: 'https://example.com/pic.jpg',
      statusMessage: 'OONJAI Member',
    },
    closeWindow: vi.fn(),
  }),
}));

vi.mock('@/stores/ui', () => ({
  useUIStore: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings page with header', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'ตั้งค่า' })).toBeInTheDocument();
  });

  it('displays user profile card', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('OONJAI Member')).toBeInTheDocument();
  });

  it('shows medication settings link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('ยาของฉัน')).toBeInTheDocument();
  });

  it('shows reminders settings link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('เตือนกิจกรรมสุขภาพ')).toBeInTheDocument();
  });

  it('shows dark mode toggle', () => {
    render(<SettingsPage />);
    expect(screen.getByText('โหมดมืด')).toBeInTheDocument();
    expect(screen.getByText('สลับ')).toBeInTheDocument();
  });

  it('shows reports link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('รายงานสุขภาพ')).toBeInTheDocument();
  });

  it('shows package link', () => {
    render(<SettingsPage />);
    expect(screen.getByText('แพ็กเกจของฉัน')).toBeInTheDocument();
  });

  it('shows logout button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('ออกจากระบบ')).toBeInTheDocument();
  });
});
