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
import { toast } from 'sonner';

const CATEGORIES = ['Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];

export default function IdeaBoard() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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
      const { data, error } = await supabase.from('idea_cards').select('*').eq('trip_id', tripId);
      if (error) throw error;
      setIdeas(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newIdea = {
        trip_id: tripId,
        title,
        category,
        quantity,
        unit_cost: unitCost,
        is_mandatory: isMandatory,
        created_by: user?.id,
        status: 'idea'
      };
      
      const { error } = await supabase.from('idea_cards').insert([newIdea]);
      if (error) throw error;
      
      toast.success('Idea added successfully!');
      setShowForm(false);
      setTitle(''); setQuantity(1); setUnitCost(0); setIsMandatory(true);
      fetchIdeas(); // Refresh the board
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="p-8">Loading ideas...</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Idea Board</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Propose Idea'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8 border-primary/20 bg-muted/50">
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
                <Label>Unit Cost (₹)</Label>
                <Input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} required />
              </div>
              <div className="flex items-center space-x-2 lg:col-span-4">
                <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
                <Label>{isMandatory ? 'Mandatory Expense' : 'Optional Expense'}</Label>
              </div>
              <Button type="submit" className="w-full">Save Idea</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {CATEGORIES.map(cat => (
          <div key={cat} className="min-w-[280px] bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-muted-foreground">{cat}</h3>
            <div className="space-y-3">
              {ideas.filter(idea => idea.category === cat).map(idea => (
                <Card key={idea.id} className="shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-medium">{idea.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-sm">
                    <div className="flex justify-between items-center mt-2 text-muted-foreground">
                      <span>{idea.quantity} × ₹{idea.unit_cost}</span>
                      <span className="font-bold text-foreground">₹{idea.quantity * idea.unit_cost}</span>
                    </div>
                    <div className="mt-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${idea.is_mandatory ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {idea.is_mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
