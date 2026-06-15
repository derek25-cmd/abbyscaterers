
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 20 hours in milliseconds
const SESSION_TIMEOUT = 72000000;

// If loading hasn't resolved after this many ms, force it to false
const LOADING_HARD_TIMEOUT = 8000;

// How long to wait after SIGNED_OUT before confirming — covers slow token refreshes
const SIGNED_OUT_DEBOUNCE = 1200;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isMounted = useRef(true);

  const logout = async () => {
    localStorage.removeItem('auth_timestamp');
    await supabase.auth.signOut();
    if (isMounted.current) {
      setUser(null);
      setSession(null);
    }
    router.push('/login');
  };

  useEffect(() => {
    isMounted.current = true;
    let authListener: any = null;

    // Hard timeout: if something hangs, never leave the user stuck on the loading screen.
    const hardTimeout = setTimeout(() => {
      if (isMounted.current && loading) {
        console.warn('[Auth] Hard timeout reached — clearing loading state.');
        setLoading(false);
      }
    }, LOADING_HARD_TIMEOUT);

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!isMounted.current) return;

        // 20-hour force logout — skip calling the full logout() here to avoid
        // router.push firing before the listener is stable.
        const authTimestamp = localStorage.getItem('auth_timestamp');
        if (initialSession && authTimestamp) {
          if (Date.now() - parseInt(authTimestamp, 10) > SESSION_TIMEOUT) {
            localStorage.removeItem('auth_timestamp');
            await supabase.auth.signOut();
            if (isMounted.current) {
              setUser(null);
              setSession(null);
              setLoading(false);
            }
            clearTimeout(hardTimeout);
            router.push('/login');
            return;
          }
        }

        if (isMounted.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
        }
        clearTimeout(hardTimeout);

        // Subscribe to future auth state changes only after init is complete.
        const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted.current) return;

          if (event === 'SIGNED_IN') {
            localStorage.setItem('auth_timestamp', Date.now().toString());
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
            return;
          }

          if (event === 'TOKEN_REFRESHED') {
            // Extend the 20-hour window from the last successful refresh.
            localStorage.setItem('auth_timestamp', Date.now().toString());
            if (currentSession) {
              setSession(currentSession);
              setUser(currentSession.user);
              setLoading(false);
            }
            return;
          }

          if (event === 'SIGNED_OUT') {
            // Hold loading=true during verification to prevent PrivateRoute from
            // redirecting while a token refresh is completing in the background.
            setLoading(true);

            // Wait for any in-flight token refresh before concluding the session is gone.
            await new Promise(res => setTimeout(res, SIGNED_OUT_DEBOUNCE));
            if (!isMounted.current) return;

            const { data: { session: verified } } = await supabase.auth.getSession();
            if (verified) {
              // Race condition — session recovered, this was not a real logout.
              setSession(verified);
              setUser(verified.user);
              setLoading(false);
              return;
            }

            // Genuine logout.
            localStorage.removeItem('auth_timestamp');
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }

          // Catch-all for other events (USER_UPDATED, etc.)
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        });

        authListener = data;
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        if (isMounted.current) setLoading(false);
        clearTimeout(hardTimeout);
      }
    };

    initializeAuth();

    // Re-check the session whenever the user returns to the tab.
    // This catches cases where the token expired while the tab was in the background.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !isMounted.current) return;
      try {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (!isMounted.current) return;
        if (freshSession) {
          setSession(freshSession);
          setUser(freshSession.user);
        } else {
          // Only clear if we currently think we're logged in, to avoid
          // overwriting a login-in-progress.
          setSession(prev => {
            if (prev) {
              setUser(null);
            }
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

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithEmail, signUpWithEmail, logout }}>
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
