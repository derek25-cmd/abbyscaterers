'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCandidate, updateCandidate, type CandidateInput } from '@/services/candidateService';
import type { Candidate } from '@/types';

const EMPTY: CandidateInput = {
  full_name: '', phone: '', email: '', address: '', position: '', department: '', proposed_salary: '', proposed_start_date: '', notes: '',
};

/** Add or edit a job candidate: who they are and what is being discussed with them. */
export function CandidateDialog({ isOpen, setIsOpen, candidate, onSaved }: {
  isOpen: boolean; setIsOpen: (o: boolean) => void; candidate?: Candidate | null; onSaved?: (c: Candidate) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<CandidateInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setForm(candidate ? {
      full_name: candidate.full_name, phone: candidate.phone ?? '', email: candidate.email ?? '', address: candidate.address ?? '',
      position: candidate.position ?? '', department: candidate.department ?? '', proposed_salary: candidate.proposed_salary ?? '',
      proposed_start_date: candidate.proposed_start_date ?? '', notes: candidate.notes ?? '',
    } : EMPTY);
  }, [isOpen, candidate]);

  const set = (k: keyof CandidateInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const saved = candidate ? await updateCandidate(candidate.id, form) : await createCandidate(form);
      toast({ title: candidate ? 'Candidate updated' : 'Candidate added', description: saved.full_name });
      setIsOpen(false);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the candidate.');
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof CandidateInput, label: string, type = 'text', optional = true) => (
    <div className="space-y-1.5">
      <Label htmlFor={`c-${k}`}>{label}{optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
      <Input id={`c-${k}`} type={type} value={String(form[k] ?? '')} onChange={set(k)} />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !saving && setIsOpen(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Edit candidate' : 'Add a candidate'}</DialogTitle>
          <DialogDescription>The person you may offer a job to. The offer letter is prepared from here.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{field('full_name', 'Full name', 'text', false)}</div>
          {field('phone', 'Phone', 'tel')}
          {field('email', 'Email', 'email')}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-address">Address <span className="font-normal text-muted-foreground">(optional; printed on the offer letter)</span></Label>
            <Textarea id="c-address" rows={2} value={String(form.address ?? '')} onChange={set('address')} />
          </div>
          {field('position', 'Position being considered')}
          {field('department', 'Department')}
          {field('proposed_salary', 'Proposed salary (TZS per month)', 'number')}
          {field('proposed_start_date', 'Proposed start date', 'date')}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="c-notes" rows={3} value={String(form.notes ?? '')} onChange={set('notes')} />
          </div>
        </div>
        {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4" />{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || String(form.full_name).trim().length < 2}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
