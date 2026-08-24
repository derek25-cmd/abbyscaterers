"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
    if (oauthError) {
      router.replace(`/login?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      router.replace("/login?error=no_code");
      return;
    }

    (async () => {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError || !data.session) {
        setError(exchangeError?.message ?? "Could not complete sign-in.");
        router.replace(`/login?error=${encodeURIComponent(exchangeError?.message ?? "exchange_failed")}`);
        return;
      }

      const user = data.session.user;
      const email = user.email;

      if (email) {
        const { data: existing } = await supabase
          .from("marketing_users")
          .select("id, auth_user_id")
          .eq("email", email)
          .maybeSingle();

        const googleName = (user.user_metadata?.full_name as string | undefined) ?? email;
        const googleAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

        if (!existing) {
          // First sign-in via this email — provision a row in the same shape
          // the Flutter app's _ensureMarketerRow() creates, since both apps
          // share this table. INCOMPLETE (not PENDING) until onboarding is
          // actually submitted — web access itself isn't gated by this status.
          await supabase.from("marketing_users").insert([{
            auth_user_id: user.id,
            google_email: email,
            google_name: googleName,
            google_avatar_url: googleAvatarUrl,
            email,
            full_name: googleName,
            role: "MARKETER",
            is_active: false,
            approval_status: "INCOMPLETE",
            onboarding_step: 0,
            onboarding_done: false,
          }]);
        } else if (!existing.auth_user_id) {
          await supabase.from("marketing_users").update({ auth_user_id: user.id }).eq("id", existing.id);
        }
      }

      router.replace("/dashboard");
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{error ?? "Signing you in..."}</p>
    </div>
  );
}
