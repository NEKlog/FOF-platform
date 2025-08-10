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
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`text-xs px-2 py-1 rounded ${map[color] || map.gray}`}>{children}</span>;
}

/* --- Små komponenter (hold dem på topniveau) --- */
function QuickAdd({ onAdd }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle('');
      }}
      className="bg-white rounded shadow-sm p-4 flex gap-2"
    >
      <input
        className="flex-1 border rounded px-3 py-2"
        placeholder="Ny opgave (fx 'Kørsel fra A til B')"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
        Opret
      </button>
    </form>
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
      className="border rounded p-3 bg-gray-50 hover:bg-gray-100 cursor-move"
      title={`ID: ${task.id}`}
    >
      <div className="font-medium">{task.title}</div>
      <div className="text-xs text-gray-500">{task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}</div>
    </div>
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
    <div className="bg-white rounded shadow-sm p-3 min-h-[300px]" onDragOver={allowDrop} onDrop={onDrop}>
      <div className="font-semibold mb-2">{title}</div>
      <div className="space-y-2">
        {tasks.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

/* --- Hovedkomponenten --- */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Menu/visning
  const [menu, setMenu] = useState('approve'); // 'approve' | 'tasks' | 'commission'
  const [view, setView] = useState('pending'); // 'pending' | 'all'

  // Brugere
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Filtre
  const [filterRole, setFilterRole] = useState('');
  const [filterApproved, setFilterApproved] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Tasks (Kanban)
  const [tasks, setTasks] = useState([]);

  // Auth header
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // --------- DATA: ROLLER & BRUGERE ----------
  async function fetchRoles() {
    try {
      const r = await axios.get(`${AUTH_API}/roles`, { headers: authHeader });
      setRoles(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error('Hent roller fejlede:', e?.response?.data || e.message);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      if (filterRole) params.role = filterRole;
      if (filterApproved) params.approved = filterApproved;
      if (filterActive) params.active = filterActive;

      const r = await axios.get(`${AUTH_API}/all-users`, { headers: authHeader, params });
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error('Fejl ved hentning:', e?.response?.status, e?.response?.data || e.message);
      setErr('Kunne ikke hente brugere');
    } finally {
      setLoading(false);
    }
  }

  // --------- DATA: TASKS ----------
  async function fetchTasks() {
    try {
      const r = await axios.get(TASK_API, { headers: authHeader });
      setTasks(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error('Kunne ikke hente tasks', e?.response?.data || e.message);
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
      alert('Kunne ikke opdatere status');
      console.error(e?.response?.data || e.message);
    }
  }

  // --------- EFFECTS ----------
  useEffect(() => { fetchRoles(); }, [authHeader]);
  useEffect(() => { fetchUsers(); }, [filterRole, filterApproved, filterActive, authHeader]);
  useEffect(() => { if (menu === 'tasks') fetchTasks(); }, [menu, authHeader]);

  // --------- ACTIONS ----------
  const handleApprove = async (id) => {
    if (!window.confirm('Godkend denne bruger?')) return;
    try {
      await axios.post(`${AUTH_API}/approve/${id}`, {}, { headers: authHeader });
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, approved: true } : u)));
    } catch (e) {
      console.error('Godkendelse fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke godkende bruger');
    }
  };

  const handleBlock = async (id) => {
    if (!window.confirm('Blokér brugeren (sætter godkendelse til false)?')) return;
    try {
      await axios.post(`${AUTH_API}/block/${id}`, {}, { headers: authHeader });
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, approved: false } : u)));
    } catch (e) {
      console.error('Blokering fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke blokere bruger');
    }
  };

  const toggleActive = async (id, isActive) => {
    const action = isActive ? 'deaktivere' : 'genaktivere';
    if (!window.confirm(`Vil du ${action} brugeren?`)) return;
    try {
      const r = await axios.post(`${AUTH_API}/toggle-active/${id}`, {}, { headers: authHeader });
      const nextActive = r.data?.active;
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, active: nextActive } : u)));
    } catch (e) {
      console.error('Toggle active fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke skifte aktiv status');
    }
  };

  const updateRole = async (id, newRole) => {
    try {
      await axios.post(
        `${AUTH_API}/users/${id}/role`,
        { role: newRole },
        { headers: { ...authHeader, 'Content-Type': 'application/json' } }
      );
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, role: newRole } : u)));
    } catch (e) {
      console.error('Rolle-opdatering fejlede:', e?.response?.data || e.message);
      alert('Kunne ikke opdatere rolle');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const pendingCarriers = users.filter(u => u.role === 'carrier' && !u.approved);

  // --------- RENDER ----------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <h1 className="text-2xl font-bold">Dashboard (admin)</h1>
        <button
          onClick={logout}
          className="px-3 py-2 rounded bg-gray-800 text-white hover:bg-gray-900"
        >
          Log ud
        </button>
      </div>

      {/* Indhold-wrapper */}
      <div className="px-6 py-6">
        <div className="p-3 rounded bg-blue-600 text-white mb-4">
          Tailwind test: denne boks skal være blå.
        </div>

        {/* HOVED-FANER */}
        <div className="menu-row mb-6">
          <button
            type="button"
            className={`btn ${menu === 'tasks' ? 'btn--active' : ''}`}
            onClick={() => setMenu('tasks')}
          >
            Se alle opgaver
          </button>
          <button
            type="button"
            className={`btn ${menu === 'approve' ? 'btn--active' : ''}`}
            onClick={() => setMenu('approve')}
          >
            Godkend/Administrér brugere
          </button>
          <button
            type="button"
            className={`btn ${menu === 'commission' ? 'btn--active' : ''}`}
            onClick={() => setMenu('commission')}
          >
            Styr kommission
          </button>
        </div>

        {/* --- APPROVE --- */}
        {menu === 'approve' && (
          <>
            {/* Filtre */}
            <div className="bg-white rounded shadow-sm p-4 mb-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm mb-1">Rolle</label>
                  <select
                    className="border rounded px-3 py-2"
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                  >
                    <option value="">Alle</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Godkendt</label>
                  <select
                    className="border rounded px-3 py-2"
                    value={filterApproved}
                    onChange={e => setFilterApproved(e.target.value)}
                  >
                    <option value="">Alle</option>
                    <option value="true">Ja</option>
                    <option value="false">Nej</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Aktiv</label>
                  <select
                    className="border rounded px-3 py-2"
                    value={filterActive}
                    onChange={e => setFilterActive(e.target.value)}
                  >
                    <option value="">Alle</option>
                    <option value="true">Ja</option>
                    <option value="false">Nej</option>
                  </select>
                </div>

                <button
                  onClick={() => { setFilterRole(''); setFilterApproved(''); setFilterActive(''); }}
                  className="text-sm underline"
                >
                  Nulstil filtre
                </button>

                <button
                  onClick={fetchUsers}
                  className="ml-auto px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
                >
                  Opdater liste
                </button>
              </div>
            </div>

            {/* Underfaner */}
            <div className="menu-row mb-4">
              <button
                type="button"
                className={`btn ${view === 'pending' ? 'btn--active' : ''}`}
                onClick={() => setView('pending')}
              >
                Afventer (transportører)
              </button>
              <button
                type="button"
                className={`btn ${view === 'all' ? 'btn--active' : ''}`}
                onClick={() => setView('all')}
              >
                Alle brugere
              </button>
            </div>

            {loading && <div className="p-4 text-gray-500">Indlæser…</div>}
            {err && <div className="p-4 text-red-600">{err}</div>}

            {view === 'pending' ? (
              <div className="space-y-3">
                {pendingCarriers.length === 0 ? (
                  <p className="text-gray-500">Ingen transportører afventer godkendelse.</p>
                ) : pendingCarriers.map(u => (
                  <div key={u.id} className="bg-white rounded shadow-sm p-4 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="font-medium">{u.email}</div>
                      <div className="text-sm text-gray-500">Oprettet: {new Date(u.createdAt).toLocaleString()}</div>
                      <div className="flex gap-2">
                        <Badge color={u.active ? 'green' : 'red'}>Aktiv: {u.active ? 'Ja' : 'Nej'}</Badge>
                        <Badge color="yellow">Godkendt: Nej</Badge>
                        <Badge color="blue">Rolle: carrier</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(u.id)} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">Godkend</button>
                      <button onClick={() => toggleActive(u.id, u.active)} className="px-3 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700">
                        {u.active ? 'Deaktiver' : 'Genaktiver'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {users.length === 0 ? (
                  <p className="text-gray-500">Ingen brugere fundet.</p>
                ) : users.map(u => (
                  <div key={u.id} className="bg-white rounded shadow-sm p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="font-medium">{u.email}</div>
                        <div className="text-sm text-gray-500">Oprettet: {new Date(u.createdAt).toLocaleString()}</div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge color={u.approved ? 'green' : 'yellow'}>Godkendt: {u.approved ? 'Ja' : 'Nej'}</Badge>
                          <Badge color={u.active ? 'green' : 'red'}>Aktiv: {u.active ? 'Ja' : 'Nej'}</Badge>
                          <Badge color="blue">Rolle: {u.role}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} className="border rounded px-2 py-2">
                          {(roles.length ? roles : ['admin','customer','carrier']).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>

                        {!u.approved ? (
                          <button onClick={() => handleApprove(u.id)} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">Godkend</button>
                        ) : (
                          u.role !== 'admin' && (
                            <button onClick={() => handleBlock(u.id)} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">Bloker</button>
                          )
                        )}

                        <button onClick={() => toggleActive(u.id, u.active)} className="px-3 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700">
                          {u.active ? 'Deaktiver' : 'Genaktiver'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* --- TASKS (KANBAN) --- */}
        {menu === 'tasks' && (
          <div className="space-y-4">
            <QuickAdd onAdd={createTaskQuick} />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div className="bg-white rounded shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-2">Styr kommission</h2>
            <p className="text-gray-600">Konfiguration af kommissionssatser kommer snart…</p>
          </div>
        )}
      </div>
    </div>
  );
}

