// src/App.jsx – Tailwind v4 wrapper + role sync
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import CarrierDashboard from './pages/CarrierDashboard';

function RoleWrapper({ children }) {
  const location = useLocation();
  useEffect(() => {
    const stored = (localStorage.getItem('role') || 'customer').toLowerCase();
    const role = stored === 'admin' ? 'carrier' : stored; // admin bruger carrier-tema
    const el = document.getElementById('app') || document.documentElement;
    el.setAttribute('data-role', role);
  }, [location.pathname]);
  return (
    <div id="app" className="app-bg">
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RoleWrapper>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowRoles={['customer', 'carrier']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/carrier"
            element={
              <ProtectedRoute allowRoles={['carrier']}>
                <CarrierDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RoleWrapper>
    </BrowserRouter>
  );
}
