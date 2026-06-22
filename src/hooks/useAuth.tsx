
"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpWithEmail: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 20 hours in milliseconds
const SESSION_TIMEOUT = 72000000;

// If the INITIAL_SESSION event hasn't fired within this many ms, unblock the UI anyway.
// Set high enough for slow networks; PrivateRoute shows a spinner while loading=true.
const LOADING_HARD_TIMEOUT = 15000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isMounted = useRef(true);
  const isCheckingSignedOut = useRef(false);
  const isIntentionalLogout = useRef(false);

  const logout = async () => {
    isIntentionalLogout.current = true;
    localStorage.removeItem('auth_timestamp');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Error signing out:', e);
    } finally {
      if (isMounted.current) {
        setUser(null);
        setSession(null);
        setLoading(false);
      }
      isIntentionalLogout.current = false;
      router.push('/login');
    }
  };

  useEffect(() => {
    isMounted.current = true;
    let authListener: any = null;

    // Safety net: if INITIAL_SESSION never fires (network down, slow device),
    // unblock the UI so the user isn't stuck on the loading screen forever.
    const hardTimeout = setTimeout(() => {
      if (isMounted.current) {
        console.warn('[Auth] Hard timeout — clearing loading state.');
        setLoading(false);
      }
    }, LOADING_HARD_TIMEOUT);

    // Use onAuthStateChange as the single source of truth.
    // Supabase fires INITIAL_SESSION synchronously on subscribe with whatever
    // session is in localStorage, so there is no race between getSession() and
    // the listener's first event (the old pattern that caused logout-on-refresh).
    const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;

      // ── Initial load ──────────────────────────────────────────────────────
      if (event === 'INITIAL_SESSION') {
        if (currentSession) {
          const authTimestamp = localStorage.getItem('auth_timestamp');
          if (!authTimestamp) {
            // First load after this timestamp system was introduced — start the clock.
            localStorage.setItem('auth_timestamp', Date.now().toString());
          } else if (Date.now() - parseInt(authTimestamp, 10) > SESSION_TIMEOUT) {
            // 20-hour window elapsed — force logout.
            isIntentionalLogout.current = true;
            localStorage.removeItem('auth_timestamp');
            try {
              await supabase.auth.signOut();
            } catch (e) {
              console.error('[Auth] Error during force logout:', e);
            } finally {
              if (isMounted.current) {
                setUser(null);
                setSession(null);
                setLoading(false);
              }
              isIntentionalLogout.current = false;
              clearTimeout(hardTimeout);
              router.push('/login');
            }
            return;
          }
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
        clearTimeout(hardTimeout);
        return;
      }

      // ── Sign-in ────────────────────────────────────────────────────────────
      if (event === 'SIGNED_IN') {
        localStorage.setItem('auth_timestamp', Date.now().toString());
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        return;
      }

      // ── Token refresh — extend the 20-hour window ─────────────────────────
      if (event === 'TOKEN_REFRESHED') {
        localStorage.setItem('auth_timestamp', Date.now().toString());
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        }
        setLoading(false);
        return;
      }

      // ── Sign-out — verify before acting ──────────────────────────────────
      // When the browser is under heavy load (large forms, many items) the JS
      // event loop can delay Supabase's background token refresh past the
      // refresh deadline, causing a spurious SIGNED_OUT event.  We retry the
      // session check several times with increasing back-off before committing
      // to a real logout (total wait: ~3.5 s).
      if (event === 'SIGNED_OUT') {
        if (isIntentionalLogout.current) {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (isCheckingSignedOut.current) {
          console.log('[Auth] Already checking SIGNED_OUT event, ignoring duplicate event.');
          return;
        }

        isCheckingSignedOut.current = true;
        setLoading(true);

        const delays = [500, 1000, 2000];
        try {
          for (const delay of delays) {
            await new Promise(res => setTimeout(res, delay));
            if (!isMounted.current) return;

            try {
              const { data: { session: verified } } = await supabase.auth.getSession();
              if (verified) {
                // Session recovered — this was a token-refresh race, not a real logout.
                setSession(verified);
                setUser(verified.user);
                setLoading(false);
                return;
              }
            } catch {
              // Network error during verification — keep retrying.
            }
          }

          // All retries exhausted with no session found — genuine logout.
          if (!isMounted.current) return;
          localStorage.removeItem('auth_timestamp');
          setSession(null);
          setUser(null);
          setLoading(false);
        } finally {
          isCheckingSignedOut.current = false;
        }
        return;
      }

      // ── Catch-all (USER_UPDATED, PASSWORD_RECOVERY, etc.) ─────────────────
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
      setLoading(false);
    });

    authListener = data;

    // Re-check the session when the user switches back to the tab.
    // This catches tokens that expired while the tab was backgrounded.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !isMounted.current) return;
      try {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (!isMounted.current) return;
        if (freshSession) {
          setSession(freshSession);
          setUser(freshSession.user);
        } else {
          // Only clear if we currently believe the user is logged in, to avoid
          // overwriting a login that is still in progress.
          setSession(prev => {
            if (prev) setUser(null);
            return prev ? null : prev;
          });
        }
      } catch {
        // Network error — leave current state as-is.
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted.current = false;
      clearTimeout(hardTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    localStorage.setItem('auth_timestamp', Date.now().toString());
    router.push('/dashboard');
    return data;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  // Redirects to Google, then back to /auth/callback, which exchanges the
  // PKCE code for a session using this same supabase client instance —
  // the code_verifier it needs lives in this client's own localStorage.
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
