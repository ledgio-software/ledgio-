import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Radio,
  Activity,
  Database,
  History,
  Send,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Loader2,
  ArrowLeft,
  Server,
  Smartphone,
  Mail,
  Users,
  Building2,
  Plug,
  MessageSquare,
  BarChart2,
  Globe,
  Monitor,
  RefreshCw,
  Clock,
  Zap,
  XCircle,
  AlertTriangle,
  UserX,
  UserCheck,
  ChevronDown,
  ChevronRight,
  HandCoins,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

const EMPTY_AUDIT_FILTERS = {
  action: "",
  entity: "",
  entityId: "",
  userEmail: "",
  ipAddress: "",
  tenantId: "",
  dateFrom: "",
  dateTo: "",
};

export function AdminCoreEngine() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Master Lock State
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Hub Tab
  const [activeTab, setActiveTab] = useState<"broadcast" | "health" | "performance" | "jobs" | "integrations" | "schemas" | "audit" | "onboard" | "feedback" | "analytics" | "errors" | "safety" | "referral">("broadcast");

  // Platform-wide Feedback state
  const [feedbackItems, setFeedbackItems] = useState<{
    id: string;
    tenantId: string;
    userId: string;
    userName: string;
    userRole: string;
    category: string;
    message: string;
    status: string;
    createdAt: string;
    tenant: { name: string; slug: string } | null;
  }[] | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("");
  const [feedbackTenantFilter, setFeedbackTenantFilter] = useState("");
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  // Referral Partners state
  const [referralPartners, setReferralPartners] = useState<{
    id: string;
    name: string;
    code: string;
    commissionRate: number;
    contacts: string | null;
    isActive: boolean;
    tenantCount: number;
    totalMrr: number;
    commissionDue: number;
  }[] | null>(null);
  const [referralStats, setReferralStats] = useState<{
    totalPartners: number;
    activePartners: number;
    totalTenants: number;
    totalMrr: number;
    totalCommissionDue: number;
  } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [showNewPartnerForm, setShowNewPartnerForm] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerCode, setNewPartnerCode] = useState("");
  const [newPartnerRate, setNewPartnerRate] = useState("");
  const [newPartnerContacts, setNewPartnerContacts] = useState("");
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  const [togglingPartnerId, setTogglingPartnerId] = useState<string | null>(null);

  // Google Analytics State
  const [analyticsData, setAnalyticsData] = useState<{
    configured: boolean;
    dateRange: string;
    totalUsers: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
    topPages: { page: string; views: number }[];
    topCountries: { country: string; users: number }[];
    topDevices: { device: string; sessions: number }[];
    activeUsers: number;
  } | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(28);

  const fetchMetrics = useCallback(() => {
    setIsLoadingMetrics(true);
    setMetricsError(null);
    const headers = { 'x-admin-passcode': passcode };
    return Promise.all([
      api.get("/admin/metrics", { headers }),
      api.get("/admin/error-logs/grouped", { headers }),
    ])
      .then(([metricsRes, errRes]) => {
        setMetricsData(metricsRes.data.data);
        setErrorGroups(errRes.data.data?.groups ?? []);
      })
      .catch(() => setMetricsError("Failed to load performance metrics."))
      .finally(() => setIsLoadingMetrics(false));
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "performance") return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  const fetchJobs = useCallback(() => {
    setIsLoadingJobs(true);
    setJobsError(null);
    return api
      .get("/admin/jobs", { headers: { 'x-admin-passcode': passcode } })
      .then((res) => setJobsData(res.data.data.jobs))
      .catch(() => setJobsError("Failed to load cron jobs."))
      .finally(() => setIsLoadingJobs(false));
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "jobs") return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  const handleTriggerJob = async (jobName: string) => {
    setTriggeringJob(jobName);
    try {
      await api.post(`/admin/jobs/${encodeURIComponent(jobName)}/trigger`, {}, { headers: { 'x-admin-passcode': passcode } });
      showToast(`Job "${jobName}" triggered successfully.`, "success");
      setTimeout(fetchJobs, 1500);
    } catch (err: any) {
      showToast(err.response?.data?.error || `Failed to trigger "${jobName}".`, "error");
    } finally {
      setTriggeringJob(null);
    }
  };

  const fetchErrors = useCallback(() => {
    setIsLoadingErrors(true);
    setErrorsError(null);
    return Promise.all([
      api.get("/admin/error-logs", { headers: { 'x-admin-passcode': passcode } }),
      api.get("/admin/error-logs/grouped", { headers: { 'x-admin-passcode': passcode } }),
    ])
      .then(([indRes, grpRes]) => {
        setErrorsData(indRes.data.data.errors);
        setErrorsGrouped(grpRes.data.data.groups);
      })
      .catch(() => setErrorsError("Failed to load error logs."))
      .finally(() => setIsLoadingErrors(false));
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "errors") return;
    fetchErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);


  const handleClearErrors = async () => {
    setIsClearingErrors(true);
    try {
      await api.delete("/admin/error-logs", { headers: { 'x-admin-passcode': passcode } });
      setErrorsData([]);
      showToast("Error log cleared.", "success");
    } catch {
      showToast("Failed to clear error log.", "error");
    } finally {
      setIsClearingErrors(false);
    }
  };

  const loadTenantUsers = async (tenantId: string) => {
    if (tenantUsers[tenantId]) return;
    setLoadingTenantUsers(tenantId);
    try {
      const res = await api.get("/admin/users/search", { params: { tenantId }, headers: { 'x-admin-passcode': passcode } });
      setTenantUsers((prev) => ({ ...prev, [tenantId]: res.data.data.users }));
    } catch {
      showToast("Failed to load tenant users.", "error");
    } finally {
      setLoadingTenantUsers(null);
    }
  };

  const handleToggleUserActive = async (userId: string, tenantId: string, activate: boolean) => {
    setTogglingUserId(userId);
    try {
      await api.patch(`/admin/users/${userId}/${activate ? "activate" : "deactivate"}`, {}, { headers: { 'x-admin-passcode': passcode } });
      showToast(`User ${activate ? "activated" : "deactivated"}.`, "success");
      setTenantUsers((prev) => ({
        ...prev,
        [tenantId]: prev[tenantId]?.map((u) => u.id === userId ? { ...u, isActive: activate } : u) ?? [],
      }));
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to update user status.", "error");
    } finally {
      setTogglingUserId(null);
    }
  };

  const fetchAnalytics = useCallback((days: number = analyticsDays) => {
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);
    return api
      .get("/admin/analytics", { params: { days }, headers: { 'x-admin-passcode': passcode } })
      .then((res) => setAnalyticsData(res.data.data))
      .catch(() => setAnalyticsError("Failed to load analytics data."))
      .finally(() => setIsLoadingAnalytics(false));
  }, [passcode, analyticsDays]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "analytics") return;
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab, analyticsDays]);

  // Engine Diagnostics State
  const [healthData, setHealthData] = useState<{
    status: string;
    database: string;
    redis: string;
    uptime: number;
    timestamp: string;
    integrations?: { email: string; sms: string };
  } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Performance metrics state
  const [metricsData, setMetricsData] = useState<{
    requests: number;
    errors: number;
    errorRate: number;
    avgLatencyMs: number;
    memory: { heapUsedMb: number; rssMb: number };
    uptime: number;
    nodeVersion: string;
    buckets: { ts: number; requests: number; errors: number; avgMs: number }[];
    statusDist?: { ok: number; redirect: number; clientErr: number; serverErr: number };
    topRoutesByTraffic?: { route: string; requests: number; errors: number; errorRate: number; avgMs: number }[];
    topRoutesByErrors?: { route: string; requests: number; errors: number; errorRate: number; avgMs: number }[];
  } | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [errorGroups, setErrorGroups] = useState<{
    key: string; status: number; method: string; error: string;
    source?: string; fn?: string; count: number; firstSeen: string; lastSeen: string;
    sample?: { path: string; [key: string]: unknown };
  }[]>([]);

  // Cron jobs state
  const [jobsData, setJobsData] = useState<{
    name: string;
    schedule: string;
    description?: string;
    lastRun?: { startedAt: string; finishedAt: string; success: boolean; errorMsg?: string; durationMs: number };
  }[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  // Error log state
  const [errorsData, setErrorsData] = useState<{
    id: string; ts: string; method: string; path: string; status: number; error: string;
    stack?: string; source?: string; fn?: string; tenantId?: string; userId?: string;
    ip?: string; userAgent?: string; bodyKeys?: string[]; count: number; lastSeen: string;
  }[] | null>(null);
  const [errorsGrouped, setErrorsGrouped] = useState<{
    key: string; status: number; method: string; error: string; source?: string; fn?: string;
    count: number; firstSeen: string; lastSeen: string;
    sample: { id: string; ts: string; method: string; path: string; status: number; error: string; stack?: string; source?: string; fn?: string; tenantId?: string; userId?: string; ip?: string; userAgent?: string; bodyKeys?: string[]; count: number; lastSeen: string };
  }[] | null>(null);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [isClearingErrors, setIsClearingErrors] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [errorsView, setErrorsView] = useState<'individual' | 'grouped'>('individual');
  const [errorsFilter, setErrorsFilter] = useState('');
  const [errorsAutoRefresh, setErrorsAutoRefresh] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<{
    id: string; ts: string; method: string; path: string; status: number; error: string;
    stack?: string; source?: string; fn?: string; tenantId?: string; userId?: string;
    ip?: string; userAgent?: string; bodyKeys?: string[]; count: number; lastSeen: string;
  } | null>(null);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "errors" || !errorsAutoRefresh) return;
    const id = setInterval(() => { fetchErrors(); }, 30_000);
    return () => clearInterval(id);
  }, [isUnlocked, activeTab, errorsAutoRefresh, fetchErrors]);

  // Expanded tenant user rows in schemas tab
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<Record<string, { id: string; name: string; email: string; role: string; isActive: boolean }[]>>({});
  const [loadingTenantUsers, setLoadingTenantUsers] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Tenant Schemas & Tiers state
  const [tenants, setTenants] = useState<
    { id: string; name: string; slug: string; schema: string; tier: number; createdAt: string; subscriptionStatus?: string; trialEndsAt?: string; subscriptionPaidUntil?: string; userCount?: number }[] | null
  >(null);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  // No self-serve billing yet - a tenant's plan tier is set here by a
  // platform admin. Draft value per row so the dropdown doesn't jump back
  // to the saved tier while a change is pending.
  const [tierDrafts, setTierDrafts] = useState<Record<string, number>>({});
  const [savingTierId, setSavingTierId] = useState<string | null>(null);

  // Tenant deletion state — requires typing the slug to confirm, to prevent
  // accidental deletion of a live business's entire dataset.
  const [deletingTenant, setDeletingTenant] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);

  // Platform-wide Audit Logs state
  const [auditLogs, setAuditLogs] = useState<
    {
      id: string;
      action: string;
      entity: string;
      entityId: string | null;
      userEmail: string | null;
      userId: string | null;
      details: string | null;
      changes: Record<string, { from: unknown; to: unknown }> | null;
      createdAt: string;
      tenant: { name: string; slug: string } | null;
    }[] | null
  >(null);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [isExportingAuditLogs, setIsExportingAuditLogs] = useState(false);

  // Audit log filters - draft (what's being typed) vs. applied (what was
  // last submitted), so typing doesn't refetch on every keystroke.
  const [draftAuditFilters, setDraftAuditFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [appliedAuditFilters, setAppliedAuditFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [auditActionOptions, setAuditActionOptions] = useState<string[]>([]);
  const [auditEntityOptions, setAuditEntityOptions] = useState<string[]>([]);

  // Broadcast Form State
  const [subject, setSubject] = useState("System Maintenance & Upgrade Notice");
  const [message, setMessage] = useState(
    "Ledgio ERP will undergo a scheduled system upgrade on Sunday at 2:00 AM UTC. Expect approximately 15 minutes of downtime. Thank you for your patience!"
  );
  const [channel, setChannel] = useState<"EMAIL" | "SMS" | "BOTH">("BOTH");
  const [targetTier, setTargetTier] = useState<string>("ALL");
  const [isSending, setIsSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  // Onboard Contracted Client state
  const [onboardCompanyName, setOnboardCompanyName] = useState("");
  const [onboardSlug, setOnboardSlug] = useState("");
  const [onboardAdminName, setOnboardAdminName] = useState("");
  const [onboardAdminEmail, setOnboardAdminEmail] = useState("");
  const [onboardAdminPhone, setOnboardAdminPhone] = useState("");
  const [onboardAdminPassword, setOnboardAdminPassword] = useState("");
  const [onboardBaseCurrency, setOnboardBaseCurrency] = useState("GHS");
  const [onboardOrgType, setOnboardOrgType] = useState("BUSINESS");
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardResult, setOnboardResult] = useState<{ tenant: { name: string; slug: string }; admin: { email: string } } | null>(null);

  // Auto-check if already unlocked in session
  useEffect(() => {
    const savedToken = sessionStorage.getItem("accountgo_admin_engine_passcode");
    if (savedToken) {
      setPasscode(savedToken);
      setIsUnlocked(true);
    }
  }, []);

  // Fetch real infrastructure health once unlocked (the top status card and the
  // Engine Diagnostics tab both read from this, so it isn't gated to one tab).
  useEffect(() => {
    if (!isUnlocked) return;

    let cancelled = false;
    setIsLoadingHealth(true);
    setHealthError(null);

    api
      .get("/health")
      .then((res) => {
        if (!cancelled) setHealthData(res.data);
      })
      .catch((err) => {
        // A degraded backend responds 503 with the same health payload shape,
        // so still show it if present rather than treating it as a fetch failure.
        if (!cancelled) {
          if (err.response?.data?.status) {
            setHealthData(err.response.data);
          } else {
            setHealthError("Failed to reach the backend health endpoint.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHealth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isUnlocked]);

  // Fetch the real platform-wide integrations status for the "Integrations"
  // tab once unlocked - every third-party integration this codebase has,
  // sourced live from each service's own isXConfigured() check plus real
  // per-tenant adoption counts for GRA E-VAT / Mono bank feeds (the two
  // integrations configured per-tenant rather than platform-wide).
  const [integrationsData, setIntegrationsData] = useState<{
    platformWide: { key: string; name: string; purpose: string; configured: boolean }[];
    perTenant: { key: string; name: string; purpose: string; tenantsConfigured: number; totalTenants: number }[];
  } | null>(null);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(() => {
    setIsLoadingIntegrations(true);
    setIntegrationsError(null);
    return api
      .get("/admin/integrations", { headers: { 'x-admin-passcode': passcode } })
      .then((res) => setIntegrationsData(res.data.data))
      .catch(() => setIntegrationsError("Failed to load integrations status."))
      .finally(() => setIsLoadingIntegrations(false));
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, passcode]);

  // Fetch the real platform-wide tenant roster for the "Tenant Schemas & Tiers"
  // tab once unlocked, using the same master passcode already used to unlock
  // this console (GET /api/v1/tenants is passcode-gated, not tenant-JWT-scoped).
  const fetchTenants = useCallback(() => {
    setIsLoadingTenants(true);
    setTenantsError(null);
    return api
      .get("/tenants", { headers: { 'x-admin-passcode': passcode } })
      .then((res) => {
        setTenants(res.data.data.tenants);
        setTierDrafts(Object.fromEntries(res.data.data.tenants.map((t: any) => [t.id, t.tier])));
      })
      .catch(() => {
        setTenantsError("Failed to load the tenant roster.");
      })
      .finally(() => {
        setIsLoadingTenants(false);
      });
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchTenants();
    // fetchTenants intentionally omitted - it's recreated per passcode change,
    // which already re-runs this effect via the passcode dependency below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, passcode]);

  const handleSaveTier = async (tenantId: string) => {
    const tier = tierDrafts[tenantId];
    setSavingTierId(tenantId);
    try {
      const res = await api.put(`/tenants/${tenantId}/tier`, { tier }, { headers: { 'x-admin-passcode': passcode } });
      if (res.data.success) {
        showToast(`Plan updated to ${res.data.data.tenant.tier === 1 ? "Shop" : res.data.data.tenant.tier === 2 ? "Business" : "Enterprise"}.`, "success");
        fetchTenants();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to update tenant plan.", "error");
    } finally {
      setSavingTierId(null);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant || deleteConfirmSlug !== deletingTenant.slug) return;
    setIsDeletingTenant(true);
    try {
      await api.delete(`/tenants/${deletingTenant.id}`, { headers: { 'x-admin-passcode': passcode } });
      showToast(`Tenant "${deletingTenant.name}" permanently deleted.`, "success");
      setDeletingTenant(null);
      setDeleteConfirmSlug("");
      fetchTenants();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to delete tenant.", "error");
    } finally {
      setIsDeletingTenant(false);
    }
  };

  const buildAuditLogParams = (filters: typeof EMPTY_AUDIT_FILTERS) => {
    const params: Record<string, string | number> = { limit: 50 };
    if (filters.action.trim()) params.action = filters.action.trim();
    if (filters.entity.trim()) params.entity = filters.entity.trim();
    if (filters.entityId.trim()) params.entityId = filters.entityId.trim();
    if (filters.userEmail.trim()) params.userEmail = filters.userEmail.trim();
    if (filters.ipAddress.trim()) params.ipAddress = filters.ipAddress.trim();
    if (filters.tenantId) params.tenantId = filters.tenantId;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    return params;
  };

  // Fetch the real platform-wide audit log for the "System Audit Logs" tab
  // once unlocked - same passcode-gated pattern as the tenant roster above.
  useEffect(() => {
    if (!isUnlocked) return;

    let cancelled = false;
    setIsLoadingAuditLogs(true);
    setAuditLogsError(null);

    api
      .get("/admin/audit-logs", { params: buildAuditLogParams(appliedAuditFilters), headers: { 'x-admin-passcode': passcode } })
      .then((res) => {
        if (!cancelled) setAuditLogs(res.data.data.logs);
      })
      .catch(() => {
        if (!cancelled) setAuditLogsError("Failed to load the platform-wide audit log.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAuditLogs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isUnlocked, passcode, appliedAuditFilters]);

  // Distinct action/entity values platform-wide, feeding the filter inputs'
  // autocomplete - same purpose as the tenant-facing Audit Trail page's.
  useEffect(() => {
    if (!isUnlocked) return;
    api
      .get("/admin/audit-logs/meta/values", { headers: { 'x-admin-passcode': passcode } })
      .then((res) => {
        if (res.data.success) {
          setAuditActionOptions(res.data.data.actions || []);
          setAuditEntityOptions(res.data.data.entities || []);
        }
      })
      .catch(() => { /* autocomplete is a nice-to-have, fail silently */ });
  }, [isUnlocked, passcode]);

  const applyAuditFilters = () => setAppliedAuditFilters(draftAuditFilters);

  const clearAuditFilters = () => {
    setDraftAuditFilters(EMPTY_AUDIT_FILTERS);
    setAppliedAuditFilters(EMPTY_AUDIT_FILTERS);
  };

  const hasActiveAuditFilters = Object.values(appliedAuditFilters).some((v) => v.trim() !== "");

  const handleExportAuditLogs = async () => {
    setIsExportingAuditLogs(true);
    try {
      const res = await api.get("/admin/audit-logs/export", {
        params: buildAuditLogParams(appliedAuditFilters),
        responseType: "blob",
        headers: { 'x-admin-passcode': passcode },
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `platform-audit-log-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export platform audit log:", err);
      showToast("Failed to export the audit log.", "error");
    } finally {
      setIsExportingAuditLogs(false);
    }
  };

  const fetchFeedback = useCallback(() => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    const params: Record<string, string> = {};
    if (feedbackCategoryFilter) params.category = feedbackCategoryFilter;
    if (feedbackStatusFilter) params.status = feedbackStatusFilter;
    if (feedbackTenantFilter.trim()) params.tenantId = feedbackTenantFilter.trim();
    return api
      .get("/admin/feedback", { params, headers: { 'x-admin-passcode': passcode } })
      .then((res) => setFeedbackItems(res.data.data.items))
      .catch(() => setFeedbackError("Failed to load platform-wide feedback."))
      .finally(() => setIsLoadingFeedback(false));
  }, [passcode, feedbackCategoryFilter, feedbackStatusFilter, feedbackTenantFilter]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "feedback") return;
    fetchFeedback();
  }, [isUnlocked, activeTab, feedbackCategoryFilter, feedbackStatusFilter, feedbackTenantFilter]);

  const fetchReferralData = useCallback(() => {
    setIsLoadingReferral(true);
    setReferralError(null);
    const headers = { 'x-admin-passcode': passcode };
    return Promise.all([
      api.get("/admin/referrals/partners", { headers }),
      api.get("/admin/referrals/stats", { headers }),
    ])
      .then(([partnersRes, statsRes]) => {
        setReferralPartners(partnersRes.data.data.partners ?? partnersRes.data.data);
        setReferralStats(statsRes.data.data);
      })
      .catch(() => setReferralError("Failed to load referral data."))
      .finally(() => setIsLoadingReferral(false));
  }, [passcode]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "referral") return;
    fetchReferralData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  const handleCreatePartner = async () => {
    if (!newPartnerName.trim() || !newPartnerCode.trim() || !newPartnerRate) return;
    setIsSavingPartner(true);
    try {
      await api.post("/admin/referrals/partners", {
        name: newPartnerName.trim(),
        code: newPartnerCode.trim().toUpperCase(),
        commissionRate: parseFloat(newPartnerRate),
        contacts: newPartnerContacts.trim() || undefined,
      }, { headers: { 'x-admin-passcode': passcode } });
      setShowNewPartnerForm(false);
      setNewPartnerName("");
      setNewPartnerCode("");
      setNewPartnerRate("");
      setNewPartnerContacts("");
      fetchReferralData();
    } catch (err: any) {
      setReferralError(err.response?.data?.error || "Failed to create partner.");
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleTogglePartner = async (id: string, isActive: boolean) => {
    setTogglingPartnerId(id);
    try {
      await api.patch(`/admin/referrals/partners/${id}`, { isActive: !isActive }, { headers: { 'x-admin-passcode': passcode } });
      setReferralPartners((prev) => prev?.map((p) => p.id === id ? { ...p, isActive: !isActive } : p) ?? null);
    } catch {
      setReferralError("Failed to update partner.");
    } finally {
      setTogglingPartnerId(null);
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await api.post("/admin/broadcast/verify-passcode", {}, { headers: { 'x-admin-passcode': passcode } });
      if (res.data.success) {
        setIsUnlocked(true);
        sessionStorage.setItem("accountgo_admin_engine_passcode", passcode);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Invalid master passcode. Access denied.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Deliberately plain, low-hype subject/message copy - emoji and
  // exclamation-heavy "announcement" language reads as promotional/spam to
  // Gmail's filters (confirmed live via a real broadcast landing in spam -
  // see broadcastService.ts's header comment and STATUS.md).
  const applyTemplate = (type: "UPGRADE" | "MAINTENANCE" | "NEWS") => {
    if (type === "UPGRADE") {
      setSubject("System upgrade deployed (v2.5)");
      setMessage(
        "We've deployed performance upgrades to Ledgio. This includes faster POS till closeouts, real-time inventory re-allocation, and quicker SMS alerts."
      );
    } else if (type === "MAINTENANCE") {
      setSubject("Scheduled maintenance this Sunday");
      setMessage(
        "Ledgio will undergo routine server maintenance this Sunday between 02:00 AM and 02:15 AM UTC. Database connections will be briefly paused during this window."
      );
    } else if (type === "NEWS") {
      setSubject("New feature: automated weekly email reports");
      setMessage(
        "You can now configure automated Monday 8:00 AM Profit & Loss PDF reports sent to your email. Configure this in Settings."
      );
    }
  };

  const handleExecuteBroadcast = async () => {
    setIsSending(true);
    setBroadcastResult(null);
    try {
      const res = await api.post("/admin/broadcast/send", {
        subject,
        message,
        channel,
        targetTier: targetTier === "ALL" ? undefined : Number(targetTier),
      }, { headers: { 'x-admin-passcode': passcode } });

      if (res.data.success) {
        setBroadcastResult(res.data.data);
        setConfirmStep(false);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Broadcast execution failed.");
    } finally {
      setIsSending(false);
    }
  };

  const handleOnboardClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardResult(null);
    setIsOnboarding(true);
    try {
      const res = await api.post("/tenants/admin-onboard", {
        companyName: onboardCompanyName,
        slug: onboardSlug,
        adminName: onboardAdminName,
        adminEmail: onboardAdminEmail,
        adminPassword: onboardAdminPassword,
        phone: onboardAdminPhone || undefined,
        baseCurrency: onboardBaseCurrency,
        orgType: onboardOrgType,
      }, { headers: { 'x-admin-passcode': passcode } });
      if (res.data.success) {
        setOnboardResult(res.data.data);
        setOnboardCompanyName("");
        setOnboardSlug("");
        setOnboardAdminName("");
        setOnboardAdminEmail("");
        setOnboardAdminPhone("");
        setOnboardAdminPassword("");
        setOnboardOrgType("BUSINESS");
        showToast(`${res.data.data.tenant.name} onboarded and pre-verified.`, "success");
      }
    } catch (err: any) {
      setOnboardError(err.response?.data?.error || "Failed to onboard contracted client.");
    } finally {
      setIsOnboarding(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-950 text-white font-sans selection:bg-amber-500 selection:text-secondary-950">
      {/* Tenant Deletion Confirmation Modal */}
      {deletingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-secondary-900 border border-rose-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanently Delete Tenant</h3>
                <p className="text-xs text-secondary-400 mt-1">
                  This will drop the PostgreSQL schema <span className="font-jetbrains text-rose-300">{deletingTenant.slug}</span>, delete all its users, and remove it from the platform roster. <strong className="text-white">This cannot be undone.</strong>
                </p>
              </div>
            </div>
            <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300 space-y-1">
              <div><span className="text-secondary-400">Tenant:</span> <span className="font-semibold text-white">{deletingTenant.name}</span></div>
              <div><span className="text-secondary-400">Slug:</span> <span className="font-jetbrains">{deletingTenant.slug}</span></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary-300">
                Type the slug <span className="font-jetbrains text-rose-300">{deletingTenant.slug}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmSlug}
                onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                placeholder={deletingTenant.slug}
                className="w-full h-9 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs font-jetbrains focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-secondary-700 text-secondary-300 hover:bg-secondary-800 text-xs"
                onClick={() => { setDeletingTenant(null); setDeleteConfirmSlug(""); }}
                disabled={isDeletingTenant}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-rose-700 hover:bg-rose-600 text-white text-xs disabled:opacity-40"
                onClick={handleDeleteTenant}
                disabled={deleteConfirmSlug !== deletingTenant.slug || isDeletingTenant}
              >
                {isDeletingTenant ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Engine Navigation Header */}
      <header className="border-b border-secondary-800 bg-secondary-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg bg-secondary-800 hover:bg-secondary-700 text-secondary-300 hover:text-white transition-colors"
              title="Return to Public Landing Page"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-2.5">
              {/* Hexagonal AGOD brand mark */}
              <div
                className="flex items-center justify-center w-9 h-9 bg-amber-500 text-secondary-950 font-extrabold text-base shrink-0"
                style={{ clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', fontFamily: "'Syne', sans-serif" }}
              >
                A
              </div>
              <div className="flex flex-col leading-none gap-0.5">
                <h1 className="text-base font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                  AGOD <span className="text-amber-400">Control Engine</span>
                </h1>
                <span className="text-[10px] text-secondary-500 tracking-widest uppercase" style={{ fontFamily: "'DM Sans', sans-serif" }}>Software Solution · Admin</span>
              </div>
            </div>
          </div>

          {isUnlocked && (
            <div className="flex items-center space-x-3 text-xs">
              <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-bold flex items-center">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                Master Admin Authenticated
              </span>
              <button
                onClick={() => {
                  sessionStorage.removeItem("accountgo_admin_engine_passcode");
                  setIsUnlocked(false);
                }}
                className="text-secondary-400 hover:text-rose-400 transition-colors"
              >
                Lock Session
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Hub Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!isUnlocked ? (
          /* Password-Encrypted Security Lock Gate */
          <div className="max-w-md mx-auto py-16">
            <Card className="bg-secondary-900 border-secondary-800 text-white shadow-2xl text-center">
              <CardHeader>
                <div
                  className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 text-secondary-950 font-extrabold text-2xl mb-4 mx-auto"
                  style={{ clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', fontFamily: "'Syne', sans-serif" }}
                >
                  A
                </div>
                <CardTitle className="text-2xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>AGOD Control Engine</CardTitle>
                <p className="text-secondary-500 text-[10px] tracking-widest uppercase mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>Software Solution · Admin Gate</p>
                <CardDescription className="text-secondary-400 text-xs mt-2">
                  Enter your master passcode to access platform-wide system upgrade broadcasts, tenant schema inspectors, and engine health controls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyPasscode} className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-semibold text-secondary-300">Master Security Passcode</label>
                    <Input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter Master Security Passcode"
                      required
                      className="bg-secondary-950 border-secondary-700 text-white text-center tracking-widest font-jetbrains text-base"
                    />
                  </div>

                  {authError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                      {authError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 font-bold"
                    disabled={isVerifying}
                  >
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Authenticate Core Engine
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Unlocked Admin Core Engine Command Center */
          <div className="space-y-8">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardContent className="p-4 flex items-center space-x-4">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Server className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-secondary-400">Core System Status</div>
                    <div className={`text-lg font-extrabold ${healthData?.status === "healthy" ? "text-emerald-400" : healthData ? "text-red-400" : "text-secondary-500"}`}>
                      {healthData ? (healthData.status === "healthy" ? "Operational" : "Degraded") : "Checking..."}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardContent className="p-4 flex items-center space-x-4">
                  <div className="p-3 bg-secondary-500/10 text-secondary-400 rounded-xl">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-secondary-400">Android SMS Gateway</div>
                    <div
                      className={`text-lg font-extrabold ${
                        !healthData ? "text-secondary-500" : healthData.integrations?.sms === "configured" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {!healthData ? "Checking..." : healthData.integrations?.sms === "configured" ? "Configured" : "Not Configured"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardContent className="p-4 flex items-center space-x-4">
                  <div className="p-3 bg-secondary-500/10 text-secondary-400 rounded-xl">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-secondary-400">Email Service (Gmail SMTP)</div>
                    <div
                      className={`text-lg font-extrabold ${
                        !healthData ? "text-secondary-500" : healthData.integrations?.email === "configured" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {!healthData ? "Checking..." : healthData.integrations?.email === "configured" ? "Configured" : "Not Configured"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardContent className="p-4 flex items-center space-x-4">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-secondary-400">Active Business Schemas</div>
                    <div className="text-lg font-extrabold text-white">PostgreSQL Multi-Tenant</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-secondary-800 space-x-6 text-sm font-semibold">
              <button
                onClick={() => setActiveTab("broadcast")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "broadcast" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Radio className="h-4 w-4" />
                <span>System Broadcast Engine</span>
              </button>
              <button
                onClick={() => setActiveTab("health")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "health" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Engine Diagnostics</span>
              </button>
              <button
                onClick={() => setActiveTab("integrations")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "integrations" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Plug className="h-4 w-4" />
                <span>Integrations</span>
              </button>
              <button
                onClick={() => setActiveTab("schemas")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "schemas" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Tenant Schemas & Tiers</span>
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "audit" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <History className="h-4 w-4" />
                <span>System Audit Logs</span>
              </button>
              <button
                onClick={() => setActiveTab("onboard")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "onboard" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Onboard Client</span>
              </button>
              <button
                onClick={() => setActiveTab("feedback")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "feedback" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Feedback</span>
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "analytics" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => setActiveTab("performance")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "performance" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Performance</span>
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "jobs" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Cron Jobs</span>
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "errors" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Error Log
                  {errorsData && errorsData.length > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                      {errorsData.length}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("safety")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "safety" ? "border-red-500 text-red-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Safety</span>
              </button>
              <button
                onClick={() => setActiveTab("referral")}
                className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === "referral" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <HandCoins className="h-4 w-4" />
                <span>Referrals</span>
              </button>
            </div>

            {/* Tab 1: System Broadcast Engine */}
            {activeTab === "broadcast" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold flex items-center" style={{ fontFamily: "'Syne', sans-serif" }}>
                    <Radio className="h-5 w-5 mr-2 text-amber-400" />
                    System-Wide Email & SMS Upgrade Broadcast Console
                  </CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    Dispatch batch upgrade notices, maintenance alerts, or feature releases to all registered business owners across SMS (Android Gateway) and Email (Gmail SMTP).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Template Switchers */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-secondary-300 flex items-center">
                      <Sparkles className="h-4 w-4 mr-1 text-amber-400" />
                      Quick Load Announcement Templates
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyTemplate("UPGRADE")}
                        className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors"
                      >
                        🚀 System Upgrade Announcement
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTemplate("MAINTENANCE")}
                        className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors"
                      >
                        🛠 Scheduled Maintenance Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTemplate("NEWS")}
                        className="px-3.5 py-2 bg-secondary-800 hover:bg-secondary-700 rounded-lg text-xs font-medium border border-secondary-700 transition-colors"
                      >
                        🎁 Feature Release Announcement
                      </button>
                    </div>
                  </div>

                  {/* Controls Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-secondary-300">Target Audience</label>
                      <select
                        value={targetTier}
                        onChange={(e: any) => setTargetTier(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                      >
                        <option value="ALL">All Business Owners (All Tenants)</option>
                        <option value="1">Tier 1 Starter Tenants</option>
                        <option value="2">Tier 2 Professional Tenants</option>
                        <option value="3">Tier 3 Enterprise Tenants</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-secondary-300">Announcement Subject</label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="bg-secondary-950 border-secondary-700 text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-secondary-300">Dispatch Channels</label>
                      <select
                        value={channel}
                        onChange={(e: any) => setChannel(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                      >
                        <option value="BOTH">Email (Gmail SMTP) & SMS (Android Gateway)</option>
                        <option value="EMAIL">Email Only (Gmail SMTP)</option>
                        <option value="SMS">SMS Only (Android Gateway)</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-secondary-300">Broadcast Message Body</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs focus:ring-2 focus:ring-amber-500 font-sans"
                    />
                  </div>

                  {/* Broadcast Execution Results */}
                  {broadcastResult && (
                    <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-lg text-xs space-y-2">
                      <div className="flex items-center font-bold text-emerald-400 text-sm">
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        System Broadcast Dispatched Successfully!
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center font-jetbrains">
                        <div className="p-2 bg-emerald-900/40 rounded">Total Targeted: <strong>{broadcastResult.totalTargeted}</strong></div>
                        <div className="p-2 bg-emerald-900/40 rounded">Emails Sent: <strong>{broadcastResult.emailSentCount}</strong></div>
                        <div className="p-2 bg-emerald-900/40 rounded">SMS Sent: <strong>{broadcastResult.smsSentCount}</strong></div>
                        <div className="p-2 bg-emerald-900/40 rounded">Failures: <strong>{broadcastResult.failedCount}</strong></div>
                      </div>
                    </div>
                  )}

                  {/* Execution Actions */}
                  {confirmStep ? (
                    <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-lg space-y-3">
                      <div className="flex items-center text-amber-300 font-bold text-xs">
                        <AlertOctagon className="h-5 w-5 mr-2 text-amber-500" />
                        Confirm System-Wide Upgrade Broadcast Dispatch?
                      </div>
                      <p className="text-[11px] text-secondary-300">
                        This action will immediately send an Email & SMS notification to all registered business owners across tenant schemas.
                      </p>
                      <div className="flex space-x-3">
                        <Button
                          type="button"
                          variant="primary"
                          className="bg-amber-600 hover:bg-amber-500 text-white text-xs py-2.5 px-5"
                          onClick={handleExecuteBroadcast}
                          disabled={isSending}
                        >
                          {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Yes, Execute Broadcast Now
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-secondary-700 text-secondary-300 hover:bg-secondary-800 text-xs"
                          onClick={() => setConfirmStep(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center pt-4 border-t border-secondary-800">
                      <span className="text-[11px] text-secondary-400">Batch-processed in 15-user chunks with 500ms safety delay</span>
                      <Button
                        type="button"
                        variant="primary"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs flex items-center py-2.5 px-5"
                        onClick={() => setConfirmStep(true)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Broadcast System Announcement
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 2: Engine Diagnostics */}
            {activeTab === "health" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold font-syne">Platform Diagnostics & Service Uptime</CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    Live status from the backend's /health endpoint.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingHealth && !healthData && (
                    <div className="flex items-center justify-center py-8 text-secondary-400 text-sm gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking infrastructure status...
                    </div>
                  )}

                  {healthError && (
                    <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">
                      {healthError}
                    </div>
                  )}

                  {healthData && (
                    <>
                      <div className="p-4 bg-secondary-950 rounded-lg border border-secondary-800 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>PostgreSQL Database</span>
                          <span className={healthData.database === "connected" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                            {healthData.database === "connected" ? "CONNECTED" : "DISCONNECTED"}
                          </span>
                        </div>
                        <div className="w-full bg-secondary-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${healthData.database === "connected" ? "bg-emerald-500 w-full" : "bg-red-500 w-[10%]"}`}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-secondary-950 rounded-lg border border-secondary-800 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Redis Cache</span>
                          <span className={healthData.redis === "connected" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                            {healthData.redis === "connected" ? "CONNECTED" : "DISCONNECTED (fallback mode)"}
                          </span>
                        </div>
                        <div className="w-full bg-secondary-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${healthData.redis === "connected" ? "bg-emerald-500 w-full" : "bg-amber-500 w-[10%]"}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-secondary-400 pt-2">
                        <span>Overall status: <span className="text-white font-semibold">{healthData.status}</span></span>
                        <span>Uptime: {Math.floor(healthData.uptime / 60)}m {Math.floor(healthData.uptime % 60)}s</span>
                      </div>
                      <p className="text-[11px] text-secondary-500">
                        SMS gateway and email transport have no live health-check endpoint yet, so they aren't shown here rather than displaying a fabricated status.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 2b: Integrations */}
            {activeTab === "integrations" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold font-syne flex items-center">
                    <Plug className="h-5 w-5 mr-2 text-amber-400" />
                    Third-Party Integrations
                  </CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    Live configured/not-configured status for every integration Ledgio has - booleans only, credential
                    values are never exposed here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingIntegrations && !integrationsData && (
                    <div className="flex items-center justify-center py-8 text-secondary-400 text-sm gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking integrations...
                    </div>
                  )}

                  {integrationsError && (
                    <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">
                      {integrationsError}
                    </div>
                  )}

                  {integrationsData && (
                    <>
                      <div>
                        <div className="text-xs font-bold text-secondary-300 uppercase tracking-wide mb-3">
                          Platform-Wide (one credential serves every tenant)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {integrationsData.platformWide.map((integration) => (
                            <div
                              key={integration.key}
                              className="p-4 bg-secondary-950 rounded-lg border border-secondary-800 flex items-start justify-between gap-3"
                            >
                              <div>
                                <div className="text-sm font-semibold text-white">{integration.name}</div>
                                <div className="text-[11px] text-secondary-500 mt-0.5">{integration.purpose}</div>
                              </div>
                              <span
                                className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                                  integration.configured
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-amber-500/10 text-amber-400"
                                }`}
                              >
                                {integration.configured ? "CONFIGURED" : "NOT CONFIGURED"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-secondary-300 uppercase tracking-wide mb-3">
                          Per-Tenant (each business enters its own credentials)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {integrationsData.perTenant.map((integration) => (
                            <div key={integration.key} className="p-4 bg-secondary-950 rounded-lg border border-secondary-800">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">{integration.name}</div>
                                  <div className="text-[11px] text-secondary-500 mt-0.5">{integration.purpose}</div>
                                </div>
                                <span className="text-lg font-extrabold text-white whitespace-nowrap">
                                  {integration.tenantsConfigured}/{integration.totalTenants}
                                </span>
                              </div>
                              <div className="w-full bg-secondary-800 h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                  className="h-full bg-amber-400"
                                  style={{
                                    width: `${integration.totalTenants > 0 ? (integration.tenantsConfigured / integration.totalTenants) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 3: Tenant Schemas */}
            {activeTab === "schemas" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold font-syne">Tenant Schemas & Tier Management</CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    Inspect schema-isolated business environments and subscription tiers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-secondary-300">
                  <div className="p-4 bg-secondary-950 rounded-lg border border-secondary-800">
                    <h4 className="font-bold text-white mb-2">Schema Isolation Architecture</h4>
                    <p>Every onboarded business operates in a dedicated PostgreSQL schema to ensure zero cross-tenant data leakage and enterprise compliance.</p>
                  </div>

                  {isLoadingTenants && (
                    <div className="text-center py-6 text-secondary-500">Loading tenant roster...</div>
                  )}

                  {tenantsError && (
                    <div className="text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                      {tenantsError}
                    </div>
                  )}

                  {!isLoadingTenants && !tenantsError && tenants && (
                    <div className="rounded-lg border border-secondary-800 overflow-x-auto">
                      <Table>
                        <TableHeader className="!bg-secondary-950">
                          <TableRow className="border-secondary-800 hover:bg-transparent">
                            <TableHead className="text-secondary-400 w-6"></TableHead>
                            <TableHead className="text-secondary-400">Name</TableHead>
                            <TableHead className="text-secondary-400">Slug</TableHead>
                            <TableHead className="text-secondary-400">Schema</TableHead>
                            <TableHead className="text-secondary-400">Plan</TableHead>
                            <TableHead className="text-secondary-400">Status</TableHead>
                            <TableHead className="text-secondary-400">Users</TableHead>
                            <TableHead className="text-secondary-400">Onboarded</TableHead>
                            <TableHead className="text-secondary-400"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenants.map((t) => {
                            const isExpanded = expandedTenantId === t.id;
                            const users = tenantUsers[t.id];
                            const subStatus = t.subscriptionStatus ?? "ACTIVE";
                            const subBadge = subStatus === "TRIAL" ? "bg-amber-500/10 text-amber-400 border-amber-700"
                              : subStatus === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-700"
                              : subStatus === "GRACE" ? "bg-orange-500/10 text-orange-400 border-orange-700"
                              : "bg-rose-500/10 text-rose-400 border-rose-700";
                            return (
                              <>
                                <TableRow key={t.id} className="border-secondary-800 hover:bg-secondary-950/60 cursor-pointer" onClick={() => {
                                  if (isExpanded) {
                                    setExpandedTenantId(null);
                                  } else {
                                    setExpandedTenantId(t.id);
                                    loadTenantUsers(t.id);
                                  }
                                }}>
                                  <TableCell className="pr-0">
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-secondary-400" /> : <ChevronRight className="h-3.5 w-3.5 text-secondary-400" />}
                                  </TableCell>
                                  <TableCell className="font-semibold text-white">{t.name}</TableCell>
                                  <TableCell className="font-jetbrains text-secondary-300">{t.slug}</TableCell>
                                  <TableCell className="font-jetbrains text-secondary-300">{t.schema}</TableCell>
                                  <TableCell className="text-secondary-300" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      <select
                                        className="h-8 px-2 rounded-md border border-secondary-700 bg-secondary-950 text-secondary-100 text-xs"
                                        value={tierDrafts[t.id] ?? t.tier}
                                        onChange={(e) => setTierDrafts((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
                                      >
                                        <option value={1}>Shop</option>
                                        <option value={2}>Business</option>
                                        <option value={3}>Enterprise</option>
                                      </select>
                                      {(tierDrafts[t.id] ?? t.tier) !== t.tier && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-xs"
                                          disabled={savingTierId === t.id}
                                          onClick={() => handleSaveTier(t.id)}
                                        >
                                          {savingTierId === t.id ? "Saving..." : "Save"}
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${subBadge}`}>
                                      {subStatus}
                                    </span>
                                    {t.trialEndsAt && subStatus === "TRIAL" && (
                                      <div className="text-[10px] text-secondary-500 mt-0.5">ends {new Date(t.trialEndsAt).toLocaleDateString()}</div>
                                    )}
                                    {t.subscriptionPaidUntil && subStatus === "ACTIVE" && (
                                      <div className="text-[10px] text-secondary-500 mt-0.5">until {new Date(t.subscriptionPaidUntil).toLocaleDateString()}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-secondary-300 font-jetbrains text-center">{t.userCount ?? "—"}</TableCell>
                                  <TableCell className="text-secondary-300">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="p-1.5 rounded-md text-rose-500 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                                      title="Delete tenant permanently"
                                      onClick={() => { setDeletingTenant({ id: t.id, name: t.name, slug: t.slug }); setDeleteConfirmSlug(""); }}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow key={`${t.id}-users`} className="border-secondary-800 bg-secondary-950/40">
                                    <TableCell colSpan={9} className="p-0">
                                      <div className="px-6 py-4 space-y-2">
                                        <div className="text-xs font-bold text-secondary-300 mb-2 flex items-center gap-2">
                                          <Users className="h-3.5 w-3.5" /> Users in {t.name}
                                        </div>
                                        {loadingTenantUsers === t.id && (
                                          <div className="flex items-center gap-2 text-secondary-500 text-xs py-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…
                                          </div>
                                        )}
                                        {users && users.length === 0 && (
                                          <p className="text-xs text-secondary-500">No users found for this tenant.</p>
                                        )}
                                        {users && users.length > 0 && (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-secondary-500 text-left border-b border-secondary-800">
                                                  <th className="pb-1 pr-4 font-medium">Name</th>
                                                  <th className="pb-1 pr-4 font-medium">Email</th>
                                                  <th className="pb-1 pr-4 font-medium">Role</th>
                                                  <th className="pb-1 pr-4 font-medium">Status</th>
                                                  <th className="pb-1 font-medium">Action</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {users.map((u) => (
                                                  <tr key={u.id} className="border-b border-secondary-800/50 last:border-0">
                                                    <td className="py-1.5 pr-4 text-secondary-200">{u.name}</td>
                                                    <td className="py-1.5 pr-4 font-jetbrains text-secondary-300">{u.email}</td>
                                                    <td className="py-1.5 pr-4 text-secondary-400">{u.role}</td>
                                                    <td className="py-1.5 pr-4">
                                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${u.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-700" : "bg-rose-500/10 text-rose-400 border-rose-700"}`}>
                                                        {u.isActive ? "Active" : "Inactive"}
                                                      </span>
                                                    </td>
                                                    <td className="py-1.5">
                                                      {u.isActive ? (
                                                        <button
                                                          onClick={(e) => { e.stopPropagation(); handleToggleUserActive(u.id, t.id, false); }}
                                                          disabled={togglingUserId === u.id}
                                                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800 hover:bg-rose-950/70 transition-colors disabled:opacity-50"
                                                        >
                                                          <UserX className="h-3 w-3" />
                                                          {togglingUserId === u.id ? "…" : "Deactivate"}
                                                        </button>
                                                      ) : (
                                                        <button
                                                          onClick={(e) => { e.stopPropagation(); handleToggleUserActive(u.id, t.id, true); }}
                                                          disabled={togglingUserId === u.id}
                                                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800 hover:bg-emerald-950/70 transition-colors disabled:opacity-50"
                                                        >
                                                          <UserCheck className="h-3 w-3" />
                                                          {togglingUserId === u.id ? "…" : "Activate"}
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {tenants.length === 0 && (
                        <div className="text-center py-6 text-secondary-500">No tenants onboarded yet.</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 4: System Audit Logs */}
            {activeTab === "audit" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-extrabold font-syne">System Audit Logs</CardTitle>
                    <CardDescription className="text-secondary-400 text-xs">
                      Platform-wide activity across every tenant - administrative broadcasts, system configuration events, and tenant-level actions.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="border-secondary-700 text-secondary-200 hover:text-white text-xs h-8"
                    onClick={handleExportAuditLogs}
                    disabled={isExportingAuditLogs}
                  >
                    {isExportingAuditLogs ? "Exporting..." : "Export CSV"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-secondary-300">
                  {/* Filter Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-3 rounded-lg bg-secondary-950 border border-secondary-800">
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">Action</label>
                      <Input
                        placeholder="e.g. JOURNAL_ENTRY"
                        list="admin-audit-action-options"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.action}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, action: e.target.value }))}
                      />
                      <datalist id="admin-audit-action-options">
                        {auditActionOptions.map((a) => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">Entity</label>
                      <Input
                        placeholder="e.g. Invoice"
                        list="admin-audit-entity-options"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.entity}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, entity: e.target.value }))}
                      />
                      <datalist id="admin-audit-entity-options">
                        {auditEntityOptions.map((e) => <option key={e} value={e} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">Entity ID</label>
                      <Input
                        placeholder="exact record ID"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.entityId}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, entityId: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">User Email</label>
                      <Input
                        placeholder="e.g. jane@shop.com"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.userEmail}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, userEmail: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">IP Address</label>
                      <Input
                        placeholder="e.g. 197.251"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.ipAddress}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, ipAddress: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">Tenant</label>
                      <select
                        className="w-full h-8 px-2 text-xs rounded-md bg-secondary-900 border border-secondary-700 text-white"
                        value={draftAuditFilters.tenantId}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, tenantId: e.target.value }))}
                      >
                        <option value="">All tenants</option>
                        {(tenants || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">From</label>
                      <Input
                        type="date"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.dateFrom}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-secondary-500 mb-1">To</label>
                      <Input
                        type="date"
                        className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                        value={draftAuditFilters.dateTo}
                        onChange={(e) => setDraftAuditFilters((f) => ({ ...f, dateTo: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-6 flex gap-2">
                      <Button variant="primary" className="h-8 text-xs" onClick={applyAuditFilters}>
                        Apply Filters
                      </Button>
                      {hasActiveAuditFilters && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-secondary-700 text-secondary-200 hover:text-white"
                          onClick={clearAuditFilters}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {isLoadingAuditLogs && (
                    <div className="text-center py-6 text-secondary-500">Loading audit logs...</div>
                  )}

                  {auditLogsError && (
                    <div className="text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                      {auditLogsError}
                    </div>
                  )}

                  {!isLoadingAuditLogs && !auditLogsError && auditLogs && (
                    <div className="rounded-lg border border-secondary-800 overflow-x-auto">
                      <Table>
                        <TableHeader className="!bg-secondary-950">
                          <TableRow className="border-secondary-800 hover:bg-transparent">
                            <TableHead className="text-secondary-400">Timestamp</TableHead>
                            <TableHead className="text-secondary-400">Tenant</TableHead>
                            <TableHead className="text-secondary-400">Action</TableHead>
                            <TableHead className="text-secondary-400">Entity</TableHead>
                            <TableHead className="text-secondary-400">User</TableHead>
                            <TableHead className="text-secondary-400">Details</TableHead>
                            <TableHead className="text-secondary-400">Changes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log) => (
                            <TableRow key={log.id} className="border-secondary-800 hover:bg-secondary-950/60">
                              <TableCell className="text-secondary-300 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-secondary-300">
                                {log.tenant ? log.tenant.name : <span className="text-secondary-600">Platform</span>}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-900/40 text-amber-300 border border-amber-800">
                                  {log.action}
                                </span>
                              </TableCell>
                              <TableCell className="font-jetbrains text-secondary-400">
                                {log.entity}
                                {log.entityId && <span className="text-secondary-600">:{log.entityId.slice(0, 8)}</span>}
                              </TableCell>
                              <TableCell className="text-secondary-300">{log.userEmail || log.userId || "System"}</TableCell>
                              <TableCell className="text-secondary-400 font-jetbrains max-w-xs truncate" title={log.details || ""}>
                                {log.details || "-"}
                              </TableCell>
                              <TableCell className="text-secondary-400">
                                {log.changes && Object.keys(log.changes).length > 0 ? (
                                  <div className="space-y-0.5">
                                    {Object.entries(log.changes).map(([field, diff]) => (
                                      <div key={field} className="text-[10px] whitespace-nowrap">
                                        <span className="text-secondary-300 font-semibold">{field}</span>
                                        <span className="text-secondary-600">: </span>
                                        {String((diff as any)?.from ?? "—")}
                                        <span className="text-secondary-600"> → </span>
                                        <span className="text-secondary-200">{String((diff as any)?.to ?? "—")}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {auditLogs.length === 0 && (
                        <div className="text-center py-6 text-secondary-500">
                          {hasActiveAuditFilters ? "No audit logs match the current filters." : "No audit log entries yet."}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 5: Onboard Contracted Client */}
            {activeTab === "onboard" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold font-syne flex items-center">
                    <Building2 className="h-5 w-5 mr-2 text-amber-400" />
                    Onboard a Contracted Client
                  </CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    Directly provisions a new tenant with its account pre-verified (no email/SMS verification round-trip) - use this only for a business you've already vetted directly (a signed contract), not a self-service signup. They can log in immediately with the credentials below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleOnboardClient} className="space-y-4">
                    {onboardError && (
                      <div className="p-3 text-xs bg-rose-950/40 text-rose-300 rounded-md border border-rose-900">
                        {onboardError}
                      </div>
                    )}
                    {onboardResult && (
                      <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center font-bold text-emerald-400 text-sm">
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          Client Onboarded & Pre-Verified
                        </div>
                        <div>Workspace: <strong>{onboardResult.tenant.name}</strong> ({onboardResult.tenant.slug})</div>
                        <div>Admin login: <strong>{onboardResult.admin.email}</strong></div>
                        <div className="text-emerald-300/80">They can log in right now with the password you set - no verification step needed.</div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Company Name</label>
                        <Input
                          required
                          value={onboardCompanyName}
                          onChange={(e) => setOnboardCompanyName(e.target.value)}
                          placeholder="Acme Retail Ltd"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Workspace Slug (optional)</label>
                        <Input
                          value={onboardSlug}
                          onChange={(e) => setOnboardSlug(e.target.value)}
                          placeholder="Auto-generated from company name if left blank"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Admin Name</label>
                        <Input
                          required
                          value={onboardAdminName}
                          onChange={(e) => setOnboardAdminName(e.target.value)}
                          placeholder="Jane Doe"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Admin Email</label>
                        <Input
                          required
                          type="email"
                          value={onboardAdminEmail}
                          onChange={(e) => setOnboardAdminEmail(e.target.value)}
                          placeholder="jane@acme.com"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Admin Phone (optional)</label>
                        <Input
                          value={onboardAdminPhone}
                          onChange={(e) => setOnboardAdminPhone(e.target.value)}
                          placeholder="+233201234567"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Admin Password</label>
                        <Input
                          required
                          type="password"
                          value={onboardAdminPassword}
                          onChange={(e) => setOnboardAdminPassword(e.target.value)}
                          placeholder="Set a password they'll change later"
                          className="bg-secondary-950 border-secondary-700 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Base Currency</label>
                        <select
                          value={onboardBaseCurrency}
                          onChange={(e) => setOnboardBaseCurrency(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                        >
                          <option value="GHS">GHS - Ghanaian Cedi</option>
                          <option value="USD">USD - US Dollar</option>
                          <option value="NGN">NGN - Nigerian Naira</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Organization Type</label>
                        <select
                          value={onboardOrgType}
                          onChange={(e) => setOnboardOrgType(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                        >
                          <option value="BUSINESS">Business</option>
                          <option value="NONPROFIT">Nonprofit / Church / NGO / School</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-secondary-800">
                      <Button
                        type="submit"
                        variant="primary"
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs flex items-center py-2.5 px-5"
                        disabled={isOnboarding}
                      >
                        {isOnboarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="mr-2 h-4 w-4" />}
                        {isOnboarding ? "Onboarding..." : "Onboard Pre-Verified Client"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Tab 8: Google Analytics */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {/* Header + controls */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BarChart2 className="h-5 w-5 text-amber-400" />
                      Platform Traffic Analytics
                    </h2>
                    <p className="text-xs text-secondary-400 mt-0.5">
                      Real-time + historical data from Google Analytics 4 — all Ledgio tenants combined.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={analyticsDays}
                      onChange={(e) => setAnalyticsDays(Number(e.target.value))}
                      className="h-9 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={14}>Last 14 days</option>
                      <option value={28}>Last 28 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                    <button
                      onClick={() => fetchAnalytics(analyticsDays)}
                      disabled={isLoadingAnalytics}
                      className="h-9 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </div>

                {isLoadingAnalytics && !analyticsData && (
                  <div className="flex items-center justify-center py-16 text-secondary-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Fetching analytics…
                  </div>
                )}

                {analyticsError && (
                  <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">
                    {analyticsError}
                  </div>
                )}

                {analyticsData && !analyticsData.configured && (
                  <Card className="bg-secondary-900 border-secondary-800 text-white">
                    <CardContent className="p-6 text-center space-y-3">
                      <BarChart2 className="h-10 w-10 text-secondary-600 mx-auto" />
                      <p className="text-secondary-300 text-sm font-semibold">Google Analytics not configured</p>
                      <p className="text-secondary-500 text-xs max-w-md mx-auto">
                        Set <code className="text-amber-400">GA_PROPERTY_ID</code>,{" "}
                        <code className="text-amber-400">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, and{" "}
                        <code className="text-amber-400">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> on the backend, and{" "}
                        <code className="text-amber-400">VITE_GA_MEASUREMENT_ID</code> on the frontend to enable tracking.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {analyticsData && analyticsData.configured && (
                  <>
                    {/* Realtime pill */}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {analyticsData.activeUsers} active right now
                      </span>
                    </div>

                    {/* Core metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: "Total Users", value: analyticsData.totalUsers.toLocaleString(), icon: Users },
                        { label: "New Users", value: analyticsData.newUsers.toLocaleString(), icon: Users },
                        { label: "Sessions", value: analyticsData.sessions.toLocaleString(), icon: Activity },
                        { label: "Page Views", value: analyticsData.pageViews.toLocaleString(), icon: Monitor },
                        {
                          label: "Avg Session",
                          value: `${Math.floor(analyticsData.avgSessionDuration / 60)}m ${analyticsData.avgSessionDuration % 60}s`,
                          icon: Activity,
                        },
                        {
                          label: "Bounce Rate",
                          value: `${analyticsData.bounceRate.toFixed(1)}%`,
                          icon: BarChart2,
                        },
                      ].map(({ label, value }) => (
                        <Card key={label} className="bg-secondary-900 border-secondary-800 text-white">
                          <CardContent className="p-4">
                            <div className="text-[11px] text-secondary-400 mb-1">{label}</div>
                            <div className="text-xl font-extrabold text-white">{value}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Top pages */}
                      <Card className="bg-secondary-900 border-secondary-800 text-white lg:col-span-1">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-amber-400" />
                            Top Pages
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {analyticsData.topPages.map((p, i) => {
                            const max = analyticsData.topPages[0]?.views || 1;
                            return (
                              <div key={i}>
                                <div className="flex justify-between items-center text-xs mb-0.5">
                                  <span className="text-secondary-300 truncate max-w-[180px]" title={p.page}>{p.page || '/'}</span>
                                  <span className="text-secondary-400 font-jetbrains ml-2 flex-shrink-0">{p.views.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-secondary-800 h-1 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400" style={{ width: `${(p.views / max) * 100}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {analyticsData.topPages.length === 0 && (
                            <p className="text-xs text-secondary-500">No data yet.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Top countries */}
                      <Card className="bg-secondary-900 border-secondary-800 text-white">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Globe className="h-4 w-4 text-amber-400" />
                            Top Countries
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {analyticsData.topCountries.map((c, i) => {
                            const max = analyticsData.topCountries[0]?.users || 1;
                            return (
                              <div key={i}>
                                <div className="flex justify-between items-center text-xs mb-0.5">
                                  <span className="text-secondary-300">{c.country}</span>
                                  <span className="text-secondary-400 font-jetbrains">{c.users.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-secondary-800 h-1 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400" style={{ width: `${(c.users / max) * 100}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {analyticsData.topCountries.length === 0 && (
                            <p className="text-xs text-secondary-500">No data yet.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Devices */}
                      <Card className="bg-secondary-900 border-secondary-800 text-white">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-amber-400" />
                            Devices
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {analyticsData.topDevices.map((d, i) => {
                            const total = analyticsData.topDevices.reduce((s, x) => s + x.sessions, 0) || 1;
                            const pct = Math.round((d.sessions / total) * 100);
                            return (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-secondary-300 capitalize">{d.device}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-secondary-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-400" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-secondary-400 font-jetbrains w-8 text-right">{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                          {analyticsData.topDevices.length === 0 && (
                            <p className="text-xs text-secondary-500">No data yet.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: Performance Metrics */}
            {activeTab === "performance" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-400" />
                      System Performance
                    </h2>
                    <p className="text-xs text-secondary-400 mt-0.5">5-min rolling buckets (last hour) · route stats since last deploy · refreshes every 30 s.</p>
                  </div>
                  <button
                    onClick={fetchMetrics}
                    disabled={isLoadingMetrics}
                    className="h-9 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingMetrics ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {isLoadingMetrics && !metricsData && (
                  <div className="flex items-center justify-center py-16 text-secondary-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading metrics…
                  </div>
                )}
                {metricsError && (
                  <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">{metricsError}</div>
                )}
                {metricsData && (
                  <>
                    {/* Summary KPI cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Requests (1hr)", value: metricsData.requests.toLocaleString(), color: "text-blue-400" },
                        { label: "Error Rate", value: `${metricsData.errorRate.toFixed(1)}%`, color: metricsData.errorRate > 5 ? "text-rose-400" : metricsData.errorRate > 1 ? "text-amber-400" : "text-emerald-400" },
                        { label: "Avg Latency", value: `${metricsData.avgLatencyMs.toFixed(0)} ms`, color: metricsData.avgLatencyMs > 500 ? "text-rose-400" : metricsData.avgLatencyMs > 200 ? "text-amber-400" : "text-emerald-400" },
                        { label: "Heap Used", value: `${metricsData.memory.heapUsedMb.toFixed(1)} MB`, color: "text-purple-400" },
                      ].map(({ label, value, color }) => (
                        <Card key={label} className="bg-secondary-900 border-secondary-800 text-white">
                          <CardContent className="p-4">
                            <div className="text-[11px] text-secondary-400 mb-1">{label}</div>
                            <div className={`text-2xl font-extrabold font-jetbrains ${color}`}>{value}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Status code distribution */}
                    {metricsData.statusDist && (() => {
                      const sd = metricsData.statusDist!;
                      const total = sd.ok + sd.redirect + sd.clientErr + sd.serverErr || 1;
                      const bars = [
                        { label: "2xx OK", count: sd.ok, color: "bg-emerald-500", text: "text-emerald-400" },
                        { label: "3xx Redirect", count: sd.redirect, color: "bg-blue-500", text: "text-blue-400" },
                        { label: "4xx Client Error", count: sd.clientErr, color: "bg-amber-500", text: "text-amber-400" },
                        { label: "5xx Server Error", count: sd.serverErr, color: "bg-rose-500", text: "text-rose-400" },
                      ];
                      return (
                        <Card className="bg-secondary-900 border-secondary-800 text-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold">Response Status Distribution (since last deploy)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex h-5 w-full rounded overflow-hidden gap-px mb-3">
                              {bars.map(bar => bar.count > 0 && (
                                <div key={bar.label} title={`${bar.label}: ${bar.count}`}
                                  className={`${bar.color} transition-all`}
                                  style={{ width: `${(bar.count / total * 100).toFixed(1)}%` }} />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {bars.map(bar => (
                                <div key={bar.label} className="flex items-center gap-2">
                                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${bar.color}`} />
                                  <div>
                                    <div className="text-[10px] text-secondary-400">{bar.label}</div>
                                    <div className={`font-jetbrains font-bold text-sm ${bar.text}`}>{bar.count.toLocaleString()}</div>
                                    <div className="text-[10px] text-secondary-500">{(bar.count / total * 100).toFixed(1)}%</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {/* Request + Latency sparklines */}
                    {metricsData.buckets.length > 0 && (
                      <Card className="bg-secondary-900 border-secondary-800 text-white">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold">Traffic & Latency — last {metricsData.buckets.length} × 5 min</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Request/Error bars */}
                          <div>
                            <div className="text-[10px] text-secondary-400 mb-1">Requests / Errors</div>
                            <div className="overflow-x-auto">
                              <svg width={Math.max(metricsData.buckets.length * 48, 400)} height={72} className="w-full" style={{ height: 72 }}>
                                {(() => {
                                  const maxReq = Math.max(...metricsData.buckets.map((b) => b.requests), 1);
                                  const w = Math.max(metricsData.buckets.length * 48, 400);
                                  const bw = w / metricsData.buckets.length;
                                  return metricsData.buckets.map((b, i) => {
                                    const reqH = Math.round((b.requests / maxReq) * 56);
                                    const errH = b.requests > 0 ? Math.round((b.errors / b.requests) * reqH) : 0;
                                    const x = i * bw;
                                    return (
                                      <g key={b.ts}>
                                        <title>{new Date(b.ts).toLocaleTimeString()} · {b.requests} req · {b.errors} err · {b.avgMs}ms avg</title>
                                        <rect x={x + 2} y={72 - reqH} width={bw - 4} height={reqH} rx={2} fill="#3b82f6" opacity={0.55} />
                                        {errH > 0 && <rect x={x + 2} y={72 - errH} width={bw - 4} height={errH} rx={2} fill="#ef4444" opacity={0.85} />}
                                      </g>
                                    );
                                  });
                                })()}
                              </svg>
                            </div>
                          </div>
                          {/* Latency line chart */}
                          <div>
                            <div className="text-[10px] text-secondary-400 mb-1">Avg Response Time (ms)</div>
                            <div className="overflow-x-auto">
                              <svg width={Math.max(metricsData.buckets.length * 48, 400)} height={56} className="w-full" style={{ height: 56 }}>
                                {(() => {
                                  const maxMs = Math.max(...metricsData.buckets.map(b => b.avgMs), 1);
                                  const w = Math.max(metricsData.buckets.length * 48, 400);
                                  const bw = w / metricsData.buckets.length;
                                  const pts = metricsData.buckets.map((b, i) => {
                                    const x = i * bw + bw / 2;
                                    const y = 48 - Math.round((b.avgMs / maxMs) * 40);
                                    return `${x},${y}`;
                                  }).join(' ');
                                  return (
                                    <>
                                      <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinejoin="round" />
                                      {metricsData.buckets.map((b, i) => (
                                        <circle key={b.ts} cx={i * bw + bw / 2} cy={48 - Math.round((b.avgMs / maxMs) * 40)} r={3} fill="#a78bfa">
                                          <title>{new Date(b.ts).toLocaleTimeString()} · {b.avgMs} ms</title>
                                        </circle>
                                      ))}
                                    </>
                                  );
                                })()}
                              </svg>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-secondary-400">
                            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-blue-500/55 rounded-sm" /> Requests</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-red-500/85 rounded-sm" /> Errors</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-violet-400 rounded" /> Avg Latency</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Top Routes by Traffic */}
                    {metricsData.topRoutesByTraffic && metricsData.topRoutesByTraffic.length > 0 && (
                      <Card className="bg-secondary-900 border-secondary-800 text-white">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold">Top Routes by Traffic (since last deploy)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-secondary-400 border-b border-secondary-800">
                                  <th className="text-left pb-2 pr-4 font-medium">Route</th>
                                  <th className="text-right pb-2 pr-4 font-medium">Requests</th>
                                  <th className="text-right pb-2 pr-4 font-medium">Errors</th>
                                  <th className="text-right pb-2 pr-4 font-medium">Error Rate</th>
                                  <th className="text-right pb-2 font-medium">Avg Latency</th>
                                </tr>
                              </thead>
                              <tbody>
                                {metricsData.topRoutesByTraffic.map((r) => (
                                  <tr key={r.route} className="border-b border-secondary-800/50 hover:bg-secondary-800/30">
                                    <td className="py-2 pr-4 font-jetbrains text-[11px] text-secondary-300 max-w-[260px] truncate">{r.route}</td>
                                    <td className="py-2 pr-4 text-right font-jetbrains text-blue-300">{r.requests.toLocaleString()}</td>
                                    <td className="py-2 pr-4 text-right font-jetbrains">{r.errors > 0 ? <span className="text-rose-400">{r.errors}</span> : <span className="text-secondary-500">0</span>}</td>
                                    <td className="py-2 pr-4 text-right font-jetbrains">
                                      <span className={r.errorRate > 10 ? "text-rose-400" : r.errorRate > 1 ? "text-amber-400" : "text-emerald-400"}>
                                        {r.errorRate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 text-right font-jetbrains">
                                      <span className={r.avgMs > 500 ? "text-rose-400" : r.avgMs > 200 ? "text-amber-400" : "text-secondary-300"}>
                                        {r.avgMs} ms
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Top Error Sources from error log */}
                    {errorGroups.length > 0 && (
                      <Card className="bg-secondary-900 border-secondary-800 text-white">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                            Top Error Sources
                            <span className="text-xs font-normal text-secondary-400 ml-1">({errorGroups.length} distinct error{errorGroups.length !== 1 ? "s" : ""})</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-secondary-400 border-b border-secondary-800">
                                  <th className="text-left pb-2 pr-3 font-medium">Route</th>
                                  <th className="text-left pb-2 pr-3 font-medium">Error</th>
                                  <th className="text-left pb-2 pr-3 font-medium">Source</th>
                                  <th className="text-right pb-2 pr-3 font-medium">Status</th>
                                  <th className="text-right pb-2 font-medium">Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {errorGroups.slice(0, 10).map((g) => (
                                  <tr key={g.key} className="border-b border-secondary-800/50 hover:bg-secondary-800/30">
                                    <td className="py-2 pr-3 font-jetbrains text-[10px] text-secondary-300 max-w-[180px] truncate">
                                      <span className="text-secondary-500 mr-1">{g.method}</span>{g.sample?.path ?? '—'}
                                    </td>
                                    <td className="py-2 pr-3 text-rose-300 max-w-[200px] truncate" title={g.error}>{g.error}</td>
                                    <td className="py-2 pr-3 font-jetbrains text-[10px] text-violet-300 max-w-[160px] truncate" title={g.source}>
                                      {g.fn ? `${g.fn} ` : ''}{g.source ?? '—'}
                                    </td>
                                    <td className="py-2 pr-3 text-right">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${g.status >= 500 ? "bg-rose-900/60 text-rose-300" : "bg-amber-900/60 text-amber-300"}`}>
                                        {g.status}
                                      </span>
                                    </td>
                                    <td className="py-2 text-right font-jetbrains font-bold text-rose-400">{g.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {errorGroups.length === 0 && metricsData && (
                      <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                        <span>✓</span> No errors in the log buffer. All good.
                      </div>
                    )}

                    {/* System info */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                      {[
                        { label: "Node.js", value: metricsData.nodeVersion },
                        { label: "Process Uptime", value: `${Math.floor(metricsData.uptime / 3600)}h ${Math.floor((metricsData.uptime % 3600) / 60)}m` },
                        { label: "Heap Used", value: `${metricsData.memory.heapUsedMb.toFixed(1)} MB` },
                        { label: "RSS Memory", value: `${metricsData.memory.rssMb.toFixed(1)} MB` },
                      ].map(({ label, value }) => (
                        <div key={label} className="p-4 bg-secondary-900 border border-secondary-800 rounded-lg">
                          <div className="text-secondary-400 mb-1">{label}</div>
                          <div className="font-jetbrains text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: Cron Jobs */}
            {activeTab === "jobs" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-extrabold font-syne flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-400" />
                      Cron Job Monitor
                    </CardTitle>
                    <CardDescription className="text-secondary-400 text-xs">
                      All 9 scheduled background services — live last-run status and manual trigger.
                    </CardDescription>
                  </div>
                  <button
                    onClick={fetchJobs}
                    disabled={isLoadingJobs}
                    className="h-9 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingJobs ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingJobs && !jobsData && (
                    <div className="flex items-center justify-center py-16 text-secondary-400 gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading jobs…
                    </div>
                  )}
                  {jobsError && (
                    <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">{jobsError}</div>
                  )}
                  {jobsData && (
                    <div className="overflow-x-auto rounded-lg border border-secondary-800">
                      <Table>
                        <TableHeader className="!bg-secondary-950">
                          <TableRow className="border-secondary-800 hover:bg-transparent">
                            <TableHead className="text-secondary-400">Job Name</TableHead>
                            <TableHead className="text-secondary-400">Schedule</TableHead>
                            <TableHead className="text-secondary-400">Last Run</TableHead>
                            <TableHead className="text-secondary-400">Duration</TableHead>
                            <TableHead className="text-secondary-400">Status</TableHead>
                            <TableHead className="text-secondary-400">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobsData.map((job) => {
                            const lr = job.lastRun;
                            const statusChip = !lr
                              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-700 text-secondary-400 border border-secondary-600">Never run</span>
                              : lr.success
                                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-700">OK</span>
                                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-700">FAILED</span>;
                            return (
                              <TableRow key={job.name} className="border-secondary-800 hover:bg-secondary-950/60">
                                <TableCell>
                                  <div className="font-semibold text-white text-xs">{job.name}</div>
                                  {job.description && <div className="text-[10px] text-secondary-500 mt-0.5">{job.description}</div>}
                                </TableCell>
                                <TableCell className="font-jetbrains text-secondary-400 text-xs">{job.schedule}</TableCell>
                                <TableCell className="text-secondary-400 text-xs whitespace-nowrap">
                                  {lr ? new Date(lr.startedAt).toLocaleString() : "—"}
                                </TableCell>
                                <TableCell className="font-jetbrains text-secondary-400 text-xs">
                                  {lr ? `${(lr.durationMs / 1000).toFixed(1)}s` : "—"}
                                </TableCell>
                                <TableCell>
                                  {statusChip}
                                  {lr && !lr.success && lr.errorMsg && (
                                    <div className="text-[10px] text-rose-400 mt-0.5 max-w-[160px] truncate" title={lr.errorMsg}>{lr.errorMsg}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => handleTriggerJob(job.name)}
                                    disabled={triggeringJob === job.name}
                                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-amber-600/20 text-amber-400 border border-amber-700 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
                                  >
                                    <Zap className="h-3 w-3" />
                                    {triggeringJob === job.name ? "Running…" : "Trigger Now"}
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ticket detail modal */}
            {selectedTicket && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={() => setSelectedTicket(null)}
              >
                <div
                  className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-secondary-700 bg-secondary-950 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal header */}
                  <div className={`flex items-start justify-between gap-4 p-5 border-b ${selectedTicket.status >= 500 ? 'border-rose-900/60 bg-rose-950/20' : 'border-amber-900/60 bg-amber-950/20'}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`shrink-0 mt-0.5 flex flex-col items-center gap-1.5`}>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg font-jetbrains tracking-wider ${selectedTicket.status >= 500 ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'}`}>
                          {selectedTicket.status >= 500 ? 'CRITICAL' : 'ERROR'}
                        </span>
                        <span className="text-[10px] font-bold font-jetbrains text-secondary-400 px-1.5 py-0.5 rounded bg-secondary-800">{selectedTicket.status}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-base font-semibold leading-snug ${selectedTicket.status >= 500 ? 'text-rose-200' : 'text-amber-200'}`}>{selectedTicket.error}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-jetbrains ${selectedTicket.method === 'GET' ? 'bg-blue-900/60 text-blue-300' : selectedTicket.method === 'POST' ? 'bg-emerald-900/60 text-emerald-300' : selectedTicket.method === 'DELETE' ? 'bg-rose-900/60 text-rose-300' : 'bg-secondary-800 text-secondary-300'}`}>{selectedTicket.method}</span>
                          <span className="font-jetbrains text-xs text-secondary-300 break-all">{selectedTicket.path}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="shrink-0 text-secondary-500 hover:text-white transition-colors p-1">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Metadata row */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">First Seen</p>
                        <p className="text-secondary-200 font-jetbrains">{new Date(selectedTicket.ts).toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">Last Seen</p>
                        <p className="text-secondary-200 font-jetbrains">{new Date(selectedTicket.lastSeen).toLocaleString()}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">Occurrences</p>
                        <p className={`font-jetbrains font-bold ${selectedTicket.count >= 10 ? 'text-rose-400' : selectedTicket.count >= 3 ? 'text-amber-400' : 'text-secondary-200'}`}>{selectedTicket.count}×</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">Ticket ID</p>
                        <p className="text-secondary-400 font-jetbrains text-[10px] break-all">{selectedTicket.id}</p>
                      </div>
                    </div>

                    {/* Source location */}
                    {(selectedTicket.source || selectedTicket.fn) && (
                      <div className="rounded-xl bg-rose-950/20 border border-rose-900/40 p-4 space-y-1">
                        <p className="text-rose-400 uppercase tracking-widest text-[9px] font-bold mb-2">📍 Source Location</p>
                        {selectedTicket.fn && <p className="text-white text-sm font-semibold">{selectedTicket.fn}<span className="text-secondary-500">()</span></p>}
                        {selectedTicket.source && <p className="text-rose-300 font-jetbrains text-xs break-all">{selectedTicket.source}</p>}
                      </div>
                    )}

                    {/* Request + Identity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-secondary-900 border border-secondary-800 p-4 space-y-2">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold mb-3">🔗 Request Context</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">Method</span><span className={`font-jetbrains font-bold ${selectedTicket.method === 'GET' ? 'text-blue-400' : selectedTicket.method === 'POST' ? 'text-emerald-400' : selectedTicket.method === 'DELETE' ? 'text-rose-400' : 'text-secondary-300'}`}>{selectedTicket.method}</span></div>
                          <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">Path</span><span className="font-jetbrains text-secondary-200 break-all">{selectedTicket.path}</span></div>
                          <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">Status</span><span className={`font-jetbrains font-bold ${selectedTicket.status >= 500 ? 'text-rose-400' : 'text-amber-400'}`}>{selectedTicket.status}</span></div>
                          {selectedTicket.ip && <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">IP</span><span className="font-jetbrains text-secondary-200">{selectedTicket.ip}</span></div>}
                          {selectedTicket.bodyKeys && selectedTicket.bodyKeys.length > 0 && (
                            <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">Body</span><span className="font-jetbrains text-secondary-300">{selectedTicket.bodyKeys.join(', ')}</span></div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl bg-secondary-900 border border-secondary-800 p-4 space-y-2">
                        <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold mb-3">🏢 Identity</p>
                        <div className="space-y-1.5 text-xs">
                          {selectedTicket.tenantId
                            ? <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">Tenant</span><span className="font-jetbrains text-secondary-200 break-all">{selectedTicket.tenantId}</span></div>
                            : <p className="text-secondary-600 italic text-xs">No tenant context (platform-level)</p>
                          }
                          {selectedTicket.userId && <div className="flex gap-2"><span className="text-secondary-500 w-14 shrink-0">User</span><span className="font-jetbrains text-secondary-200 break-all">{selectedTicket.userId}</span></div>}
                          {selectedTicket.userAgent && (
                            <div className="flex gap-2">
                              <span className="text-secondary-500 w-14 shrink-0">UA</span>
                              <span className="text-secondary-400 break-all leading-relaxed">{selectedTicket.userAgent}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stack trace */}
                    {selectedTicket.stack && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">📋 Stack Trace</p>
                          <button
                            onClick={() => navigator.clipboard?.writeText(selectedTicket.stack ?? '')}
                            className="text-[10px] text-secondary-500 hover:text-white px-2.5 py-1 rounded-lg border border-secondary-700 hover:border-secondary-500 transition-colors"
                          >Copy stack</button>
                        </div>
                        <div className="rounded-xl bg-black/60 border border-secondary-800 overflow-x-auto max-h-72 overflow-y-auto">
                          <pre className="p-4 text-[11px] font-jetbrains leading-relaxed">
                            {selectedTicket.stack.split('\n').map((line, i) => {
                              const isAppLine = line.includes('/src/') && !line.includes('node_modules');
                              const isAt = line.trim().startsWith('at ');
                              return (
                                <span key={i} className={
                                  isAppLine
                                    ? 'text-rose-300 font-semibold'
                                    : isAt
                                    ? 'text-secondary-600'
                                    : 'text-secondary-300'
                                }>
                                  {line}{'\n'}
                                </span>
                              );
                            })}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Error Log */}
            {activeTab === "errors" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-extrabold font-syne flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-rose-400" />
                      Server Error Log
                      {errorsData && errorsData.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-900/50 text-rose-300 text-xs font-jetbrains font-bold">
                          {errorsData.reduce((s, e) => s + e.count, 0)} total
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-secondary-400 text-xs">
                      Last 200 unhandled server errors — enriched with source location, tenant, and request context.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* View toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-secondary-700 text-xs">
                      <button onClick={() => setErrorsView('grouped')} className={`px-3 py-1.5 font-medium transition-colors ${errorsView === 'grouped' ? 'bg-secondary-700 text-white' : 'text-secondary-400 hover:text-white'}`}>Grouped</button>
                      <button onClick={() => setErrorsView('individual')} className={`px-3 py-1.5 font-medium transition-colors ${errorsView === 'individual' ? 'bg-secondary-700 text-white' : 'text-secondary-400 hover:text-white'}`}>Individual</button>
                    </div>
                    {/* Auto-refresh */}
                    <button
                      onClick={() => setErrorsAutoRefresh((v) => !v)}
                      className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${errorsAutoRefresh ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : 'bg-secondary-800 border-secondary-700 text-secondary-400 hover:text-white'}`}
                      title="Auto-refresh every 30 s"
                    >
                      <RefreshCw className={`h-3 w-3 ${errorsAutoRefresh ? 'animate-spin' : ''}`} />
                      {errorsAutoRefresh ? 'Live' : 'Auto'}
                    </button>
                    <button onClick={fetchErrors} disabled={isLoadingErrors} className="h-8 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                      <RefreshCw className={`h-3 w-3 ${isLoadingErrors ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    {errorsData && errorsData.length > 0 && (
                      <button onClick={handleClearErrors} disabled={isClearingErrors} className="h-8 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800 text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors">
                        <XCircle className="h-3 w-3" />
                        {isClearingErrors ? "Clearing…" : "Clear"}
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Filter bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter by error message, path, source file, tenant…"
                      value={errorsFilter}
                      onChange={(e) => setErrorsFilter(e.target.value)}
                      className="flex-1 h-8 bg-secondary-950 border border-secondary-700 rounded-lg px-3 text-xs text-white placeholder-secondary-500 focus:outline-none focus:border-secondary-500"
                    />
                    {errorsFilter && (
                      <button onClick={() => setErrorsFilter('')} className="h-8 px-2 text-secondary-400 hover:text-white text-xs">✕</button>
                    )}
                  </div>

                  {isLoadingErrors && !errorsData && (
                    <div className="flex items-center justify-center py-16 text-secondary-400 gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading errors…
                    </div>
                  )}
                  {errorsError && (
                    <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg text-red-300 text-xs">{errorsError}</div>
                  )}

                  {/* GROUPED VIEW */}
                  {errorsView === 'grouped' && errorsGrouped !== null && !isLoadingErrors && (
                    errorsGrouped.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-secondary-500 gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        <p className="text-sm">No errors logged — system is clean.</p>
                      </div>
                    ) : (() => {
                      const q = errorsFilter.toLowerCase();
                      const filtered = errorsGrouped.filter((g) =>
                        !q || g.error.toLowerCase().includes(q) || (g.source ?? '').toLowerCase().includes(q) || (g.fn ?? '').toLowerCase().includes(q)
                      );
                      return (
                        <div className="space-y-2">
                          {filtered.length === 0 && <p className="text-secondary-500 text-xs text-center py-8">No results match your filter.</p>}
                          {filtered.map((g) => {
                            const isExpanded = expandedErrorId === g.key;
                            return (
                              <div key={g.key} className={`rounded-lg border transition-colors ${isExpanded ? 'border-rose-700 bg-secondary-950' : 'border-secondary-800 bg-secondary-950/40 hover:border-secondary-700'}`}>
                                <button
                                  className="w-full text-left p-3 flex items-start gap-3"
                                  onClick={() => setExpandedErrorId(isExpanded ? null : g.key)}
                                >
                                  {/* Count badge */}
                                  <div className="shrink-0 mt-0.5">
                                    <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-md text-xs font-bold font-jetbrains ${g.count >= 10 ? 'bg-rose-900/60 text-rose-300' : g.count >= 3 ? 'bg-amber-900/50 text-amber-300' : 'bg-secondary-800 text-secondary-300'}`}>
                                      {g.count}×
                                    </span>
                                  </div>
                                  {/* Status + method */}
                                  <div className="shrink-0 flex flex-col gap-1 mt-0.5">
                                    <span className={`text-[10px] font-bold font-jetbrains px-1.5 py-0.5 rounded ${g.status >= 500 ? 'bg-rose-900/40 text-rose-400' : g.status >= 400 ? 'bg-amber-900/40 text-amber-400' : 'bg-secondary-800 text-secondary-400'}`}>{g.status}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-jetbrains ${g.method === 'GET' ? 'bg-blue-900/40 text-blue-400' : g.method === 'POST' ? 'bg-emerald-900/40 text-emerald-400' : g.method === 'DELETE' ? 'bg-rose-900/40 text-rose-400' : 'bg-secondary-800 text-secondary-300'}`}>{g.method}</span>
                                  </div>
                                  {/* Error + source */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium truncate">{g.error}</p>
                                    {g.source && (
                                      <p className="text-[11px] text-rose-400/80 font-jetbrains mt-0.5 truncate">
                                        📍 {g.fn ? `${g.fn} @ ` : ''}{g.source}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-secondary-500 mt-1">
                                      First: {new Date(g.firstSeen).toLocaleString()} · Last: {new Date(g.lastSeen).toLocaleString()}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-secondary-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                </button>

                                {/* Expanded detail for grouped */}
                                {isExpanded && (
                                  <div className="border-t border-secondary-800 p-4 space-y-3">
                                    {/* Sample request context */}
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="space-y-1">
                                        <p className="text-secondary-500 uppercase tracking-wide text-[10px] font-semibold">Sample Request</p>
                                        <p className="font-jetbrains text-secondary-300 break-all">{g.sample.path}</p>
                                        {g.sample.ip && <p className="text-secondary-500">IP: <span className="text-secondary-300 font-jetbrains">{g.sample.ip}</span></p>}
                                        {g.sample.tenantId && <p className="text-secondary-500">Tenant: <span className="text-secondary-300 font-jetbrains">{g.sample.tenantId}</span></p>}
                                        {g.sample.userId && <p className="text-secondary-500">User: <span className="text-secondary-300 font-jetbrains">{g.sample.userId}</span></p>}
                                        {g.sample.bodyKeys && g.sample.bodyKeys.length > 0 && (
                                          <p className="text-secondary-500">Body keys: <span className="text-secondary-300 font-jetbrains">{g.sample.bodyKeys.join(', ')}</span></p>
                                        )}
                                        {g.sample.userAgent && <p className="text-secondary-500 break-all">UA: <span className="text-secondary-400">{g.sample.userAgent.slice(0, 80)}{g.sample.userAgent.length > 80 ? '…' : ''}</span></p>}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-secondary-500 uppercase tracking-wide text-[10px] font-semibold">Source Location</p>
                                        {g.source ? (
                                          <>
                                            <p className="font-jetbrains text-rose-400 break-all">{g.source}</p>
                                            {g.fn && <p className="text-secondary-400">Function: <span className="font-jetbrains text-white">{g.fn}</span></p>}
                                          </>
                                        ) : (
                                          <p className="text-secondary-600 italic">No source frame (external or built-in error)</p>
                                        )}
                                      </div>
                                    </div>
                                    {/* Stack trace */}
                                    {g.sample.stack && (
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-secondary-500 uppercase tracking-wide text-[10px] font-semibold">Stack Trace (sample)</p>
                                          <button
                                            onClick={() => navigator.clipboard?.writeText(g.sample.stack ?? '')}
                                            className="text-[10px] text-secondary-500 hover:text-white px-2 py-0.5 rounded border border-secondary-700 hover:border-secondary-500 transition-colors"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <div className="rounded-lg bg-black/40 border border-secondary-800 overflow-x-auto max-h-64 overflow-y-auto">
                                          <pre className="p-3 text-[10px] font-jetbrains leading-relaxed">
                                            {g.sample.stack.split('\n').map((line, i) => {
                                              const isAppLine = line.includes('/src/') && !line.includes('node_modules');
                                              return (
                                                <span key={i} className={isAppLine ? 'text-rose-300' : 'text-secondary-500'}>
                                                  {line}{'\n'}
                                                </span>
                                              );
                                            })}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}

                  {/* INDIVIDUAL TICKET VIEW */}
                  {errorsView === 'individual' && errorsData !== null && !isLoadingErrors && (
                    errorsData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-secondary-500 gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        <p className="text-sm">No errors logged — system is clean.</p>
                      </div>
                    ) : (() => {
                      const q = errorsFilter.toLowerCase();
                      const filtered = errorsData.filter((e) =>
                        !q || e.error.toLowerCase().includes(q) || e.path.toLowerCase().includes(q) || (e.source ?? '').toLowerCase().includes(q) || (e.tenantId ?? '').toLowerCase().includes(q)
                      );
                      return (
                        <div className="space-y-3">
                          {filtered.length === 0 && <p className="text-secondary-500 text-xs text-center py-8">No results match your filter.</p>}
                          {filtered.map((err) => {
                            const isCritical = err.status >= 500;
                            const isExpanded = expandedErrorId === err.id;
                            return (
                              <div
                                key={err.id}
                                className={`rounded-xl border transition-all ${isCritical ? 'border-rose-800/60 bg-rose-950/10' : 'border-amber-800/40 bg-amber-950/10'} ${isExpanded ? 'shadow-lg' : 'hover:border-secondary-600'}`}
                              >
                                {/* Ticket header - always visible */}
                                <div className="p-4">
                                  <div className="flex items-start gap-3">
                                    {/* Severity + status */}
                                    <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                                      <span className={`text-[9px] font-black px-2 py-1 rounded-md tracking-widest ${isCritical ? 'bg-rose-900/70 text-rose-200' : 'bg-amber-900/60 text-amber-200'}`}>
                                        {isCritical ? 'CRITICAL' : 'ERROR'}
                                      </span>
                                      <span className={`text-[11px] font-bold font-jetbrains px-1.5 py-0.5 rounded ${isCritical ? 'bg-rose-900/40 text-rose-400' : 'bg-amber-900/40 text-amber-400'}`}>{err.status}</span>
                                      {err.count > 1 && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-jetbrains ${err.count >= 10 ? 'bg-rose-900/50 text-rose-300' : 'bg-amber-900/40 text-amber-300'}`}>{err.count}×</span>
                                      )}
                                    </div>

                                    {/* Main content */}
                                    <div className="flex-1 min-w-0 space-y-2">
                                      {/* Error message */}
                                      <p className={`text-sm font-semibold leading-snug ${isCritical ? 'text-rose-200' : 'text-amber-200'}`}>{err.error}</p>

                                      {/* Method + path */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-jetbrains ${err.method === 'GET' ? 'bg-blue-900/50 text-blue-300' : err.method === 'POST' ? 'bg-emerald-900/50 text-emerald-300' : err.method === 'DELETE' ? 'bg-rose-900/50 text-rose-300' : 'bg-secondary-800 text-secondary-300'}`}>{err.method}</span>
                                        <span className="font-jetbrains text-xs text-secondary-300 truncate max-w-xs" title={err.path}>{err.path}</span>
                                      </div>

                                      {/* Source location — the key detail */}
                                      {err.source && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[9px] text-secondary-500 uppercase tracking-widest font-bold">📍 Source</span>
                                          <span className="font-jetbrains text-[11px] text-rose-400">{err.fn ? `${err.fn} @ ` : ''}{err.source}</span>
                                        </div>
                                      )}

                                      {/* Context chips */}
                                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                        <span className="text-secondary-500 font-jetbrains">{new Date(err.ts).toLocaleString()}</span>
                                        {err.ip && <span className="px-1.5 py-0.5 rounded bg-secondary-800 text-secondary-400 font-jetbrains">{err.ip}</span>}
                                        {err.tenantId && <span className="px-1.5 py-0.5 rounded bg-secondary-800 text-secondary-400 font-jetbrains" title={err.tenantId}>T:{err.tenantId.slice(0, 8)}</span>}
                                        {err.userId && <span className="px-1.5 py-0.5 rounded bg-secondary-800 text-secondary-400 font-jetbrains" title={err.userId}>U:{err.userId.slice(0, 8)}</span>}
                                        {err.bodyKeys && err.bodyKeys.length > 0 && <span className="px-1.5 py-0.5 rounded bg-secondary-800 text-secondary-400">body: {err.bodyKeys.join(', ')}</span>}
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="shrink-0 flex flex-col gap-1.5">
                                      <button
                                        onClick={() => setSelectedTicket(err)}
                                        className="h-7 px-2.5 rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-[10px] font-medium text-secondary-200 transition-colors whitespace-nowrap"
                                      >
                                        Full Ticket
                                      </button>
                                      {err.stack && (
                                        <button
                                          onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                                          className="h-7 px-2.5 rounded-lg bg-secondary-900 hover:bg-secondary-800 border border-secondary-800 text-[10px] font-medium text-secondary-400 transition-colors whitespace-nowrap"
                                        >
                                          {isExpanded ? 'Hide stack' : 'Stack trace'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Inline stack trace (toggled) */}
                                {isExpanded && err.stack && (
                                  <div className="border-t border-secondary-800 px-4 pb-4 pt-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-secondary-500 uppercase tracking-widest text-[9px] font-bold">Stack Trace</p>
                                      <button
                                        onClick={() => navigator.clipboard?.writeText(err.stack ?? '')}
                                        className="text-[10px] text-secondary-500 hover:text-white px-2 py-0.5 rounded border border-secondary-700 hover:border-secondary-500 transition-colors"
                                      >Copy</button>
                                    </div>
                                    <div className="rounded-lg bg-black/50 border border-secondary-800 overflow-x-auto max-h-52 overflow-y-auto">
                                      <pre className="p-3 text-[10px] font-jetbrains leading-relaxed">
                                        {err.stack.split('\n').map((line, i) => {
                                          const isAppLine = line.includes('/src/') && !line.includes('node_modules');
                                          return (
                                            <span key={i} className={isAppLine ? 'text-rose-300 font-semibold' : 'text-secondary-600'}>
                                              {line}{'\n'}
                                            </span>
                                          );
                                        })}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab 7: Platform-wide Feedback */}
            {activeTab === "feedback" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold font-syne flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-amber-400" />
                    Tenant Feedback Inbox
                  </CardTitle>
                  <CardDescription className="text-secondary-400 text-xs">
                    All feedback submitted by users across every tenant workspace — read-only view.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={feedbackCategoryFilter}
                      onChange={(e) => setFeedbackCategoryFilter(e.target.value)}
                      className="h-9 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs px-2"
                    >
                      <option value="">All Categories</option>
                      <option value="GENERAL">General</option>
                      <option value="BUG">Bug</option>
                      <option value="FEATURE_REQUEST">Feature Request</option>
                    </select>
                    <select
                      value={feedbackStatusFilter}
                      onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                      className="h-9 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs px-2"
                    >
                      <option value="">All Statuses</option>
                      <option value="NEW">New</option>
                      <option value="REVIEWED">Reviewed</option>
                    </select>
                    <Input
                      value={feedbackTenantFilter}
                      onChange={(e) => setFeedbackTenantFilter(e.target.value)}
                      placeholder="Filter by Tenant ID…"
                      className="h-9 w-52 bg-secondary-950 border-secondary-700 text-white text-xs"
                    />
                    <button
                      onClick={fetchFeedback}
                      className="h-9 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 text-xs font-medium border border-secondary-700 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>

                  {isLoadingFeedback && (
                    <div className="flex items-center gap-2 text-secondary-400 text-sm py-4">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading feedback…
                    </div>
                  )}
                  {feedbackError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                      {feedbackError}
                    </div>
                  )}
                  {feedbackItems !== null && !isLoadingFeedback && (
                    feedbackItems.length === 0 ? (
                      <p className="text-sm text-secondary-500 py-4">No feedback found for the current filters.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-secondary-800">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-secondary-800">
                              <TableHead className="text-secondary-400 text-xs">Date</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Tenant</TableHead>
                              <TableHead className="text-secondary-400 text-xs">User</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Role</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Category</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Status</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Message</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {feedbackItems.map((item) => {
                              const isExpanded = expandedFeedbackId === item.id;
                              return (
                                <TableRow
                                  key={item.id}
                                  className="border-secondary-800 cursor-pointer hover:bg-secondary-800/40"
                                  onClick={() => setExpandedFeedbackId(isExpanded ? null : item.id)}
                                >
                                  <TableCell className="text-xs text-secondary-400 whitespace-nowrap">
                                    {new Date(item.createdAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-xs text-secondary-300">
                                    {item.tenant?.name ?? item.tenantId}
                                  </TableCell>
                                  <TableCell className="text-xs text-secondary-300">{item.userName}</TableCell>
                                  <TableCell className="text-xs text-secondary-400">{item.userRole}</TableCell>
                                  <TableCell>
                                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                                      item.category === "BUG"
                                        ? "bg-rose-950/60 text-rose-400 border border-rose-800"
                                        : item.category === "FEATURE_REQUEST"
                                          ? "bg-blue-950/60 text-blue-400 border border-blue-800"
                                          : "bg-secondary-800 text-secondary-400 border border-secondary-700"
                                    }`}>
                                      {item.category === "FEATURE_REQUEST" ? "Feature" : item.category === "BUG" ? "Bug" : "General"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                                      item.status === "REVIEWED"
                                        ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                                        : "bg-amber-950/60 text-amber-400 border border-amber-800"
                                    }`}>
                                      {item.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-secondary-300 max-w-xs">
                                    {isExpanded ? item.message : (
                                      item.message.length > 100 ? item.message.slice(0, 100) + "…" : item.message
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tab: Safety — Emergency Stop */}
            {activeTab === "safety" && (
              <EmergencyStopPanel passcode={passcode} />
            )}

            {/* Tab: Referral Partners */}
            {activeTab === "referral" && (
              <Card className="bg-secondary-900 border-secondary-800 text-white">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-extrabold font-syne flex items-center">
                        <HandCoins className="h-5 w-5 mr-2 text-amber-400" />
                        Referral Partner Management
                      </CardTitle>
                      <CardDescription className="text-secondary-400 text-xs mt-1">
                        Track referral partners, commission rates, and revenue attributed per code.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchReferralData}
                        className="h-8 px-3 rounded-lg bg-secondary-800 hover:bg-secondary-700 text-xs font-medium border border-secondary-700 transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" /> Refresh
                      </button>
                      <button
                        onClick={() => setShowNewPartnerForm((v) => !v)}
                        className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors"
                      >
                        + New Partner
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Summary stats */}
                  {referralStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: "Total Partners", value: referralStats.totalPartners },
                        { label: "Active", value: referralStats.activePartners },
                        { label: "Tenants Referred", value: referralStats.totalTenants },
                        { label: "Total MRR", value: `$${referralStats.totalMrr.toFixed(2)}` },
                        { label: "Commission Due", value: `$${referralStats.totalCommissionDue.toFixed(2)}` },
                      ].map((s) => (
                        <div key={s.label} className="bg-secondary-800 rounded-lg p-3 border border-secondary-700">
                          <p className="text-[10px] text-secondary-400 uppercase tracking-wide">{s.label}</p>
                          <p className="text-lg font-bold text-amber-400 mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New partner form */}
                  {showNewPartnerForm && (
                    <div className="bg-secondary-800 border border-secondary-700 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-semibold text-secondary-300">New Referral Partner</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-secondary-400 block mb-1">Partner Name</label>
                          <Input
                            value={newPartnerName}
                            onChange={(e) => setNewPartnerName(e.target.value)}
                            placeholder="Acme Agency"
                            className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-secondary-400 block mb-1">Referral Code</label>
                          <Input
                            value={newPartnerCode}
                            onChange={(e) => setNewPartnerCode(e.target.value.toUpperCase())}
                            placeholder="ACME2026"
                            className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white font-jetbrains"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-secondary-400 block mb-1">Commission Rate (%)</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={newPartnerRate}
                            onChange={(e) => setNewPartnerRate(e.target.value)}
                            placeholder="10"
                            className="h-8 text-xs bg-secondary-900 border-secondary-700 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-secondary-400 block mb-1">Contacts (optional)</label>
                          <textarea
                            value={newPartnerContacts}
                            onChange={(e) => setNewPartnerContacts(e.target.value)}
                            placeholder="email@partner.com, +1-555-0100"
                            rows={1}
                            className="w-full bg-secondary-900 border border-secondary-700 rounded px-3 py-1.5 text-xs text-white placeholder-secondary-500 resize-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleCreatePartner}
                          disabled={isSavingPartner || !newPartnerName.trim() || !newPartnerCode.trim() || !newPartnerRate}
                          className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                        >
                          {isSavingPartner ? "Saving…" : "Create Partner"}
                        </button>
                        <button
                          onClick={() => setShowNewPartnerForm(false)}
                          className="px-4 py-1.5 rounded bg-secondary-700 hover:bg-secondary-600 text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoadingReferral && (
                    <div className="flex items-center gap-2 text-secondary-400 text-sm py-4">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading referral data…
                    </div>
                  )}
                  {referralError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                      {referralError}
                    </div>
                  )}

                  {referralPartners !== null && !isLoadingReferral && (
                    referralPartners.length === 0 ? (
                      <p className="text-sm text-secondary-500 py-4">No referral partners yet. Create one above.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-secondary-800">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-secondary-800">
                              <TableHead className="text-secondary-400 text-xs">Code</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Partner Name</TableHead>
                              <TableHead className="text-secondary-400 text-xs text-right">Commission %</TableHead>
                              <TableHead className="text-secondary-400 text-xs text-right">Tenants</TableHead>
                              <TableHead className="text-secondary-400 text-xs text-right">MRR</TableHead>
                              <TableHead className="text-secondary-400 text-xs text-right">Due</TableHead>
                              <TableHead className="text-secondary-400 text-xs text-center">Active</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {referralPartners.map((p) => (
                              <TableRow key={p.id} className="border-secondary-800 hover:bg-secondary-800/40">
                                <TableCell className="font-jetbrains text-xs text-amber-400 font-semibold">{p.code}</TableCell>
                                <TableCell className="text-xs text-secondary-200">{p.name}</TableCell>
                                <TableCell className="text-xs text-secondary-300 text-right">{p.commissionRate}%</TableCell>
                                <TableCell className="text-xs text-secondary-300 text-right">{p.tenantCount}</TableCell>
                                <TableCell className="text-xs text-secondary-300 text-right">${p.totalMrr.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-emerald-400 text-right font-semibold">${p.commissionDue.toFixed(2)}</TableCell>
                                <TableCell className="text-center">
                                  <button
                                    onClick={() => handleTogglePartner(p.id, p.isActive)}
                                    disabled={togglingPartnerId === p.id}
                                    className={`text-[10px] font-bold rounded px-2 py-0.5 border transition-colors ${
                                      p.isActive
                                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-800 hover:bg-emerald-950"
                                        : "bg-secondary-800 text-secondary-500 border-secondary-700 hover:bg-secondary-700"
                                    } disabled:opacity-50`}
                                  >
                                    {togglingPartnerId === p.id ? "…" : p.isActive ? "Active" : "Inactive"}
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EmergencyStopPanel({ passcode }: { passcode: string }) {
  const [state, setState] = useState<{ active: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const adminBase = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/admin/emergency-stop`;
  const adminHeaders = { "x-admin-passcode": passcode, "Content-Type": "application/json" };

  async function adminFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, { ...init, headers: { ...adminHeaders, ...init?.headers } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }

  const fetchState = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch(adminBase);
      setState(body.data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch emergency stop state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchState(); }, []); // eslint-disable-line

  const activate = async () => {
    if (!reason.trim()) { setError("A reason is required."); return; }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const payload: Record<string, any> = { reason: reason.trim() };
      if (ttlSeconds) payload.ttlSeconds = Number(ttlSeconds);
      await adminFetch(adminBase, { method: "POST", body: JSON.stringify(payload) });
      setMsg("Emergency stop activated.");
      await fetchState();
    } catch (e: any) {
      setError(e?.message || "Failed to activate.");
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      await adminFetch(adminBase, { method: "DELETE" });
      setMsg("Emergency stop cleared. Operations resumed.");
      setReason("");
      setTtlSeconds("");
      await fetchState();
    } catch (e: any) {
      setError(e?.message || "Failed to clear.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-secondary-900 border-secondary-800 text-white">
      <CardHeader>
        <CardTitle className="text-xl font-extrabold font-syne flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          Emergency Stop
        </CardTitle>
        <CardDescription className="text-secondary-400 text-xs">
          Halt all financial movement (invoice creation, payments, journal posting, POS sales) instantly.
          This does not affect read operations or authentication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && !state && <p className="text-secondary-400 text-sm">Loading…</p>}

        {state && (
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${state.active ? "border-red-600 bg-red-950/40" : "border-green-700 bg-green-950/30"}`}>
            <span className={`inline-block h-3 w-3 rounded-full ${state.active ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
            <div>
              <p className={`font-semibold ${state.active ? "text-red-400" : "text-green-400"}`}>
                {state.active ? "EMERGENCY STOP ACTIVE" : "System Running Normally"}
              </p>
              {state.active && state.reason && (
                <p className="text-xs text-red-300 mt-0.5">{state.reason}</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {msg && <p className="text-green-400 text-sm">{msg}</p>}

        {!state?.active ? (
          <div className="space-y-3">
            <p className="text-secondary-300 text-sm font-medium">Activate Emergency Stop</p>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Reason (required)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Suspected fraud — pausing all transactions pending investigation"
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-2 text-sm text-white placeholder-secondary-500 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Auto-expire after (seconds, optional)</label>
              <input
                type="number"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(e.target.value)}
                placeholder="Leave blank to keep until manually cleared"
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-2 text-sm text-white placeholder-secondary-500"
              />
            </div>
            <button
              onClick={activate}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              Activate Emergency Stop
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={clear}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
            >
              Clear Emergency Stop — Resume Operations
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
