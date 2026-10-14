'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CONTRACT_TYPE_LABEL } from '@/lib/hr-docs/types/shared';
import { recordLegacyContract } from '@/services/hrRecordsService';
import type { ContractType, Employee } from '@/types';

/**
 * Records a contract that exists on paper but was never issued through the
 * system, so the contract history and the expiry reminders include it.
 * No letter is produced.
 */
export function LegacyContractDialog({ isOpen, setIsOpen, employee, hasActive, onSaved }: {
  isOpen: boolean; setIsOpen: (o: boolean) => void; employee: Employee; hasActive: boolean; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<ContractType>('fixed_term');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [notice, setNotice] = useState('');
  const [current, setCurrent] = useState<'active' | 'expired'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setType('fixed_term'); setStart(employee.employmentStartDate ?? ''); setEnd(''); setPosition(employee.role ?? '');
    setSalary(employee.monthlySalary ? String(employee.monthlySalary) : ''); setNotice('');
    setCurrent(hasActive ? 'expired' : 'active'); setError(null);
  }, [isOpen, employee, hasActive]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await recordLegacyContract({
        employeeId: employee.id, contractType: type, startDate: start, endDate: type === 'permanent' ? null : end,
        position, salary: salary ? Number(salary) : null, noticeDays: notice ? Number(notice) : null, status: current,
      });
      toast({ title: 'Contract recorded', description: current === 'active' ? 'Expiry reminders now cover it.' : 'Kept for the record.' });
      setIsOpen(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the contract.');
    } finally { setSaving(false); }
  };

  const ready = !!start && !!position.trim() && (type === 'permanent' || !!end);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !saving && setIsOpen(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record an existing contract</DialogTitle>
          <DialogDescription>
            For a contract signed before this system. Nothing is printed; it is added to {employee.firstName}&apos;s contract history
            {current === 'active' ? ' and expiry reminders will cover it.' : '.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Contract type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContractType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CONTRACT_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>This contract is</Label>
            <Select value={current} onValueChange={(v) => setCurrent(v as 'active' | 'expired')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active" disabled={hasActive}>The current contract</SelectItem>
                <SelectItem value="expired">A past contract (already ended)</SelectItem>
              </SelectContent>
            </Select>
            {hasActive && <p className="text-xs text-muted-foreground">There is already a current contract, so this can only be a past one.</p>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="lc-start">Start date</Label><Input id="lc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          {type !== 'permanent'
            ? <div className="space-y-1.5"><Label htmlFor="lc-end">End date</Label><Input id="lc-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} /></div>
            : <p className="self-end pb-2 text-sm text-muted-foreground">Permanent: no end date.</p>}
          <div className="space-y-1.5"><Label htmlFor="lc-pos">Position</Label><Input id="lc-pos" value={position} onChange={(e) => setPosition(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="lc-sal">Salary (TZS per month) <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="lc-sal" type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="lc-not">Notice (days) <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="lc-not" type="number" min={0} value={notice} onChange={(e) => setNotice(e.target.value)} /></div>
        </div>
        {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4" />{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={!ready || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record contract</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
