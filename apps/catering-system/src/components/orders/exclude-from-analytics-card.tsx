"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useStaffRole } from "@/hooks/use-staff-role";
import { setOrderIsTest } from "@/services/orderService";

/**
 * Admin-only "Exclude from analytics (test order)" switch (orders.is_test,
 * data-readiness Phase 3). Saved on its own, outside the order form, so the
 * form's behaviour is unchanged. The database refuses the change from
 * non-admins too (20261018150200_orders_is_test_admin_only.sql).
 */
export function ExcludeFromAnalyticsCard({ orderId, isTest }: { orderId: string; isTest: boolean }) {
  const { canManageSettings, isLoading } = useStaffRole();
  const { toast } = useToast();
  const [value, setValue] = useState(isTest);
  const [saving, setSaving] = useState(false);

  if (isLoading || !canManageSettings) return null;

  const onChange = async (next: boolean) => {
    setSaving(true);
    const ok = await setOrderIsTest(orderId, next);
    setSaving(false);
    if (ok) {
      setValue(next);
      toast({ title: next ? "Excluded from analytics" : "Included in analytics", description: `${orderId} ${next ? "is marked as a test order" : "counts as a real order"}.` });
    } else {
      toast({ variant: "destructive", title: "Not saved", description: "Could not change the test-order flag." });
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-0.5">
          <Label htmlFor="exclude-from-analytics" className="text-sm font-semibold">Exclude from analytics (test order)</Label>
          <p className="text-xs text-muted-foreground">Admins only. A test order is left out of reports, ML exports and the Data Quality page.</p>
        </div>
        <Switch id="exclude-from-analytics" checked={value} disabled={saving} onCheckedChange={onChange} />
      </CardContent>
    </Card>
  );
}
