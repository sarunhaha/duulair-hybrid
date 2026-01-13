import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Switch, Router } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Base path for the app (must match vite.config.ts base)
const BASE_PATH = '/liff-v2';
import { LiffProvider } from '@/lib/liff/provider';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Toaster } from '@/components/ui/toaster';
import { SkipLink } from '@/components/a11y/skip-link';
import { Loader2 } from 'lucide-react';

// Core pages - loaded immediately
import HomePage from '@/pages/index';
import DashboardPage from '@/pages/dashboard';
import RecordsPage from '@/pages/records';
import SettingsPage from '@/pages/settings';
import NotFoundPage from '@/pages/not-found';

// Lazy loaded pages
const GroupDashboardPage = lazy(() => import('@/pages/dashboard/group'));
const TrendsPage = lazy(() => import('@/pages/trends'));

// Registration - lazy
const WelcomeRegistrationPage = lazy(() => import('@/pages/registration/welcome'));
const QuickRegistrationPage = lazy(() => import('@/pages/registration/quick'));
const GroupRegistrationPage = lazy(() => import('@/pages/registration/group'));
const RegistrationSuccessPage = lazy(() => import('@/pages/registration/success'));

// Profile - lazy
const ProfilePage = lazy(() => import('@/pages/profile'));
const ProfileEditPage = lazy(() => import('@/pages/profile/edit'));

// Settings subpages - lazy
const MedicationsPage = lazy(() => import('@/pages/settings/medications'));
const RemindersPage = lazy(() => import('@/pages/settings/reminders'));
const PackagePage = lazy(() => import('@/pages/settings/package'));

// Reports - lazy (has heavy chart deps)
const ReportsPage = lazy(() => import('@/pages/reports'));

// History - lazy
const HistoryPage = lazy(() => import('@/pages/history'));

// Link pages - lazy
const LinkPage = lazy(() => import('@/pages/link'));
const EnterCodePage = lazy(() => import('@/pages/link/enter-code'));

// Loading spinner component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">กำลังโหลด...</p>
      </div>
    </div>
  );
}

// Protected route wrapper - ensures user is authenticated
function Protected({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiffProvider>
        <SkipLink />
        <Suspense fallback={<PageLoader />}>
          <main id="main-content">
          <Router base={BASE_PATH}>
          <Switch>
            {/* Entry Point - No auth guard needed, handles its own auth */}
            <Route path="/" component={HomePage} />

            {/* Registration Routes - No auth guard needed */}
            <Route path="/registration" component={WelcomeRegistrationPage} />
            <Route path="/registration/welcome" component={WelcomeRegistrationPage} />
            <Route path="/registration/quick" component={QuickRegistrationPage} />
            <Route path="/registration/group" component={GroupRegistrationPage} />
            <Route path="/registration/success" component={RegistrationSuccessPage} />

            {/* Main App Routes - Protected */}
            <Route path="/dashboard">
              <Protected><DashboardPage /></Protected>
            </Route>
            <Route path="/dashboard/group">
              <Protected><GroupDashboardPage /></Protected>
            </Route>
            <Route path="/records">
              <Protected><RecordsPage /></Protected>
            </Route>
            <Route path="/trends">
              <Protected><TrendsPage /></Protected>
            </Route>
            <Route path="/settings">
              <Protected><SettingsPage /></Protected>
            </Route>

            {/* Profile Routes - Protected */}
            <Route path="/profile">
              <Protected><ProfilePage /></Protected>
            </Route>
            <Route path="/profile/edit">
              <Protected><ProfileEditPage /></Protected>
            </Route>

            {/* Settings Subpages - Protected */}
            <Route path="/settings/medications">
              <Protected><MedicationsPage /></Protected>
            </Route>
            <Route path="/settings/reminders">
              <Protected><RemindersPage /></Protected>
            </Route>
            <Route path="/settings/package">
              <Protected><PackagePage /></Protected>
            </Route>

            {/* Reports - Protected */}
            <Route path="/reports">
              <Protected><ReportsPage /></Protected>
            </Route>

            {/* History - Protected */}
            <Route path="/history">
              <Protected><HistoryPage /></Protected>
            </Route>

            {/* Link Pages - Protected */}
            <Route path="/link">
              <Protected><LinkPage /></Protected>
            </Route>
            <Route path="/link/enter-code">
              <Protected><EnterCodePage /></Protected>
            </Route>

            {/* 404 */}
            <Route component={NotFoundPage} />
          </Switch>
          </Router>
          </main>
        </Suspense>
        <Toaster />
      </LiffProvider>
    </QueryClientProvider>
  );
}
