import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Users, MapPin, Clock, Edit2, Plus, Loader2, Users2 } from "lucide-react";

interface CellGroup {
  id: string;
  name: string;
  leader_name: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  member_count: number;
}

const MEETING_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface GroupForm {
  name: string;
  leaderName: string;
  meetingDay: string;
  meetingTime: string;
  location: string;
  description: string;
}

const emptyForm: GroupForm = {
  name: "", leaderName: "", meetingDay: "", meetingTime: "", location: "", description: "",
};

export function CellGroups() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<CellGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CellGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/church/cell-groups");
      setGroups(r.data?.data ?? []);
    } catch {
      showToast("Failed to load cell groups.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  function openAdd() {
    setEditingGroup(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(g: CellGroup) {
    setEditingGroup(g);
    setForm({
      name: g.name,
      leaderName: g.leader_name ?? "",
      meetingDay: g.meeting_day ?? "",
      meetingTime: g.meeting_time ?? "",
      location: g.location ?? "",
      description: g.description ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        leaderName: form.leaderName || null,
        meetingDay: form.meetingDay || null,
        meetingTime: form.meetingTime || null,
        location: form.location || null,
        description: form.description || null,
      };
      if (editingGroup) {
        await api.put(`/church/cell-groups/${editingGroup.id}`, payload);
        showToast("Cell group updated.", "success");
      } else {
        await api.post("/church/cell-groups", payload);
        showToast("Cell group created.", "success");
      }
      setShowModal(false);
      loadGroups();
    } catch {
      showToast("Failed to save cell group.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this cell group?")) return;
    try {
      await api.delete(`/church/cell-groups/${id}`);
      showToast("Cell group deactivated.", "success");
      loadGroups();
    } catch {
      showToast("Failed to deactivate.", "error");
    }
  }

  function f(key: keyof GroupForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users2 className="h-6 w-6 text-primary-600" />
          <h1 className="text-xl font-bold text-secondary-900 dark:text-secondary-50">Cell Groups</h1>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Cell Group
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-secondary-500">
            No cell groups yet. Click "New Cell Group" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.id} className="relative">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-secondary-900 dark:text-secondary-50 text-lg">{g.name}</h3>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => openEdit(g)}
                      className="p-1 hover:text-primary-600 text-secondary-400"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="p-1 hover:text-red-600 text-secondary-400"
                      title="Deactivate"
                    >
                      <Edit2 className="h-4 w-4 opacity-0 pointer-events-none" />
                    </button>
                  </div>
                </div>

                {g.leader_name && (
                  <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Leader: {g.leader_name}
                  </p>
                )}

                <div className="mt-3 space-y-1.5">
                  {(g.meeting_day || g.meeting_time) && (
                    <p className="text-sm text-secondary-600 dark:text-secondary-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {[g.meeting_day, g.meeting_time].filter(Boolean).join(" • ")}
                    </p>
                  )}
                  {g.location && (
                    <p className="text-sm text-secondary-600 dark:text-secondary-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {g.location}
                    </p>
                  )}
                  {g.description && (
                    <p className="text-xs text-secondary-500 mt-2 line-clamp-2">{g.description}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-secondary-100 dark:border-secondary-800 flex items-center gap-1 text-sm font-medium text-primary-600">
                  <Users className="h-4 w-4" />
                  {g.member_count ?? 0} member{g.member_count !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? "Edit Cell Group" : "New Cell Group"}
        className="max-w-lg"
      >
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => f("name", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Leader Name</label>
            <input
              type="text"
              value={form.leaderName}
              onChange={(e) => f("leaderName", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Meeting Day</label>
              <select
                value={form.meetingDay}
                onChange={(e) => f("meetingDay", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
              >
                <option value="">Select day</option>
                {MEETING_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Meeting Time</label>
              <input
                type="time"
                value={form.meetingTime}
                onChange={(e) => f("meetingTime", e.target.value)}
                className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => f("location", e.target.value)}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 dark:text-secondary-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 text-sm px-3 py-2 text-secondary-900 dark:text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingGroup ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default CellGroups;
