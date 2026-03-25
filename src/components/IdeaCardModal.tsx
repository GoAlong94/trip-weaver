import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Link as LinkIcon, Trash2, Youtube, Instagram, Globe, Save, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface IdeaCardModalProps {
  idea: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  memberCount: number;
}

export default function IdeaCardModal({ idea, isOpen, onClose, onUpdate, memberCount }: IdeaCardModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Local State for all rich fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [currency, setCurrency] = useState('₹');
  const [quantityType, setQuantityType] = useState('fixed');
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  
  // Links State
  const [newLink, setNewLink] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);

  // Sync state when a new idea is passed in
  useEffect(() => {
    if (idea) {
      setTitle(idea.title || '');
      setCategory(idea.category || '');
      setUnitCost(idea.unit_cost || 0);
      setCurrency(idea.currency || '₹');
      setQuantityType(idea.quantity_type || 'fixed');
      setQuantity(idea.quantity || 1);
      setAddress(idea.location_address || '');
      
      // Safely parse JSONB array
      try {
        const parsedLinks = typeof idea.social_links === 'string' ? JSON.parse(idea.social_links) : idea.social_links;
        setSocialLinks(Array.isArray(parsedLinks) ? parsedLinks : []);
      } catch (e) {
        setSocialLinks([]);
      }
    }
  }, [idea]);

  const handleSave = async () => {
    if (!idea) return;
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('idea_cards')
        .update({
          title,
          unit_cost: unitCost,
          currency,
          quantity_type: quantityType,
          quantity: quantityType === 'fixed' ? quantity : 1, // Reset qty if per_person
          location_address: address,
          social_links: socialLinks
        })
        .eq('id', idea.id);

      if (error) throw error;
      
      toast.success('Card details saved!');
      onUpdate(); // Trigger parent refresh
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save card');
    } finally {
      setLoading(false);
    }
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    setSocialLinks([...socialLinks, newLink.trim()]);
    setNewLink('');
  };

  const removeLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const getLinkIcon = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return <Youtube className="h-4 w-4 text-red-500" />;
    if (url.includes('instagram.com')) return <Instagram className="h-4 w-4 text-pink-500" />;
    return <Globe className="h-4 w-4 text-blue-500" />;
  };

  // Math Engine
  const effectiveQuantity = quantityType === 'per_person' ? memberCount : quantity;
  const totalCost = unitCost * effectiveQuantity;

  if (!idea) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto p-0 flex flex-col h-full border-l">
        
        {/* HEADER */}
        <div className="p-6 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="bg-background">{category}</Badge>
            <Button onClick={handleSave} disabled={loading} size="sm" className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
          <Input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            className="text-2xl font-bold font-display h-auto py-2 border-transparent hover:border-input focus-visible:ring-primary/20 transition-all bg-transparent px-0 rounded-none shadow-none"
          />
        </div>

        <div className="p-6 space-y-8 flex-1">
          
          {/* SECTION 1: DYNAMIC MATH & BUDGET */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Budget & Quantity
            </h3>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
              
              <div className="space-y-2">
                <Label className="text-xs">Pricing Model</Label>
                <Select value={quantityType} onValueChange={setQuantityType}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Total (e.g. 1 Car)</SelectItem>
                    <SelectItem value="per_person">Per Person (x{memberCount} members)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quantityType === 'fixed' && (
                <div className="space-y-2">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="bg-background" />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Unit Cost & Currency</Label>
                <div className="flex gap-2">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w20 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="₹">₹ INR</SelectItem>
                      <SelectItem value="$">$ USD</SelectItem>
                      <SelectItem value="€">€ EUR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} className="bg-background flex-1" />
                </div>
              </div>

              {/* LIVE TOTAL CALCULATION */}
              <div className="col-span-2 mt-2 pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Total Estimated Cost: 
                  {quantityType === 'per_person' && <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">Unit x {memberCount} Members</span>}
                </div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {currency}{(totalCost).toLocaleString()}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 2: LIVE MAPS & LOCATION */}
          <div className="space-y-4">
             <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Location Details
            </h3>
            <div className="space-y-3">
              <Input 
                placeholder="Enter an exact address or Google Maps place name..." 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
              />
              {/* Dynamic Google Maps Embed based on the address string */}
              <div className="w-full h-48 bg-muted rounded-xl border overflow-hidden relative">
                {address ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    loading="lazy" 
                    allowFullScreen 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mb-2 opacity-20" />
                    <span className="text-sm font-medium">Add an address to see the map</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: MEDIA & SOCIAL LINKS */}
          <div className="space-y-4">
             <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> References & Media
            </h3>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Paste YouTube, Instagram, or Website link..." 
                value={newLink} 
                onChange={e => setNewLink(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())}
              />
              <Button type="button" onClick={addLink} variant="secondary">Add</Button>
            </div>

            {socialLinks.length > 0 && (
              <div className="space-y-2 mt-4">
                {socialLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted/40 border p-3 rounded-lg group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {getLinkIcon(link)}
                      <a href={link} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:text-primary hover:underline truncate">
                        {link}
                      </a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => removeLink(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
