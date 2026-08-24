'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStaffRole } from '@/hooks/use-staff-role';
import { getAllTaxRates, addTaxRate } from '@/services/taxRatesService';
import { getErrorDescription } from '@/lib/service-validation';
import { formatTZS } from '@/lib/formatCurrency';
import type { PayeBand } from '@/lib/payrollEngine';

interface TaxRateRow extends PayeBand { }

export function TaxRatesPageComponent() {
  const { isAdmin, isLoading: roleLoading } = useStaffRole();
  const { toast } = useToast();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getAllTaxRates>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [bands, setBands] = useState<TaxRateRow[]>([{ min: 0, max: null, rate: 0 }]);
  const [nssfEmployeeRate, setNssfEmployeeRate] = useState(0.10);
  const [nssfEmployerRate, setNssfEmployerRate] = useState(0.10);
  const [sdlRate, setSdlRate] = useState(0.035);
  const [wcfRate, setWcfRate] = useState(0.005);
  const [notes, setNotes] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setHistory(await getAllTaxRates());
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const addBandRow = () => setBands(prev => [...prev, { min: prev[prev.length - 1]?.max ?? 0, max: null, rate: 0 }]);
  const removeBandRow = (idx: number) => setBands(prev => prev.filter((_, i) => i !== idx));
  const updateBand = (idx: number, field: keyof PayeBand, value: number | null) => {
    setBands(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await addTaxRate({
        effectiveFrom,
        effectiveTo: null,
        payeBands: bands,
        nssfEmployeeRate,
        nssfEmployerRate,
        sdlRate,
        wcfRate,
        notes,
      });
      toast({ title: 'New tax rate version created', description: 'It is now the active rate set for new payslips.' });
      setEffectiveFrom('');
      setNotes('');
      await loadHistory();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save tax rates', description: getErrorDescription(error) });
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading) {
    return <main className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }

  if (!isAdmin) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>Only admins can view or edit statutory tax rates.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <h1 className="font-headline text-2xl font-bold">Payroll Tax Rates</h1>

      <Card>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
          <CardDescription>Payslips are always computed against whichever version was active on their pay period — changing rates here never rewrites past payslips.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>NSSF (Emp/Er)</TableHead>
                  <TableHead>SDL</TableHead>
                  <TableHead>WCF</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.effectiveFrom}</TableCell>
                    <TableCell>{r.effectiveTo ?? '—'}</TableCell>
                    <TableCell>{(r.nssfEmployeeRate * 100).toFixed(1)}% / {(r.nssfEmployerRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(r.sdlRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{(r.wcfRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{!r.effectiveTo ? <Badge>Active</Badge> : <Badge variant="outline">Closed</Badge>}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tax rate versions yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Rate Version</CardTitle>
          <CardDescription>Saving this closes out the current active version and makes this the new active one from the effective date onward.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="effectiveFrom">Effective From</Label>
              <Input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="nssfEmployeeRate">NSSF Employee %</Label>
              <Input id="nssfEmployeeRate" type="number" step="0.001" value={nssfEmployeeRate} onChange={(e) => setNssfEmployeeRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="nssfEmployerRate">NSSF Employer %</Label>
              <Input id="nssfEmployerRate" type="number" step="0.001" value={nssfEmployerRate} onChange={(e) => setNssfEmployerRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="sdlRate">SDL %</Label>
              <Input id="sdlRate" type="number" step="0.001" value={sdlRate} onChange={(e) => setSdlRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="wcfRate">WCF %</Label>
              <Input id="wcfRate" type="number" step="0.001" value={wcfRate} onChange={(e) => setWcfRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Finance Act 2027 update" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>PAYE Bands (TZS, monthly)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addBandRow}>
                <PlusCircle className="mr-2 h-3.5 w-3.5" /> Add Band
              </Button>
            </div>
            <div className="space-y-2">
              {bands.map((band, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input type="number" placeholder="Min" value={band.min} onChange={(e) => updateBand(idx, 'min', parseFloat(e.target.value) || 0)} />
                  <Input type="number" placeholder="Max (blank = and above)" value={band.max ?? ''} onChange={(e) => updateBand(idx, 'max', e.target.value === '' ? null : parseFloat(e.target.value))} />
                  <Input type="number" step="0.01" placeholder="Rate (0-1)" value={band.rate} onChange={(e) => updateBand(idx, 'rate', parseFloat(e.target.value) || 0)} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeBandRow(idx)} disabled={bands.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !effectiveFrom}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save New Version
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
