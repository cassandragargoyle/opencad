import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthModal } from './components/AuthModal';
import { useAuthStore } from './stores/authStore';
import { isFirebaseConfigured } from './lib/firebase';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuthStore();

  // Firebase not configured → skip auth gate (local dev / OSS self-hosted)
  if (!isFirebaseConfigured) return <>{children}</>;

  // Local dev override: VITE_SKIP_AUTH=true in .env.local lets you work on
  // the app without signing in. Never set this in production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === 'true') {
    return <>{children}</>;
  }

  if (status === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <span className="auth-spinner" style={{ width:24, height:24, borderWidth:3 }} aria-label="Loading" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <AuthModal required />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <Routes>
          <Route path="/" element={<ProjectDashboard />} />
          <Route path="/project/:id" element={<AppLayout />} />
        </Routes>
      </AuthGate>
    </ErrorBoundary>
  );
}

export default App;
