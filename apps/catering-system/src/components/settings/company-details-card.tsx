'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getCompanyDetails, saveCompanyDetails } from '@/services/companySettingsService';

type Form = { name: string; address: string; phone: string; email: string; tin: string; vrn: string };
const EMPTY: Form = { name: '', address: '', phone: '', email: '', tin: '', vrn: '' };

/** The company details printed on HR letters. Shown, and editable, only to people who manage settings. */
export function CompanyDetailsCard() {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCompanyDetails()
      .then((d) => { setForm(d); setSaved(d); })
      .catch((err) => toast({ variant: 'destructive', title: 'Could not load the company details', description: err instanceof Error ? err.message : undefined }))
      .finally(() => setLoading(false));
  }, [toast]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveCompanyDetails(form);
      setSaved(form);
      toast({ title: 'Company details saved', description: 'New letters use them straight away. Letters already issued are unchanged.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details</CardTitle>
        <CardDescription>
          Printed on HR letters (as the letterhead when no header image is set) and available to letter templates as
          {' {{company.name}}, {{company.address}}'} and so on. Empty lines are left out.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="co-name">Company name</Label>
              <Input id="co-name" value={form.name} onChange={set('name')} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="co-address">Address</Label>
              <Textarea id="co-address" rows={3} value={form.address} onChange={set('address')} placeholder="One line per line, e.g. street and area, then P.O. Box and city" />
            </div>
            <div className="space-y-1.5"><Label htmlFor="co-phone">Phone</Label><Input id="co-phone" value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-email">Email</Label><Input id="co-email" type="email" value={form.email} onChange={set('email')} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-tin">TIN</Label><Input id="co-tin" value={form.tin} onChange={set('tin')} /></div>
            <div className="space-y-1.5"><Label htmlFor="co-vrn">VRN</Label><Input id="co-vrn" value={form.vrn} onChange={set('vrn')} /></div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={!dirty || saving || loading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save company details
        </Button>
      </CardFooter>
    </Card>
  );
}
