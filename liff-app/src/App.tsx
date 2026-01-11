import { lazy, Suspense } from 'react';
import { Route, Switch, Router } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Base path for the app (must match vite.config.ts base)
const BASE_PATH = '/liff-v2';
import { LiffProvider } from '@/lib/liff/provider';
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
            {/* Entry Point */}
            <Route path="/" component={HomePage} />

            {/* Registration Routes */}
            <Route path="/registration/quick" component={QuickRegistrationPage} />
            <Route path="/registration/group" component={GroupRegistrationPage} />
            <Route path="/registration/success" component={RegistrationSuccessPage} />

            {/* Main App Routes */}
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/dashboard/group" component={GroupDashboardPage} />
            <Route path="/records" component={RecordsPage} />
            <Route path="/trends" component={TrendsPage} />
            <Route path="/settings" component={SettingsPage} />

            {/* Profile Routes */}
            <Route path="/profile" component={ProfilePage} />
            <Route path="/profile/edit" component={ProfileEditPage} />

            {/* Settings Subpages */}
            <Route path="/settings/medications" component={MedicationsPage} />
            <Route path="/settings/reminders" component={RemindersPage} />
            <Route path="/settings/package" component={PackagePage} />

            {/* Reports */}
            <Route path="/reports" component={ReportsPage} />

            {/* History */}
            <Route path="/history" component={HistoryPage} />

            {/* Link Pages */}
            <Route path="/link" component={LinkPage} />
            <Route path="/link/enter-code" component={EnterCodePage} />

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
