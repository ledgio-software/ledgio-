import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Settings, Save, RefreshCw, Image, Palette, FileText } from "lucide-react";

interface SettingsMap {
  church_name?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  report_header?: string;
  report_footer?: string;
  report_show_logo?: string;
  report_show_address?: string;
  report_show_pastor?: string;
  currency_symbol?: string;
  motto?: string;
  website?: string;
  address?: string;
  [key: string]: string | undefined;
}

type TabKey = "branding" | "report" | "general";

export function ChurchSettings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("branding");
  const [changed, setChanged] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/church/settings");
      setSettings(res.data.data ?? {});
      setChanged(new Set());
    } catch {
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
    setChanged(c => new Set([...c, key]));
  }

  async function handleSave() {
    const updates: SettingsMap = {};
    changed.forEach(k => { updates[k] = settings[k] ?? null as unknown as string; });
    if (Object.keys(updates).length === 0) {
      showToast("No changes to save", "info");
      return;
    }
    setSaving(true);
    try {
      await api.put("/church/settings", updates);
      showToast("Settings saved", "success");
      setChanged(new Set());
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full border rounded px-3 py-2 text-sm bg-white dark:bg-secondary-800";
  const lbl = "block text-xs text-muted-foreground mb-1";

  if (loading) return <div className="p-6"><p className="text-sm text-muted-foreground">Loading settings…</p></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Church Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={handleSave} disabled={saving || changed.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? "Saving…" : `Save${changed.size > 0 ? ` (${changed.size})` : ""}`}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "branding" as TabKey, label: "Branding & Identity", icon: Palette },
          { key: "report" as TabKey, label: "Report Settings", icon: FileText },
          { key: "general" as TabKey, label: "General", icon: Settings },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* Branding tab */}
      {activeTab === "branding" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Church Identity</p>
              </div>
              <div>
                <label className={lbl}>Church Name</label>
                <input type="text" value={settings.church_name ?? ""} onChange={e => set("church_name", e.target.value)}
                  className={inp} placeholder="e.g. Grace Community Church" />
              </div>
              <div>
                <label className={lbl}>Motto / Tagline</label>
                <input type="text" value={settings.motto ?? ""} onChange={e => set("motto", e.target.value)}
                  className={inp} placeholder="e.g. Building Faith, Building Lives" />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input type="text" value={settings.website ?? ""} onChange={e => set("website", e.target.value)}
                  className={inp} placeholder="https://www.yourchurch.org" />
              </div>
              <div>
                <label className={lbl}>Address</label>
                <textarea rows={2} value={settings.address ?? ""} onChange={e => set("address", e.target.value)}
                  className={inp} placeholder="Full church address" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Logo & Colors</p>
              </div>
              <div>
                <label className={lbl}>Logo URL</label>
                <input type="text" value={settings.logo_url ?? ""} onChange={e => set("logo_url", e.target.value)}
                  className={inp} placeholder="https://…/logo.png" />
                {settings.logo_url && (
                  <div className="mt-2 flex items-center justify-center h-16 border rounded bg-muted/30">
                    <img src={settings.logo_url} alt="Logo preview" className="max-h-14 max-w-full object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.primary_color ?? "#6366f1"} onChange={e => set("primary_color", e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer" />
                    <input type="text" value={settings.primary_color ?? "#6366f1"} onChange={e => set("primary_color", e.target.value)}
                      className="flex-1 border rounded px-2 py-2 text-xs bg-white dark:bg-secondary-800" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.accent_color ?? "#10b981"} onChange={e => set("accent_color", e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer" />
                    <input type="text" value={settings.accent_color ?? "#10b981"} onChange={e => set("accent_color", e.target.value)}
                      className="flex-1 border rounded px-2 py-2 text-xs bg-white dark:bg-secondary-800" />
                  </div>
                </div>
              </div>
              {/* Color preview */}
              <div className="flex gap-2 mt-2">
                <div className="h-6 flex-1 rounded" style={{ background: settings.primary_color ?? "#6366f1" }} />
                <div className="h-6 flex-1 rounded" style={{ background: settings.accent_color ?? "#10b981" }} />
              </div>
              <p className="text-xs text-muted-foreground">Colors are applied to reports and printouts.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report settings tab */}
      {activeTab === "report" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Report Header & Footer</p>
              </div>
              <div>
                <label className={lbl}>Report Header Text</label>
                <textarea rows={3} value={settings.report_header ?? ""} onChange={e => set("report_header", e.target.value)}
                  className={inp} placeholder="e.g. Grace Community Church&#10;123 Faith Street, Accra&#10;Tel: 0244 123 456" />
                <p className="text-xs text-muted-foreground mt-1">Appears at the top of all printed reports.</p>
              </div>
              <div>
                <label className={lbl}>Report Footer Text</label>
                <textarea rows={3} value={settings.report_footer ?? ""} onChange={e => set("report_footer", e.target.value)}
                  className={inp} placeholder="e.g. Confidential — For church use only" />
                <p className="text-xs text-muted-foreground mt-1">Appears at the bottom of all printed reports.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="font-semibold text-sm mb-2">Report Display Options</p>
              {[
                { key: "report_show_logo", label: "Show logo on reports" },
                { key: "report_show_address", label: "Show church address on reports" },
                { key: "report_show_pastor", label: "Show pastor name on reports" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input type="checkbox" id={key}
                    checked={(settings[key] ?? "true") !== "false"}
                    onChange={e => set(key, e.target.checked ? "true" : "false")}
                    className="rounded" />
                  <label htmlFor={key} className="text-sm">{label}</label>
                </div>
              ))}

              <div className="pt-2">
                <label className={lbl}>Currency Symbol</label>
                <input type="text" value={settings.currency_symbol ?? "GHS"} onChange={e => set("currency_symbol", e.target.value)}
                  className={`${inp} w-32`} placeholder="GHS" />
                <p className="text-xs text-muted-foreground mt-1">Used on report financial summaries.</p>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="md:col-span-2">
            <CardContent className="p-5">
              <p className="font-semibold text-sm mb-3">Report Preview</p>
              <div className="border rounded p-4 bg-white dark:bg-gray-900 text-sm space-y-2">
                <div className="flex items-center gap-3 border-b pb-3">
                  {settings.logo_url && (settings.report_show_logo ?? "true") !== "false" && (
                    <img src={settings.logo_url} alt="" className="h-10 max-w-24 object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div>
                    <p className="font-bold" style={{ color: settings.primary_color ?? "#6366f1" }}>
                      {settings.church_name ?? "Your Church Name"}
                    </p>
                    {settings.report_header && (
                      <p className="text-xs text-muted-foreground whitespace-pre-line">{settings.report_header}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground italic">[Report content appears here]</p>
                {settings.report_footer && (
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground text-center whitespace-pre-line">{settings.report_footer}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* General tab */}
      {activeTab === "general" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="font-semibold text-sm mb-2">General Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Default Currency</label>
                <select value={settings.currency_symbol ?? "GHS"} onChange={e => set("currency_symbol", e.target.value)}
                  className={inp}>
                  {["GHS", "USD", "EUR", "GBP", "NGN", "KES", "ZAR", "UGX", "TZS", "RWF"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Church Name</label>
                <input type="text" value={settings.church_name ?? ""} onChange={e => set("church_name", e.target.value)}
                  className={inp} placeholder="Your church name" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">More settings will appear here as the system grows.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
