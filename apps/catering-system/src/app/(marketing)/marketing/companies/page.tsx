"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Building2, Download, Pencil, PlusCircle, Search, SlidersHorizontal, ArrowUpRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCompanies, useRegions, useMarketersList } from "@/features/marketing/hooks/useMarketingQuery";
import { CompanyForm } from "@/features/marketing/components/forms/CompanyForm";
import { getStageMeta, PIPELINE_STAGES } from "@/features/marketing/utils/pipeline";
import { getTierFromScore } from "@/features/marketing/utils/lead-score";
import { formatDate } from "@/features/marketing/utils/format";
import type { Company, CompanyFilters } from "@/features/marketing/types";

const PAGE_SIZE = 20;

export default function CompaniesPage() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Omit<CompanyFilters, "search" | "page">>({});
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const updateSearch = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const activeFilters: CompanyFilters = { ...filters, search: debouncedSearch || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading } = useCompanies(activeFilters);
  const { data: regions } = useRegions();
  const { data: marketers } = useMarketersList();

  const companies = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo<ColumnDef<Company>[]>(() => [
    {
      accessorKey: "name",
      header: "Company",
      cell: ({ row }) => (
        <div className="font-medium text-foreground">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => row.original.industry ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "pipeline_stage",
      header: "Stage",
      cell: ({ row }) => {
        const meta = getStageMeta(row.original.pipeline_stage);
        return <Badge className={meta.color}>{meta.label}</Badge>;
      },
    },
    {
      accessorKey: "lead_score",
      header: "Score",
      cell: ({ row }) => {
        const tier = getTierFromScore(row.original.lead_score);
        return <span className={`font-semibold ${tier.color}`}>{row.original.lead_score}</span>;
      },
    },
    {
      id: "marketer",
      header: "Marketer",
      cell: ({ row }) => (row.original as any).marketer?.full_name ?? <span className="text-muted-foreground">Unassigned</span>,
    },
    {
      accessorKey: "last_visited_at",
      header: "Last Visited",
      cell: ({ row }) => row.original.last_visited_at ? formatDate(row.original.last_visited_at, "relative") : <span className="text-muted-foreground">Never</span>,
    },
    ...(filters.isClient ? [{
      id: "client_since",
      header: "Client Since",
      cell: ({ row }: { row: { original: Company } }) =>
        row.original.client_since ? formatDate(row.original.client_since, "long") : <span className="text-muted-foreground">—</span>,
    } as ColumnDef<Company>] : []),
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingCompany(row.original); setFormOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/marketing/companies/${row.original.id}`} onClick={(e) => e.stopPropagation()}>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ], [filters.isClient]);

  const table = useReactTable({
    data: companies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const handleExport = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Companies");
    sheet.columns = [
      { header: "Company", key: "name" },
      { header: "Industry", key: "industry" },
      { header: "Stage", key: "stage" },
      { header: "Lead Score", key: "score" },
      { header: "Marketer", key: "marketer" },
      { header: "Last Visited", key: "lastVisited" },
    ];
    companies.forEach((company) => {
      sheet.addRow({
        name: company.name,
        industry: company.industry ?? "",
        stage: getStageMeta(company.pipeline_stage).label,
        score: company.lead_score,
        marketer: (company as any).marketer?.full_name ?? "",
        lastVisited: company.last_visited_at ? formatDate(company.last_visited_at) : "",
      });
    });

    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "abbys_companies.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: "Companies exported to CSV." });
  };

  const filterPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <p className="text-sm font-medium">Clients only</p>
        <Switch
          checked={Boolean(filters.isClient)}
          onCheckedChange={(checked) => { setPage(1); setFilters((p) => ({ ...p, isClient: checked || undefined })); }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Pipeline stage</p>
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STAGES.map((stage) => {
            const meta = getStageMeta(stage);
            const active = filters.stage?.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilters((prev) => {
                    const current = prev.stage ?? [];
                    const next = current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage];
                    return { ...prev, stage: next.length ? next : undefined };
                  });
                }}
                className={`rounded-full border px-2.5 py-1 text-xs ${active ? meta.color : "text-muted-foreground"}`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Region</p>
        <Select value={filters.regionId ?? "all"} onValueChange={(v) => { setPage(1); setFilters((p) => ({ ...p, regionId: v === "all" ? undefined : v })); }}>
          <SelectTrigger><SelectValue placeholder="All regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions?.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Assigned marketer</p>
        <Select value={filters.assignedMarketerId ?? "all"} onValueChange={(v) => { setPage(1); setFilters((p) => ({ ...p, assignedMarketerId: v === "all" ? undefined : v })); }}>
          <SelectTrigger><SelectValue placeholder="All marketers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All marketers</SelectItem>
            {marketers?.map((marketer) => <SelectItem key={marketer.id} value={marketer.id}>{marketer.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Lead score range</p>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Min" min={0} max={100} value={filters.minLeadScore ?? ""} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, minLeadScore: e.target.value ? Number(e.target.value) : undefined })); }} />
          <span className="text-muted-foreground">–</span>
          <Input type="number" placeholder="Max" min={0} max={100} value={filters.maxLeadScore ?? ""} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, maxLeadScore: e.target.value ? Number(e.target.value) : undefined })); }} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Industry</p>
        <Input placeholder="e.g. Banking" value={filters.industry ?? ""} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, industry: e.target.value || undefined })); }} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Last visited</p>
        <div className="flex items-center gap-2">
          <Input type="date" value={filters.visitedFrom?.slice(0, 10) ?? ""} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, visitedFrom: e.target.value || undefined })); }} />
          <Input type="date" value={filters.visitedTo?.slice(0, 10) ?? ""} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, visitedTo: e.target.value || undefined })); }} />
        </div>
      </div>

      {Object.values(filters).some(Boolean) && (
        <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setPage(1); }}>Clear filters</Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Companies</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/marketing/companies/import">
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => { setEditingCompany(undefined); setFormOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Company
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, contact, or industry..." value={searchInput} onChange={(e) => updateSearch(e.target.value)} />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
            <div className="mt-4">{filterPanel}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="hidden rounded-lg border bg-card p-4 lg:block">{filterPanel}</div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No companies yet. Add your first prospect.</p>
              <Button onClick={() => { setEditingCompany(undefined); setFormOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Company
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => window.location.assign(`/marketing/companies/${row.original.id}`)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Page {page} of {pageCount}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <CompanyForm open={formOpen} onOpenChange={setFormOpen} company={editingCompany} />
    </div>
  );
}
