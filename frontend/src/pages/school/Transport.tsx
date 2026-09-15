import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, X, Bus, Users, MapPin, Fuel, Wrench, AlertTriangle, Edit2, Trash2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle { id: string; regNumber: string; make: string | null; model: string | null; capacity: number | null; fuelType: string | null; status: string; }
interface Driver { id: string; firstName: string; lastName: string; phone: string | null; licenseNo: string | null; licenseExp: string | null; isActive: boolean; }
interface Stop { id?: string; name: string; order: number; landmark: string | null; }
interface Route { id: string; name: string; description: string | null; vehicleId: string | null; driverId: string | null; morningDep: string | null; afternoonDep: string | null; fee: number | null; isActive: boolean; vehicle: Vehicle | null; driver: Driver | null; stops: Stop[]; }
interface FuelLog { id: string; vehicleId: string; date: string; litres: number; costPerLitre: number; totalCost: number; odometer: number | null; station: string | null; vehicle: { regNumber: string }; }
interface MaintLog { id: string; vehicleId: string; date: string; type: string; description: string; cost: number; workshop: string | null; nextDueDate: string | null; vehicle: { regNumber: string }; }
interface Summary { totalVehicles: number; activeVehicles: number; vehiclesInMaintenance: number; totalDrivers: number; licenseExpiringSoon: number; activeRoutes: number; totalFuelCost: number; totalMaintCost: number; upcomingMaintenance: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Vehicles', 'Drivers', 'Routes', 'Fuel', 'Maintenance'] as const;
type Tab = typeof TABS[number];

function fmt(n: number) { return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' }); }

const VEHICLE_STATUS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  MAINTENANCE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  RETIRED: 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${VEHICLE_STATUS[status] ?? VEHICLE_STATUS.ACTIVE}`}>{status}</span>;
}

const INPUT = 'w-full text-sm border border-secondary-300 dark:border-secondary-600 rounded-lg px-3 py-2 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white';
const LABEL = 'block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1';

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, onSave, saving }: { title: string; onClose: () => void; children: React.ReactNode; onSave: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-secondary-200 dark:border-secondary-700">
          <h2 className="text-base font-semibold text-secondary-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-secondary-400 hover:text-secondary-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="flex justify-end gap-2 p-5 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle form ─────────────────────────────────────────────────────────────

function VehicleModal({ initial, onClose, onSaved }: { initial?: Vehicle; onClose: () => void; onSaved: (v: Vehicle) => void }) {
  const [form, setForm] = useState({ regNumber: initial?.regNumber ?? '', make: initial?.make ?? '', model: initial?.model ?? '', capacity: initial?.capacity?.toString() ?? '', fuelType: initial?.fuelType ?? '', status: initial?.status ?? 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError('');
    if (!form.regNumber.trim()) { setError('Registration number is required.'); return; }
    setSaving(true);
    try {
      const body = { regNumber: form.regNumber, make: form.make || undefined, model: form.model || undefined, capacity: form.capacity ? Number(form.capacity) : undefined, fuelType: form.fuelType || undefined, status: form.status };
      const res = initial
        ? await api.put(`/school/transport/vehicles/${initial.id}`, body)
        : await api.post('/school/transport/vehicles', body);
      onSaved(res.data.data.vehicle);
    } catch (e: any) { setError(e.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Vehicle' : 'Add Vehicle'} onClose={onClose} onSave={save} saving={saving}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={LABEL}>Registration Number *</label><input className={INPUT} value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} placeholder="GH-1234-20" /></div>
        <div><label className={LABEL}>Make</label><input className={INPUT} value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Toyota" /></div>
        <div><label className={LABEL}>Model</label><input className={INPUT} value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Coaster" /></div>
        <div><label className={LABEL}>Capacity</label><input type="number" min="1" className={INPUT} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="32" /></div>
        <div><label className={LABEL}>Fuel Type</label>
          <select className={INPUT} value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
            <option value="">Select…</option>
            {['DIESEL', 'PETROL', 'LPG'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={LABEL}>Status</label>
          <select className={INPUT} value={form.status} onChange={(e) => set('status', e.target.value)}>
            {['ACTIVE', 'MAINTENANCE', 'RETIRED'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Driver form ──────────────────────────────────────────────────────────────

function DriverModal({ initial, onClose, onSaved }: { initial?: Driver; onClose: () => void; onSaved: (d: Driver) => void }) {
  const [form, setForm] = useState({ firstName: initial?.firstName ?? '', lastName: initial?.lastName ?? '', phone: initial?.phone ?? '', licenseNo: initial?.licenseNo ?? '', licenseExp: initial?.licenseExp ? initial.licenseExp.slice(0, 10) : '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required.'); return; }
    setSaving(true);
    try {
      const body = { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined, licenseNo: form.licenseNo || undefined, licenseExp: form.licenseExp || undefined };
      const res = initial
        ? await api.put(`/school/transport/drivers/${initial.id}`, body)
        : await api.post('/school/transport/drivers', body);
      onSaved(res.data.data.driver);
    } catch (e: any) { setError(e.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Driver' : 'Add Driver'} onClose={onClose} onSave={save} saving={saving}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LABEL}>First Name *</label><input className={INPUT} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
        <div><label className={LABEL}>Last Name *</label><input className={INPUT} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
        <div><label className={LABEL}>Phone</label><input className={INPUT} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0244000000" /></div>
        <div><label className={LABEL}>License No</label><input className={INPUT} value={form.licenseNo} onChange={(e) => set('licenseNo', e.target.value)} /></div>
        <div className="col-span-2"><label className={LABEL}>License Expiry</label><input type="date" className={INPUT} value={form.licenseExp} onChange={(e) => set('licenseExp', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

// ─── Route form ───────────────────────────────────────────────────────────────

function RouteModal({ initial, vehicles, drivers, onClose, onSaved }: { initial?: Route; vehicles: Vehicle[]; drivers: Driver[]; onClose: () => void; onSaved: (r: Route) => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? '', description: initial?.description ?? '', vehicleId: initial?.vehicleId ?? '', driverId: initial?.driverId ?? '', morningDep: initial?.morningDep ?? '', afternoonDep: initial?.afternoonDep ?? '', fee: initial?.fee?.toString() ?? '' });
  const [stops, setStops] = useState<{ name: string; order: number; landmark: string }[]>(initial?.stops?.map((s) => ({ name: s.name, order: s.order, landmark: s.landmark ?? '' })) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function addStop() { setStops((s) => [...s, { name: '', order: s.length + 1, landmark: '' }]); }
  function removeStop(idx: number) { setStops((s) => s.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }))); }
  function setStop(idx: number, field: 'name' | 'landmark', val: string) { setStops((s) => s.map((r, i) => i === idx ? { ...r, [field]: val } : r)); }

  async function save() {
    setError('');
    if (!form.name.trim()) { setError('Route name is required.'); return; }
    if (stops.some((s) => !s.name.trim())) { setError('Every stop needs a name.'); return; }
    setSaving(true);
    try {
      const body = { name: form.name, description: form.description || undefined, vehicleId: form.vehicleId || undefined, driverId: form.driverId || undefined, morningDep: form.morningDep || undefined, afternoonDep: form.afternoonDep || undefined, fee: form.fee ? Number(form.fee) : undefined, stops: stops.map((s, i) => ({ name: s.name, order: i + 1, landmark: s.landmark || undefined })) };
      const res = initial
        ? await api.put(`/school/transport/routes/${initial.id}`, body)
        : await api.post('/school/transport/routes', body);
      onSaved(res.data.data.route);
    } catch (e: any) { setError(e.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Edit Route' : 'Add Route'} onClose={onClose} onSave={save} saving={saving}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={LABEL}>Route Name *</label><input className={INPUT} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="North Legon – School" /></div>
        <div className="col-span-2"><label className={LABEL}>Description</label><input className={INPUT} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div><label className={LABEL}>Vehicle</label>
          <select className={INPUT} value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
            <option value="">None</option>
            {vehicles.filter((v) => v.status === 'ACTIVE').map((v) => <option key={v.id} value={v.id}>{v.regNumber}{v.make ? ` — ${v.make} ${v.model ?? ''}` : ''}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Driver</label>
          <select className={INPUT} value={form.driverId} onChange={(e) => set('driverId', e.target.value)}>
            <option value="">None</option>
            {drivers.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Morning Departure</label><input type="time" className={INPUT} value={form.morningDep} onChange={(e) => set('morningDep', e.target.value)} /></div>
        <div><label className={LABEL}>Afternoon Departure</label><input type="time" className={INPUT} value={form.afternoonDep} onChange={(e) => set('afternoonDep', e.target.value)} /></div>
        <div className="col-span-2"><label className={LABEL}>Term Fee (GHS)</label><input type="number" min="0" step="0.01" className={INPUT} value={form.fee} onChange={(e) => set('fee', e.target.value)} /></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-secondary-600 dark:text-secondary-400">Stops</p>
          <button onClick={addStop} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"><Plus size={12} /> Add Stop</button>
        </div>
        {stops.length === 0 && <p className="text-xs text-secondary-400 italic">No stops added yet.</p>}
        <div className="space-y-2">
          {stops.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-secondary-400 w-5 shrink-0">{idx + 1}.</span>
              <input className={INPUT + ' flex-1'} placeholder="Stop name" value={s.name} onChange={(e) => setStop(idx, 'name', e.target.value)} />
              <input className={INPUT + ' flex-1'} placeholder="Landmark" value={s.landmark} onChange={(e) => setStop(idx, 'landmark', e.target.value)} />
              <button onClick={() => removeStop(idx)} className="text-secondary-400 hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─── Fuel Log form ────────────────────────────────────────────────────────────

function FuelModal({ vehicles, onClose, onSaved }: { vehicles: Vehicle[]; onClose: () => void; onSaved: (l: FuelLog) => void }) {
  const [form, setForm] = useState({ vehicleId: '', date: new Date().toISOString().slice(0, 10), litres: '', costPerLitre: '', odometer: '', station: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const total = parseFloat(form.litres) * parseFloat(form.costPerLitre);

  async function save() {
    setError('');
    if (!form.vehicleId || !form.litres || !form.costPerLitre) { setError('Vehicle, litres and cost/litre are required.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/school/transport/fuel-logs', { vehicleId: form.vehicleId, date: form.date, litres: Number(form.litres), costPerLitre: Number(form.costPerLitre), odometer: form.odometer ? Number(form.odometer) : undefined, station: form.station || undefined });
      onSaved(res.data.data.log);
    } catch (e: any) { setError(e.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Log Fuel" onClose={onClose} onSave={save} saving={saving}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={LABEL}>Vehicle *</label>
          <select className={INPUT} value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNumber}{v.make ? ` — ${v.make}` : ''}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Date *</label><input type="date" className={INPUT} value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className={LABEL}>Station</label><input className={INPUT} value={form.station} onChange={(e) => set('station', e.target.value)} placeholder="Total, Shell…" /></div>
        <div><label className={LABEL}>Litres *</label><input type="number" min="0.1" step="0.01" className={INPUT} value={form.litres} onChange={(e) => set('litres', e.target.value)} /></div>
        <div><label className={LABEL}>Cost/Litre (GHS) *</label><input type="number" min="0.01" step="0.01" className={INPUT} value={form.costPerLitre} onChange={(e) => set('costPerLitre', e.target.value)} /></div>
        <div><label className={LABEL}>Odometer (km)</label><input type="number" min="0" className={INPUT} value={form.odometer} onChange={(e) => set('odometer', e.target.value)} /></div>
        <div className="flex items-end"><div className="text-sm font-semibold text-secondary-900 dark:text-white">Total: {!isNaN(total) && total > 0 ? fmt(total) : '—'}</div></div>
      </div>
    </Modal>
  );
}

// ─── Maintenance Log form ─────────────────────────────────────────────────────

function MaintModal({ vehicles, onClose, onSaved }: { vehicles: Vehicle[]; onClose: () => void; onSaved: (l: MaintLog) => void }) {
  const [form, setForm] = useState({ vehicleId: '', date: new Date().toISOString().slice(0, 10), type: 'SERVICE', description: '', cost: '', workshop: '', nextDueDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError('');
    if (!form.vehicleId || !form.description.trim() || !form.cost) { setError('Vehicle, description and cost are required.'); return; }
    setSaving(true);
    try {
      const res = await api.post('/school/transport/maint-logs', { vehicleId: form.vehicleId, date: form.date, type: form.type, description: form.description, cost: Number(form.cost), workshop: form.workshop || undefined, nextDueDate: form.nextDueDate || undefined });
      onSaved(res.data.data.log);
    } catch (e: any) { setError(e.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Log Maintenance" onClose={onClose} onSave={save} saving={saving}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={LABEL}>Vehicle *</label>
          <select className={INPUT} value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.regNumber}{v.make ? ` — ${v.make}` : ''}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Date</label><input type="date" className={INPUT} value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        <div><label className={LABEL}>Type</label>
          <select className={INPUT} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {['OIL_CHANGE', 'TYRE', 'BRAKE', 'SERVICE', 'REPAIR', 'OTHER'].map((t) => <option key={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={LABEL}>Description *</label><input className={INPUT} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div><label className={LABEL}>Cost (GHS) *</label><input type="number" min="0" step="0.01" className={INPUT} value={form.cost} onChange={(e) => set('cost', e.target.value)} /></div>
        <div><label className={LABEL}>Workshop</label><input className={INPUT} value={form.workshop} onChange={(e) => set('workshop', e.target.value)} /></div>
        <div className="col-span-2"><label className={LABEL}>Next Due Date</label><input type="date" className={INPUT} value={form.nextDueDate} onChange={(e) => set('nextDueDate', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Transport() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintLogs, setMaintLogs] = useState<MaintLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [vehicleModal, setVehicleModal] = useState<{ open: boolean; item?: Vehicle }>({ open: false });
  const [driverModal, setDriverModal] = useState<{ open: boolean; item?: Driver }>({ open: false });
  const [routeModal, setRouteModal] = useState<{ open: boolean; item?: Route }>({ open: false });
  const [fuelModal, setFuelModal] = useState(false);
  const [maintModal, setMaintModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sumRes, vRes, dRes, rRes, fRes, mRes] = await Promise.all([
        api.get('/school/transport/summary'),
        api.get('/school/transport/vehicles'),
        api.get('/school/transport/drivers'),
        api.get('/school/transport/routes'),
        api.get('/school/transport/fuel-logs'),
        api.get('/school/transport/maint-logs'),
      ]);
      setSummary(sumRes.data.data);
      setVehicles(vRes.data.data.vehicles);
      setDrivers(dRes.data.data.drivers);
      setRoutes(rRes.data.data.routes);
      setFuelLogs(fRes.data.data.logs);
      setMaintLogs(mRes.data.data.logs);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load transport data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteItem(type: string, id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/school/transport/${type}/${id}`);
      if (type === 'vehicles') setVehicles((v) => v.filter((x) => x.id !== id));
      if (type === 'routes') setRoutes((r) => r.filter((x) => x.id !== id));
      if (type === 'fuel-logs') setFuelLogs((l) => l.filter((x) => x.id !== id));
      if (type === 'maint-logs') setMaintLogs((l) => l.filter((x) => x.id !== id));
    } catch (e: any) { alert(e.response?.data?.error ?? 'Delete failed.'); }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900 dark:text-white">Transport Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Vehicles, routes, drivers, fuel & maintenance</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'Vehicles' && <Button onClick={() => setVehicleModal({ open: true })}><Plus size={15} className="mr-1" /> Vehicle</Button>}
          {activeTab === 'Drivers' && <Button onClick={() => setDriverModal({ open: true })}><Plus size={15} className="mr-1" /> Driver</Button>}
          {activeTab === 'Routes' && <Button onClick={() => setRouteModal({ open: true })}><Plus size={15} className="mr-1" /> Route</Button>}
          {activeTab === 'Fuel' && <Button onClick={() => setFuelModal(true)}><Plus size={15} className="mr-1" /> Log Fuel</Button>}
          {activeTab === 'Maintenance' && <Button onClick={() => setMaintModal(true)}><Plus size={15} className="mr-1" /> Log Maintenance</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-secondary-200 dark:border-secondary-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-secondary-400 text-center py-8">Loading…</p>}
      {error && <p className="text-sm text-red-600 text-center py-4">{error}</p>}

      {!loading && !error && (
        <>
          {/* OVERVIEW */}
          {activeTab === 'Overview' && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Active Vehicles', value: summary.activeVehicles, sub: `${summary.vehiclesInMaintenance} in maintenance`, icon: Bus, color: 'text-blue-600' },
                  { label: 'Active Drivers', value: summary.totalDrivers, sub: summary.licenseExpiringSoon > 0 ? `${summary.licenseExpiringSoon} license expiring` : 'All licenses valid', icon: Users, color: 'text-emerald-600', warn: summary.licenseExpiringSoon > 0 },
                  { label: 'Active Routes', value: summary.activeRoutes, icon: MapPin, color: 'text-purple-600' },
                  { label: 'Total Fuel Cost', value: fmt(summary.totalFuelCost), icon: Fuel, color: 'text-amber-600' },
                  { label: 'Total Maint Cost', value: fmt(summary.totalMaintCost), icon: Wrench, color: 'text-red-600' },
                  { label: 'Upcoming Maint', value: summary.upcomingMaintenance, sub: 'within 30 days', icon: AlertTriangle, color: 'text-orange-600', warn: summary.upcomingMaintenance > 0 },
                ].map((tile) => (
                  <Card key={tile.label}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <tile.icon size={18} className={tile.color} />
                        <span className="text-xs text-secondary-500">{tile.label}</span>
                      </div>
                      <p className="text-xl font-bold text-secondary-900 dark:text-white mt-1">{tile.value}</p>
                      {tile.sub && <p className={`text-xs mt-0.5 ${(tile as any).warn ? 'text-amber-600' : 'text-secondary-400'}`}>{tile.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* VEHICLES */}
          {activeTab === 'Vehicles' && (
            <Card>
              <CardContent className="pt-4">
                {vehicles.length === 0 ? <p className="text-sm text-secondary-400 text-center py-6">No vehicles. Add one to get started.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-secondary-500 border-b border-secondary-200 dark:border-secondary-700">
                        <th className="px-3 py-2 text-left">Reg No.</th><th className="px-3 py-2 text-left">Make / Model</th><th className="px-3 py-2 text-center">Capacity</th><th className="px-3 py-2 text-left">Fuel</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {vehicles.map((v) => (
                          <tr key={v.id} className="border-b border-secondary-100 dark:border-secondary-700/50 last:border-0">
                            <td className="px-3 py-2 font-medium text-secondary-900 dark:text-white">{v.regNumber}</td>
                            <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                            <td className="px-3 py-2 text-center text-secondary-600 dark:text-secondary-300">{v.capacity ?? '—'}</td>
                            <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{v.fuelType ?? '—'}</td>
                            <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => setVehicleModal({ open: true, item: v })} className="text-secondary-400 hover:text-primary-600 mr-2"><Edit2 size={14} /></button>
                              <button onClick={() => deleteItem('vehicles', v.id)} className="text-secondary-400 hover:text-red-500"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* DRIVERS */}
          {activeTab === 'Drivers' && (
            <Card>
              <CardContent className="pt-4">
                {drivers.length === 0 ? <p className="text-sm text-secondary-400 text-center py-6">No drivers. Add one to get started.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-secondary-500 border-b border-secondary-200 dark:border-secondary-700">
                        <th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">License No</th><th className="px-3 py-2 text-left">Expiry</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {drivers.map((d) => {
                          const expiring = d.licenseExp && new Date(d.licenseExp) <= new Date(Date.now() + 30 * 86400000);
                          return (
                            <tr key={d.id} className="border-b border-secondary-100 dark:border-secondary-700/50 last:border-0">
                              <td className="px-3 py-2 font-medium text-secondary-900 dark:text-white">{d.firstName} {d.lastName}</td>
                              <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{d.phone ?? '—'}</td>
                              <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{d.licenseNo ?? '—'}</td>
                              <td className={`px-3 py-2 ${expiring ? 'text-amber-600 font-medium' : 'text-secondary-600 dark:text-secondary-300'}`}>
                                {d.licenseExp ? fmtDate(d.licenseExp) : '—'}{expiring && ' ⚠'}
                              </td>
                              <td className="px-3 py-2"><StatusBadge status={d.isActive ? 'ACTIVE' : 'RETIRED'} /></td>
                              <td className="px-3 py-2 text-right">
                                <button onClick={() => setDriverModal({ open: true, item: d })} className="text-secondary-400 hover:text-primary-600"><Edit2 size={14} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ROUTES */}
          {activeTab === 'Routes' && (
            <div className="space-y-3">
              {routes.length === 0 && <Card><CardContent className="pt-4"><p className="text-sm text-secondary-400 text-center py-6">No routes. Add one to get started.</p></CardContent></Card>}
              {routes.map((r) => (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-secondary-900 dark:text-white">{r.name}</span>
                          {!r.isActive && <StatusBadge status="RETIRED" />}
                        </div>
                        {r.description && <p className="text-xs text-secondary-500 mt-0.5">{r.description}</p>}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-secondary-600 dark:text-secondary-300">
                          {r.vehicle && <span><Bus size={11} className="inline mr-1" />{r.vehicle.regNumber}{r.vehicle.make ? ` (${r.vehicle.make})` : ''}</span>}
                          {r.driver && <span><Users size={11} className="inline mr-1" />{r.driver.firstName} {r.driver.lastName}</span>}
                          {r.morningDep && <span>🌅 {r.morningDep}</span>}
                          {r.afternoonDep && <span>🌆 {r.afternoonDep}</span>}
                          {r.fee !== null && <span className="font-medium text-secondary-900 dark:text-white">{fmt(r.fee)}/term</span>}
                        </div>
                        {r.stops.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.stops.map((s, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300 px-2 py-0.5 rounded">
                                <MapPin size={9} />{s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setRouteModal({ open: true, item: r })} className="text-secondary-400 hover:text-primary-600"><Edit2 size={14} /></button>
                        <button onClick={() => deleteItem('routes', r.id)} className="text-secondary-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* FUEL */}
          {activeTab === 'Fuel' && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Fuel Logs — {fuelLogs.length} entries</CardTitle></CardHeader>
              <CardContent>
                {fuelLogs.length === 0 ? <p className="text-sm text-secondary-400 text-center py-6">No fuel logs yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-secondary-500 border-b border-secondary-200 dark:border-secondary-700">
                        <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Vehicle</th><th className="px-3 py-2 text-left">Station</th><th className="px-3 py-2 text-right">Litres</th><th className="px-3 py-2 text-right">GHS/L</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">ODO</th><th className="px-3 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {fuelLogs.map((l) => (
                          <tr key={l.id} className="border-b border-secondary-100 dark:border-secondary-700/50 last:border-0">
                            <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{fmtDate(l.date)}</td>
                            <td className="px-3 py-2 font-medium text-secondary-900 dark:text-white">{l.vehicle.regNumber}</td>
                            <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{l.station ?? '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(l.litres).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(l.costPerLitre).toFixed(4)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(Number(l.totalCost))}</td>
                            <td className="px-3 py-2 text-right text-secondary-500">{l.odometer ?? '—'}</td>
                            <td className="px-3 py-2 text-right"><button onClick={() => deleteItem('fuel-logs', l.id)} className="text-secondary-400 hover:text-red-500"><Trash2 size={13} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* MAINTENANCE */}
          {activeTab === 'Maintenance' && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Maintenance Logs — {maintLogs.length} entries</CardTitle></CardHeader>
              <CardContent>
                {maintLogs.length === 0 ? <p className="text-sm text-secondary-400 text-center py-6">No maintenance logs yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-secondary-500 border-b border-secondary-200 dark:border-secondary-700">
                        <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Vehicle</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-left">Next Due</th><th className="px-3 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {maintLogs.map((l) => {
                          const due = l.nextDueDate;
                          const overdue = due && new Date(due) < new Date();
                          const soon = due && !overdue && new Date(due) <= new Date(Date.now() + 30 * 86400000);
                          return (
                            <tr key={l.id} className="border-b border-secondary-100 dark:border-secondary-700/50 last:border-0">
                              <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300">{fmtDate(l.date)}</td>
                              <td className="px-3 py-2 font-medium text-secondary-900 dark:text-white">{l.vehicle.regNumber}</td>
                              <td className="px-3 py-2"><span className="text-xs bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300 px-1.5 py-0.5 rounded">{l.type.replace('_', ' ')}</span></td>
                              <td className="px-3 py-2 text-secondary-600 dark:text-secondary-300 max-w-xs truncate">{l.description}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(Number(l.cost))}</td>
                              <td className={`px-3 py-2 text-sm ${overdue ? 'text-red-600 font-medium' : soon ? 'text-amber-600 font-medium' : 'text-secondary-500'}`}>
                                {due ? fmtDate(due) : '—'}
                                {overdue && ' ⚠'}{soon && ' ⏰'}
                              </td>
                              <td className="px-3 py-2 text-right"><button onClick={() => deleteItem('maint-logs', l.id)} className="text-secondary-400 hover:text-red-500"><Trash2 size={13} /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modals */}
      {vehicleModal.open && <VehicleModal initial={vehicleModal.item} onClose={() => setVehicleModal({ open: false })} onSaved={(v) => { setVehicles((prev) => vehicleModal.item ? prev.map((x) => x.id === v.id ? v : x) : [v, ...prev]); setVehicleModal({ open: false }); }} />}
      {driverModal.open && <DriverModal initial={driverModal.item} onClose={() => setDriverModal({ open: false })} onSaved={(d) => { setDrivers((prev) => driverModal.item ? prev.map((x) => x.id === d.id ? d : x) : [d, ...prev]); setDriverModal({ open: false }); }} />}
      {routeModal.open && <RouteModal initial={routeModal.item} vehicles={vehicles} drivers={drivers} onClose={() => setRouteModal({ open: false })} onSaved={(r) => { setRoutes((prev) => routeModal.item ? prev.map((x) => x.id === r.id ? r : x) : [r, ...prev]); setRouteModal({ open: false }); }} />}
      {fuelModal && <FuelModal vehicles={vehicles} onClose={() => setFuelModal(false)} onSaved={(l) => { setFuelLogs((prev) => [l, ...prev]); setFuelModal(false); }} />}
      {maintModal && <MaintModal vehicles={vehicles} onClose={() => setMaintModal(false)} onSaved={(l) => { setMaintLogs((prev) => [l, ...prev]); setMaintModal(false); }} />}
    </div>
  );
}
