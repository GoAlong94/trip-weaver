import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type JoinState = 'loading' | 'joining' | 'success' | 'already_member' | 'error' | 'need_auth';

export default function JoinTrip() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const navigate = useNavigate();
  const { user, loading: authLoading, session } = useAuth();

  const [state, setState] = useState<JoinState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tripTitle, setTripTitle] = useState('');

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !session) {
      const returnUrl = `/join/${tripId}?code=${code}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [authLoading, session, tripId, code, navigate]);

  useEffect(() => {
    if (!user || !tripId || !code) return;
    handleJoin();
  }, [user, tripId, code]);

  const handleJoin = async () => {
    if (!user || !tripId || !code) {
      setState('error');
      setErrorMsg('Invalid invite link.');
      return;
    }

    try {
      setState('loading');

      // 1. Validate the invite code
      const { data: invite, error: inviteErr } = await supabase
        .from('trip_invites')
        .select('id, trip_id, max_uses, use_count, expires_at')
        .eq('trip_id', tripId)
        .eq('code', code)
        .maybeSingle();

      if (inviteErr || !invite) {
        setState('error');
        setErrorMsg('This invite link is invalid or has expired.');
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setState('error');
        setErrorMsg('This invite link has expired.');
        return;
      }

      if (invite.max_uses && invite.use_count >= invite.max_uses) {
        setState('error');
        setErrorMsg('This invite link has reached its maximum number of uses.');
        return;
      }

      // 2. Check if already a member
      const { data: existing } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { data: tripData } = await supabase.from('trips').select('title').eq('id', tripId).single();
        setTripTitle(tripData?.title || 'this trip');
        setState('already_member');
        return;
      }

      // 3. Add user as member
      setState('joining');
      const { error: memberErr } = await supabase
        .from('trip_members')
        .insert({ trip_id: tripId, user_id: user.id, role: 'Member' });

      if (memberErr) throw memberErr;

      // 4. Increment use_count (best effort)
      await supabase
        .from('trip_invites')
        .update({ use_count: invite.use_count + 1 })
        .eq('id', invite.id);

      const { data: tripData } = await supabase.from('trips').select('title').eq('id', tripId).single();
      setTripTitle(tripData?.title || 'the trip');
      setState('success');
    } catch (error: any) {
      console.error('Join error:', error);
      setState('error');
      setErrorMsg(error.message || 'Something went wrong.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {(state === 'loading' || state === 'joining') && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-display font-bold">
              {state === 'joining' ? 'Joining trip...' : 'Verifying invite...'}
            </h1>
            <p className="text-muted-foreground">Hang tight, this will only take a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-display font-bold">You're in! 🎉</h1>
            <p className="text-muted-foreground">
              You've been added to <span className="font-semibold text-foreground">{tripTitle}</span>.
            </p>
            <Button onClick={() => navigate(`/trip/${tripId}/overview`)} className="gap-2">
              Go to Trip Workspace
            </Button>
          </>
        )}

        {state === 'already_member' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-display font-bold">Already a member</h1>
            <p className="text-muted-foreground">
              You're already part of <span className="font-semibold text-foreground">{tripTitle}</span>.
            </p>
            <Button onClick={() => navigate(`/trip/${tripId}/overview`)} className="gap-2">
              Go to Trip Workspace
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-display font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
