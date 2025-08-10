// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function ProtectedRoute({ children, allowRoles }) {
  const [state, setState] = useState({ loading: true, role: null });
  const token = localStorage.getItem('token');
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) throw new Error('no token');

        const { data } = await axios.get('http://localhost:4000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const role = (data.role || '').toLowerCase();

        // Gem i localStorage så App’s RoleWrapper kan læse den
        localStorage.setItem('role', role);

        // Sæt data-role for tema (admin = carrier-tema)
        const themeRole = role === 'admin' ? 'carrier' : role;
        const rootEl = document.getElementById('app') || document.documentElement;
        rootEl.setAttribute('data-role', themeRole);

        if (!alive) return;
        setState({ loading: false, role });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, role: null });
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // Loader – brug dine komponentklasser, så den ser ordentlig ud
  if (state.loading) {
    return (
      <div className="app-bg flex items-center justify-center p-6 min-h-screen">
        <div className="card p-4">
          <div className="h2">Indlæser…</div>
          <div className="muted text-sm">Tjekker login og rettigheder</div>
        </div>
      </div>
    );
  }

  // Ikke logget ind → login
  if (!state.role) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Forkert rolle → send til “rigtig” side
  if (allowRoles && !allowRoles.includes(state.role)) {
    return <Navigate to={state.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return children;
}
