import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const CARRIER_API = 'http://localhost:4000/api/carrier';
const BIDS_API = 'http://localhost:4000/api/bids';

export default function CarrierDashboard() {
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [openTasks, setOpenTasks] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [amountByTask, setAmountByTask] = useState({});
  const [messageByTask, setMessageByTask] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function loadAll() {
    setLoading(true); setErr('');
    try {
      const [t, b] = await Promise.all([
        axios.get(`${CARRIER_API}/tasks/open`, { headers: authHeader }),
        axios.get(`${CARRIER_API}/bids/mine`, { headers: authHeader }),
      ]);
      setOpenTasks(Array.isArray(t.data) ? t.data : []);
      setMyBids(Array.isArray(b.data) ? b.data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Kunne ikke hente data');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [authHeader]);

  const alreadyBidTaskIds = new Set(myBids.map(b => b.taskId));

  async function placeBid(taskId) {
    const amount = Number(amountByTask[taskId]);
    const message = (messageByTask[taskId] || '').trim();
    if (!amount || amount <= 0) return alert('Angiv et gyldigt beløb');

    try {
      await axios.post(`${BIDS_API}/task/${taskId}`, { amount, message }, {
        headers: { ...authHeader, 'Content-Type': 'application/json' }
      });
      // refresh mine bud + ryd felter
      setAmountByTask(prev => ({ ...prev, [taskId]: '' }));
      setMessageByTask(prev => ({ ...prev, [taskId]: '' }));
      await loadAll();
      alert('Bud sendt ✔');
    } catch (e) {
      alert(e?.response?.data?.error || 'Kunne ikke sende bud');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Transportør – Bud</h1>

      {err && <div className="mb-4 text-red-600">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ÅBNE OPGAVER */}
        <div className="bg-white rounded shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Åbne opgaver</h2>
          {loading ? (
            <div className="text-gray-500">Indlæser…</div>
          ) : openTasks.length === 0 ? (
            <div className="text-gray-500">Ingen åbne opgaver lige nu.</div>
          ) : (
            <ul className="space-y-3">
              {openTasks.map(t => (
                <li key={t.id} className="border rounded p-3">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-gray-600">
                    {t.pickup || 'Ukendt afhentning'} → {t.dropoff || 'Ukendt levering'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Oprettet: {new Date(t.createdAt).toLocaleString()}
                    {t.scheduledAt && <> · Planlagt: {new Date(t.scheduledAt).toLocaleString()}</>}
                  </div>

                  {alreadyBidTaskIds.has(t.id) ? (
                    <div className="mt-2 text-green-700 text-sm">Du har allerede budt på denne opgave</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Beløb (kr.)"
                        className="border rounded px-3 py-2 md:col-span-2"
                        value={amountByTask[t.id] || ''}
                        onChange={e => setAmountByTask(p => ({ ...p, [t.id]: e.target.value }))}
                      />
                      <input
                        placeholder="Besked (valgfri)"
                        className="border rounded px-3 py-2 md:col-span-2"
                        value={messageByTask[t.id] || ''}
                        onChange={e => setMessageByTask(p => ({ ...p, [t.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => placeBid(t.id)}
                        className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Afgiv bud
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* MINE BUD */}
        <div className="bg-white rounded shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Mine bud</h2>
          {loading ? (
            <div className="text-gray-500">Indlæser…</div>
          ) : myBids.length === 0 ? (
            <div className="text-gray-500">Du har ingen bud endnu.</div>
          ) : (
            <ul className="space-y-3">
              {myBids.map(b => (
                <li key={b.id} className="border rounded p-3">
                  <div className="font-medium">{b.task?.title || `Task #${b.taskId}`}</div>
                  <div className="text-sm">Beløb: {b.amount} kr.</div>
                  {b.message && <div className="text-sm text-gray-600">“{b.message}”</div>}
                  <div className="text-xs text-gray-500">
                    Status: {b.status} · {new Date(b.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
