import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar, MapPin, Users, Clock, Settings, Trash2, Link2, Copy, Check, RefreshCw, UserPlus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const APP_DOMAIN = 'https://plansplit.lovable.app';

function generateCode(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Overview() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getTrip, updateTrip, deleteTrip } = useTrips();
  const trip = getTrip(tripId || '');

  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(trip?.title || '');
  const [editDest, setEditDest] = useState(trip?.start_destination || '');
  const [editStart, setEditStart] = useState(trip?.start_date || '');
  const [editEnd, setEditEnd] = useState(trip?.end_date || '');

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  useEffect(() => {
    if (tripId) fetchMembers();
  }, [tripId]);

  const fetchMembers = async () => {
    try {
      const { data: memberData, error } = await supabase
        .from('trip_members')
        .select('id, role, user_id')
        .eq('trip_id', tripId);
      if (error) throw error;

      const userIds = (memberData || []).map(m => m.user_id);
      if (userIds.length === 0) { setMembers([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      setMembers((memberData || []).map(m => ({
        ...m,
        profiles: profileMap.get(m.user_id) || null,
      })));
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInviteByEmail = async () => {
    if (!trip || !user || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setGeneratingLink(true);
    try {
      const code = generateCode(10);
      const { error } = await supabase.from('trip_invites').insert({
        trip_id: trip.id,
        code,
        created_by: user.id,
        max_uses: 1,
      });
      if (error) throw error;

      const link = `${APP_DOMAIN}/join/${trip.id}?code=${code}`;
      setInviteLink(link);
      toast.success(`Invite link generated for ${email}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate invite');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [inviteLink]);

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteLink(null);
    setCopied(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    try {
      await updateTrip(trip.id, {
        title: editTitle,
        start_destination: editDest,
        start_date: editStart,
        end_date: editEnd,
      });
      setIsEditing(false);
    } catch {}
  };

  const handleDelete = async () => {
    if (!trip) return;
    if (window.confirm('Are you sure you want to delete this trip? This cannot be undone.')) {
      try {
        await deleteTrip(trip.id);
        navigate('/dashboard');
      } catch {}
    }
  };

  // --- SURGICAL EXTRACTION FUNCTION ---
  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName}? Their upvotes and expense splits will be cleared.`)) return;
    
    try {
      // 1. Scrub from Idea Cards (Upvotes & Subgroups)
      const { data: cards } = await supabase.from('idea_cards').select('id, upvotes, shared_with').eq('trip_id', tripId);
      
      if (cards) {
        for (const card of cards) {
          let needsUpdate = false;
          let newUpvotes = Array.isArray(card.upvotes) ? [...card.upvotes] : [];
          let newSharedWith = Array.isArray(card.shared_with) ? [...card.shared_with] : [];

          if (newUpvotes.includes(memberIdToRemove)) {
             newUpvotes = newUpvotes.filter(id => id !== memberIdToRemove);
             needsUpdate = true;
          }
          if (newSharedWith.includes(memberIdToRemove)) {
             newSharedWith = newSharedWith.filter(id => id !== memberIdToRemove);
             needsUpdate = true;
          }
          if (needsUpdate) {
             await supabase.from('idea_cards').update({ upvotes: newUpvotes, shared_with: newSharedWith }).eq('id', card.id);
          }
        }
      }

      // 2. Scrub from Ledger Expenses (Splits)
      const { data: expenses } = await supabase.from('expenses').select('id, split_among').eq('trip_id', tripId);
      
      if (expenses) {
        for (const exp of expenses) {
          let newSplits = Array.isArray(exp.split_among) ? [...exp.split_among] : [];
          if (newSplits.includes(memberIdToRemove)) {
            newSplits = newSplits.filter(id => id !== memberIdToRemove);
            await supabase.from('expenses').update({ split_among: newSplits }).eq('id', exp.id);
          }
        }
      }

      // 3. Remove from Trip Members Table
      const { error: deleteError } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', memberIdToRemove);

      if (deleteError) throw deleteError;

      toast.success(`${memberName} removed from the trip.`);
      fetchMembers(); // Refresh UI
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    }
  };

  if (!trip) return null;

  const safeParseDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return parseISO(dateStr); } catch { return null; }
  };

  const startDate = safeParseDate(trip.start_date);
  const endDate = safeParseDate(trip.end_date);
  const days = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  const isHost = trip.created_by === user?.id;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* HEADER & ACTIONS */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Trip Overview</h2>
        {isHost && (
          <div className="flex gap-2">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" /> Edit Details
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Trip</DialogTitle></DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>Title</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Destination</Label><Input value={editDest} onChange={e => setEditDest(e.target.value)} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} /></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full">Save Changes</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><MapPin className="h-4 w-4" /> Destination</div>
          <p className="text-foreground font-semibold truncate">{trip.start_destination}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Clock className="h-4 w-4" /> Duration</div>
          <p className="text-foreground font-semibold">{days > 0 ? `${days} days` : 'TBD'}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Calendar className="h-4 w-4" /> Dates</div>
          <p className="text-foreground font-semibold text-sm">
            {startDate ? format(startDate, 'MMM d') : 'TBD'} – {endDate ? format(endDate, 'MMM d, yyyy') : 'TBD'}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Users className="h-4 w-4" /> Members</div>
          <p className="text-foreground font-semibold">{members.length}</p>
        </div>
      </div>

      {/* MEMBER MANAGEMENT */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-6 border-b flex justify-between items-center bg-muted/30">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Travel Party
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Manage who has access to this trip's planner and ledger.</p>
          </div>
          {isHost && (
            <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
              setInviteDialogOpen(open);
              if (!open) resetInviteForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Enter your friend's email address. We'll generate a unique invite link you can share with them.
                  </p>

                  {!inviteLink ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <div className="flex gap-2">
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="friend@example.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleInviteByEmail()}
                          />
                          <Button
                            onClick={handleInviteByEmail}
                            disabled={generatingLink || !inviteEmail.trim()}
                            className="gap-2 shrink-0"
                          >
                            <Mail className="h-4 w-4" />
                            {generatingLink ? 'Generating...' : 'Generate Link'}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground mb-1">Share this link with <span className="font-medium text-foreground">{inviteEmail}</span>:</p>
                        <div className="flex gap-2 mt-2">
                          <Input
                            readOnly
                            value={inviteLink}
                            className="font-mono text-xs bg-background"
                          />
                          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={resetInviteForm} className="gap-2">
                        <UserPlus className="h-3.5 w-3.5" /> Invite Another
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="p-6">
          <ul className="space-y-3">
            {loadingMembers ? (
              <p className="text-sm text-muted-foreground">Loading members...</p>
            ) : members.map((member) => (
              <li key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {member.profiles?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{member.profiles?.name || 'Unknown User'}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                
                {/* SURGICAL EXTRACTION BUTTON */}
                {isHost && member.user_id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemoveMember(member.user_id, member.profiles?.name || 'Unknown User')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
