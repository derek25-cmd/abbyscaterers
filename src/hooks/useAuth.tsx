
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
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Security Check: 20 hour force logout
      const authTimestamp = localStorage.getItem('auth_timestamp');
      if (session && authTimestamp) {
          const now = Date.now();
          if (now - parseInt(authTimestamp, 10) > SESSION_TIMEOUT) {
              await logout();
              setLoading(false);
              return;
          }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
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
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
              // Session recovered — this was a transient race condition, not a real logout.
              setSession(currentSession);
              setUser(currentSession.user);
              setLoading(false);
              return;
          }
          localStorage.removeItem('auth_timestamp');
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
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
