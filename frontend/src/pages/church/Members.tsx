import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Users, UserPlus, Search, Edit2, Trash2, Loader2 } from "lucide-react";

interface CellGroup {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ChurchMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  membership_date: string | null;
  membership_status: string;
  cell_group_id: string | null;
  cell_group_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  department: string | null;
  address: string | null;
  occupation: string | null;
  marital_status: string | null;
  baptism_date: string | null;
  notes: string | null;
  is_active: boolean;
}

const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE", "TRANSFERRED", "DECEASED"] as const;
type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

const STATUS_BADGE: Record<MembershipStatus, "success" | "secondary" | "default" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  TRANSFERRED: "default",
  DECEASED: "danger",
};

const GENDERS = ["Male", "Female"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

interface MemberForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  membershipDate: string;
  membershipStatus: string;
  branchId: string;
  cellGroupId: string;
  department: string;
  address: string;
  occupation: string;
  maritalStatus: string;
  baptismDate: string;
  notes: string;
}

const emptyForm: MemberForm = {
  firstName: "", lastName: "", email: "", phone: "", gender: "",
  dateOfBirth: "", membershipDate: "", membershipStatus: "ACTIVE",
  branchId: "", cellGroupId: "", department: "", address: "", occupation: "",
  maritalStatus: "", baptismDate: "", notes: "",
};

export function Members() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ChurchMember | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const r = await api.get("/church/members", { params });
      setMembers(r.data?.data ?? []);
    } catch {
      showToast("Failed to load members.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, showToast]);

  useEffect(() => {
    loadMembers();
    api.get("/church/cell-groups").then((r) => setCellGroups(r.data?.data ?? []));
    api.get("/church/branches").then((r) => setBranches(r.data?.data ?? []));
  }, [loadMembers]);

  function openAdd() {
    setEditingMember(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(m: ChurchMember) {
    setEditingMember(m);
    setForm({
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email ?? "",
      phone: m.phone ?? "",
      gender: m.gender ?? "",
      dateOfBirth: m.date_of_birth ? m.date_of_birth.slice(0, 10) : "",
      membershipDate: m.membership_date ? m.membership_date.slice(0, 10) : "",
      membershipStatus: m.membership_status,
      branchId: m.branch_id ?? "",
      cellGroupId: m.cell_group_id ?? "",
      department: m.department ?? "",
      address: m.address ?? "",
      occupation: m.occupation ?? "",
      maritalStatus: m.marital_status ?? "",
      baptismDate: m.baptism_date ? m.baptism_date.slice(0, 10) : "",
      notes: m.notes ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("First name and last name are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email || null,
        phone: form.phone || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        membershipDate: form.membershipDate || null,
        membershipStatus: form.membershipStatus,
        branchId: form.branchId || null,
        cellGroupId: form.cellGroupId || null,
        department: form.department || null,
        address: form.address || null,
        occupation: form.occupation || null,
        maritalStatus: form.maritalStatus || null,
        baptismDate: form.baptismDate || null,
        notes: form.notes || null,
      };
      if (editingMember) {
        await api.put(`/church/members/${editingMember.id}`, payload);
        showToast("Member updated.", "success");
      } else {
        await api.post("/church/members", payload);
        showToast("Member added.", "success");
      }
      setShowModal(false);
      loadMembers();
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(apiErr ?? "Failed to save member.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Archive this member?")) return;
    try {
      await api.delete(`/church/members/${id}`);
      showToast("Member archived.", "success");
      loadMembers();
    } catch {
      showToast("Failed to archive member.", "error");
    }
  }

  function f(key: keyof MemberForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-600" />
          <h1 className="text-xl font-bold text-secondary-900 dark:text-secondary-50">Church Members</h1>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
          >
            <option value="">All Statuses</option>
            {MEMBERSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Cell Group</TableHead>
                  <TableHead>Membership Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-secondary-500">
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                      <TableCell>{m.phone ?? "—"}</TableCell>
                      <TableCell>{m.email ?? "—"}</TableCell>
                      <TableCell>{m.department ?? "—"}</TableCell>
                      <TableCell>{m.cell_group_name ?? "—"}</TableCell>
                      <TableCell>{m.membership_date ? m.membership_date.slice(0, 10) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[m.membership_status as MembershipStatus]}>
                          {m.membership_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(m)} className="p-1 hover:text-primary-600 text-secondary-500" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="p-1 hover:text-red-600 text-secondary-500" title="Archive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingMember ? "Edit Member" : "Add Member"}
        className="max-w-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {(
            [
              ["First Name *", "firstName", "text"],
              ["Last Name *", "lastName", "text"],
              ["Email", "email", "email"],
              ["Phone", "phone", "tel"],
              ["Date of Birth", "dateOfBirth", "date"],
              ["Membership Date", "membershipDate", "date"],
              ["Department", "department", "text"],
              ["Occupation", "occupation", "text"],
              ["Baptism Date", "baptismDate", "date"],
            ] as [string, keyof MemberForm, string][]
          ).map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => f(key, e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => f("gender", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              <option value="">Select gender</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Marital Status</label>
            <select
              value={form.maritalStatus}
              onChange={(e) => f("maritalStatus", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              <option value="">Select status</option>
              {MARITAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Membership Status</label>
            <select
              value={form.membershipStatus}
              onChange={(e) => f("membershipStatus", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              {MEMBERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {branches.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Branch</label>
              <select
                value={form.branchId}
                onChange={(e) => f("branchId", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
              >
                <option value="">No specific branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Cell Group</label>
            <select
              value={form.cellGroupId}
              onChange={(e) => f("cellGroupId", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
            >
              <option value="">None</option>
              {cellGroups.map((cg) => <option key={cg.id} value={cg.id}>{cg.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => f("address", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => f("notes", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingMember ? "Save Changes" : "Add Member"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Required for lazy import pattern
export default Members;
