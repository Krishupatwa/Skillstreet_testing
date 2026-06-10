import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ user, children, requiredRole, authLoading }) {
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-slate-900/90 px-6 py-4 text-center shadow-2xl shadow-black/30">Loading your session…</div>
      </div>
    );
  }

  // Extra guard: some pages (like Company) rely on user.uid.
  // During initial auth hydration, `user` may be set without uid.
  if (!user || !user.uid) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return children;
}

