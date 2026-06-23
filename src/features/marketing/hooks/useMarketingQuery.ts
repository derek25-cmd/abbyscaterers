"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "../api/authed-fetch";
import { supabase } from "@/lib/supabase-client";
import { useToast } from "@/hooks/use-toast";
import type { CompetitorInsightInput, FollowUpDraftInput, ReportNarrativeInput } from "../utils/ai";
import type { UploadBucket } from "../utils/upload";
import type {
  AccountAction,
  AIFollowUpDraft,
  AILeadAnalysis,
  ApplicationDetail,
  CacResult,
  Company,
  CompanyDetail,
  CompanyFilters,
  CompanyImportResult,
  CompanyMapPin,
  CompetitorRow,
  DocumentRow,
  PendingApplication,
  FollowUp,
  HeatmapPoint,
  MarketerAccountOverview,
  MarketerLiveLocation,
  MarketerPerformanceRow,
  MarketerLeaderboardRow,
  MarketingKpis,
  MarketingLiveData,
  MarketingNotification,
  MarketingPerformanceSnapshot,
  MarketingUserRole,
  MonthlyReportData,
  PaginatedResult,
  PipelineFunnelStage,
  PipelineStage,
  QuotationPrompt,
  RoiResult,
  WonAlert,
} from "../types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

function buildParams(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}

// ---- Queries ----

export function useCompanies(filters: CompanyFilters) {
  return useQuery({
    queryKey: ["marketing", "companies", filters],
    queryFn: () => fetchJson<PaginatedResult<Company>>(`/api/marketing/companies?${buildParams(filters)}`),
    staleTime: 30_000,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "company", id],
    queryFn: () => fetchJson<{ data: CompanyDetail }>(`/api/marketing/companies/${id}`).then((r) => r.data),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useFollowUps(filter?: { status?: string; assignedTo?: string }) {
  return useQuery({
    queryKey: ["marketing", "followups", filter],
    queryFn: () => fetchJson<{ data: FollowUp[] }>(`/api/marketing/followups?${buildParams(filter ?? {})}`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useMarketers(month?: number, year?: number) {
  return useQuery({
    queryKey: ["marketing", "marketers", month, year],
    queryFn: () =>
      fetchJson<{ data: MarketerPerformanceRow[]; month: number; year: number }>(
        `/api/marketing/marketers?${buildParams({ month, year })}`
      ),
    staleTime: 60_000,
  });
}

export function useMarketersList() {
  return useQuery({
    queryKey: ["marketing", "marketers-list"],
    queryFn: () => fetchJson<{ data: { id: string; full_name: string; email: string }[] }>(`/api/marketing/marketers/list`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ["marketing", "regions"],
    queryFn: () => fetchJson<{ data: { id: string; name: string }[] }>(`/api/marketing/regions`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useMonthlyReport(month: number, year: number) {
  return useQuery({
    queryKey: ["marketing", "report", month, year],
    queryFn: () => fetchJson<{ data: MonthlyReportData }>(`/api/marketing/reports/monthly?month=${month}&year=${year}`).then((r) => r.data),
    staleTime: 60_000,
  });
}

export interface DashboardData {
  kpis: MarketingKpis;
  pipeline: PipelineFunnelStage[];
  followUps: FollowUp[];
  leaderboard: MarketerLeaderboardRow[];
  role: MarketingUserRole | null;
  myPerformance: MarketingPerformanceSnapshot | null;
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["marketing", "dashboard"],
    queryFn: () => fetchJson<DashboardData>(`/api/marketing/dashboard`),
    staleTime: 60_000,
  });
}

export function useCompanyDocuments(companyId: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "company-documents", companyId],
    queryFn: () => fetchJson<{ data: DocumentRow[] }>(`/api/marketing/companies/${companyId}/documents`).then((r) => r.data),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
}

export function useSignedUrl(bucket: UploadBucket | undefined, path: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "signed-url", bucket, path],
    queryFn: () => fetchJson<{ url: string }>(`/api/marketing/uploads/signed-url?bucket=${bucket}&path=${encodeURIComponent(path!)}`).then((r) => r.url),
    enabled: Boolean(bucket && path),
    staleTime: 50 * 60_000, // signed URLs are valid 1 hour server-side; refetch well before they expire
  });
}

// ---- Mutations ----

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      fetchJson<{ data: Company }>(`/api/marketing/companies`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      fetchJson<{ data: Company }>(`/api/marketing/companies/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company", variables.id] });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: PipelineStage }) =>
      fetchJson<{ data: Company; quotationPrompt?: QuotationPrompt; wonAlert?: WonAlert }>(
        `/api/marketing/companies/${id}/stage`,
        { method: "PUT", body: JSON.stringify({ stage }) }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company", variables.id] });
    },
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      fetchJson<{ data: unknown; leadScore: number }>(`/api/marketing/visits`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company", (variables as { companyId?: string }).companyId] });
    },
  });
}

export function useCreateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      fetchJson<{ data: FollowUp }>(`/api/marketing/followups`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "followups"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
    },
  });
}

export function useUpdateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      fetchJson<{ data: FollowUp }>(`/api/marketing/followups/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "followups"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ data: FollowUp }>(`/api/marketing/followups/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "followups"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
    },
  });
}

export function useCreateMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      fetchJson<{ data: unknown }>(`/api/marketing/marketers`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "marketers"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "marketers-list"] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      fetchJson<{ success: true; data: { id: string; path: string; url: string } }>(`/api/marketing/uploads`, {
        method: "POST",
        body: formData,
      }),
    onSuccess: (_data, formData) => {
      const entityType = formData.get("entityType");
      const entityId = formData.get("entityId");
      if (entityType === "company") {
        queryClient.invalidateQueries({ queryKey: ["marketing", "company-documents", entityId] });
      }
      queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
    },
  });
}

export function useImportCompanies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetchJson<{ success: true; data: CompanyImportResult }>(`/api/marketing/companies/import`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
    },
  });
}

// ---- AI mutations (always optional — callers should degrade gracefully on error) ----

export function useDraftFollowUp() {
  return useMutation({
    mutationFn: (input: FollowUpDraftInput) =>
      fetchJson<{ success: true; data: AIFollowUpDraft }>(`/api/marketing/ai/followup-draft`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.data),
  });
}

export function useGenerateVisitSummary() {
  return useMutation({
    mutationFn: (visitId: string) =>
      fetchJson<{ success: true; data: { summary: string } }>(`/api/marketing/ai/visit-summary`, {
        method: "POST",
        body: JSON.stringify({ visitId }),
      }).then((r) => r.data.summary),
  });
}

export function useLeadAnalysis() {
  return useMutation({
    mutationFn: (companyId: string) =>
      fetchJson<{ success: true; data: AILeadAnalysis }>(`/api/marketing/ai/lead-analysis`, {
        method: "POST",
        body: JSON.stringify({ companyId }),
      }).then((r) => r.data),
  });
}

// ---- Live map ----

export function useMarketerLocations() {
  return useQuery({
    queryKey: ["marketing", "locations"],
    queryFn: () => fetchJson<{ data: MarketerLiveLocation[] }>(`/api/marketing/marketers/locations`).then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useCompanyMapPins() {
  return useQuery({
    queryKey: ["marketing", "map-pins"],
    queryFn: () => fetchJson<{ data: CompanyMapPin[] }>(`/api/marketing/analytics/map-pins`).then((r) => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useHeatmapPoints(month: number, year: number, enabled = true) {
  return useQuery({
    queryKey: ["marketing", "heatmap", month, year],
    queryFn: () => fetchJson<{ data: HeatmapPoint[] }>(`/api/marketing/analytics/heatmap?month=${month}&year=${year}`).then((r) => r.data),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useLiveData() {
  return useQuery({
    queryKey: ["marketing", "live"],
    queryFn: () => fetchJson<{ data: MarketingLiveData }>(`/api/marketing/analytics/live`).then((r) => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ---- Notifications ----

export function useNotifications(includeAll = false) {
  return useQuery({
    queryKey: ["marketing", "notifications", includeAll],
    queryFn: () => fetchJson<{ data: MarketingNotification[] }>(`/api/marketing/notifications?all=${includeAll}`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) =>
      fetchJson<{ success: true }>(`/api/marketing/notifications/read`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "notifications"] });
    },
  });
}

// ---- Realtime ----

/** Subscribes to live database changes for the marketing module and keeps React Query caches fresh. Mount once near the top of the marketing route tree. */
export function useMarketingRealtime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel("marketing-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visits" }, () => {
        queryClient.invalidateQueries({ queryKey: ["marketing", "dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "live"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "locations"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketing_users" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["marketing", "locations"] });
          queryClient.invalidateQueries({ queryKey: ["marketing", "live"] });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "companies" }, () => {
        queryClient.invalidateQueries({ queryKey: ["marketing", "dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "companies"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "company"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "follow_ups" }, () => {
        queryClient.invalidateQueries({ queryKey: ["marketing", "followups"] });
        queryClient.invalidateQueries({ queryKey: ["marketing", "dashboard"] });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "marketing_notifications" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["marketing", "notifications"] });
          const notif = payload.new as { type: string; title: string; message: string };
          if (notif.type === "HOT_LEAD" || notif.type === "DEAL_WON") {
            toast({ title: notif.title, description: notif.message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);
}

// ---- Phase 5: reports analytics ----

export function useCac(month: number, year: number) {
  return useQuery({
    queryKey: ["marketing", "cac", month, year],
    queryFn: () => fetchJson<{ data: CacResult }>(`/api/marketing/analytics/cac?month=${month}&year=${year}`).then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useSaveExpenses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: number; year: number; totalExpenses: number; notes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/analytics/cac`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "cac", variables.month, variables.year] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "roi", variables.month, variables.year] });
    },
  });
}

export function useCompetitors() {
  return useQuery({
    queryKey: ["marketing", "competitors"],
    queryFn: () => fetchJson<{ data: CompetitorRow[] }>(`/api/marketing/analytics/competitors`).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useRoi(month: number, year: number) {
  return useQuery({
    queryKey: ["marketing", "roi", month, year],
    queryFn: () => fetchJson<{ data: RoiResult }>(`/api/marketing/analytics/roi?month=${month}&year=${year}`).then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useGenerateReportNarrative() {
  return useMutation({
    mutationFn: (input: ReportNarrativeInput) =>
      fetchJson<{ success: true; data: { narrative: string } }>(`/api/marketing/ai/report-narrative`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.data.narrative),
  });
}

export function useGenerateCompetitorInsight() {
  return useMutation({
    mutationFn: (competitors: CompetitorInsightInput[]) =>
      fetchJson<{ success: true; data: { insight: string } }>(`/api/marketing/ai/competitor-insight`, {
        method: "POST",
        body: JSON.stringify({ competitors }),
      }).then((r) => r.data.insight),
  });
}

// ---- Marketer applications (approval workflow) ----

export function usePendingApplications() {
  return useQuery({
    queryKey: ["marketing", "applications"],
    queryFn: () => fetchJson<{ success: true; data: PendingApplication[] }>(`/api/marketing/applications`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useApplicationDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "applications", id],
    queryFn: () => fetchJson<{ success: true; data: ApplicationDetail }>(`/api/marketing/applications/${id}`).then((r) => r.data),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useApplicationDocumentUrl(applicationId: string | undefined, bucket: string, path: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "applications", applicationId, "signed-url", bucket, path],
    queryFn: () =>
      fetchJson<{ success: true; data: { url: string } }>(
        `/api/marketing/applications/${applicationId}/documents/signed-url?bucket=${bucket}&path=${encodeURIComponent(path!)}`
      ).then((r) => r.data.url),
    enabled: Boolean(applicationId && path),
    staleTime: 50 * 60_000,
  });
}

export function useApproveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/applications/${id}/approve`, { method: "POST", body: JSON.stringify({ role }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "applications", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "marketers-list"] });
    },
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/applications/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "applications", variables.id] });
    },
  });
}

export function useRecalculatePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson<{ success: true; timestamp: string }>(`/api/marketing/reports/recalculate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "marketers"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "report"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "dashboard"] });
    },
  });
}

// ---- Marketer account authority ----

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>, marketerId: string) {
  queryClient.invalidateQueries({ queryKey: ["marketing", "account-overview"] });
  queryClient.invalidateQueries({ queryKey: ["marketing", "marketer-history", marketerId] });
}

export function useMarketerOverview() {
  return useQuery({
    queryKey: ["marketing", "account-overview"],
    queryFn: () => fetchJson<{ success: true; data: MarketerAccountOverview[] }>(`/api/marketing/marketers/overview`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useMarketerHistory(marketerId: string | undefined) {
  return useQuery({
    queryKey: ["marketing", "marketer-history", marketerId],
    queryFn: () => fetchJson<{ success: true; data: AccountAction[] }>(`/api/marketing/marketers/${marketerId}/history`).then((r) => r.data),
    enabled: Boolean(marketerId),
    staleTime: 15_000,
  });
}

export function useCautionMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, internalNotes }: { id: string; reason: string; internalNotes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/caution`, { method: "POST", body: JSON.stringify({ reason, internalNotes }) }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

export function useRestrictMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, internalNotes }: { id: string; reason: string; internalNotes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/restrict`, { method: "POST", body: JSON.stringify({ reason, internalNotes }) }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

export function useLiftRestriction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/restrict`, { method: "DELETE", body: JSON.stringify({ notes }) }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

export function useDisableMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, internalNotes }: { id: string; reason: string; internalNotes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/disable`, { method: "POST", body: JSON.stringify({ reason, internalNotes }) }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

export function useReinstateMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/reinstate`, { method: "POST", body: JSON.stringify({ notes }) }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

export function useSuspendMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, suspendedUntil, internalNotes }: { id: string; reason: string; suspendedUntil: string; internalNotes?: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason, suspendedUntil, internalNotes }),
      }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}

/** The calling user's own marketing_users row — used client-side to gate UI
 * (e.g. internal notes) by role without needing a server round trip. */
export function useMyMarketingProfile() {
  return useQuery({
    queryKey: ["marketing", "my-profile"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.email) return null;
      const { data } = await supabase.from("marketing_users").select("id, role").eq("email", session.user.email).maybeSingle();
      return data as { id: string; role: MarketingUserRole } | null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useDeleteMarketer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, internalNotes, confirmName }: { id: string; reason: string; internalNotes?: string; confirmName: string }) =>
      fetchJson<{ success: true }>(`/api/marketing/marketers/${id}/delete`, {
        method: "POST",
        body: JSON.stringify({ reason, internalNotes, confirmName }),
      }),
    onSuccess: (_data, variables) => invalidateAccountQueries(queryClient, variables.id),
  });
}
