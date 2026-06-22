"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight, FileText, Image as ImageIcon, CheckCircle2, XCircle, Loader2, Download, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useApplicationDetail, useApplicationDocumentUrl, useApproveApplication, useRejectApplication,
} from "@/features/marketing/hooks/useMarketingQuery";
import { formatDate, formatDateTime, titleCase } from "@/features/marketing/utils/format";
import type { MarketerDocument } from "@/features/marketing/types";

const DOCUMENT_LABELS: Record<string, string> = {
  NIDA_FRONT: "NIDA Card — Front",
  NIDA_BACK: "NIDA Card — Back",
  TIN_CERTIFICATE: "TIN Certificate",
  PROFILE_PHOTO: "Profile Photo",
  SUPPORTING_DOCUMENT: "Supporting Document",
};

function DocumentCard({ applicationId, doc }: { applicationId: string; doc: MarketerDocument }) {
  const bucket = doc.document_type === "PROFILE_PHOTO" ? "marketer-avatars" : "marketer-documents";
  const { data: url, isLoading } = useApplicationDocumentUrl(applicationId, bucket, doc.storage_path);
  const isImage = doc.mime_type?.startsWith("image/");

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center hover:bg-accent ${!url ? "pointer-events-none opacity-60" : ""}`}
    >
      {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      <span className="truncate text-xs">{DOCUMENT_LABELS[doc.document_type] ?? doc.document_type}</span>
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Download className="h-3 w-3 text-muted-foreground" />}
    </a>
  );
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: detail, isLoading } = useApplicationDetail(params.id);
  const approve = useApproveApplication();
  const reject = useRejectApplication();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [role, setRole] = useState("MARKETER");
  const [reason, setReason] = useState("");

  if (isLoading || !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { marketer, documents, auditLog } = detail;

  const handleApprove = async () => {
    try {
      await approve.mutateAsync({ id: params.id, role });
      toast({ title: "Application approved" });
      setApproveOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not approve", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleReject = async () => {
    try {
      await reject.mutateAsync({ id: params.id, reason });
      toast({ title: "Application rejected" });
      setRejectOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not reject", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/marketing/applications" className="hover:text-foreground">Applications</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{marketer.full_name as string}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {marketer.google_avatar_url ? (
            <img src={marketer.google_avatar_url as string} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">?</div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{marketer.full_name as string}</h2>
            <p className="text-sm text-muted-foreground">{marketer.email as string} · Submitted {formatDate(marketer.submitted_at as string, "long")}</p>
          </div>
        </div>
        {marketer.approval_status === "PENDING" && (
          <div className="flex gap-2">
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setRejectOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{[marketer.first_name, marketer.middle_name, marketer.last_name].filter(Boolean).join(" ") || "—"}</p>
            <p className="text-muted-foreground">{marketer.gender ? titleCase(marketer.gender as string) : "—"} · Born {marketer.date_of_birth ? formatDate(marketer.date_of_birth as string, "long") : "—"}</p>
            <p className="text-muted-foreground">{marketer.phone as string ?? "—"}</p>
            <p className="text-muted-foreground">{marketer.physical_address as string ?? "—"}{marketer.district ? `, ${marketer.district}` : ""}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><ShieldCheck className="h-4 w-4" /> Identity</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>NIDA: {(marketer.nida_number as string) ?? "—"} {marketer.nida_verified ? <Badge className="ml-1 bg-success/15 text-success">Verified</Badge> : null}</p>
            <p>TIN: {(marketer.tin_number as string) ?? "—"} {marketer.tin_verified ? <Badge className="ml-1 bg-success/15 text-success">Verified</Badge> : null}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Employment</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{marketer.employment_type ? titleCase(marketer.employment_type as string) : "—"}</p>
            <p className="text-muted-foreground">Start date: {marketer.start_date ? formatDate(marketer.start_date as string, "long") : "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Emergency Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{(marketer.emergency_name as string) ?? "—"} {marketer.emergency_relation ? `(${titleCase(marketer.emergency_relation as string)})` : ""}</p>
            <p className="text-muted-foreground">{(marketer.emergency_phone as string) ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {documents.map((doc) => <DocumentCard key={doc.id} applicationId={params.id} doc={doc} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {auditLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Log</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{titleCase(entry.action)}{entry.reason ? ` — ${entry.reason}` : ""}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Application</DialogTitle>
            <DialogDescription>Grant {marketer.full_name as string} access to the marketer app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Role</p>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETER">Marketer</SelectItem>
                <SelectItem value="MARKETING_MANAGER">Marketing Manager</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide a reason — this will be shown to the applicant.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. TIN number could not be verified against TRA records." />
          {reason.trim().length > 0 && reason.trim().length < 10 && (
            <p className="text-xs text-destructive">Reason must be at least 10 characters.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending || reason.trim().length < 10}>
              {reject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
