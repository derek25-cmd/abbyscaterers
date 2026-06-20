"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "../api/authed-fetch";
import type {
  Company,
  CompanyDetail,
  CompanyFilters,
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
