import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AUTH_API = 'http://localhost:4000/api/auth';
const TASK_API = 'http://localhost:4000/api/tasks';

const COLUMNS = [
  { key: 'NEW',         title: 'Ny' },
  { key: 'PLANNED',     title: 'Planlagt' },
  { key: 'IN_PROGRESS', title: 'I gang' },
  { key: 'DELIVERED',   title: 'Leveret' },
  { key: 'CANCELLED',   title: 'Annulleret' },
];

function Badge({ children, color = 'gray' }) {
  const map = {
    green: 'badge badge--green',
    red: 'badge badge--red',
    yellow: 'badge badge--yellow',
    gray: 'badge badge--gray',
    blue: 'badge badge--blue',
  };
  return <span className={map[color] || map.gray}>{children}</span>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Sidebar / hovedfaner
  const [menu, setMenu] = useState('approve'); // 'approve' | 'tasks' | 'commission'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Underfaner for “Brugere”
  const [userTab, setUserTab] = useState('all'); // all|admin|customer|carrier|carrier_pending

  // Filtre (for “Brugere”)
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(''); // ''|active|inactive|approved|pending

  // Data
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tasks, setTasks] = useState([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // --------- Hent roller + brugere ----------
  async function fetchRoles() {
    try {
      const r = await axios.get(`${AUTH_API}/roles`, { headers: authHeader });
      setRoles(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Hent roller fejlede:', e?.response?.data || e.message);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      // server-side statusfilter
      if (status === 'active')   params.active = true;
      if (status === 'inactive') params.active = false;
      if (status === 'approved') params.approved = true;
      if (status === 'pending')  params.approved = false;

      // server-side rolefilter når vi står på en dedikeret underfane
      if (userTab === 'admin')    params.role = 'admin';
      if (userTab === 'customer') params.role = 'customer';
      if (userTab === 'carrier')  params.role = 'carrier';
      // 'carrier_pending' håndteres client-side (rolle=carrier + approved=false),
      // men ovenstående params hjælper med kun at hente relevante felter.

      const r = await axios.get(`${AUTH_API}/all-users`, { headers: authHeader, params });
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Fejl ved hentning:', e?.response?.status, e?.response?.data || e.message);
      setErr('Kunne ikke hente brugere');
    } finally {
      setLoading(false);
    }
  }

  // --------- Tasks ----------
  async function fetchTasks() {
    try {
      const r = await axios.get(TASK_API, { headers: authHeader });
      setTasks(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Kunne ikke hente tasks', e?.response?.status, e?.response?.data || e.message);
    }
  }

  async function createTaskQuick(title) {
    try {
      const r = await axios.post(
        TASK_API,
        { title },
        { headers: { ...authHeader, 'Content-Type': 'application/json' } }
      );
      setTasks(prev => [r.data, ...prev]);
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Opret task fejlede', e?.response?.status, e?.response?.data || e.message);
      alert(e?.response?.data?.error || 'Kunne ikke oprette opgave');
    }
  }

  async function moveTask(taskId, newStatus) {
    try {
      const r = await axios.patch(
        `${TASK_API}/${taskId}/status`,
        { status: newStatus },
        { headers: { ...authHeader, 'Content-Type': 'application/json' } }
      );
      setTasks(prev => prev.map(t => (t.id === taskId ? r.data : t)));
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      alert('Kunne ikke opdatere status');
      console.error(e?.response?.data || e.message);
    }
  }

  // --------- Actions (brugere) ----------
  async function handleApprove(id) {
    if (!window.confirm('Godkend denne bruger?')) return;
    try {
      await axios.post(`${AUTH_API}/approve/${id}`, {}, { headers: authHeader });
      await fetchUsers();
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Godkendelse fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke godkende bruger');
    }
  }

  async function handleBlock(id) {
    if (!window.confirm('Blokér brugeren (sætter godkendelse til false)?')) return;
    try {
      await axios.post(`${AUTH_API}/block/${id}`, {}, { headers: authHeader });
      await fetchUsers();
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Blokering fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke blokere bruger');
    }
  }

  async function toggleActive(id) {
    try {
      await axios.post(`${AUTH_API}/toggle-active/${id}`, {}, { headers: authHeader });
      await fetchUsers();
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Toggle active fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke skifte aktiv status');
    }
  }

  async function updateRole(id, newRole) {
    try {
      await axios.post(
        `${AUTH_API}/users/${id}/role`,
        { role: newRole },
        { headers: { ...authHeader, 'Content-Type': 'application/json' } }
      );
      await fetchUsers();
    } catch (e) {
      if ([401,403].includes(e?.response?.status)) navigate('/');
      console.error('Rolle-opdatering fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke opdatere rolle');
    }
  }

  // --------- Effects ----------
  useEffect(() => { fetchRoles(); }, [token]);
  useEffect(() => {
    if (menu === 'approve') fetchUsers();
  }, [menu, userTab, status, token]); // henter når man skifter underfane/status
  useEffect(() => {
    if (menu === 'tasks') fetchTasks();
  }, [menu, token]);

  const logout = () => { localStorage.removeItem('token'); navigate('/'); };

  // Client-side søg + “carrier_pending”
  const baseUsers = users.filter(u => {
    if (userTab === 'carrier_pending') return u.role === 'carrier' && !u.approved;
    return true;
  });
  const displayedUsers = baseUsers.filter(u =>
    !q.trim() || u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="app-bg">
      {/* HEADER */}
      <header className="header">
        <div className="header__left">
          <a className="header__logo" href="/admin" aria-label="Forside">
            <img src="/billeder/Transparent Logo.svg" alt="Flytte & Fragttilbud" />
          </a>
          <div className="header__title">Admin Dashboard</div>
        </div>
        <div className="header__right">
          <button onClick={() => setSidebarOpen(s => !s)} className="btn btn--ghost" aria-label="Toggle menu">☰</button>
          <button onClick={logout} className="btn btn--primary">Log ud</button>
        </div>
      </header>

      {/* SHELL */}
      <div className="shell">
        <nav className="sidebar__nav">
          {/* Hovedpunkt: Brugere */}
          <button
            className={`sidebar__link ${menu==='approve' ? 'sidebar__link--active' : ''}`}
            onClick={() => setMenu('approve')}
            aria-current={menu==='approve' ? 'page' : undefined}
          >
            Brugere
          </button>

          {/* SUBMENU for Brugere */}
          {menu === 'approve' && (
            <div className="sidebar__submenu">
              {[
                ['all','Alle'],
                ['admin','Admin'],
                ['customer','Customer'],
                ['carrier','Carrier'],
                ['carrier_pending','Carrier (afventer)'],
              ].map(([k,label]) => (
                <button
                  key={k}
                  className={`sidebar__sublink ${userTab===k ? 'sidebar__sublink--active' : ''}`}
                  onClick={() => setUserTab(k)}
                  aria-current={userTab===k ? 'true' : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Øvrige hovedpunkter */}
          <button
            className={`sidebar__link ${menu==='tasks' ? 'sidebar__link--active' : ''}`}
            onClick={() => setMenu('tasks')}
            aria-current={menu==='tasks' ? 'page' : undefined}
          >
            Opgaver
          </button>

          <button
            className={`sidebar__link ${menu==='commission' ? 'sidebar__link--active' : ''}`}
            onClick={() => setMenu('commission')}
            aria-current={menu==='commission' ? 'page' : undefined}
          >
            Kommission
          </button>

          <div className="sidebar__section">Andet</div>
          <button className="sidebar__link" disabled>Messages</button>
          <button className="sidebar__link" disabled>Payments</button>
          <button className="sidebar__link" disabled>Reports</button>
        </nav>



        {/* MAIN */}
        <main className="main">
          <div className="main__content">
            {/* --- BRUGERE --- */}
            {menu === 'approve' && (
              <>
                {/* søg + status */}
                <div className="card mb-4" style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div>
                    <label className="block text-sm mb-1">Søg (email)</label>
                    <input
                      className="input"
                      placeholder="fx user@domain.com"
                      value={q}
                      onChange={e=>setQ(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Status</label>
                    <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
                      <option value="">Alle</option>
                      <option value="active">Aktiv</option>
                      <option value="inactive">Deaktiveret</option>
                      <option value="approved">Godkendt</option>
                      <option value="pending">Afventer</option>
                    </select>
                  </div>
                  <button onClick={fetchUsers} className="btn btn--ghost" style={{ marginLeft: 'auto' }}>Opdater</button>
                </div>

                {loading && <div className="p-4 muted">Indlæser…</div>}
                {err && <div className="p-4" style={{ color: '#dc2626' }}>{err}</div>}

                {/* LISTE: flot “table-card” layout */}
                <div className="card">
                  <div className="table__header">
                    <div>Email</div>
                    <div>Oprettet</div>
                    <div>Status</div>
                    <div>Rolle</div>
                    <div style={{ textAlign:'right' }}>Handling</div>
                  </div>

                  <div className="table__body">
                    {displayedUsers.length === 0 ? (
                      <div className="muted p-3">Ingen brugere fundet.</div>
                    ) : displayedUsers.map(u => (
                      <UserRow
                        key={u.id}
                        user={u}
                        roles={roles.length ? roles : ['admin','customer','carrier']}
                        onApprove={() => handleApprove(u.id)}
                        onBlock={() => handleBlock(u.id)}
                        onToggleActive={() => toggleActive(u.id)}
                        onChangeRole={(role) => updateRole(u.id, role)}
                      />
                    ))}
                  </div>
                </div>

              </>
            )}

            {/* --- TASKS --- */}
            {menu === 'tasks' && (
              <div className="space-y-4">
                <QuickAddForm onAdd={createTaskQuick} />
                <div className="kanban">
                  {COLUMNS.map(col => (
                    <KanbanColumn
                      key={col.key}
                      title={col.title}
                      statusKey={col.key}
                      tasks={tasks.filter(t => t.status === col.key)}
                      onDropTask={moveTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* --- COMMISSION --- */}
            {menu === 'commission' && (
              <div className="card">
                <h2 className="h2" style={{ fontSize:'1.125rem', fontWeight:600, marginBottom:'.5rem' }}>Styr kommission</h2>
                <p className="muted">Konfiguration af kommissionssatser kommer snart…</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* --- små komponenter --- */
function QuickAddForm({ onAdd }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; onAdd(title.trim()); setTitle(''); }}
      className="card"
      style={{ display:'flex', gap:'.5rem' }}
    >
      <input
        className="input"
        style={{ flex:1 }}
        placeholder="Ny opgave (fx 'Kørsel fra A til B')"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <button type="submit" className="btn btn--primary">Opret</button>
    </form>
  );
}

function KanbanColumn({ title, statusKey, tasks, onDropTask }) {
  const allowDrop = (e) => e.preventDefault();
  const onDrop = (e) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (!taskId) return;
    onDropTask(taskId, statusKey);
  };

  return (
    <div className="kanban__col" style={{ minHeight: 300 }} onDragOver={allowDrop} onDrop={onDrop}>
      <div className="kanban__title">{title}</div>
      <div className="space-y-2">
        {tasks.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function TaskCard({ task }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData('text/plain', String(task.id));
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="kanban__card"
      style={{ cursor:'move' }}
      title={`ID: ${task.id}`}
    >
      <div className="font-medium">{task.title}</div>
      <div className="text-xs muted">{new Date(task.createdAt).toLocaleString()}</div>
    </div>
  );
}
function UserRow({ user, roles, onApprove, onBlock, onToggleActive, onChangeRole }) {
  const initials = (user.email || '?')
    .split('@')[0]
    .split(/[.\-_]/)
    .filter(Boolean)
    .slice(0,2)
    .map(s => s[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <div className="table__row">
      {/* Email + avatar */}
      <div className="table__cell">
        <div className="row__id">
          <div className="avatar">{initials}</div>
          <div className="row__title">{user.email}</div>
        </div>
      </div>

      {/* Oprettet */}
      <div className="table__cell">
        <div className="muted">{new Date(user.createdAt).toLocaleString()}</div>
      </div>

      {/* Status */}
      <div className="table__cell">
        <div className="row__badges">
          <span className={`badge ${user.approved ? 'badge--green' : 'badge--yellow'}`}>
            {user.approved ? 'Godkendt' : 'Afventer'}
          </span>
          <span className={`badge ${user.active ? 'badge--green' : 'badge--red'}`}>
            {user.active ? 'Aktiv' : 'Deaktiveret'}
          </span>
        </div>
      </div>

      {/* Rolle */}
      <div className="table__cell">
        <select
          className="select"
          value={user.role}
          onChange={e => onChangeRole(e.target.value)}
        >
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Handling */}
      <div className="table__cell" style={{ textAlign:'right' }}>
        {!user.approved ? (
          <button className="btn btn--primary" onClick={onApprove}>Godkend</button>
        ) : (
          user.role !== 'admin' && (
            <button className="btn btn--danger" onClick={onBlock}>Bloker</button>
          )
        )}
        <button className="btn btn--warn" onClick={onToggleActive} style={{ marginLeft: '.5rem' }}>
          {user.active ? 'Deaktiver' : 'Genaktiver'}
        </button>
      </div>
    </div>
  );
}
