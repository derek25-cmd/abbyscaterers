"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "../api/authed-fetch";
import type { FollowUpDraftInput } from "../utils/ai";
import type { UploadBucket } from "../utils/upload";
import type {
  AIFollowUpDraft,
  AILeadAnalysis,
  Company,
  CompanyDetail,
  CompanyFilters,
  CompanyImportResult,
  DocumentRow,
  FollowUp,
  MarketerPerformanceRow,
  MarketerLeaderboardRow,
  MarketingKpis,
  MonthlyReportData,
  PaginatedResult,
  PipelineFunnelStage,
  PipelineStage,
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
      fetchJson<{ data: Company }>(`/api/marketing/companies/${id}/stage`, { method: "PUT", body: JSON.stringify({ stage }) }),
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
