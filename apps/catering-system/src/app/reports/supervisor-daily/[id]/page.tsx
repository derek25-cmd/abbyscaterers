'use client';

import { useParams } from "next/navigation";
import { SupervisorReportForm } from "@/components/reports/supervisor-report-form";

export default function EditSupervisorReportPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : undefined;

  return (
    <div className="container mx-auto p-6">
      <SupervisorReportForm reportId={id} />
    </div>
  );
}
