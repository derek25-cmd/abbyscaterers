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
import { getStaffUsers, setStaffUserActive, setStaffUserEmployee, updateStaffUserRole, type StaffUser } from '@/services/staffUserService';
import { getEmployeeDirectory } from '@/services/employeeService';
import type { Employee } from '@/types';

const NOT_LINKED = '__none__';

export function UsersAccessTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  useEffect(() => { void getEmployeeDirectory().then(setEmployees); }, []);

  const employeeName = (e: Employee) => `${e.firstName} ${e.lastName}${e.department ? ` — ${e.department}` : ''}`;
  // Employees already linked to another login are hidden, so one employee cannot end up with two logins.
  const takenBy = new Map(users.filter((u) => u.employee_id).map((u) => [u.employee_id as string, u.id]));

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
          Set each person&apos;s role and whether they can sign in. Link a login to the employee record it belongs to, so leave requests are filed under the right person and nobody can approve their own leave. Changes take effect on their next page load and are recorded in the audit trail.
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
                <TableHead className="w-[280px]">Linked employee</TableHead>
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
                    <TableCell>
                      <Select
                        value={u.employee_id ?? NOT_LINKED}
                        disabled={busyId === u.id}
                        onValueChange={(v) => {
                          const next = v === NOT_LINKED ? null : v;
                          const who = next ? employeeName(employees.find((e) => e.id === next) as Employee) : 'no employee';
                          void apply(u.id, () => setStaffUserEmployee(u.id, next), `${u.email} is now linked to ${who}.`);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOT_LINKED}>Not linked to an employee</SelectItem>
                          {employees
                            .filter((e) => !takenBy.has(e.id) || takenBy.get(e.id) === u.id)
                            .map((e) => <SelectItem key={e.id} value={e.id}>{employeeName(e)}</SelectItem>)}
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
