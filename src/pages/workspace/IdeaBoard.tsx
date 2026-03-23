import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Plane, Hotel, UtensilsCrossed, Compass, Music, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type IdeaCard = Tables<'idea_cards'>;

const CATEGORIES = [
  { value: 'Transportation', icon: Plane },
  { value: 'Lodging', icon: Hotel },
  { value: 'Food', icon: UtensilsCrossed },
  { value: 'Excursions', icon: Compass },
  { value: 'Entertainment', icon: Music },
  { value: 'Other', icon: Package },
] as const;

const categoryColors: Record<string, string> = {
  Transportation: 'bg-blue-500/10 border-blue-500/20',
  Lodging: 'bg-purple-500/10 border-purple-500/20',
  Food: 'bg-orange-500/10 border-orange-500/20',
  Excursions: 'bg-green-500/10 border-green-500/20',
  Entertainment: 'bg-pink-500/10 border-pink-500/20',
  Other: 'bg-muted border-border',
};

export default function IdeaBoard() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [cards, setCards] = useState<IdeaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [isMandatory, setIsMandatory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from('idea_cards')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setCards(data || []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Real-time subscription
  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`idea_cards_${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'idea_cards',
        filter: `trip_id=eq.${tripId}`,
      }, () => {
        fetchCards();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId, fetchCards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !tripId || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('idea_cards').insert({
        trip_id: tripId,
        title,
        category,
        quantity,
        unit_cost: unitCost,
        is_mandatory: isMandatory,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success('Idea proposed!');
      setDialogOpen(false);
      setTitle(''); setCategory('Other'); setQuantity(1); setUnitCost(0); setIsMandatory(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add idea');
    } finally {
      setSubmitting(false);
    }
  };

  const cardsByCategory = CATEGORIES.map(cat => ({
    ...cat,
    cards: cards.filter(c => c.category === cat.value),
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold">Idea Board</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-warm text-primary-foreground shadow-warm gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Propose Idea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Propose an Idea</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="idea-title">Title</Label>
                <Input id="idea-title" placeholder="e.g. Train to Kyoto" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input id="qty" type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cost">Unit Cost ($)</Label>
                  <Input id="cost" type="number" min={0} step={0.01} value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="mandatory" className="text-sm font-medium">Mandatory Expense</Label>
                  <p className="text-xs text-muted-foreground">Mark as required for the trip</p>
                </div>
                <Switch id="mandatory" checked={isMandatory} onCheckedChange={setIsMandatory} />
              </div>
              <Button type="submit" className="w-full gradient-warm text-primary-foreground shadow-warm font-semibold" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Idea'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cardsByCategory.map(col => {
          const Icon = col.icon;
          return (
            <div key={col.value} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground font-sans">{col.value}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{col.cards.length}</span>
              </div>
              <div className={`rounded-xl border p-2 min-h-[200px] space-y-2 ${categoryColors[col.value]}`}>
                {col.cards.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No ideas yet</p>
                )}
                {col.cards.map(card => {
                  const total = card.quantity * Number(card.unit_cost);
                  return (
                    <div key={card.id} className="rounded-lg bg-card border p-3 shadow-sm space-y-2">
                      <p className="font-medium text-sm text-foreground leading-tight">{card.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">
                          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <Badge
                          variant={card.is_mandatory ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {card.is_mandatory ? 'Must-have' : 'Optional'}
                        </Badge>
                      </div>
                      {card.quantity > 1 && (
                        <p className="text-[11px] text-muted-foreground">
                          {card.quantity} × ${Number(card.unit_cost).toFixed(2)}
                        </p>
                      )}
                    </div>
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
