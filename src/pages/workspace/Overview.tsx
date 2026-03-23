import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar, MapPin, Users, Clock, Settings, Trash2, UserPlus } from 'lucide-react';
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

  // Invite State
  const [inviteName, setInviteName] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (tripId) fetchMembers();
  }, [tripId]);

  const fetchMembers = async () => {
    try {
      // Fetch members and join with profiles to get their names
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          id, role,
          profiles:user_id (id, name, avatar_url)
        `)
        .eq('trip_id', tripId);
      
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    try {
      await updateTrip(trip.id, {
        title: editTitle,
        start_destination: editDest,
        start_date: editStart,
        end_date: editEnd
      });
      setIsEditing(false);
    } catch (error) {
      // Error handled by context
    }
  };

  const handleDelete = async () => {
    if (!trip) return;
    if (window.confirm("Are you sure you want to delete this trip? This cannot be undone.")) {
      try {
        await deleteTrip(trip.id);
        navigate('/dashboard');
      } catch (error) {
        // Error handled by context
      }
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setIsInviting(true);
    
    try {
      // 1. Find user by exact name (Prototype method)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('name', inviteName)
        .limit(1)
        .single();

      if (profileError || !profileData) {
        throw new Error("Could not find a user with that exact name.");
      }

      // 2. Add to trip_members
      const { error: insertError } = await supabase
        .from('trip_members')
        .insert([{ trip_id: trip.id, user_id: profileData.id, role: 'Member' }]);

      if (insertError) throw insertError;

      toast.success("Member added successfully!");
      setInviteName('');
      fetchMembers(); // Refresh list
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsInviting(false);
    }
  };

  if (!trip) return null;

  // Safe parsing
  const safeParseDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return parseISO(dateStr); } catch { return null; }
  };

  const startDate = safeParseDate(trip.start_date);
  const endDate = safeParseDate(trip.end_date);
  const days = (startDate && endDate) ? differenceInDays(endDate, startDate) : 0;
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
                <Button variant="outline" size="sm" className="gap-2"><Settings className="h-4 w-4"/> Edit Details</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Trip</DialogTitle></DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>Title</Label><Input value={editTitle} onChange={e=>setEditTitle(e.target.value)} required/></div>
                  <div className="space-y-2"><Label>Destination</Label><Input value={editDest} onChange={e=>setEditDest(e.target.value)} required/></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={editStart} onChange={e=>setEditStart(e.target.value)}/></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={editEnd} onChange={e=>setEditEnd(e.target.value)}/></div>
                  </div>
                  <Button type="submit" className="w-full">Save Changes</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4"/> Delete</Button>
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
            <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Travel Party</h3>
            <p className="text-sm text-muted-foreground mt-1">Manage who has access to this trip's planner and ledger.</p>
          </div>
        </div>
        
        <div className="p-6">
          <ul className="space-y-4 mb-6">
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
              </li>
            ))}
          </ul>

          {/* INVITE FORM */}
          {isHost && (
            <form onSubmit={handleInvite} className="flex gap-3 items-end p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Add Member by Exact Name</Label>
                <Input 
                  placeholder="e.g. John Doe" 
                  value={inviteName} 
                  onChange={(e) => setInviteName(e.target.value)} 
                  required
                />
              </div>
              <Button type="submit" disabled={isInviting} className="gap-2">
                <UserPlus className="h-4 w-4" /> {isInviting ? 'Adding...' : 'Add Member'}
              </Button>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
