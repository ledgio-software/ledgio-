import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, AlertTriangle, Plus, LogIn, LogOut } from "lucide-react";
import { api } from "../../lib/api";
import { useNavigate, useParams } from "react-router-dom";

interface FolioCharge { id: string; description: string; amount: number; charge_date: string; }
interface Reservation {
  id: string; reservation_number: string; guest_name: string; guest_email?: string; guest_phone?: string;
  room_number: string; room_type_name: string; check_in_date: string; check_out_date: string;
  actual_check_in?: string; actual_check_out?: string; status: string; rate_per_night: number;
  adults: number; children: number; special_requests?: string; deposit_amount: number; invoice_id?: string;
}
interface FolioSummary { nights: number; ratePerNight: number; roomTotal: number; folioTotal: number; grandTotal: number; }

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700", CHECKED_IN: "bg-green-100 text-green-700",
  CHECKED_OUT: "bg-muted text-muted-foreground", CANCELLED: "bg-red-100 text-red-700", NO_SHOW: "bg-orange-100 text-orange-700",
};

export function ReservationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [charges, setCharges] = useState<FolioCharge[]>([]);
  const [summary, setSummary] = useState<FolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "" });

  const fetchFolio = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/hospitality/reservations/${id}/folio`);
      setReservation(res.data.reservation);
      setCharges(res.data.charges ?? []);
      setSummary(res.data.summary);
    } catch {
      setError("Failed to load reservation.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchFolio(); }, [fetchFolio]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/hospitality/reservations/${id}/check-in`);
      fetchFolio();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Check-in failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm("Confirm check-out? This will create an invoice for the full stay.")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/hospitality/reservations/${id}/check-out`);
      alert(`Check-out complete. Invoice #${res.data.invoiceId} created. Total: GHS ${Number(res.data.totalAmount).toFixed(2)}`);
      fetchFolio();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Check-out failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCharge = async () => {
    if (!chargeForm.description.trim() || !chargeForm.amount) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/hospitality/reservations/${id}/folio-charges`, {
        description: chargeForm.description.trim(),
        amount: Number(chargeForm.amount),
      });
      setShowChargeForm(false);
      setChargeForm({ description: "", amount: "" });
      fetchFolio();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to add charge.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!reservation) return <div className="p-6 text-center text-muted-foreground">Reservation not found.</div>;

  const canCheckIn = reservation.status === "CONFIRMED";
  const canCheckOut = reservation.status === "CHECKED_IN";
  const canAddCharges = ["CONFIRMED", "CHECKED_IN"].includes(reservation.status);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate("/hospitality/reservations")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Reservations
      </button>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{reservation.reservation_number}</h1>
          <p className="text-muted-foreground">{reservation.guest_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm px-3 py-1 rounded-full ${STATUS_COLORS[reservation.status]}`}>{reservation.status.replace("_", " ")}</span>
          {canCheckIn && (
            <button onClick={handleCheckIn} disabled={actionLoading} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Check In
            </button>
          )}
          {canCheckOut && (
            <button onClick={handleCheckOut} disabled={actionLoading} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Check Out & Invoice
            </button>
          )}
        </div>
      </div>

      {/* Stay Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold mb-3">Guest Info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{reservation.guest_name}</dd></div>
            {reservation.guest_email && <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{reservation.guest_email}</dd></div>}
            {reservation.guest_phone && <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{reservation.guest_phone}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Guests</dt><dd>{reservation.adults} adult{reservation.adults !== 1 ? "s" : ""}{reservation.children > 0 ? `, ${reservation.children} child${reservation.children !== 1 ? "ren" : ""}` : ""}</dd></div>
          </dl>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold mb-3">Stay Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Room</dt><dd className="font-medium">Room {reservation.room_number} ({reservation.room_type_name})</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Check-in</dt><dd>{reservation.check_in_date}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Check-out</dt><dd>{reservation.check_out_date}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Rate</dt><dd>GHS {Number(reservation.rate_per_night).toFixed(2)}/night</dd></div>
            {reservation.deposit_amount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Deposit Paid</dt><dd>GHS {Number(reservation.deposit_amount).toFixed(2)}</dd></div>}
          </dl>
          {reservation.special_requests && <p className="mt-3 text-xs text-muted-foreground italic">Note: {reservation.special_requests}</p>}
        </div>
      </div>

      {/* Folio */}
      <div className="border rounded-lg p-4 mb-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Guest Folio</h2>
          {canAddCharges && (
            <button onClick={() => setShowChargeForm(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="h-4 w-4" /> Add Charge
            </button>
          )}
        </div>

        {showChargeForm && (
          <div className="flex gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
            <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Description (e.g. Room Service)" value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} />
            <input type="number" className="w-32 border rounded px-3 py-2 text-sm" placeholder="Amount (GHS)" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} min={0.01} step={0.01} />
            <button onClick={handleAddCharge} disabled={actionLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">Add</button>
            <button onClick={() => setShowChargeForm(false)} className="border px-3 py-2 rounded text-sm hover:bg-muted">Cancel</button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-2 text-muted-foreground font-medium">Description</th><th className="text-left py-2 text-muted-foreground font-medium">Date</th><th className="text-right py-2 text-muted-foreground font-medium">Amount</th></tr></thead>
          <tbody>
            {summary && (
              <tr className="border-b"><td className="py-2">Room stay ({summary.nights} night{summary.nights !== 1 ? "s" : ""} × GHS {Number(summary.ratePerNight).toFixed(2)})</td><td className="py-2 text-muted-foreground">{reservation.check_in_date}</td><td className="py-2 text-right font-medium">GHS {Number(summary.roomTotal).toFixed(2)}</td></tr>
            )}
            {charges.map((c) => (
              <tr key={c.id} className="border-b"><td className="py-2">{c.description}</td><td className="py-2 text-muted-foreground">{c.charge_date}</td><td className="py-2 text-right">GHS {Number(c.amount).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>

        {summary && (
          <div className="mt-4 pt-4 border-t space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Room Total</span><span>GHS {Number(summary.roomTotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Extra Charges</span><span>GHS {Number(summary.folioTotal).toFixed(2)}</span></div>
            {reservation.deposit_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Deposit Paid</span><span>− GHS {Number(reservation.deposit_amount).toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>Amount Due</span><span>GHS {Number(summary.grandTotal).toFixed(2)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
