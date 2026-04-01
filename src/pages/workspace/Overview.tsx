import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTripData } from '@/hooks/useTripData';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar, MapPin, Users, Clock, Settings, Trash2, Copy, Check, UserPlus, Mail, Download, Wallet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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

  // 🔥 THE INSTANT CACHE ENGINE 🔥
  const { members, expenses, ideas, loading, refreshData } = useTripData(tripId);

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

  const handleInviteByEmail = async () => {
    if (!trip || !user || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();

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

  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName}? Their upvotes and expense splits will be cleared.`)) return;
    try {
      const { data: cards } = await supabase.from('idea_cards').select('id, upvotes, shared_with').eq('trip_id', tripId);
      if (cards) {
        for (const card of cards) {
          let needsUpdate = false;
          let newUpvotes = Array.isArray(card.upvotes) ? [...card.upvotes] : [];
          let newSharedWith = Array.isArray(card.shared_with) ? [...card.shared_with] : [];

          if (newUpvotes.includes(memberIdToRemove)) { newUpvotes = newUpvotes.filter(id => id !== memberIdToRemove); needsUpdate = true; }
          if (newSharedWith.includes(memberIdToRemove)) { newSharedWith = newSharedWith.filter(id => id !== memberIdToRemove); needsUpdate = true; }
          if (needsUpdate) await supabase.from('idea_cards').update({ upvotes: newUpvotes, shared_with: newSharedWith }).eq('id', card.id);
        }
      }

      const { data: expensesList } = await supabase.from('expenses').select('id, split_among').eq('trip_id', tripId);
      if (expensesList) {
        for (const exp of expensesList) {
          let newSplits = Array.isArray(exp.split_among) ? [...exp.split_among] : [];
          if (newSplits.includes(memberIdToRemove)) {
            newSplits = newSplits.filter(id => id !== memberIdToRemove);
            await supabase.from('expenses').update({ split_among: newSplits }).eq('id', exp.id);
          }
        }
      }

      const { error: deleteError } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', memberIdToRemove);
      if (deleteError) throw deleteError;

      toast.success(`${memberName} removed from the trip.`);
      refreshData(); 
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

  // BROCHURE MATH
  const totalActualSpend = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalPlannedBudget = ideas.reduce((sum, idea) => {
    if (!idea.unit_cost) return sum;
    const qty = idea.quantity_type === 'per_person' ? (members.length || 1) : (idea.quantity || 1);
    return sum + (idea.unit_cost * qty);
  }, 0);
  const budgetPercentage = totalPlannedBudget > 0 ? Math.min((totalActualSpend / totalPlannedBudget) * 100, 100) : 0;

  const scheduledIdeas = ideas
    .filter(i => i.start_datetime)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-2 pb-24">
      {/* HEADER & ACTIONS */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Trip Overview</h2>
        {isHost && (
          <div className="flex gap-2">
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><Settings className="h-4 w-4" /> Edit Details</Button>
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
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 space-y-8">
          {/* FINANCIAL SUMMARY */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><Wallet className="h-5 w-5 text-primary" /> Financial Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Actual Spend</span>
                  <span className="font-bold">₹{totalActualSpend.toLocaleString()}</span>
                </div>
                <Progress value={budgetPercentage} className="h-3" indicatorColor={budgetPercentage > 100 ? 'bg-destructive' : 'bg-primary'} />
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-muted-foreground">0</span>
                  <span className="text-muted-foreground">Planned: ₹{totalPlannedBudget.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MEMBER MANAGEMENT */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">Travel Party</h3>
              {isHost && (
                <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) resetInviteForm(); }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"><UserPlus className="h-4 w-4"/></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Invite a Member</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">Enter an email to generate a unique invite link.</p>
                      {!inviteLink ? (
                        <div className="space-y-2">
                          <Label>Email Address</Label>
                          <div className="flex gap-2">
                            <Input type="email" placeholder="friend@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInviteByEmail()} />
                            <Button onClick={handleInviteByEmail} disabled={generatingLink || !inviteEmail.trim()} className="gap-2 shrink-0">
                              <Mail className="h-4 w-4" /> {generatingLink ? '...' : 'Generate'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-muted/50 border">
                            <p className="text-xs text-muted-foreground mb-1">Share this link with <span className="font-medium text-foreground">{inviteEmail}</span>:</p>
                            <div className="flex gap-2 mt-2">
                              <Input readOnly value={inviteLink} className="font-mono text-xs bg-background" />
                              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copied
                              </Button>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={resetInviteForm} className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Invite Another</Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <p className="text-sm text-muted-foreground p-4">Loading members...</p>
              ) : members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                      {member.profiles?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-sm leading-none">{member.profiles?.name || 'Unknown User'}</p>
                      <p className="text-[10px] text-muted-foreground uppercase mt-1">{member.role}</p>
                    </div>
                  </div>
                  {isHost && member.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(member.user_id, member.profiles?.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ITINERARY PREVIEW */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border bg-card p-6 shadow-sm h-full relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold tracking-tight">Timeline Summary</h3>
              <Button variant="link" className="text-primary gap-1" onClick={() => navigate(`/workspace/${tripId}/timeline`)}>View Full <ArrowRight className="h-4 w-4"/></Button>
            </div>

            {scheduledIdeas.length === 0 ? (
              <div className="text-center p-12 border border-dashed rounded-xl text-muted-foreground">
                No activities scheduled yet. Go to the Timeline to build your itinerary!
              </div>
            ) : (
              <div className="relative border-l-2 border-primary/20 ml-3 space-y-8 pb-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                {scheduledIdeas.map((idea) => (
                  <div key={idea.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                    <div className="bg-muted/30 border rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-lg">{idea.title}</h4>
                        <Badge variant="secondary">{idea.category}</Badge>
                      </div>
                      <div className="text-sm font-semibold text-primary mb-2">
                        {format(parseISO(idea.start_datetime), 'EEEE, MMM d • h:mm a')}
                      </div>
                      {idea.location_address && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
                          <MapPin className="h-3.5 w-3.5" /> {idea.location_address}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DOWNLOAD PDF OVERLAY BUTTON */}
            <div className="absolute bottom-6 right-6">
              <Button size="lg" className="gap-2 rounded-xl shadow-xl hover:scale-105 transition-transform" onClick={() => toast.info("PDF Generation Engine coming in next phase!")}>
                <Download className="h-5 w-5" /> Download Brochure
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
