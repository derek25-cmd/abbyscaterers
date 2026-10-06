'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { PORTAL_ROLES, BRANCHES, type PortalRole, type Branch } from '@abbyscaterers/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const selectClass = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

export interface UserCardData {
  id: string;
  email: string;
  full_name: string | null;
  role: PortalRole;
  branch: Branch | null;
  is_active: boolean;
}

export function UserCard({
  user,
  onUpdate,
}: {
  user: UserCardData;
  onUpdate: (id: string, updates: Partial<Pick<UserCardData, 'role' | 'branch' | 'is_active'>>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-foreground">{user.email}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Edit user">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{user.full_name ?? '—'}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="secondary">{user.role}</Badge>
            <Badge variant="outline">{user.branch ?? 'All branches'}</Badge>
            <Badge variant="outline" className={user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-destructive/10 text-destructive'}>
              {user.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{user.email}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground font-normal">Role</Label>
              <select
                value={user.role}
                onChange={(e) => onUpdate(user.id, { role: e.target.value as PortalRole })}
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
              <Label className="text-xs text-muted-foreground font-normal">Branch</Label>
              <select
                value={user.branch ?? ''}
                onChange={(e) => onUpdate(user.id, { branch: (e.target.value || null) as Branch | null })}
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="user-active"
                checked={user.is_active}
                onCheckedChange={(checked) => onUpdate(user.id, { is_active: checked === true })}
              />
              <Label htmlFor="user-active" className="font-normal">
                Active
              </Label>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
