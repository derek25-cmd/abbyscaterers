'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileSignature, Loader2, Lock, Undo2 } from 'lucide-react';
import { usePortalRole } from '@/lib/portal-role';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useAppSettings } from '@/lib/use-app-settings';
import {
  HR_LETTER_APPROVER_ROLES, approveLetter, cannotApproveOwn, listPendingLetters, returnLetter, type PendingLetter,
} from '@/lib/hr-letters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

/** The letter as it will print: letterhead, date, addressee, subject, text, signature and stamp. */
function LetterSheet({ letter }: { letter: PendingLetter }) {
  const settings = useAppSettings().data;
  const p = letter.preview;
  if (!p) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No preview was saved for this letter. Ask HR to return it to draft and send it again.</p>;
  }
  return (
    <div className="mx-auto max-w-[700px] bg-white p-6 text-[13px] leading-relaxed text-black shadow-sm ring-1 ring-black/5">
      {settings?.headerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.headerUrl} alt="" className="mb-4 max-h-28 w-full object-contain" />
      )}
      <div className="mb-4 text-right text-xs">
        <p>Ref: <span className="italic text-neutral-500">given when issued</span></p>
        <p>{p.date}</p>
      </div>
      <div className="mb-4">{p.addressee.map((line, i) => <p key={i}>{line}</p>)}</div>
      <p className="mb-4 font-bold">{p.subject}</p>
      {p.paragraphs.map((para, i) => (
        <p key={i} className="mb-3 whitespace-pre-line">
          {para.map((seg, j) => (seg.bold ? <strong key={j}>{seg.text}</strong> : <span key={j}>{seg.text}</span>))}
        </p>
      ))}
      <div className="mt-6">
        <p>Yours sincerely,</p>
        <div className="relative">
          <div className="flex h-12 items-end">
            {settings?.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.signatureUrl} alt="Signature" className="max-h-12 w-auto object-contain mix-blend-multiply" />
            )}
          </div>
          {settings?.invoiceStampUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.invoiceStampUrl} alt="Stamp" className="absolute left-60 top-0 h-28 w-28 object-contain mix-blend-multiply" />
          )}
          <div className="w-56 border-t border-black pt-1 text-neutral-500 italic">Name and title of the approver</div>
        </div>
      </div>
      {p.confidential && <p className="mt-6 text-[10px] font-bold text-red-900">CONFIDENTIAL</p>}
    </div>
  );
}

function LetterDialog({ letter, onClose }: { letter: PendingLetter | null; onClose: () => void }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'return'>('view');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!letter) return null;
  const ownBlocked = cannotApproveOwn(letter);

  const close = () => { if (busy) return; setMode('view'); setNote(''); setError(null); setDone(null); onClose(); };
  const run = async (action: 'approve' | 'return') => {
    setBusy(true); setError(null);
    try {
      if (action === 'approve') await approveLetter(supabase, letter.id);
      else await returnLetter(supabase, letter.id, note);
      setDone(action === 'approve'
        ? 'Approved. HR has been told and can now issue it.'
        : 'Returned to the author with your note.');
      await queryClient.invalidateQueries({ queryKey: ['hr-letters-pending'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {letter.type_label}: {letter.subject}
            {letter.confidential && <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" />Confidential</Badge>}
          </DialogTitle>
          <DialogDescription>
            For {letter.person}. Written by {letter.author_email ?? 'HR'} on {when(letter.written_at)}.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900"><CheckCircle2 className="h-5 w-5" />{done}</p>
        ) : (
          <>
            <div className="rounded-md bg-muted/40 p-3"><LetterSheet letter={letter} /></div>
            {ownBlocked && (
              <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />You wrote this letter. A {letter.type_label.toLowerCase()} must be approved by someone else.
              </p>
            )}
            {mode === 'return' && (
              <div className="space-y-1.5">
                <Label htmlFor="return-note">What needs to change?</Label>
                <Textarea id="return-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please correct the last working day." />
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

        <DialogFooter className="gap-2">
          {done ? (
            <Button onClick={close}>Close</Button>
          ) : mode === 'return' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('view')} disabled={busy}>Back</Button>
              <Button variant="outline" onClick={() => run('return')} disabled={busy || note.trim().length < 3}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Return for changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('return')} disabled={busy}><Undo2 className="mr-2 h-4 w-4" />Return for changes</Button>
              <Button onClick={() => run('approve')} disabled={busy || ownBlocked || !letter.preview}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HrLettersPage() {
  const supabase = useSupabaseClient();
  const { role, loading: roleLoading } = usePortalRole();
  const allowed = !!role && (HR_LETTER_APPROVER_ROLES as readonly string[]).includes(role);
  const [open, setOpen] = useState<PendingLetter | null>(null);

  const letters = useQuery({
    queryKey: ['hr-letters-pending'],
    queryFn: () => listPendingLetters(supabase),
    enabled: allowed,
  });

  if (roleLoading) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>;
  if (!allowed) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">HR letters are approved by super admins and management.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FileSignature className="h-6 w-6" />HR letters awaiting approval</h1>
        <p className="text-sm text-muted-foreground">Read each letter as it will print, then approve it or return it with a note. HR issues approved letters.</p>
      </div>

      {letters.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading letters…</p>
      ) : letters.error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{(letters.error as Error).message}</p>
      ) : (letters.data ?? []).length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No letters are waiting for approval.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {letters.data!.map((l) => (
            <Card key={l.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setOpen(l)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {l.type_label}
                  {l.confidential && <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" />Confidential</Badge>}
                  {cannotApproveOwn(l) && <Badge variant="outline">Written by you</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{l.subject}</p>
                <p className="text-muted-foreground">For {l.person} · by {l.author_email ?? 'HR'} · {when(l.written_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LetterDialog letter={open} onClose={() => setOpen(null)} />
    </div>
  );
}
