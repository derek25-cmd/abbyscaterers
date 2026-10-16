'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton({ variant = 'outline', ...props }: ButtonProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await getBrowserSupabase().auth.signOut();
        window.location.replace('/login');
      }}
      {...props}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out
    </Button>
  );
}
