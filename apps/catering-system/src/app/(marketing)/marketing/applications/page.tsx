"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCheck, FileText } from "lucide-react";
import { usePendingApplications } from "@/features/marketing/hooks/useMarketingQuery";
import { formatDate, titleCase } from "@/features/marketing/utils/format";
import type { PendingApplication } from "@/features/marketing/types";

// google_avatar_url is the applicant's public Google account picture —
// unlike marketer_documents.storage_path, it's already a plain HTTPS URL
// and needs no signed-URL exchange.
function ApplicantAvatar({ url }: { url: string | null }) {
  if (!url) {
    return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">?</div>;
  }
  return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />;
}

function ApplicationCard({ application }: { application: PendingApplication }) {
  return (
    <Link href={`/marketing/applications/${application.id}`}>
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="flex items-center gap-4 p-4">
          <ApplicantAvatar url={application.google_avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{application.full_name}</p>
            <p className="truncate text-sm text-muted-foreground">{application.email}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {application.region_name && <Badge variant="outline">{application.region_name}</Badge>}
              {application.employment_type && <Badge variant="secondary">{titleCase(application.employment_type)}</Badge>}
              <Badge variant="outline" className="gap-1">
                <FileText className="h-3 w-3" /> {application.document_count} docs
              </Badge>
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            Submitted<br />{formatDate(application.submitted_at, "relative")}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ApplicationsPage() {
  const { data: applications, isLoading } = usePendingApplications();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Pending Marketer Applications</h2>
        <p className="text-sm text-muted-foreground">Review identity and employment details before granting field access.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !applications || applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No pending applications. New marketer sign-ups will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}
