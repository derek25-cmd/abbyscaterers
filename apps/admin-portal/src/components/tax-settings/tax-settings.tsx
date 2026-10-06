'use client';

import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { usePortalRole } from '@/lib/portal-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export type TaxType = 'vat' | 'wht' | 'vat_withholding';

const TAX_TYPE_LABEL: Record<TaxType, string> = {
  vat: 'VAT',
  wht: 'WHT (Withholding Tax)',
  vat_withholding: 'VAT Withholding',
};

const TAX_TYPES: TaxType[] = ['vat', 'wht', 'vat_withholding'];

// VAT is the statutory default in Tanzania — it applies unless a client is
// explicitly marked exempt. WHT/VAT Withholding are the opposite: they only
// apply to specific clients (e.g. government/appointed withholding agents),
// so a client with no row for them defaults to "doesn't apply". Shared with
// invoice-detail.tsx's computation so the checkbox state and the actual tax
// math never disagree about what "unset" means.
export const TAX_DEFAULT_APPLIES: Record<TaxType, boolean> = {
  vat: true,
  wht: false,
  vat_withholding: false,
};

interface TaxRateRow {
  tax_type: TaxType;
  rate: number;
}

interface ClientRow {
  id: string;
  companyName: string;
}

interface ClientTaxSettingRow {
  client_id: string;
  tax_type: TaxType;
  applies: boolean;
}

/**
 * Writes are RLS-gated to super_admin/finance (invoice_tax_rates_write /
 * client_invoice_tax_settings_write, supabase/migrations/20260901140000_tax_settings.sql)
 * — this role check is UI-only, same documented convention as usePortalRole
 * itself: it decides what to show, never what to allow.
 */
export function TaxSettings() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { role, loading: roleLoading } = usePortalRole();
  const [search, setSearch] = useState('');
  const [rateDrafts, setRateDrafts] = useState<Partial<Record<TaxType, string>>>({});
  const [savingRate, setSavingRate] = useState<TaxType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = role === 'super_admin' || role === 'finance';

  const ratesQuery = useQuery({
    queryKey: ['invoice-tax-rates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_tax_rates').select('tax_type, rate');
      if (error) throw error;
      return data as TaxRateRow[];
    },
  });

  const clientsQuery = useQuery({
    queryKey: ['clients-for-tax-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, companyName')
        .order('companyName', { ascending: true });
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const clientTaxQuery = useQuery({
    queryKey: ['client-tax-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_invoice_tax_settings').select('client_id, tax_type, applies');
      if (error) throw error;
      return data as ClientTaxSettingRow[];
    },
  });

  const appliesMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (clientTaxQuery.data ?? []).forEach((row) => map.set(`${row.client_id}:${row.tax_type}`, row.applies));
    return map;
  }, [clientTaxQuery.data]);

  const filteredClients = useMemo(() => {
    const clients = clientsQuery.data ?? [];
    if (!search.trim()) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter((c) => c.companyName.toLowerCase().includes(q));
  }, [clientsQuery.data, search]);

  const saveRate = async (taxType: TaxType) => {
    const draft = rateDrafts[taxType];
    if (draft === undefined) return;
    const rate = Number(draft);
    if (!Number.isFinite(rate) || rate < 0) {
      setError('Rate must be a non-negative number');
      return;
    }
    setSavingRate(taxType);
    setError(null);
    try {
      const { error } = await supabase
        .from('invoice_tax_rates')
        .upsert({ tax_type: taxType, rate, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
      if (error) throw error;
      setRateDrafts((prev) => ({ ...prev, [taxType]: undefined }));
      queryClient.invalidateQueries({ queryKey: ['invoice-tax-rates'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rate');
    } finally {
      setSavingRate(null);
    }
  };

  const toggleClientTax = async (clientId: string, taxType: TaxType, next: boolean) => {
    setError(null);
    // Optimistic update so a row of checkboxes doesn't feel laggy.
    queryClient.setQueryData<ClientTaxSettingRow[]>(['client-tax-settings'], (prev) => {
      const rest = (prev ?? []).filter((r) => !(r.client_id === clientId && r.tax_type === taxType));
      return [...rest, { client_id: clientId, tax_type: taxType, applies: next }];
    });
    try {
      const { error } = await supabase.from('client_invoice_tax_settings').upsert({
        client_id: clientId,
        tax_type: taxType,
        applies: next,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client tax setting');
      queryClient.invalidateQueries({ queryKey: ['client-tax-settings'] });
    }
  };

  if (roleLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!canEdit) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        You don&apos;t have access to Tax Settings. This is restricted to Super Admin and Finance roles.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Tax Rates</CardTitle>
        </CardHeader>
        <CardContent>
        {ratesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {TAX_TYPES.map((taxType) => {
              const current = ratesQuery.data?.find((r) => r.tax_type === taxType);
              const draft = rateDrafts[taxType];
              return (
                <div key={taxType} className="flex items-center gap-3">
                  <span className="w-48 text-sm">{TAX_TYPE_LABEL[taxType]}</span>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={draft ?? current?.rate ?? ''}
                      onChange={(e) => setRateDrafts((prev) => ({ ...prev, [taxType]: e.target.value }))}
                      className="w-28 pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveRate(taxType)}
                    disabled={savingRate === taxType || draft === undefined}
                  >
                    {savingRate === taxType ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Client Tax Applicability</CardTitle>
            <p className="text-xs text-muted-foreground mt-1.5">
              VAT applies to every client by default — untick it only for VAT-exempt clients. WHT and VAT
              Withholding are off by default and only apply to the clients you tick (e.g. government or
              appointed withholding agents).
            </p>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-56"
          />
        </CardHeader>
        <CardContent>
        {clientsQuery.isLoading || clientTaxQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  {TAX_TYPES.map((taxType) => (
                    <TableHead key={taxType} className="text-center">
                      {TAX_TYPE_LABEL[taxType]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>{client.companyName}</TableCell>
                    {TAX_TYPES.map((taxType) => (
                      <TableCell key={taxType} className="text-center">
                        <Checkbox
                          checked={appliesMap.get(`${client.id}:${taxType}`) ?? TAX_DEFAULT_APPLIES[taxType]}
                          onCheckedChange={(checked) => toggleClientTax(client.id, taxType, checked === true)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={TAX_TYPES.length + 1} className="text-center text-muted-foreground">
                      No clients found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
