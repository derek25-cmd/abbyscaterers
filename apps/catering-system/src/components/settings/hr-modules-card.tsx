'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { HR_MODULES, HR_MODULE_LABELS, saveHrModules, useHrModules, type HrModule } from '@/lib/hr-modules';

/**
 * Admin only: which HR modules the app shows. A safety switch: turning a module
 * off hides its screens and stops its daily job straight away, without a
 * deploy. Nothing is deleted and the database rules stay in force.
 */
export function HrModulesCard() {
  const { toast } = useToast();
  const current = useHrModules();
  const [chosen, setChosen] = useState<Set<HrModule>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (current) setChosen(new Set(current)); }, [current]);

  const dirty = !!current && (chosen.size !== current.size || [...chosen].some((m) => !current.has(m)));
  const toggle = (m: HrModule, on: boolean) => setChosen((s) => { const n = new Set(s); if (on) n.add(m); else n.delete(m); return n; });

  const save = async () => {
    setSaving(true);
    try {
      await saveHrModules([...chosen]);
      toast({ title: 'HR modules saved', description: 'Everyone sees the change the next time a page loads.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save', description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>HR modules</CardTitle>
        <CardDescription>
          Switch parts of the HR system off and on, for example if something goes wrong after go-live. Switching off hides
          the screens and pauses the daily job; no data is deleted. &quot;End employment without a letter&quot; and Users &amp;
          Access are always available. Letter types need HR Documents; Candidates needs both.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {!current ? <Loader2 className="h-5 w-5 animate-spin" /> : HR_MODULES.map((m) => (
          <div key={m} className="flex items-center gap-2">
            <Checkbox id={`hrmod-${m}`} checked={chosen.has(m)} onCheckedChange={(v) => toggle(m, v === true)} />
            <Label htmlFor={`hrmod-${m}`} className="font-normal">{HR_MODULE_LABELS[m]}</Label>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
      </CardFooter>
    </Card>
  );
}
