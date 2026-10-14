'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from '@/lib/permissions';
import { getStaffUsers, setStaffUserActive, updateStaffUserRole, type StaffUser } from '@/services/staffUserService';

export function UsersAccessTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await getStaffUsers());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load users', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const apply = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast({ title: 'Saved', description: success });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not save change', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      await load();
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users &amp; Access</CardTitle>
        <CardDescription>
          Set each person&apos;s role and whether they can sign in. Changes take effect on their next page load and are recorded in the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-[220px]">Role</TableHead>
                <TableHead className="w-[100px] text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                // An admin must not be able to lock themselves out: there may be no other admin.
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.email} {isSelf && <Badge variant="secondary" className="ml-2">You</Badge>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        disabled={busyId === u.id || isSelf}
                        onValueChange={(role) =>
                          apply(u.id, () => updateStaffUserRole(u.id, role as StaffRole), `${u.email} is now ${ROLE_LABELS[role as StaffRole]}.`)
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={u.is_active}
                        disabled={busyId === u.id || isSelf}
                        aria-label={`Active: ${u.email}`}
                        onCheckedChange={(checked) =>
                          apply(u.id, () => setStaffUserActive(u.id, checked), `${u.email} ${checked ? 'activated' : 'deactivated'}.`)
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
