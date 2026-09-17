import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Radio,
  Activity,
  Database,
  History,
  CheckCircle2,
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
  HeartPulse,
  TrendingDown,
  ClipboardList,
  TrendingUp,
  DollarSign,
  UserPlus,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { api } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { BroadcastConsolePanel } from "./BroadcastConsolePanel";

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
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Two-step auth: 'passcode' → 'totp' → unlocked
  const [authStep, setAuthStep] = useState<'passcode' | 'totp'>('passcode');
  const [totpCode, setTotpCode] = useState('');
  const [showSetupQr, setShowSetupQr] = useState(false);
  const [setupQrData, setSetupQrData] = useState<{ qrDataUrl: string; secret: string; configured: boolean; note: string } | null>(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);

  // Active Hub Tab
  const [activeTab, setActiveTab] = useState<"broadcast" | "health" | "performance" | "jobs" | "integrations" | "schemas" | "audit" | "onboard" | "feedback" | "analytics" | "errors" | "safety" | "referral" | "clienthealth" | "churnrisk" | "onboarding" | "revenue" | "debuglogs" | "team">("broadcast");

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
    const headers = adminHeaders;
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
  }, [passcode, sessionToken]);

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
      .get("/admin/jobs", { headers: adminHeaders })
      .then((res) => setJobsData(res.data.data.jobs))
      .catch(() => setJobsError("Failed to load cron jobs."))
      .finally(() => setIsLoadingJobs(false));
  }, [passcode, sessionToken]);

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
      await api.post(`/admin/jobs/${encodeURIComponent(jobName)}/trigger`, {}, { headers: adminHeaders });
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
      api.get("/admin/error-logs", { headers: adminHeaders }),
      api.get("/admin/error-logs/grouped", { headers: adminHeaders }),
    ])
      .then(([indRes, grpRes]) => {
        setErrorsData(indRes.data.data.errors);
        setErrorsGrouped(grpRes.data.data.groups);
      })
      .catch(() => setErrorsError("Failed to load error logs."))
      .finally(() => setIsLoadingErrors(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "errors") return;
    fetchErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);


  const handleClearErrors = async () => {
    setIsClearingErrors(true);
    try {
      await api.delete("/admin/error-logs", { headers: adminHeaders });
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
      await api.patch(`/admin/users/${userId}/${activate ? "activate" : "deactivate"}`, {}, { headers: adminHeaders });
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

  // Broadcast state is now managed inside BroadcastConsolePanel

  // Onboard Contracted Client state
  const [onboardCompanyName, setOnboardCompanyName] = useState("");
  const [onboardSlug, setOnboardSlug] = useState("");
  const [onboardAdminName, setOnboardAdminName] = useState("");
  const [onboardAdminEmail, setOnboardAdminEmail] = useState("");
  const [onboardAdminPhone, setOnboardAdminPhone] = useState("");
  const [onboardAdminPassword, setOnboardAdminPassword] = useState("");
  const [onboardBaseCurrency, setOnboardBaseCurrency] = useState("GHS");
  const [onboardOrgType, setOnboardOrgType] = useState("BUSINESS");
  const [onboardTier, setOnboardTier] = useState(3);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardResult, setOnboardResult] = useState<{ tenant: { name: string; slug: string }; admin: { email: string } } | null>(null);

  // Derived admin request headers — prefer session token; fall back to raw passcode
  const adminHeaders: Record<string, string> = sessionToken
    ? { 'x-admin-session': sessionToken }
    : { 'x-admin-passcode': passcode };

  // Auto-check if already unlocked in session
  useEffect(() => {
    const savedSession = sessionStorage.getItem("accountgo_admin_engine_session");
    if (savedSession) {
      setSessionToken(savedSession);
      setIsUnlocked(true);
      return;
    }
    // Backward-compat: upgrade old passcode-only sessions on first load
    const savedPasscode = sessionStorage.getItem("accountgo_admin_engine_passcode");
    if (savedPasscode) {
      setPasscode(savedPasscode);
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
      .get("/admin/integrations", { headers: adminHeaders })
      .then((res) => setIntegrationsData(res.data.data))
      .catch(() => setIntegrationsError("Failed to load integrations status."))
      .finally(() => setIsLoadingIntegrations(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, passcode, sessionToken]);

  // Fetch the real platform-wide tenant roster for the "Tenant Schemas & Tiers"
  // tab once unlocked, using the same master passcode already used to unlock
  // this console (GET /api/v1/tenants is passcode-gated, not tenant-JWT-scoped).
  const fetchTenants = useCallback(() => {
    setIsLoadingTenants(true);
    setTenantsError(null);
    return api
      .get("/tenants", { headers: adminHeaders })
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
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchTenants();
    // fetchTenants intentionally omitted - it's recreated per passcode/sessionToken change,
    // which already re-runs this effect via those dependencies below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, passcode, sessionToken]);

  const handleSaveTier = async (tenantId: string) => {
    const tier = tierDrafts[tenantId];
    setSavingTierId(tenantId);
    try {
      const res = await api.put(`/tenants/${tenantId}/tier`, { tier }, { headers: adminHeaders });
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
      await api.delete(`/tenants/${deletingTenant.id}`, { headers: adminHeaders });
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
      .get("/admin/audit-logs/meta/values", { headers: adminHeaders })
      .then((res) => {
        if (res.data.success) {
          setAuditActionOptions(res.data.data.actions || []);
          setAuditEntityOptions(res.data.data.entities || []);
        }
      })
      .catch(() => { /* autocomplete is a nice-to-have, fail silently */ });
  }, [isUnlocked, passcode, sessionToken]);

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
    const headers = adminHeaders;
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
  }, [passcode, sessionToken]);

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
      }, { headers: adminHeaders });
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
      await api.patch(`/admin/referrals/partners/${id}`, { isActive: !isActive }, { headers: adminHeaders });
      setReferralPartners((prev) => prev?.map((p) => p.id === id ? { ...p, isActive: !isActive } : p) ?? null);
    } catch {
      setReferralError("Failed to update partner.");
    } finally {
      setTogglingPartnerId(null);
    }
  };

  // Client Health Dashboard state
  const [clientHealthData, setClientHealthData] = useState<{
    summary: {
      totalTenants: number;
      activeTenants: number;
      trialTenants: number;
      expiredTenants: number;
      dormantTenants: number;
      highRiskTenants: number;
      mediumRiskTenants: number;
      trialsExpiringIn7Days: number;
    };
    tenants: {
      id: string;
      name: string;
      slug: string;
      tier: number;
      subscriptionStatus: string;
      trialEndsAt: string | null;
      subscriptionPaidUntil: string | null;
      createdAt: string;
      isLive: boolean;
      userCount: number;
      lastActivityAt: string | null;
      daysSinceActivity: number | null;
      trialDaysLeft: number | null;
      paidDaysLeft: number | null;
      churnRisk: 'high' | 'medium' | 'low' | 'none';
    }[];
  } | null>(null);
  const [clientHealthError, setClientHealthError] = useState<string | null>(null);
  const [isLoadingClientHealth, setIsLoadingClientHealth] = useState(false);
  const [clientHealthSort, setClientHealthSort] = useState<'risk' | 'dormant' | 'recent'>('risk');
  const [clientHealthFilter, setClientHealthFilter] = useState<'all' | 'high' | 'medium' | 'trial' | 'active' | 'expired'>('all');

  const fetchClientHealth = useCallback(() => {
    setIsLoadingClientHealth(true);
    setClientHealthError(null);
    return api
      .get("/admin/client-health", { headers: adminHeaders })
      .then((res) => setClientHealthData(res.data.data))
      .catch(() => setClientHealthError("Failed to load client health data."))
      .finally(() => setIsLoadingClientHealth(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "clienthealth") return;
    fetchClientHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  // Churn Risk Tracker state
  const [churnData, setChurnData] = useState<{
    summary: {
      total: number;
      expired: number;
      trialCritical: number;
      trialSoon: number;
      trialWatch: number;
      renewalSoon: number;
      dormant: number;
      notEmbedded: number;
    };
    tenants: {
      id: string;
      name: string;
      slug: string;
      tier: number;
      subscriptionStatus: string;
      trialEndsAt: string | null;
      subscriptionPaidUntil: string | null;
      createdAt: string;
      isLive: boolean;
      userCount: number;
      lastActivityAt: string | null;
      daysSinceActivity: number | null;
      trialDaysLeft: number | null;
      paidDaysLeft: number | null;
      adoptionScore: number;
      adoptionDetail: { invoicing: boolean; bookkeeping: boolean; inventory: boolean; sales: boolean; banking: boolean };
      bucket: 'expired' | 'trial_critical' | 'trial_soon' | 'trial_watch' | 'renewal_soon' | 'dormant';
    }[];
  } | null>(null);
  const [churnError, setChurnError] = useState<string | null>(null);
  const [isLoadingChurn, setIsLoadingChurn] = useState(false);

  const fetchChurnRisk = useCallback(() => {
    setIsLoadingChurn(true);
    setChurnError(null);
    return api
      .get("/admin/churn-risk", { headers: adminHeaders })
      .then((res) => setChurnData(res.data.data))
      .catch(() => setChurnError("Failed to load churn risk data."))
      .finally(() => setIsLoadingChurn(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "churnrisk") return;
    fetchChurnRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  // Onboarding Completion Tracker state
  const [onboardingData, setOnboardingData] = useState<{
    summary: {
      total: number;
      fullyOnboarded: number;
      halfOrMore: number;
      barelyStarted: number;
      stuck: number;
      avgCompletionPct: number;
    };
    totalSteps: number;
    tenants: {
      id: string;
      name: string;
      slug: string;
      tier: number;
      subscriptionStatus: string;
      isLive: boolean;
      createdAt: string;
      userCount: number;
      daysSinceSignup: number;
      completionScore: number;
      completionPct: number;
      isStuck: boolean;
      milestoneDetail: {
        teamMemberAdded: boolean;
        firstJournalPosted: boolean;
        firstInvoiceSent: boolean;
        firstSaleRecorded: boolean;
        firstInventoryItem: boolean;
        bankConnected: boolean;
        firstReconciliation: boolean;
      };
    }[];
  } | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'stuck' | 'complete' | 'started' | 'bare'>('all');

  const fetchOnboarding = useCallback(() => {
    setIsLoadingOnboarding(true);
    setOnboardingError(null);
    return api
      .get("/admin/onboarding", { headers: adminHeaders })
      .then((res) => setOnboardingData(res.data.data))
      .catch(() => setOnboardingError("Failed to load onboarding data."))
      .finally(() => setIsLoadingOnboarding(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "onboarding") return;
    fetchOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  // Revenue & MRR Dashboard state
  const [revenueData, setRevenueData] = useState<{
    summary: {
      totalTenants: number;
      activePaid: number;
      trial: number;
      expired: number;
      mrr: number;
      arr: number;
      trialPipelineValue: number;
      revenueAtRisk: number;
      renewalsDueIn30Days: number;
      avgRevenuePerTenant: number;
      trialConversionRate: number;
    };
    tierBreakdown: { tier: number; name: string; priceGhs: number; activeCount: number; tierMrr: number }[];
    renewalsDue: {
      id: string; name: string; slug: string; tier: number; tierName: string; priceGhs: number;
      subscriptionStatus: string; subscriptionPaidUntil: string | null; renewalDaysLeft: number | null;
    }[];
    monthlyActivations: { month: string; count: number; mrr: number }[];
    allTenants: {
      id: string; name: string; slug: string; tier: number; tierName: string; priceGhs: number;
      subscriptionStatus: string; trialEndsAt: string | null; subscriptionPaidUntil: string | null;
      createdAt: string; isLive: boolean; trialDaysLeft: number | null;
      renewalDaysLeft: number | null; isRevenueAtRisk: boolean;
    }[];
  } | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
  const [revenueView, setRevenueView] = useState<'overview' | 'renewals' | 'all'>('overview');

  const fetchRevenue = useCallback(() => {
    setIsLoadingRevenue(true);
    setRevenueError(null);
    return api
      .get("/admin/revenue", { headers: adminHeaders })
      .then((res) => setRevenueData(res.data.data))
      .catch(() => setRevenueError("Failed to load revenue data."))
      .finally(() => setIsLoadingRevenue(false));
  }, [passcode, sessionToken]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "revenue") return;
    fetchRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeTab]);

  // ── Debug Logs ────────────────────────────────────────────────────────────────
  interface DebugLogEntry {
    id: string;
    ts: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    level: 'ok' | 'warn' | 'error';
    tenantId?: string;
    userId?: string;
    userEmail?: string;
    ip?: string;
    errorMessage?: string;
    errorSource?: string;
    bodyKeys?: string[];
  }
  interface DebugStats { total: number; ok: number; warn: number; error: number }

  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [debugTotal, setDebugTotal] = useState(0);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugLevelFilter, setDebugLevelFilter] = useState<'' | 'ok' | 'warn' | 'error'>('');
  const [debugSearch, setDebugSearch] = useState('');
  const [debugOffset, setDebugOffset] = useState(0);
  const DEBUG_PAGE = 50;

  const fetchDebugLogs = useCallback(() => {
    setIsLoadingDebug(true);
    setDebugError(null);
    const params = new URLSearchParams({ limit: String(DEBUG_PAGE), offset: String(debugOffset) });
    if (debugLevelFilter) params.set('level', debugLevelFilter);
    if (debugSearch.trim()) params.set('search', debugSearch.trim());
    return api
      .get(`/admin/debug/logs?${params}`, { headers: adminHeaders })
      .then((res) => {
        setDebugLogs(res.data.data.entries);
        setDebugTotal(res.data.data.total);
        setDebugStats(res.data.data.stats);
      })
      .catch(() => setDebugError("Failed to load debug logs."))
      .finally(() => setIsLoadingDebug(false));
  }, [passcode, sessionToken, debugLevelFilter, debugSearch, debugOffset]);

  useEffect(() => {
    if (!isUnlocked || activeTab !== "debuglogs") return;
    fetchDebugLogs();
  }, [isUnlocked, activeTab, debugLevelFilter, debugSearch, debugOffset]);

  const clearDebugLogs = async () => {
    await api.delete("/admin/debug/logs", { headers: adminHeaders });
    setDebugLogs([]);
    setDebugTotal(0);
    setDebugStats(null);
  };

  // Step 1: verify the master passcode; advance to TOTP step on success.
  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError(null);

    try {
      await api.post("/admin/broadcast/verify-passcode", {}, { headers: { 'x-admin-passcode': passcode } });
      setAuthStep('totp');
      setTotpCode('');
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Invalid master passcode. Access denied.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: verify the TOTP code and exchange for a session token.
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await api.post("/admin/totp/verify", { totpCode }, { headers: { 'x-admin-passcode': passcode } });
      const token: string = res.data.data.sessionToken;
      setSessionToken(token);
      setIsUnlocked(true);
      sessionStorage.setItem("accountgo_admin_engine_session", token);
      sessionStorage.removeItem("accountgo_admin_engine_passcode");
    } catch (err: any) {
      // 503 = TOTP not yet configured on this server → fall back to passcode-only
      if (err.response?.status === 503) {
        setIsUnlocked(true);
        sessionStorage.setItem("accountgo_admin_engine_passcode", passcode);
      } else {
        setAuthError(err.response?.data?.error || "Invalid authenticator code. Codes expire every 30 seconds — try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Fetch QR code setup data (requires passcode; shown on the TOTP step).
  const handleShowSetup = async () => {
    setIsLoadingSetup(true);
    setShowSetupQr(true);
    setSetupQrData(null);
    try {
      const res = await api.get("/admin/totp/setup", { headers: { 'x-admin-passcode': passcode } });
      setSetupQrData(res.data.data);
    } catch {
      setAuthError("Failed to load authenticator setup. Check your passcode and try again.");
      setShowSetupQr(false);
    } finally {
      setIsLoadingSetup(false);
    }
  };

  // Deliberately plain, low-hype subject/message copy - emoji and
  // exclamation-heavy "announcement" language reads as promotional/spam to

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
        tier: onboardTier,
      }, { headers: adminHeaders });
      if (res.data.success) {
        setOnboardResult(res.data.data);
        setOnboardCompanyName("");
        setOnboardSlug("");
        setOnboardAdminName("");
        setOnboardAdminEmail("");
        setOnboardAdminPhone("");
        setOnboardAdminPassword("");
        setOnboardOrgType("BUSINESS");
        setOnboardTier(3);
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
                  sessionStorage.removeItem("accountgo_admin_engine_session");
                  sessionStorage.removeItem("accountgo_admin_engine_passcode");
                  setSessionToken(null);
                  setPasscode('');
                  setAuthStep('passcode');
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
                {authStep === 'passcode' ? (
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
                      Continue
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-secondary-300">Authenticator Code</span>
                      <button
                        type="button"
                        onClick={() => { setAuthStep('passcode'); setAuthError(null); setShowSetupQr(false); setSetupQrData(null); }}
                        className="text-xs text-secondary-500 hover:text-amber-400 transition-colors"
                      >
                        ← Back
                      </button>
                    </div>

                    {!showSetupQr ? (
                      <form onSubmit={handleVerifyTotp} className="space-y-4">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit code from authenticator"
                          required
                          autoFocus
                          className="bg-secondary-950 border-secondary-700 text-white text-center tracking-[0.4em] font-jetbrains text-xl"
                        />

                        {authError && (
                          <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900">
                            {authError}
                          </div>
                        )}

                        <Button
                          type="submit"
                          variant="primary"
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 font-bold"
                          disabled={isVerifying || totpCode.length !== 6}
                        >
                          {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Verify &amp; Unlock
                        </Button>

                        <button
                          type="button"
                          onClick={handleShowSetup}
                          disabled={isLoadingSetup}
                          className="w-full text-xs text-secondary-500 hover:text-amber-400 transition-colors pt-1"
                        >
                          {isLoadingSetup ? 'Loading...' : 'Set up authenticator app →'}
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        {setupQrData ? (
                          <>
                            <p className="text-xs text-secondary-400 text-left">{setupQrData.note}</p>
                            <div className="flex justify-center">
                              <img src={setupQrData.qrDataUrl} alt="TOTP QR Code" className="w-44 h-44 rounded-lg bg-white p-1" />
                            </div>
                            <div className="bg-secondary-950 border border-secondary-700 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-secondary-500 mb-1 text-left">Manual entry key</p>
                              <p className="font-jetbrains text-xs text-amber-400 break-all text-center select-all">{setupQrData.secret}</p>
                            </div>
                            <p className="text-[10px] text-secondary-500 text-left">
                              Scan with Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code above.
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowSetupQr(false)}
                              className="w-full text-xs text-amber-400 hover:text-amber-300 transition-colors font-semibold"
                            >
                              Done — enter my code
                            </button>
                          </>
                        ) : (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
            <div className="flex border-b border-secondary-800 gap-6 text-sm font-semibold overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-px">
              <button
                onClick={() => setActiveTab("broadcast")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "broadcast" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Radio className="h-4 w-4" />
                <span>System Broadcast Engine</span>
              </button>
              <button
                onClick={() => setActiveTab("health")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "health" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Engine Diagnostics</span>
              </button>
              <button
                onClick={() => setActiveTab("integrations")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "integrations" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Plug className="h-4 w-4" />
                <span>Integrations</span>
              </button>
              <button
                onClick={() => setActiveTab("schemas")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "schemas" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Tenant Schemas & Tiers</span>
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "audit" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <History className="h-4 w-4" />
                <span>System Audit Logs</span>
              </button>
              <button
                onClick={() => setActiveTab("onboard")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "onboard" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Onboard Client</span>
              </button>
              <button
                onClick={() => setActiveTab("feedback")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "feedback" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Feedback</span>
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "analytics" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => setActiveTab("performance")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "performance" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Performance</span>
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "jobs" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Cron Jobs</span>
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
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
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "safety" ? "border-red-500 text-red-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Safety</span>
              </button>
              <button
                onClick={() => setActiveTab("referral")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "referral" ? "border-amber-400 text-amber-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <HandCoins className="h-4 w-4" />
                <span>Referrals</span>
              </button>
              <button
                onClick={() => setActiveTab("clienthealth")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "clienthealth" ? "border-emerald-400 text-emerald-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <HeartPulse className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Client Health
                  {clientHealthData && clientHealthData.summary.highRiskTenants > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                      {clientHealthData.summary.highRiskTenants}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("churnrisk")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "churnrisk" ? "border-rose-400 text-rose-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Churn Risk
                  {churnData && (churnData.summary.trialCritical + churnData.summary.expired) > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                      {churnData.summary.trialCritical + churnData.summary.expired}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("onboarding")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "onboarding" ? "border-violet-400 text-violet-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Onboarding
                  {onboardingData && onboardingData.summary.stuck > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
                      {onboardingData.summary.stuck}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("revenue")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "revenue" ? "border-cyan-400 text-cyan-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Revenue
                  {revenueData && revenueData.summary.revenueAtRisk > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-amber-600 text-white text-[10px] font-bold leading-none">
                      !
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("debuglogs")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "debuglogs" ? "border-violet-400 text-violet-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span className="flex items-center gap-1.5">
                  Debug Logs
                  {debugStats && debugStats.error > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                      {debugStats.error}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("team")}
                className={`pb-3 flex items-center space-x-2 shrink-0 border-b-2 transition-colors ${
                  activeTab === "team" ? "border-emerald-400 text-emerald-400" : "border-transparent text-secondary-400 hover:text-white"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Team</span>
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
                  <BroadcastConsolePanel adminHeaders={adminHeaders} />
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
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-secondary-300">Plan Tier</label>
                        <select
                          value={onboardTier}
                          onChange={(e) => setOnboardTier(Number(e.target.value))}
                          className="w-full h-10 px-3 rounded-lg border border-secondary-700 bg-secondary-950 text-white text-xs"
                        >
                          <option value={1}>1 — Shop (basic)</option>
                          <option value={2}>2 — Business</option>
                          <option value={3}>3 — Enterprise</option>
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
              <EmergencyStopPanel passcode={passcode} sessionToken={sessionToken} />
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
                        { label: "Total MRR", value: `GH₵${referralStats.totalMrr.toFixed(2)}` },
                        { label: "Commission Due", value: `GH₵${referralStats.totalCommissionDue.toFixed(2)}` },
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
                                <TableCell className="text-xs text-secondary-300 text-right">GH₵{p.totalMrr.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-emerald-400 text-right font-semibold">GH₵{p.commissionDue.toFixed(2)}</TableCell>
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
            {/* Tab: Churn Risk Tracker */}
            {activeTab === "churnrisk" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                      <TrendingDown className="h-5 w-5 text-rose-400" />
                      Churn Risk Tracker
                    </h2>
                    <p className="text-secondary-400 text-xs mt-0.5">
                      At-risk tenants sorted by urgency + feature adoption — who to call and what to say.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchChurnRisk}
                    disabled={isLoadingChurn}
                    className="border-secondary-700 text-secondary-300 hover:text-white gap-2"
                  >
                    {isLoadingChurn ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>

                {churnError && (
                  <div className="rounded-lg border border-rose-800 bg-rose-950/30 p-4 text-rose-400 text-sm">{churnError}</div>
                )}

                {isLoadingChurn && !churnData && (
                  <div className="flex items-center gap-3 text-secondary-400 text-sm py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analysing churn risk signals…
                  </div>
                )}

                {churnData && (
                  <>
                    {/* Summary strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total at risk", value: churnData.summary.total, color: "text-white" },
                        { label: "Trial ≤3 days", value: churnData.summary.trialCritical, color: "text-rose-400" },
                        { label: "Expired", value: churnData.summary.expired, color: "text-rose-400" },
                        { label: "Not yet embedded", value: churnData.summary.notEmbedded, color: "text-amber-400", note: "score 0–1 features" },
                      ].map((s) => (
                        <Card key={s.label} className="bg-secondary-900 border-secondary-800">
                          <CardContent className="p-4">
                            <p className="text-secondary-400 text-xs">{s.label}</p>
                            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
                            {s.note && <p className="text-secondary-600 text-[10px] mt-0.5">{s.note}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {churnData.tenants.length === 0 ? (
                      <Card className="bg-secondary-900 border-secondary-800">
                        <CardContent className="py-12 text-center text-secondary-500 text-sm">
                          No at-risk tenants right now.
                        </CardContent>
                      </Card>
                    ) : (
                      (() => {
                        const BUCKETS: { key: typeof churnData.tenants[0]['bucket']; label: string; urgency: string; color: string }[] = [
                          { key: 'expired',        label: 'Expired — already churned',         urgency: 'Re-engage now',         color: 'border-rose-800 bg-rose-950/20' },
                          { key: 'trial_critical', label: 'Trial ends in ≤3 days',             urgency: 'Call today',            color: 'border-rose-800 bg-rose-950/20' },
                          { key: 'trial_soon',     label: 'Trial ends in 4–7 days',            urgency: 'Reach out this week',   color: 'border-amber-800 bg-amber-950/20' },
                          { key: 'renewal_soon',   label: 'Renewal due in ≤14 days',           urgency: 'Confirm renewal',       color: 'border-amber-800 bg-amber-950/20' },
                          { key: 'dormant',        label: 'Dormant 14+ days',                  urgency: 'Check-in needed',       color: 'border-secondary-700 bg-secondary-900' },
                          { key: 'trial_watch',    label: 'Trial ends in 8–30 days',           urgency: 'Monitor closely',       color: 'border-secondary-700 bg-secondary-900' },
                        ];

                        const FEATURES: { key: keyof typeof churnData.tenants[0]['adoptionDetail']; label: string }[] = [
                          { key: 'invoicing',    label: 'Invoicing' },
                          { key: 'bookkeeping',  label: 'Books' },
                          { key: 'inventory',    label: 'Inventory' },
                          { key: 'sales',        label: 'Sales' },
                          { key: 'banking',      label: 'Banking' },
                        ];

                        return (
                          <div className="space-y-5">
                            {BUCKETS.map(({ key, label, urgency, color }) => {
                              const rows = churnData.tenants.filter((t) => t.bucket === key);
                              if (rows.length === 0) return null;
                              return (
                                <div key={key} className={`rounded-xl border ${color} overflow-hidden`}>
                                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                      <span className="text-white text-sm font-bold">{label}</span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-800 text-secondary-300">{rows.length}</span>
                                    </div>
                                    <span className="text-xs text-secondary-400 italic">{urgency}</span>
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="text-secondary-400 text-xs pl-5">Client</TableHead>
                                        <TableHead className="text-secondary-400 text-xs">Tier</TableHead>
                                        <TableHead className="text-secondary-400 text-xs">Deadline</TableHead>
                                        <TableHead className="text-secondary-400 text-xs">Last active</TableHead>
                                        <TableHead className="text-secondary-400 text-xs">Score</TableHead>
                                        {FEATURES.map((f) => (
                                          <TableHead key={f.key} className="text-secondary-400 text-xs text-center">{f.label}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {rows.map((t) => {
                                        const tierLabel = t.tier === 1 ? "Shop" : t.tier === 2 ? "Business" : t.tier === 3 ? "Enterprise" : `T${t.tier}`;
                                        const deadlineLabel = (() => {
                                          if (t.bucket === 'expired') return <span className="text-rose-400 text-xs font-bold">EXPIRED</span>;
                                          if (t.bucket === 'trial_critical' || t.bucket === 'trial_soon' || t.bucket === 'trial_watch') {
                                            if (t.trialDaysLeft !== null && t.trialDaysLeft <= 0) return <span className="text-rose-400 text-xs font-bold">TODAY</span>;
                                            return <span className={`text-xs ${(t.trialDaysLeft ?? 99) <= 3 ? 'text-rose-300 font-semibold' : (t.trialDaysLeft ?? 99) <= 7 ? 'text-amber-300' : 'text-secondary-300'}`}>Trial ends in {t.trialDaysLeft}d</span>;
                                          }
                                          if (t.bucket === 'renewal_soon') return <span className={`text-xs ${(t.paidDaysLeft ?? 99) <= 7 ? 'text-amber-300 font-semibold' : 'text-secondary-300'}`}>Renewal in {t.paidDaysLeft}d</span>;
                                          return <span className="text-secondary-500 text-xs">—</span>;
                                        })();
                                        const activityLabel = t.daysSinceActivity === null
                                          ? <span className="text-secondary-600 text-xs italic">never</span>
                                          : t.daysSinceActivity === 0
                                          ? <span className="text-emerald-400 text-xs">today</span>
                                          : <span className={`text-xs ${t.daysSinceActivity >= 14 ? 'text-rose-400 font-semibold' : t.daysSinceActivity >= 7 ? 'text-amber-300' : 'text-secondary-300'}`}>{t.daysSinceActivity}d ago</span>;
                                        const scoreColor = t.adoptionScore === 0 ? 'text-rose-400' : t.adoptionScore <= 2 ? 'text-amber-400' : t.adoptionScore <= 3 ? 'text-secondary-200' : 'text-emerald-400';

                                        return (
                                          <TableRow key={t.id} className="border-white/5 hover:bg-white/5">
                                            <TableCell className="pl-5">
                                              <div>
                                                <p className="text-white text-sm font-semibold">{t.name}</p>
                                                <p className="text-secondary-500 text-[10px]">{t.slug}</p>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-secondary-400 text-xs">{tierLabel}</TableCell>
                                            <TableCell>{deadlineLabel}</TableCell>
                                            <TableCell>{activityLabel}</TableCell>
                                            <TableCell>
                                              <span className={`text-sm font-bold ${scoreColor}`}>{t.adoptionScore}<span className="text-secondary-600 text-xs">/5</span></span>
                                            </TableCell>
                                            {FEATURES.map((f) => (
                                              <TableCell key={f.key} className="text-center">
                                                {t.adoptionDetail[f.key]
                                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                                                  : <XCircle className="h-3.5 w-3.5 text-secondary-700 mx-auto" />}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}

                    {/* Adoption legend */}
                    <div className="flex flex-wrap gap-4 text-xs text-secondary-500 pt-2 border-t border-secondary-800">
                      <span className="font-semibold text-secondary-300">Feature adoption legend:</span>
                      <span><span className="text-emerald-400">●</span> Used at least once in audit log</span>
                      <span><span className="text-secondary-600">●</span> No audit record (never used or pre-audit)</span>
                      <span>Score 0-1 = not yet embedded, at very high churn risk regardless of trial status</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: Client Health Dashboard */}
            {activeTab === "clienthealth" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                      <HeartPulse className="h-5 w-5 text-emerald-400" />
                      Client Health Dashboard
                    </h2>
                    <p className="text-secondary-400 text-xs mt-0.5">
                      Real-time tenant activity, subscription health, and churn risk — last activity derived from audit logs.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchClientHealth}
                    disabled={isLoadingClientHealth}
                    className="border-secondary-700 text-secondary-300 hover:text-white gap-2"
                  >
                    {isLoadingClientHealth ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>

                {clientHealthError && (
                  <div className="rounded-lg border border-rose-800 bg-rose-950/30 p-4 text-rose-400 text-sm">{clientHealthError}</div>
                )}

                {isLoadingClientHealth && !clientHealthData && (
                  <div className="flex items-center gap-3 text-secondary-400 text-sm py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading client health data…
                  </div>
                )}

                {clientHealthData && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Clients", value: clientHealthData.summary.totalTenants, color: "text-white" },
                        { label: "Active Paid", value: clientHealthData.summary.activeTenants, color: "text-emerald-400" },
                        { label: "On Trial", value: clientHealthData.summary.trialTenants, color: "text-amber-400" },
                        { label: "Expired", value: clientHealthData.summary.expiredTenants, color: "text-rose-400" },
                      ].map((stat) => (
                        <Card key={stat.label} className="bg-secondary-900 border-secondary-800">
                          <CardContent className="p-4">
                            <p className="text-secondary-400 text-xs">{stat.label}</p>
                            <p className={`text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Churn Risk Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Card className="bg-rose-950/20 border-rose-900">
                        <CardContent className="p-4 flex items-center gap-3">
                          <TrendingDown className="h-8 w-8 text-rose-400 shrink-0" />
                          <div>
                            <p className="text-rose-300 text-xs font-semibold">HIGH RISK</p>
                            <p className="text-3xl font-black text-rose-400">{clientHealthData.summary.highRiskTenants}</p>
                            <p className="text-rose-500 text-[10px]">dormant 14d+ or expired</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-amber-950/20 border-amber-900">
                        <CardContent className="p-4 flex items-center gap-3">
                          <AlertTriangle className="h-8 w-8 text-amber-400 shrink-0" />
                          <div>
                            <p className="text-amber-300 text-xs font-semibold">MEDIUM RISK</p>
                            <p className="text-3xl font-black text-amber-400">{clientHealthData.summary.mediumRiskTenants}</p>
                            <p className="text-amber-600 text-[10px]">dormant 7-13d or expiring soon</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary-900 border-secondary-800">
                        <CardContent className="p-4 flex items-center gap-3">
                          <Clock className="h-8 w-8 text-amber-400 shrink-0" />
                          <div>
                            <p className="text-secondary-300 text-xs font-semibold">TRIALS EXPIRING ≤7 DAYS</p>
                            <p className="text-3xl font-black text-amber-400">{clientHealthData.summary.trialsExpiringIn7Days}</p>
                            <p className="text-secondary-500 text-[10px]">need conversion outreach now</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Filters & Sort */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-secondary-400 text-xs font-semibold">FILTER:</span>
                      {(["all", "high", "medium", "trial", "active", "expired"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setClientHealthFilter(f)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            clientHealthFilter === f
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-secondary-700 text-secondary-400 hover:text-white"
                          }`}
                        >
                          {f === "all" ? "All" : f === "high" ? "High Risk" : f === "medium" ? "Medium Risk" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                      <span className="ml-4 text-secondary-400 text-xs font-semibold">SORT:</span>
                      {(["risk", "dormant", "recent"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setClientHealthSort(s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            clientHealthSort === s
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-secondary-700 text-secondary-400 hover:text-white"
                          }`}
                        >
                          {s === "risk" ? "By Risk" : s === "dormant" ? "Most Dormant" : "Most Recent"}
                        </button>
                      ))}
                    </div>

                    {/* Tenant Table */}
                    <Card className="bg-secondary-900 border-secondary-800">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-secondary-800 hover:bg-transparent">
                              <TableHead className="text-secondary-400 text-xs">Client</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Tier</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Status</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Risk</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Users</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Last Activity</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Expiry / Deadline</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };
                              let rows = [...clientHealthData.tenants];

                              // filter
                              if (clientHealthFilter === "high") rows = rows.filter((r) => r.churnRisk === "high");
                              else if (clientHealthFilter === "medium") rows = rows.filter((r) => r.churnRisk === "medium");
                              else if (clientHealthFilter === "trial") rows = rows.filter((r) => r.subscriptionStatus === "TRIAL");
                              else if (clientHealthFilter === "active") rows = rows.filter((r) => r.subscriptionStatus === "ACTIVE");
                              else if (clientHealthFilter === "expired") rows = rows.filter((r) => r.subscriptionStatus === "EXPIRED");

                              // sort
                              if (clientHealthSort === "risk") rows.sort((a, b) => RISK_ORDER[a.churnRisk] - RISK_ORDER[b.churnRisk]);
                              else if (clientHealthSort === "dormant") rows.sort((a, b) => (b.daysSinceActivity ?? -1) - (a.daysSinceActivity ?? -1));
                              else rows.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

                              if (rows.length === 0) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={7} className="text-center text-secondary-500 text-sm py-8">
                                      No clients match this filter.
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              return rows.map((t) => {
                                const tierLabel = t.tier === 1 ? "Shop" : t.tier === 2 ? "Business" : t.tier === 3 ? "Enterprise" : `Tier ${t.tier}`;
                                const statusColor =
                                  t.subscriptionStatus === "ACTIVE" ? "text-emerald-400" :
                                  t.subscriptionStatus === "TRIAL" ? "text-amber-400" :
                                  t.subscriptionStatus === "EXPIRED" ? "text-rose-400" : "text-secondary-400";
                                const riskBadge = {
                                  high: <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800"><TrendingDown className="h-2.5 w-2.5" />HIGH</span>,
                                  medium: <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800"><AlertTriangle className="h-2.5 w-2.5" />MEDIUM</span>,
                                  low: <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-800 text-secondary-400">LOW</span>,
                                  none: <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-500 border border-emerald-900">OK</span>,
                                }[t.churnRisk];

                                const activityLabel = t.daysSinceActivity === null
                                  ? <span className="text-secondary-500 text-xs italic">No audit records</span>
                                  : t.daysSinceActivity === 0
                                  ? <span className="text-emerald-400 text-xs">Today</span>
                                  : t.daysSinceActivity === 1
                                  ? <span className="text-emerald-300 text-xs">Yesterday</span>
                                  : t.daysSinceActivity <= 6
                                  ? <span className="text-secondary-200 text-xs">{t.daysSinceActivity}d ago</span>
                                  : t.daysSinceActivity <= 13
                                  ? <span className="text-amber-300 text-xs">{t.daysSinceActivity}d ago</span>
                                  : <span className="text-rose-400 text-xs font-semibold">{t.daysSinceActivity}d ago</span>;

                                const expiryLabel = (() => {
                                  if (t.subscriptionStatus === "TRIAL" && t.trialDaysLeft !== null) {
                                    if (t.trialDaysLeft < 0) return <span className="text-rose-400 text-xs">Trial expired {Math.abs(t.trialDaysLeft)}d ago</span>;
                                    if (t.trialDaysLeft === 0) return <span className="text-rose-400 text-xs font-bold">Trial ends TODAY</span>;
                                    return <span className={`text-xs ${t.trialDaysLeft <= 7 ? "text-rose-300 font-semibold" : t.trialDaysLeft <= 14 ? "text-amber-300" : "text-secondary-300"}`}>Trial ends in {t.trialDaysLeft}d</span>;
                                  }
                                  if (t.subscriptionStatus === "ACTIVE" && t.paidDaysLeft !== null) {
                                    if (t.paidDaysLeft < 0) return <span className="text-rose-400 text-xs">Overdue {Math.abs(t.paidDaysLeft)}d</span>;
                                    return <span className={`text-xs ${t.paidDaysLeft <= 7 ? "text-amber-300 font-semibold" : "text-secondary-400"}`}>Renews in {t.paidDaysLeft}d</span>;
                                  }
                                  if (t.subscriptionStatus === "EXPIRED") return <span className="text-rose-400 text-xs font-bold">EXPIRED</span>;
                                  return <span className="text-secondary-500 text-xs">—</span>;
                                })();

                                return (
                                  <TableRow key={t.id} className="border-secondary-800 hover:bg-secondary-800/40">
                                    <TableCell>
                                      <div>
                                        <p className="text-white text-sm font-semibold">{t.name}</p>
                                        <p className="text-secondary-500 text-[10px]">{t.slug}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-secondary-300 text-xs">{tierLabel}</TableCell>
                                    <TableCell className={`text-xs font-semibold ${statusColor}`}>{t.subscriptionStatus}</TableCell>
                                    <TableCell>{riskBadge}</TableCell>
                                    <TableCell className="text-secondary-300 text-xs">{t.userCount}</TableCell>
                                    <TableCell>{activityLabel}</TableCell>
                                    <TableCell>{expiryLabel}</TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Tab: Onboarding Completion Tracker */}
            {activeTab === "onboarding" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                      <ClipboardList className="h-5 w-5 text-violet-400" />
                      Onboarding Completion Tracker
                    </h2>
                    <p className="text-secondary-400 text-xs mt-0.5">
                      Per-tenant setup progress across 8 milestones. Stuck clients ({">"} 7 days, {"<"} 4 steps) need outreach.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchOnboarding}
                    disabled={isLoadingOnboarding}
                    className="border-secondary-700 text-secondary-300 hover:text-white gap-2"
                  >
                    {isLoadingOnboarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>

                {onboardingError && (
                  <div className="rounded-lg bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 text-sm">
                    {onboardingError}
                  </div>
                )}

                {isLoadingOnboarding && !onboardingData && (
                  <div className="flex items-center gap-2 text-secondary-400 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding data…
                  </div>
                )}

                {onboardingData && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: "Total Tenants", value: onboardingData.summary.total, color: "text-white" },
                        { label: "Fully Onboarded", value: onboardingData.summary.fullyOnboarded, color: "text-emerald-400" },
                        { label: "Half or More", value: onboardingData.summary.halfOrMore, color: "text-amber-400" },
                        { label: "Barely Started", value: onboardingData.summary.barelyStarted, color: "text-orange-400" },
                        { label: "Stuck (need call)", value: onboardingData.summary.stuck, color: "text-rose-400" },
                        { label: "Avg Completion", value: `${onboardingData.summary.avgCompletionPct}%`, color: "text-violet-400" },
                      ].map(({ label, value, color }) => (
                        <Card key={label} className="bg-secondary-900 border-secondary-800">
                          <CardContent className="p-4">
                            <p className="text-secondary-400 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                            <p className={`text-2xl font-extrabold ${color}`} style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Filter Row */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(['all', 'stuck', 'complete', 'started', 'bare'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setOnboardingFilter(f)}
                          className={`px-3 py-1 rounded-full border transition-colors ${
                            onboardingFilter === f
                              ? "border-violet-500 bg-violet-900/30 text-violet-300"
                              : "border-secondary-700 text-secondary-400 hover:text-white"
                          }`}
                        >
                          {f === 'all' ? 'All Tenants' : f === 'stuck' ? 'Stuck Only' : f === 'complete' ? 'Fully Onboarded' : f === 'started' ? 'In Progress' : 'Barely Started'}
                        </button>
                      ))}
                    </div>

                    {/* Tenant Milestone Table */}
                    <Card className="bg-secondary-900 border-secondary-800">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-secondary-800 hover:bg-transparent">
                              <TableHead className="text-secondary-400 text-xs">Client</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Score</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Wizard</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Team</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Journal</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Invoice</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Sale</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Inventory</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Bank</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Reconcile</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Days</TableHead>
                              <TableHead className="text-secondary-400 text-xs">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              let rows = [...onboardingData.tenants];
                              if (onboardingFilter === 'stuck') rows = rows.filter((r) => r.isStuck);
                              else if (onboardingFilter === 'complete') rows = rows.filter((r) => r.completionScore === onboardingData.totalSteps);
                              else if (onboardingFilter === 'started') rows = rows.filter((r) => r.completionScore >= 2 && r.completionScore < onboardingData.totalSteps);
                              else if (onboardingFilter === 'bare') rows = rows.filter((r) => r.completionScore < 2);
                              rows.sort((a, b) => {
                                if (a.isStuck !== b.isStuck) return a.isStuck ? -1 : 1;
                                return a.completionScore - b.completionScore;
                              });
                              if (rows.length === 0) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={12} className="text-center text-secondary-500 text-sm py-8">
                                      No clients match this filter.
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              return rows.map((t) => {
                                const tierLabel = t.tier === 1 ? "Shop" : t.tier === 2 ? "Business" : t.tier === 3 ? "Enterprise" : `T${t.tier}`;
                                const pctColor = t.completionPct >= 75 ? "text-emerald-400" : t.completionPct >= 50 ? "text-amber-400" : t.completionPct >= 25 ? "text-orange-400" : "text-rose-400";
                                const check = (val: boolean) => val
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                                  : <XCircle className="h-3.5 w-3.5 text-secondary-700 mx-auto" />;
                                return (
                                  <TableRow key={t.id} className={`border-secondary-800 hover:bg-secondary-800/50 ${t.isStuck ? 'bg-rose-900/10' : ''}`}>
                                    <TableCell>
                                      <div>
                                        <p className="text-white text-sm font-semibold">{t.name}</p>
                                        <p className="text-secondary-500 text-[10px]">{t.slug} · {tierLabel} · {t.subscriptionStatus}</p>
                                        <p className="text-secondary-600 text-[10px]">{t.userCount} user{t.userCount !== 1 ? 's' : ''}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className={`font-bold text-sm ${pctColor}`}>{t.completionScore}/{onboardingData.totalSteps}</span>
                                      <div className="w-16 h-1 bg-secondary-700 rounded-full mt-1">
                                        <div className={`h-1 rounded-full ${t.completionPct >= 75 ? 'bg-emerald-400' : t.completionPct >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${t.completionPct}%` }} />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">{check(t.isLive)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.teamMemberAdded)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.firstJournalPosted)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.firstInvoiceSent)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.firstSaleRecorded)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.firstInventoryItem)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.bankConnected)}</TableCell>
                                    <TableCell className="text-center">{check(t.milestoneDetail.firstReconciliation)}</TableCell>
                                    <TableCell className="text-secondary-400 text-xs">{t.daysSinceSignup}d</TableCell>
                                    <TableCell>
                                      {t.isStuck ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 text-[10px] font-bold border border-rose-700">
                                          STUCK
                                        </span>
                                      ) : t.completionScore === onboardingData.totalSteps ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 text-[10px] font-bold border border-emerald-700">
                                          COMPLETE
                                        </span>
                                      ) : t.completionScore >= Math.ceil(onboardingData.totalSteps / 2) ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 text-[10px] font-bold border border-amber-700">
                                          IN PROGRESS
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-800 text-secondary-400 text-[10px] font-bold border border-secondary-700">
                                          STARTED
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-xs text-secondary-500 pt-2 border-t border-secondary-800">
                      <span className="font-semibold text-secondary-300">Step guide:</span>
                      <span><span className="text-emerald-400">✓</span> = done (detected in audit log or isLive flag)</span>
                      <span><span className="text-secondary-600">✗</span> = not yet completed</span>
                      <span><span className="text-rose-400">STUCK</span> = signed up {">"}7 days ago, {"<"} 4 of 8 steps done — call them</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: Revenue & MRR Dashboard */}
            {activeTab === "revenue" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                      <TrendingUp className="h-5 w-5 text-cyan-400" />
                      Revenue & MRR Dashboard
                    </h2>
                    <p className="text-secondary-400 text-xs mt-0.5">
                      Monthly recurring revenue, tier breakdown, trial pipeline, and upcoming renewals.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRevenue}
                    disabled={isLoadingRevenue}
                    className="border-secondary-700 text-secondary-300 hover:text-white gap-2"
                  >
                    {isLoadingRevenue ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>

                {revenueError && (
                  <div className="rounded-lg bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 text-sm">
                    {revenueError}
                  </div>
                )}

                {isLoadingRevenue && !revenueData && (
                  <div className="flex items-center gap-2 text-secondary-400 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading revenue data…
                  </div>
                )}

                {revenueData && (
                  <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { label: "MRR", value: `GHS ${revenueData.summary.mrr.toLocaleString()}`, sub: "active paid tenants", color: "text-cyan-400" },
                        { label: "ARR (Projected)", value: `GHS ${revenueData.summary.arr.toLocaleString()}`, sub: "MRR × 12", color: "text-emerald-400" },
                        { label: "Trial Pipeline", value: `GHS ${revenueData.summary.trialPipelineValue.toLocaleString()}`, sub: `${revenueData.summary.trial} active trials`, color: "text-amber-400" },
                        { label: "Revenue at Risk", value: `GHS ${revenueData.summary.revenueAtRisk.toLocaleString()}`, sub: `${revenueData.summary.renewalsDueIn30Days} renewals + expired`, color: revenueData.summary.revenueAtRisk > 0 ? "text-rose-400" : "text-secondary-400" },
                        { label: "Active Paid", value: String(revenueData.summary.activePaid), sub: "of " + revenueData.summary.totalTenants + " total", color: "text-white" },
                        { label: "Trial Conversion", value: `${revenueData.summary.trialConversionRate}%`, sub: "paid / total tenants", color: "text-violet-400" },
                        { label: "Avg Rev / Tenant", value: `GHS ${revenueData.summary.avgRevenuePerTenant}`, sub: "active paid only", color: "text-secondary-300" },
                        { label: "Renewals in 30d", value: String(revenueData.summary.renewalsDueIn30Days), sub: "need retention action", color: revenueData.summary.renewalsDueIn30Days > 0 ? "text-orange-400" : "text-secondary-400" },
                      ].map(({ label, value, sub, color }) => (
                        <Card key={label} className="bg-secondary-900 border-secondary-800">
                          <CardContent className="p-4">
                            <p className="text-secondary-400 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                            <p className={`text-xl font-extrabold ${color}`} style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
                            <p className="text-secondary-600 text-[10px] mt-0.5">{sub}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Tier Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {revenueData.tierBreakdown.map((t) => (
                        <Card key={t.tier} className="bg-secondary-900 border-secondary-800">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-white font-bold text-sm">{t.name} Plan</p>
                                <p className="text-secondary-400 text-xs">GHS {t.priceGhs}/mo per tenant</p>
                              </div>
                              <DollarSign className="h-5 w-5 text-cyan-600" />
                            </div>
                            <p className="text-2xl font-extrabold text-cyan-400" style={{ fontFamily: "'Syne', sans-serif" }}>
                              GHS {t.tierMrr.toLocaleString()}
                            </p>
                            <p className="text-secondary-500 text-xs mt-1">{t.activeCount} active tenant{t.activeCount !== 1 ? 's' : ''}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Monthly Activations Sparkline */}
                    <Card className="bg-secondary-900 border-secondary-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-secondary-300">New Paid Activations — Last 12 Months</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-1 h-20">
                          {(() => {
                            const maxCount = Math.max(...revenueData.monthlyActivations.map((m) => m.count), 1);
                            return revenueData.monthlyActivations.map((m) => (
                              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-cyan-500/70 rounded-t"
                                  style={{ height: `${Math.max(4, Math.round((m.count / maxCount) * 64))}px` }}
                                  title={`${m.month}: ${m.count} new paid, GHS ${m.mrr}`}
                                />
                                <span className="text-[8px] text-secondary-600 leading-none">{m.month}</span>
                              </div>
                            ));
                          })()}
                        </div>
                        <p className="text-secondary-600 text-[10px] mt-2">Bucketed by sign-up month for active paid tenants.</p>
                      </CardContent>
                    </Card>

                    {/* Sub-views */}
                    <div className="flex gap-2 text-xs">
                      {(['overview', 'renewals', 'all'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setRevenueView(v)}
                          className={`px-3 py-1 rounded-full border transition-colors ${
                            revenueView === v
                              ? "border-cyan-500 bg-cyan-900/30 text-cyan-300"
                              : "border-secondary-700 text-secondary-400 hover:text-white"
                          }`}
                        >
                          {v === 'overview' ? 'Overview' : v === 'renewals' ? `Renewals Due (${revenueData.summary.renewalsDueIn30Days})` : 'All Tenants'}
                        </button>
                      ))}
                    </div>

                    {/* Renewals Due Table */}
                    {revenueView === 'renewals' && (
                      <Card className="bg-secondary-900 border-secondary-800">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-secondary-800 hover:bg-transparent">
                                <TableHead className="text-secondary-400 text-xs">Client</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Plan</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Monthly Value</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Renews In</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Renewal Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {revenueData.renewalsDue.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-secondary-500 text-sm py-8">
                                    No renewals due in the next 30 days.
                                  </TableCell>
                                </TableRow>
                              ) : revenueData.renewalsDue.map((t) => {
                                const urgencyColor = (t.renewalDaysLeft ?? 99) <= 7 ? "text-rose-400" : (t.renewalDaysLeft ?? 99) <= 14 ? "text-orange-400" : "text-amber-400";
                                return (
                                  <TableRow key={t.id} className="border-secondary-800 hover:bg-secondary-800/50">
                                    <TableCell>
                                      <p className="text-white text-sm font-semibold">{t.name}</p>
                                      <p className="text-secondary-500 text-[10px]">{t.slug}</p>
                                    </TableCell>
                                    <TableCell className="text-secondary-300 text-xs">{t.tierName}</TableCell>
                                    <TableCell className="text-cyan-400 text-sm font-bold">GHS {t.priceGhs}</TableCell>
                                    <TableCell className={`font-bold text-sm ${urgencyColor}`}>
                                      {t.renewalDaysLeft}d
                                    </TableCell>
                                    <TableCell className="text-secondary-400 text-xs">
                                      {t.subscriptionPaidUntil ? new Date(t.subscriptionPaidUntil).toLocaleDateString('en-GB') : '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    )}

                    {/* All Tenants Revenue Table */}
                    {revenueView === 'all' && (
                      <Card className="bg-secondary-900 border-secondary-800">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-secondary-800 hover:bg-transparent">
                                <TableHead className="text-secondary-400 text-xs">Client</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Plan</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Status</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Monthly Value</TableHead>
                                <TableHead className="text-secondary-400 text-xs">Paid Until / Trial Ends</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {revenueData.allTenants.map((t) => {
                                const statusColor = t.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : t.subscriptionStatus === 'TRIAL' ? 'text-amber-400' : 'text-rose-400';
                                const dateLabel = t.subscriptionStatus === 'ACTIVE' && t.subscriptionPaidUntil
                                  ? new Date(t.subscriptionPaidUntil).toLocaleDateString('en-GB')
                                  : t.subscriptionStatus === 'TRIAL' && t.trialEndsAt
                                  ? `Trial ends ${new Date(t.trialEndsAt).toLocaleDateString('en-GB')}`
                                  : '—';
                                return (
                                  <TableRow key={t.id} className={`border-secondary-800 hover:bg-secondary-800/50 ${t.isRevenueAtRisk ? 'bg-rose-900/10' : ''}`}>
                                    <TableCell>
                                      <p className="text-white text-sm font-semibold">{t.name}</p>
                                      <p className="text-secondary-500 text-[10px]">{t.slug}</p>
                                    </TableCell>
                                    <TableCell className="text-secondary-300 text-xs">{t.tierName}</TableCell>
                                    <TableCell className={`text-xs font-semibold ${statusColor}`}>{t.subscriptionStatus}</TableCell>
                                    <TableCell className={`font-bold text-sm ${t.subscriptionStatus === 'ACTIVE' ? 'text-cyan-400' : t.subscriptionStatus === 'TRIAL' ? 'text-amber-300/60' : 'text-rose-400/60'}`}>
                                      GHS {t.priceGhs}
                                    </TableCell>
                                    <TableCell className="text-secondary-400 text-xs">{dateLabel}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    )}

                    {revenueView === 'overview' && (
                      <div className="text-secondary-500 text-xs pt-2 border-t border-secondary-800">
                        MRR counts only ACTIVE paid tenants at their tier price. Trial pipeline value shows potential MRR if all active trials convert. Revenue at risk = expired tenants + renewals due in ≤30 days.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Debug Logs Tab */}
            {activeTab === "debuglogs" && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                      <Activity className="h-5 w-5 text-violet-400" />
                      Debug Request Log
                    </h2>
                    <p className="text-secondary-400 text-xs mt-0.5">
                      Last 500 requests — searchable by debugId, path, tenant, or error. Entries older than 24h are pruned automatically.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchDebugLogs} disabled={isLoadingDebug}
                      className="border-secondary-700 text-secondary-300 hover:text-white gap-2">
                      {isLoadingDebug ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearDebugLogs}
                      className="border-rose-700 text-rose-400 hover:text-white gap-2">
                      Clear Buffer
                    </Button>
                  </div>
                </div>

                {/* Stats tiles */}
                {debugStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total", value: debugStats.total, color: "text-white" },
                      { label: "OK (2xx)", value: debugStats.ok, color: "text-emerald-400" },
                      { label: "Warn (4xx)", value: debugStats.warn, color: "text-amber-400" },
                      { label: "Error (5xx)", value: debugStats.error, color: "text-rose-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-secondary-800 rounded-lg p-3 text-center">
                        <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                        <div className="text-secondary-400 text-xs mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={debugLevelFilter}
                    onChange={(e) => { setDebugLevelFilter(e.target.value as '' | 'ok' | 'warn' | 'error'); setDebugOffset(0); }}
                    className="bg-secondary-800 border border-secondary-700 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">All levels</option>
                    <option value="ok">OK (2xx)</option>
                    <option value="warn">Warn (4xx)</option>
                    <option value="error">Error (5xx)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Search debugId, path, tenant, error…"
                    value={debugSearch}
                    onChange={(e) => { setDebugSearch(e.target.value); setDebugOffset(0); }}
                    className="bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-xs text-white placeholder-secondary-500 w-64"
                  />
                  <span className="text-secondary-500 text-xs ml-auto">{debugTotal} matching</span>
                </div>

                {debugError && <div className="text-rose-400 text-sm">{debugError}</div>}

                {/* Table */}
                {debugLogs.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-secondary-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-secondary-900 text-secondary-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2">DebugId</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2">Path</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">ms</th>
                          <th className="px-3 py-2">Tenant</th>
                          <th className="px-3 py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-800">
                        {debugLogs.map((log) => (
                          <tr key={log.id} className={`hover:bg-secondary-800/50 ${log.level === 'error' ? 'bg-rose-950/20' : log.level === 'warn' ? 'bg-amber-950/20' : ''}`}>
                            <td className="px-3 py-2 font-mono text-violet-300">{log.id}</td>
                            <td className="px-3 py-2 text-secondary-400 whitespace-nowrap">{new Date(log.ts).toLocaleTimeString()}</td>
                            <td className="px-3 py-2">
                              <span className={`font-bold ${log.method === 'GET' ? 'text-sky-400' : log.method === 'POST' ? 'text-emerald-400' : log.method === 'DELETE' ? 'text-rose-400' : 'text-amber-400'}`}>
                                {log.method}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-secondary-300 max-w-[200px] truncate" title={log.path}>{log.path}</td>
                            <td className="px-3 py-2">
                              <span className={`font-bold ${log.status >= 500 ? 'text-rose-400' : log.status >= 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-secondary-300">{log.durationMs}</td>
                            <td className="px-3 py-2 text-secondary-400 font-mono text-[10px] truncate max-w-[80px]" title={log.tenantId}>{log.tenantId ? log.tenantId.slice(0, 8) : '—'}</td>
                            <td className="px-3 py-2 text-rose-300 max-w-[160px] truncate" title={log.errorMessage}>{log.errorMessage ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  !isLoadingDebug && (
                    <div className="text-center text-secondary-500 py-12 text-sm">
                      {debugLevelFilter || debugSearch ? 'No logs match your filter.' : 'No requests captured yet. Make some API calls and refresh.'}
                    </div>
                  )
                )}

                {/* Pagination */}
                {debugTotal > DEBUG_PAGE && (
                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={() => setDebugOffset(Math.max(0, debugOffset - DEBUG_PAGE))}
                      disabled={debugOffset === 0} className="border-secondary-700 text-secondary-300 hover:text-white">
                      Previous
                    </Button>
                    <span className="text-secondary-400 text-xs">
                      {debugOffset + 1}–{Math.min(debugOffset + DEBUG_PAGE, debugTotal)} of {debugTotal}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setDebugOffset(debugOffset + DEBUG_PAGE)}
                      disabled={debugOffset + DEBUG_PAGE >= debugTotal} className="border-secondary-700 text-secondary-300 hover:text-white">
                      Next
                    </Button>
                  </div>
                )}

                <div className="text-secondary-600 text-xs pt-2 border-t border-secondary-800">
                  Each row has a unique <span className="font-mono text-violet-400">x-debug-id</span> header on the response — search by it to trace a specific request end-to-end. Buffer is in-process memory; it resets on server restart.
                </div>
              </div>
            )}

            {activeTab === "team" && (
              <TeamManagementPanel adminHeaders={adminHeaders as unknown as Record<string, string>} />
            )}

      </main>
    </div>
  );
}

// ── Team Management Panel ─────────────────────────────────────────────────────

const VALID_COLORS = ['blue', 'cyan', 'emerald', 'rose', 'violet', 'amber', 'indigo', 'slate'] as const;
const ALL_TABS = [
  'broadcast', 'health', 'performance', 'jobs', 'integrations',
  'schemas', 'audit', 'onboard', 'feedback', 'analytics', 'errors',
  'safety', 'referral', 'clienthealth', 'churnrisk', 'onboarding',
  'revenue', 'debuglogs',
] as const;

interface TeamMemberRow {
  id: string; name: string; role: string; color: string;
  assignedTabs: string[]; isActive: boolean;
}

const COLOR_DOT: Record<string, string> = {
  blue: 'bg-blue-500', cyan: 'bg-cyan-500', emerald: 'bg-emerald-500',
  rose: 'bg-rose-500', violet: 'bg-violet-500', amber: 'bg-amber-500',
  indigo: 'bg-indigo-500', slate: 'bg-slate-400',
};

function TeamManagementPanel({ adminHeaders }: { adminHeaders: Record<string, string> }) {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({ id: '', name: '', role: '', color: 'slate', assignedTabs: [] as string[] });
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await api.get('/admin/team/members/all', { headers: adminHeaders });
      setMembers(res.data.data);
    } catch {
      setErr('Failed to load team members.');
    } finally { setLoading(false); }
  }, [adminHeaders]);

  useEffect(() => { load(); }, [load]);

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000); }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    setActionLoading(id + '-del');
    try {
      await api.delete(`/admin/team/members/${id}`, { headers: adminHeaders });
      flash(`${name} deleted.`);
      load();
    } catch { flash('Delete failed.'); }
    setActionLoading('');
  }

  async function handleResetPin(id: string, name: string) {
    if (!confirm(`Reset ${name}'s PIN to 0000?`)) return;
    setActionLoading(id + '-pin');
    try {
      await api.post(`/admin/team/members/${id}/reset-pin`, {}, { headers: adminHeaders });
      flash(`${name}'s PIN reset to 0000.`);
    } catch { flash('Reset failed.'); }
    setActionLoading('');
  }

  async function handleToggleActive(member: TeamMemberRow) {
    setActionLoading(member.id + '-active');
    try {
      await api.patch(`/admin/team/members/${member.id}`, { isActive: !member.isActive }, { headers: adminHeaders });
      flash(`${member.name} ${member.isActive ? 'deactivated' : 'reactivated'}.`);
      load();
    } catch { flash('Update failed.'); }
    setActionLoading('');
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setActionLoading('save');
    try {
      await api.patch(`/admin/team/members/${editing.id}`, {
        name: editing.name, role: editing.role, color: editing.color, assignedTabs: editing.assignedTabs,
      }, { headers: adminHeaders });
      flash('Member updated.');
      setEditing(null);
      load();
    } catch { flash('Update failed.'); }
    setActionLoading('');
  }

  async function handleCreate() {
    if (!newMember.id || !newMember.name || !newMember.role) return;
    setActionLoading('create');
    try {
      await api.post('/admin/team/members', newMember, { headers: adminHeaders });
      flash(`${newMember.name} added. Default PIN is 0000.`);
      setShowAdd(false);
      setNewMember({ id: '', name: '', role: '', color: 'slate', assignedTabs: [] });
      load();
    } catch (e: any) {
      flash(e?.response?.data?.error ?? 'Create failed.');
    }
    setActionLoading('');
  }

  function toggleTab(tabs: string[], tab: string): string[] {
    return tabs.includes(tab) ? tabs.filter((t) => t !== tab) : [...tabs, tab];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
            <Users className="h-5 w-5 text-emerald-400" />
            Team Members
          </h2>
          <p className="text-secondary-400 text-xs mt-0.5">Manage the AGOD team roster — add, edit, deactivate, or reset PINs.</p>
        </div>
        <div className="flex gap-2">
          {msg && <span className="text-emerald-400 text-xs self-center">{msg}</span>}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}
            className="border-secondary-700 text-secondary-300 hover:text-white gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}

      {/* Add member form */}
      {showAdd && (
        <div className="bg-secondary-900 border border-emerald-500/20 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-semibold">New Team Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary-400 block mb-1">ID (slug)</label>
              <input value={newMember.id} onChange={(e) => setNewMember((v) => ({ ...v, id: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                placeholder="e.g. john" className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white placeholder-secondary-500" />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Full Name</label>
              <input value={newMember.name} onChange={(e) => setNewMember((v) => ({ ...v, name: e.target.value }))}
                placeholder="e.g. John Doe" className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white placeholder-secondary-500" />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Role</label>
              <input value={newMember.role} onChange={(e) => setNewMember((v) => ({ ...v, role: e.target.value }))}
                placeholder="e.g. Designer" className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white placeholder-secondary-500" />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Avatar Color</label>
              <select value={newMember.color} onChange={(e) => setNewMember((v) => ({ ...v, color: e.target.value }))}
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white">
                {VALID_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-secondary-400 block mb-1">Assigned Tabs</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TABS.map((t) => (
                <button key={t} onClick={() => setNewMember((v) => ({ ...v, assignedTabs: toggleTab(v.assignedTabs, t) }))}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${newMember.assignedTabs.includes(t) ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-secondary-700 text-secondary-400 hover:border-secondary-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={actionLoading === 'create' || !newMember.id || !newMember.name || !newMember.role}
              className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {actionLoading === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}
              className="border-secondary-700 text-secondary-400">Cancel</Button>
          </div>
        </div>
      )}

      {/* Edit member form */}
      {editing && (
        <div className="bg-secondary-900 border border-violet-500/20 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-sm font-semibold">Edit — {editing.name}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Name</label>
              <input value={editing.name} onChange={(e) => setEditing((v) => v ? { ...v, name: e.target.value } : v)}
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Role</label>
              <input value={editing.role} onChange={(e) => setEditing((v) => v ? { ...v, role: e.target.value } : v)}
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-secondary-400 block mb-1">Avatar Color</label>
              <select value={editing.color} onChange={(e) => setEditing((v) => v ? { ...v, color: e.target.value } : v)}
                className="w-full bg-secondary-800 border border-secondary-700 rounded px-3 py-1.5 text-sm text-white">
                {VALID_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-secondary-400 block mb-1">Assigned Tabs</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TABS.map((t) => (
                <button key={t} onClick={() => setEditing((v) => v ? { ...v, assignedTabs: toggleTab(v.assignedTabs, t) } : v)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${editing.assignedTabs.includes(t) ? 'bg-violet-600 border-violet-500 text-white' : 'border-secondary-700 text-secondary-400 hover:border-secondary-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={actionLoading === 'save'}
              className="bg-violet-600 hover:bg-violet-500 text-white">
              {actionLoading === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}
              className="border-secondary-700 text-secondary-400">Cancel</Button>
          </div>
        </div>
      )}

      {/* Members table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-secondary-400 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className={`bg-secondary-900 border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 ${m.isActive ? 'border-secondary-800' : 'border-secondary-800 opacity-50'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${COLOR_DOT[m.color] ?? 'bg-slate-500'}`}>
                <span className="text-white text-xs font-bold">{m.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-semibold">{m.name}</span>
                  {!m.isActive && <span className="text-[10px] bg-secondary-700 text-secondary-400 px-1.5 py-0.5 rounded">Inactive</span>}
                </div>
                <p className="text-secondary-400 text-xs">{m.role}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.assignedTabs.map((t) => (
                    <span key={t} className="text-[10px] bg-secondary-800 border border-secondary-700 text-secondary-300 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditing(m)}
                  className="border-secondary-700 text-secondary-300 hover:text-white h-7 px-2 text-xs">Edit</Button>
                <Button variant="outline" size="sm" onClick={() => handleResetPin(m.id, m.name)} disabled={actionLoading === m.id + '-pin'}
                  className="border-secondary-700 text-amber-400 hover:text-amber-300 h-7 px-2 text-xs">
                  {actionLoading === m.id + '-pin' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reset PIN'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleToggleActive(m)} disabled={actionLoading === m.id + '-active'}
                  className={`border-secondary-700 h-7 px-2 text-xs ${m.isActive ? 'text-orange-400 hover:text-orange-300' : 'text-emerald-400 hover:text-emerald-300'}`}>
                  {actionLoading === m.id + '-active' ? <Loader2 className="h-3 w-3 animate-spin" /> : m.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(m.id, m.name)} disabled={actionLoading === m.id + '-del'}
                  className="border-rose-800 text-rose-400 hover:text-rose-300 h-7 px-2 text-xs">
                  {actionLoading === m.id + '-del' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmergencyStopPanel({ passcode, sessionToken }: { passcode: string; sessionToken: string | null }) {
  const [state, setState] = useState<{ active: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [ttlSeconds, setTtlSeconds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const adminBase = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/admin/emergency-stop`;
  const adminHeaders: Record<string, string> = sessionToken
    ? { "x-admin-session": sessionToken, "Content-Type": "application/json" }
    : { "x-admin-passcode": passcode, "Content-Type": "application/json" };

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
