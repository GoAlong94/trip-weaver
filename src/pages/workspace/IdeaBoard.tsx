import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import IdeaCardModal from '@/components/IdeaCardModal';
import { ThumbsUp, Trash2, Loader2, Eye, EyeOff, Users } from 'lucide-react';
import { toast } from 'sonner';
import { MapPin, Users, Link as LinkIcon, Trash2, Youtube, Instagram, Globe, Save, Loader2, DollarSign } from 'lucide-react';

const CATEGORIES = ['Locations', 'Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];
const VERSIONS = [
  { id: 'idea', label: 'Brainstorming' },
  { id: 'draft_a', label: 'Draft A' },
  { id: 'draft_b', label: 'Draft B' },
  { id: 'active', label: 'Active Itinerary' }
];

export default function IdeaBoard() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('idea');
  
  // Modal & Card State
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  const [membersCount, setMembersCount] = useState(1);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);
  const [visibility, setVisibility] = useState('public');
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  useEffect(() => {
    fetchIdeas();
    fetchMembers();
  }, [tripId]);

  const fetchMembers = async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('trip_members')
      .select('user_id, profiles(name)')
      .eq('trip_id', tripId);
    
    if (data) {
        setMembers(data.filter(m => m.user_id !== user?.id));
        setMembersCount(data.length || 1); // Set count for the dynamic math engine
    }
  };

  const fetchIdeas = async () => {
    try {
      const { data, error } = await supabase.from('idea_cards').select('*').eq('trip_id', tripId);
      if (error) throw error;
      setIdeas(data || []);
    } catch (error: any) {
      toast.error("Failed to load ideas");
    } finally {
      setLoading(false);
    }
  };

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const finalSharedWith = visibility === 'subgroup' ? [...sharedWith, user.id] : [];

      const newIdea = {
        trip_id: tripId,
        title,
        category,
        quantity,
        unit_cost: unitCost,
        is_mandatory: isMandatory,
        created_by: user.id,
        draft_version: activeTab,
        visibility: visibility,
        shared_with: finalSharedWith,
        upvotes: []
      };
      
      const { data, error } = await supabase.from('idea_cards').insert([newIdea]).select().single();
      if (error) throw error;
      
      toast.success('Idea added successfully!');
      setShowForm(false);
      
      setTitle(''); setQuantity(1); setUnitCost(0); setIsMandatory(true); 
      setVisibility('public'); setSharedWith([]);
      
      setIdeas([...ideas, data]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleSubGroupMember = (memberId: string) => {
      setSharedWith(prev => 
          prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
      );
  };

  const toggleUpvote = async (idea: any) => {
    if (!user) return;
    const hasUpvoted = idea.upvotes?.includes(user.id);
    const newUpvotes = hasUpvoted
      ? idea.upvotes.filter((id: string) => id !== user.id)
      : [...(idea.upvotes || []), user.id];

    setIdeas(ideas.map(i => i.id === idea.id ? { ...i, upvotes: newUpvotes } : i));
    await supabase.from('idea_cards').update({ upvotes: newUpvotes }).eq('id', idea.id);
  };

  const moveDraft = async (idea: any, newVersion: string) => {
    setIdeas(ideas.map(i => i.id === idea.id ? { ...i, draft_version: newVersion } : i));
    await supabase.from('idea_cards').update({ draft_version: newVersion }).eq('id', idea.id);
  };

  const deleteIdea = async (id: string) => {
    setIdeas(ideas.filter(i => i.id !== id));
    await supabase.from('idea_cards').delete().eq('id', id);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const visibleIdeas = ideas
    .filter(i => (i.draft_version || 'idea') === activeTab)
    .sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold">The Planning Board</h2>
          <p className="text-muted-foreground text-sm">Dump ideas, upvote favorites, and organize drafts.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Propose Idea'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1">
          {VERSIONS.map(v => (
             <TabsTrigger key={v.id} value={v.id} className="py-2.5 text-sm">
               {v.label}
               <span className="ml-2 bg-muted-foreground/10 text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                 {ideas.filter(i => (i.draft_version || 'idea') === v.id).length}
               </span>
             </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* NEW IDEA FORM */}
      {showForm && (
        <Card className="mb-8 border-primary/20 bg-muted/30 shadow-inner shrink-0">
          <CardContent className="pt-6">
            <form onSubmit={handleAddIdea} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="space-y-2 lg:col-span-2">
                <Label>Idea Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Secret Beer Run" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public"><div className="flex items-center gap-2"><Eye className="h-3 w-3"/> Public</div></SelectItem>
                    <SelectItem value="subgroup"><div className="flex items-center gap-2"><Users className="h-3 w-3"/> Sub-Group</div></SelectItem>
                    <SelectItem value="private"><div className="flex items-center gap-2"><EyeOff className="h-3 w-3"/> Private</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Est. Cost (₹)</Label>
                <Input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} required />
              </div>

              <Button type="submit" className="w-full h-10 lg:mt-6">Save Idea</Button>
              
              {visibility === 'subgroup' && members.length > 0 && (
                  <div className="lg:col-span-6 bg-background p-4 rounded-md border mt-2">
                      <Label className="mb-3 block">Who is invited?</Label>
                      <div className="flex flex-wrap gap-4">
                          {members.map(m => (
                              <div key={m.user_id} className="flex items-center space-x-2">
                                  <Checkbox 
                                      id={`member-${m.user_id}`} 
                                      checked={sharedWith.includes(m.user_id)}
                                      onCheckedChange={() => toggleSubGroupMember(m.user_id)}
                                  />
                                  <label htmlFor={`member-${m.user_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                      {m.profiles?.name || 'Unknown'}
                                  </label>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* KANBAN BOARD */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {CATEGORIES.map(cat => {
          const categoryIdeas = visibleIdeas.filter(idea => idea.category === cat);
          if (categoryIdeas.length === 0 && !showForm) return null;

          return (
            <div key={cat} className="min-w-[300px] w-[300px] bg-muted/40 rounded-xl p-4 border flex flex-col max-h-full">
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-muted-foreground flex justify-between">
                {cat} <span>{categoryIdeas.length}</span>
              </h3>
              
              <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar pb-2">
                {categoryIdeas.map(idea => {
                  const hasUpvoted = idea.upvotes?.includes(user?.id);
                  
                  return (
                    <Card 
                      key={idea.id} 
                      onClick={() => setSelectedIdea(idea)}
                      className="shadow-sm border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                    >
                      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                        <div>
                            <CardTitle className="text-base font-medium leading-tight group-hover:text-primary transition-colors">{idea.title}</CardTitle>
                            {idea.visibility !== 'public' && (
                                <span className={`text-[10px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${idea.visibility === 'private' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
                                    {idea.visibility === 'private' ? <EyeOff className="h-3 w-3"/> : <Users className="h-3 w-3"/>}
                                    {idea.visibility}
                                </span>
                            )}
                        </div>
                        {/* Stop propagation so deleting doesn't open the modal */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive -mt-1 -mr-2 shrink-0" 
                          onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardHeader>
                      
                      <CardContent className="p-4 pt-0 text-sm flex flex-col gap-3">
                        <div className="flex justify-between items-center pt-2 border-t mt-2">
                          {/* Stop propagation so voting doesn't open the modal */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); toggleUpvote(idea); }} 
                            className={`h-8 px-2 ${hasUpvoted ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            <ThumbsUp className={`w-4 h-4 mr-1.5 ${hasUpvoted ? 'fill-primary' : ''}`} />
                            <span className="font-medium">{idea.upvotes?.length || 0}</span>
                          </Button>

                          {/* Stop propagation on the select wrapper */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select value={idea.draft_version || 'idea'} onValueChange={(val) => moveDraft(idea, val)}>
                              <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VERSIONS.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* SUPER CARD MODAL */}
      <IdeaCardModal 
        idea={selectedIdea} 
        isOpen={!!selectedIdea} 
        onClose={() => setSelectedIdea(null)} 
        onUpdate={fetchIdeas}
        memberCount={membersCount}
      />
    </div>
  );
}
