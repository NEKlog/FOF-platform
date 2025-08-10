import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [role, setRole] = useState('');

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    setRole(storedRole);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard ({role})</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Log ud
        </button>
      </div>

      {role === 'admin' && (
        <div>
          <p className="text-blue-600 font-medium">Velkommen, Admin!</p>
          <ul className="mt-4 list-disc pl-6">
            <li>Se alle opgaver</li>
            <li>Godkend transportører</li>
            <li>Styr kommission</li>
          </ul>
        </div>
      )}

      {role === 'customer' && (
        <div>
          <p className="text-green-700 font-medium">Velkommen, Kunde!</p>
          <p className="mt-2">Du kan oprette transportopgaver og se status.</p>
        </div>
      )}

      {role === 'carrier' && (
        <div>
          <p className="text-purple-700 font-medium">Velkommen, Transportør!</p>
          <p className="mt-2">Du kan byde på opgaver og opdatere status.</p>
        </div>
      )}

      {!role && (
        <div>
          <p className="text-red-500">Ingen rolle fundet...</p>
        </div>
      )}
    </div>
  );
}
