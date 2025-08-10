import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:4000/api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/login`, { email, password }, {
        headers: { 'Content-Type': 'application/json' },
      });

      // token + rolle
      localStorage.setItem('token', res.data.token);
      const role = (res.data.role || '').toLowerCase();

      // Sæt rolle på root for tema (matcher index.css tokens)
      const root = document.getElementById('app') || document.documentElement;
      if (root) root.setAttribute('data-role', role === 'admin' ? 'carrier' : role); // admin får carrier-tema som default

      navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (error) {
      console.error(error?.response?.data || error.message);
      setErr(error?.response?.data?.error || 'Forkert login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo/brand top */}
        <div className="brand-gradient text-white rounded-t-xl px-5 py-4">
          <h1 className="text-lg font-semibold">Log ind</h1>
          <p className="text-xs opacity-90">Velkommen tilbage</p>
        </div>

        <form onSubmit={handleLogin} className="card -mt-1 rounded-t-none p-6 space-y-4">
          {err && (
            <div className="text-rose-600 text-sm" role="alert">{err}</div>
          )}

          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">Adgangskode</label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                className="input w-full pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPwd ? 'Skjul adgangskode' : 'Vis adgangskode'}
                title={showPwd ? 'Skjul adgangskode' : 'Vis adgangskode'}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary w-full disabled:opacity-50"
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>

          <div className="text-sm muted text-center">
            Har du ikke en konto?{' '}
            <Link to="/register" className="text-[rgb(var(--color-accent))] hover:underline">Opret</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
