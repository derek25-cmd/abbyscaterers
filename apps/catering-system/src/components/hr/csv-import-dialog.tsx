'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, Upload, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { readTable, type CheckedRow } from '@/lib/hr-import';

export interface CsvImportDialogProps<T extends string> {
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  title: string;
  description: string;
  columns: readonly T[];
  templateCsv: () => string | Promise<string>;
  templateName: string;
  /** Loads what the rows are checked against, and returns the checker. */
  prepare: () => Promise<(rows: Record<T, string>[]) => CheckedRow<T>[]>;
  /** Imports the valid rows (one call, all or nothing); returns the summary line. */
  importRows: (rows: Record<T, string>[]) => Promise<string>;
  onImported?: () => void;
}

type Stage = 'choose' | 'preview' | 'done';

/**
 * Template → upload → preview (every row checked, with the reason it would be
 * skipped) → import the valid rows in one go → summary.
 */
export function CsvImportDialog<T extends string>(props: CsvImportDialogProps<T>) {
  const { isOpen, setIsOpen, title, description, columns, templateCsv, templateName, prepare, importRows, onImported } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [checked, setChecked] = useState<CheckedRow<T>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStage('choose'); setChecked([]); setFileName(''); setError(null); setSummary('');
  }, [isOpen]);

  const valid = checked.filter((r) => r.errors.length === 0);
  const skipped = checked.filter((r) => r.errors.length > 0);

  const download = async () => {
    const blob = new Blob([await templateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = templateName; a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setFileName(file.name);
    try {
      const table = readTable(await file.text(), columns);
      if (table.error) { setError(table.error); return; }
      const check = await prepare();
      setChecked(check(table.rows));
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async () => {
    setBusy(true); setError(null);
    try {
      const line = await importRows(valid.map((r) => r.values));
      setSummary(line);
      setStage('done');
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed. Nothing was imported.');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !busy && setIsOpen(o)}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {stage === 'choose' && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Download the template and fill it in (one row per line, at most 500 rows). Keep the first line as it is.</li>
              <li>Save it as CSV and choose it below. Nothing is imported until you confirm the preview.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download template</Button>
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Choose CSV file
              </Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {stage === 'preview' && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{fileName}</span>: <Badge variant="secondary">{valid.length} ready</Badge>{' '}
              {skipped.length > 0 && <Badge variant="destructive">{skipped.length} will be skipped</Badge>}
            </p>
            <ScrollArea className="h-[50vh] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Line</TableHead>
                    {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checked.map((r) => (
                    <TableRow key={r.line} className={r.errors.length ? 'bg-red-50' : undefined}>
                      <TableCell>{r.line}</TableCell>
                      {columns.map((c) => <TableCell key={c} className="whitespace-nowrap">{r.values[c]}</TableCell>)}
                      <TableCell className="min-w-56 text-sm">
                        {r.errors.length
                          ? <span className="flex gap-1 text-red-800"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{r.errors.join(' ')}</span>
                          : <span className="flex gap-1 text-green-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{r.note}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              The {valid.length} ready row(s) are imported together: if the system refuses any of them, none are imported and the reason is shown here.
            </p>
          </div>
        )}

        {stage === 'done' && (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-green-800"><CheckCircle2 className="h-5 w-5" />{summary}</p>
            {skipped.length > 0 && (
              <div>
                <p className="font-medium">Skipped ({skipped.length}): fix them in the file and import just those rows again.</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {skipped.map((r) => <li key={r.line}>Line {r.line}: {r.errors.join(' ')}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

        <DialogFooter>
          {stage === 'preview' && <Button variant="ghost" onClick={() => setStage('choose')} disabled={busy}>Choose another file</Button>}
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={busy}>{stage === 'done' ? 'Close' : 'Cancel'}</Button>
          {stage === 'preview' && (
            <Button onClick={runImport} disabled={busy || valid.length === 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {valid.length} row(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
