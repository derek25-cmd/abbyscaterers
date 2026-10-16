'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileDown, FilePlus2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DocStatusBadge } from '@/components/hr/doc-status-badge';
import { HrDocumentDialog } from '@/components/hr/hr-document-dialog';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import { useToast } from '@/hooks/use-toast';
import { exportDocumentPdf, listDocuments } from '@/services/hrDocumentService';
import type { HrDocumentView } from '@/types';

/** An employee's HR letters, newest first, with PDF export for the issued ones. HR roles only. */
export function EmployeeDocumentsTab({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<HrDocumentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    listDocuments({ employeeId })
      .then((d) => { setDocs(d); setError(null); })
      .catch((err) => { setDocs([]); setError(err instanceof Error ? err.message : 'Could not load the documents.'); });
  }, [employeeId]);
  useEffect(() => { setDocs(null); load(); }, [load]);

  const download = async (id: string) => {
    try { await exportDocumentPdf(id); }
    catch (err) { toast({ variant: 'destructive', title: 'Could not export the PDF', description: err instanceof Error ? err.message : undefined }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-primary">HR documents</h3>
        <Button size="sm" onClick={() => setWizard(true)}><FilePlus2 className="mr-2 h-4 w-4" />Generate letter</Button>
      </div>
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Subject</TableHead><TableHead>Stage</TableHead><TableHead>Date</TableHead><TableHead className="w-[1%]"><span className="sr-only">Export PDF</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {docs === null && <TableRow><TableCell colSpan={5} className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {docs?.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => setOpenId(d.id)}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{d.ref_no ?? '—'}</TableCell>
                <TableCell>{d.subject}<span className="block text-xs text-muted-foreground">{d.type_label}</span></TableCell>
                <TableCell><DocStatusBadge doc={d} /></TableCell>
                <TableCell className="whitespace-nowrap text-xs">{format(parseISO(d.issued_at ?? d.created_at), 'd MMM yyyy')}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {d.status === 'issued' && <Button variant="ghost" size="icon" aria-label={`Export ${d.subject} as PDF`} title="Export PDF" onClick={() => download(d.id)}><FileDown className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {docs && docs.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No HR letters for {employeeName} yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <NewDocumentWizard isOpen={wizard} setIsOpen={setWizard} defaultEmployeeId={employeeId} onSaved={(d) => { load(); setOpenId(d.id); }} />
      <HrDocumentDialog documentId={openId} isOpen={!!openId} setIsOpen={(o) => !o && setOpenId(null)} onChanged={load} />
    </div>
  );
}
