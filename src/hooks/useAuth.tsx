
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

// 20 hours in milliseconds: 20 * 60 * 60 * 1000
const SESSION_TIMEOUT = 72000000; 

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = async () => {
    localStorage.removeItem('auth_timestamp');
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error);
    setUser(null);
    setSession(null);
    router.push('/login');
  };

  useEffect(() => {
    let isMounted = true;
    let authListener: any = null;

    const initializeAuth = async () => {
      try {
        // 1. Get the session first and let Supabase handle any initial refresh sequentially
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        // Security Check: 20 hour force logout
        const authTimestamp = localStorage.getItem('auth_timestamp');
        if (session && authTimestamp) {
            const now = Date.now();
            if (now - parseInt(authTimestamp, 10) > SESSION_TIMEOUT) {
                await logout();
                return;
            }
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // 2. Now that initialization is complete, subscribe to future changes safely
        const { data } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;

          if (event === 'SIGNED_IN') {
              localStorage.setItem('auth_timestamp', Date.now().toString());
          }

          if (event === 'TOKEN_REFRESHED') {
              // Extend the 20-hour window from the last successful refresh, not from login.
              localStorage.setItem('auth_timestamp', Date.now().toString());
          }

          if (event === 'SIGNED_OUT') {
              // SIGNED_OUT can fire spuriously during token-refresh race conditions that
              // happen when many API calls are in-flight near the 1-hour JWT expiry.
              // Verify the session is genuinely gone before clearing auth state.
              const { data: { session: verifiedSession } } = await supabase.auth.getSession();
              if (verifiedSession) {
                  // Session recovered — this was a transient race condition, not a real logout.
                  setSession(verifiedSession);
                  setUser(verifiedSession.user);
                  setLoading(false);
                  return;
              }
              localStorage.removeItem('auth_timestamp');
          }

          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        });

        authListener = data;
      } catch (error) {
        console.error('Error during auth initialization:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) throw error;
    localStorage.setItem('auth_timestamp', Date.now().toString());
    router.push('/dashboard');
    return data;
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if(error) throw error;
    return data;
  }

  const value = {
    user,
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
