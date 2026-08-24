'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PORTAL_ROLES, BRANCHES, type PortalRole, type Branch } from '@abbyscaterers/types';
import { useSupabaseClient } from '@/lib/supabase-client';
import { SuperAdminGate } from '@/components/admin/super-admin-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const selectClass = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
const selectClassSm = 'rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

interface PortalUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: PortalRole;
  branch: Branch | null;
  is_active: boolean;
}

function UsersAdmin() {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ id: '', email: '', full_name: '', role: 'staff' as PortalRole, branch: '' });
  const [adding, setAdding] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['portal-users-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_users')
        .select('id, email, full_name, role, branch, is_active')
        .order('email', { ascending: true });
      if (error) throw error;
      return data as PortalUserRow[];
    },
  });

  const updateUser = async (id: string, updates: Partial<Pick<PortalUserRow, 'role' | 'branch' | 'is_active'>>) => {
    setError(null);
    const { error } = await supabase.from('portal_users').update(updates).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['portal-users-admin'] });
  };

  const addUser = async () => {
    if (!newUser.id.trim() || !newUser.email.trim()) {
      setError('Clerk user id and email are required');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const { error } = await supabase.from('portal_users').insert({
        id: newUser.id.trim(),
        email: newUser.email.trim(),
        full_name: newUser.full_name.trim() || null,
        role: newUser.role,
        branch: newUser.branch || null,
      });
      if (error) throw error;
      setNewUser({ id: '', email: '', full_name: '', role: 'staff', branch: '' });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['portal-users-admin'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage admin portal access, roles, and branches.</p>
        </div>
        <Button type="button" onClick={() => setShowAdd((v) => !v)}>
          Add User
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Provision a new portal user</CardTitle>
            <p className="text-xs text-muted-foreground">
              The user must already have a Clerk account — get their Clerk user id from the Clerk dashboard. This
              doesn&apos;t create a Clerk account, only grants it portal access.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Clerk User ID</Label>
              <Input
                value={newUser.id}
                onChange={(e) => setNewUser((u) => ({ ...u, id: e.target.value }))}
                placeholder="user_..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Email</Label>
              <Input
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Full name</Label>
              <Input
                value={newUser.full_name}
                onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Role</Label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as PortalRole }))}
                className={selectClass}
              >
                {PORTAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Branch (optional — blank = all)</Label>
              <select
                value={newUser.branch}
                onChange={(e) => setNewUser((u) => ({ ...u, branch: e.target.value }))}
                className={selectClass}
              >
                <option value="">All branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="button" onClick={addUser} disabled={adding}>
            {adding ? 'Adding…' : 'Add User'}
          </Button>
          </CardContent>
        </Card>
      )}

      {usersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(usersQuery.data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.full_name ?? '—'}</TableCell>
                <TableCell>
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as PortalRole })}
                    className={selectClassSm}
                  >
                    {PORTAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    value={u.branch ?? ''}
                    onChange={(e) => updateUser(u.id, { branch: (e.target.value || null) as Branch | null })}
                    className={selectClassSm}
                  >
                    <option value="">All branches</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={u.is_active}
                    onCheckedChange={(checked) => updateUser(u.id, { is_active: checked === true })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <SuperAdminGate>
      <UsersAdmin />
    </SuperAdminGate>
  );
}
