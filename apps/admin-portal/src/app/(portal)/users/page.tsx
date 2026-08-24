'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PORTAL_ROLES, BRANCHES, type PortalRole, type Branch } from '@abbyscaterers/types';
import { useSupabaseClient } from '@/lib/supabase-client';
import { SuperAdminGate } from '@/components/admin/super-admin-gate';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage admin portal access, roles, and branches.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Add User
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="font-medium">Provision a new portal user</h2>
          <p className="text-xs text-muted-foreground">
            The user must already have a Clerk account — get their Clerk user id from the Clerk dashboard. This
            doesn&apos;t create a Clerk account, only grants it portal access.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Clerk User ID</label>
              <input
                value={newUser.id}
                onChange={(e) => setNewUser((u) => ({ ...u, id: e.target.value }))}
                placeholder="user_..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Full name</label>
              <input
                value={newUser.full_name}
                onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as PortalRole }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PORTAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Branch (optional — blank = all)</label>
              <select
                value={newUser.branch}
                onChange={(e) => setNewUser((u) => ({ ...u, branch: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          <button
            type="button"
            onClick={addUser}
            disabled={adding}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add User'}
          </button>
        </div>
      )}

      {usersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Email</th>
              <th className="py-2">Name</th>
              <th className="py-2">Role</th>
              <th className="py-2">Branch</th>
              <th className="py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.full_name ?? '—'}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as PortalRole })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {PORTAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <select
                    value={u.branch ?? ''}
                    onChange={(e) => updateUser(u.id, { branch: (e.target.value || null) as Branch | null })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">All branches</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={u.is_active}
                    onChange={(e) => updateUser(u.id, { is_active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
