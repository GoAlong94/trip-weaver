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
import { ThumbsUp, Trash2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Expanded Categories
const CATEGORIES = ['Locations', 'Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];

// Draft Versions
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('idea');

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);

  useEffect(() => {
    fetchIdeas();
  }, [tripId]);

  const fetchIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from('idea_cards')
        .select('*')
        .eq('trip_id', tripId);
      
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
      const newIdea = {
        trip_id: tripId,
        title,
        category,
        quantity,
        unit_cost: unitCost,
        is_mandatory: isMandatory,
        created_by: user.id,
        status: 'idea',
        draft_version: activeTab, // Add it directly to the tab you are currently viewing
        upvotes: []
      };
      
      const { data, error } = await supabase.from('idea_cards').insert([newIdea]).select().single();
      if (error) throw error;
      
      toast.success('Idea added successfully!');
      setShowForm(false);
      setTitle(''); setQuantity(1); setUnitCost(0); setIsMandatory(true);
      setIdeas([...ideas, data]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleUpvote = async (idea: any) => {
    if (!user) return;
    
    // Calculate new upvotes array
    const hasUpvoted = idea.upvotes?.includes(user.id);
    const newUpvotes = hasUpvoted
      ? idea.upvotes.filter((id: string) => id !== user.id) // Remove vote
      : [...(idea.upvotes || []), user.id]; // Add vote

    // Optimistic UI update for instant feedback
    setIdeas(ideas.map(i => i.id === idea.id ? { ...i, upvotes: newUpvotes } : i));

    // Database update
    const { error } = await supabase
      .from('idea_cards')
      .update({ upvotes: newUpvotes })
      .eq('id', idea.id);

    if (error) {
      toast.error("Failed to register vote.");
      fetchIdeas(); // Revert on failure
    }
  };

  const moveDraft = async (idea: any, newVersion: string) => {
    setIdeas(ideas.map(i => i.id === idea.id ? { ...i, draft_version: newVersion } : i));
    const { error } = await supabase.from('idea_cards').update({ draft_version: newVersion }).eq('id', idea.id);
    if (error) toast.error("Failed to move card.");
  };

  const deleteIdea = async (id: string) => {
    setIdeas(ideas.filter(i => i.id !== id));
    const { error } = await supabase.from('idea_cards').delete().eq('id', id);
    if (error) toast.error("Failed to delete card.");
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Filter cards by the active draft tab, and sort by upvotes (Highest to Lowest)
  const visibleIdeas = ideas
    .filter(i => (i.draft_version || 'idea') === activeTab)
    .sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col">
      
      {/* HEADER & TABS */}
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
            <form onSubmit={handleAddIdea} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-2 lg:col-span-2">
                <Label>Idea Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Bus to Kasol" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
              </div>
              <div className="space-y-2">
                <Label>Est. Unit Cost (₹)</Label>
                <Input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} required />
              </div>
              <div className="flex items-center space-x-2 lg:col-span-4 bg-background p-3 rounded-md border">
                <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
                <div>
                  <Label className="text-base">{isMandatory ? 'Mandatory Expense' : 'Optional Expense'}</Label>
                  <p className="text-xs text-muted-foreground">Mandatory items count towards the Base Budget.</p>
                </div>
              </div>
              <Button type="submit" className="w-full h-full">Save Idea</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* KANBAN BOARD */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {CATEGORIES.map(cat => {
          const categoryIdeas = visibleIdeas.filter(idea => idea.category === cat);
          if (categoryIdeas.length === 0 && !showForm) return null; // Hide empty columns unless adding

          return (
            <div key={cat} className="min-w-[300px] w-[300px] bg-muted/40 rounded-xl p-4 border flex flex-col max-h-full">
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-muted-foreground flex justify-between">
                {cat} <span>{categoryIdeas.length}</span>
              </h3>
              
              <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar pb-2">
                {categoryIdeas.map(idea => {
                  const hasUpvoted = idea.upvotes?.includes(user?.id);
                  
                  return (
                    <Card key={idea.id} className="shadow-sm border-border/50 hover:border-primary/30 transition-colors">
                      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                        <CardTitle className="text-base font-medium leading-tight">{idea.title}</CardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive -mt-1 -mr-2 shrink-0" onClick={() => deleteIdea(idea.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm flex flex-col gap-3">
                        
                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                          <span className="text-muted-foreground">{idea.quantity} × ₹{idea.unit_cost}</span>
                          <span className="font-bold text-foreground">₹{idea.quantity * idea.unit_cost}</span>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleUpvote(idea)} 
                            className={`h-8 px-2 ${hasUpvoted ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            <ThumbsUp className={`w-4 h-4 mr-1.5 ${hasUpvoted ? 'fill-primary' : ''}`} />
                            <span className="font-medium">{idea.upvotes?.length || 0}</span>
                          </Button>

                          <Select value={idea.draft_version || 'idea'} onValueChange={(val) => moveDraft(idea, val)}>
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VERSIONS.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
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
    </div>
  );
}
