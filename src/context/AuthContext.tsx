import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: { id: string; name: string | null; avatar_url: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextValue['profile']>(null);
  const [loading, setLoading] = useState(true); // Initial load only

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', userId)
          .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Profile fetch error:', error);
        }
        if (mounted) setProfile(data);
      } catch (error) {
        console.error('Error in fetchProfile block:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
            setSession(session);
        }
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        
        setSession(newSession);
        
        // Critical: Do NOT set loading=true here. It causes infinite loops on token refresh.
        if (newSession?.user) {
           // Silently fetch profile in background
           fetchProfile(newSession.user.id);
        } else {
           setProfile(null);
           // Only ensure loading is false if we are logging out
           setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear state immediately for fast UI feedback
    setSession(null);
    setProfile(null);
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Supabase signOut error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
