import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/components/Toast';

// Refresh session 5 minutes before it expires
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [linearToken, setLinearToken] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule automatic session refresh before expiry
  const scheduleRefresh = useCallback((sess: Session) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const expiresAt = sess.expires_at;
    if (!expiresAt) return;

    const expiresInMs = expiresAt * 1000 - Date.now() - REFRESH_BUFFER_MS;
    if (expiresInMs <= 0) {
      // Already close to expiry — refresh immediately
      supabase.auth.refreshSession().catch(() => {
        toastError('Session expired. Please sign in again.');
      });
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          scheduleRefresh(data.session);
        }
      } catch {
        toastError('Session expired. Please sign in again.');
      }
    }, expiresInMs);
  }, []);

  // Load session and Linear token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadLinearToken(session.user.id);
        scheduleRefresh(session);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadLinearToken(session.user.id);
        scheduleRefresh(session);
      } else {
        setLinearToken(null);
        setLoading(false);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  // Handle visibility change — refresh if returning from background
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!session?.expires_at) return;

      const expiresInMs = session.expires_at * 1000 - Date.now();
      if (expiresInMs < REFRESH_BUFFER_MS) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
            scheduleRefresh(data.session);
          }
        } catch {
          toastError('Session expired. Please sign in again.');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [session, scheduleRefresh]);

  const loadLinearToken = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('linear_access_token')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setLinearToken(data?.linear_access_token ?? null);
    } catch {
      setLinearToken(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await supabase.auth.signOut();
    setLinearToken(null);
  }, []);

  const saveLinearToken = useCallback(
    async (token: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('user_settings')
        .upsert({ id: user.id, linear_access_token: token, updated_at: new Date().toISOString() });
      if (error) throw error;
      setLinearToken(token);
    },
    [user],
  );

  const disconnectLinear = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('user_settings')
      .update({ linear_access_token: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setLinearToken(null);
  }, [user]);

  return {
    session,
    user,
    loading,
    linearToken,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    saveLinearToken,
    disconnectLinear,
  };
}
