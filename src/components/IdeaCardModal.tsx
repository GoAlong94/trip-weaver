import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Link as LinkIcon, Trash2, Youtube, Instagram, Globe, Save, Loader2, DollarSign, ArrowRight, Target, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface IdeaCardModalProps {
  idea: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  memberCount: number;
}

const formatExternalUrl = (url: string) => {
  if (!url) return '#';
  if (!url.match(/^https?:\/\//i)) return `https://${url}`;
  return url;
};

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper for <input type="datetime-local">
const formatForInput = (isoString?: string) => {
  if (!isoString) return '';
  return format(new Date(isoString), "yyyy-MM-dd'T'HH:mm");
};

export default function IdeaCardModal({ idea, isOpen, onClose, onUpdate, memberCount }: IdeaCardModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [currency, setCurrency] = useState('₹');
  const [quantityType, setQuantityType] = useState('fixed');
  const [quantity, setQuantity] = useState(1);
  
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  
  const [endAddress, setEndAddress] = useState('');
  const [endLat, setEndLat] = useState<string>('');
  const [endLng, setEndLng] = useState<string>('');
  
  const [newLink, setNewLink] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);

  // Manual Schedule State
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');

  useEffect(() => {
    if (idea) {
      setTitle(idea.title || '');
      setCategory(idea.category || '');
      setUnitCost(idea.unit_cost || 0);
      setCurrency(idea.currency || '₹');
      setQuantityType(idea.quantity_type || 'fixed');
      setQuantity(idea.quantity || 1);
      
      setAddress(idea.location_address || '');
      setLat(idea.location_lat ? String(idea.location_lat) : '');
      setLng(idea.location_lng ? String(idea.location_lng) : '');
      
      setEndAddress(idea.end_location_address || '');
      setEndLat(idea.end_location_lat ? String(idea.end_location_lat) : '');
      setEndLng(idea.end_location_lng ? String(idea.end_location_lng) : '');
      
      setStartDatetime(formatForInput(idea.start_datetime));
      setEndDatetime(formatForInput(idea.end_datetime));

      try {
        const parsedLinks = typeof idea.social_links === 'string' ? JSON.parse(idea.social_links) : idea.social_links;
        setSocialLinks(Array.isArray(parsedLinks) ? parsedLinks : []);
      } catch (e) {
        setSocialLinks([]);
      }
    }
  }, [idea]);

  const testGeocode = async (searchAddress: string, isDestination: boolean) => {
    if (!searchAddress) return toast.error("Enter an address first");
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchAddress)}&limit=1`);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        if (isDestination) {
          setEndLat(String(coords[1])); setEndLng(String(coords[0]));
        } else {
          setLat(String(coords[1])); setLng(String(coords[0]));
        }
        toast.success(`Found coordinates!`);
      } else {
        toast.error("API found nothing. Please enter manually.");
      }
    } catch (e) {
      toast.error("API request failed.");
    }
  };

  const handleSave = async () => {
    if (!idea) return;
    setLoading(true);
    
    try {
      const finalLat = lat ? parseFloat(lat) : null;
      const finalLng = lng ? parseFloat(lng) : null;
      const finalEndLat = endLat ? parseFloat(endLat) : null;
      const finalEndLng = endLng ? parseFloat(endLng) : null;
      
      const finalStart = startDatetime ? new Date(startDatetime).toISOString() : null;
      const finalEnd = endDatetime ? new Date(endDatetime).toISOString() : null;

      const { error } = await supabase.from('idea_cards').update({
        title, unit_cost: unitCost, currency, quantity_type: quantityType,
        quantity: quantityType === 'fixed' ? quantity : 1,
        location_address: address, location_lat: finalLat, location_lng: finalLng,
        end_location_address: category === 'Transportation' ? endAddress : null,
        end_location_lat: category === 'Transportation' ? finalEndLat : null,
        end_location_lng: category === 'Transportation' ? finalEndLng : null,
        social_links: socialLinks,
        start_datetime: finalStart,
        end_datetime: finalEnd
      }).eq('id', idea.id);

      if (error) throw error;
      toast.success('Card details saved!');
      onUpdate(); 
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
  const removeLink = (index: number) => setSocialLinks(socialLinks.filter((_, i) => i !== index));

  const getLinkIcon = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return <Youtube className="h-4 w-4 text-red-500" />;
    if (url.includes('instagram.com')) return <Instagram className="h-4 w-4 text-pink-500" />;
    return <Globe className="h-4 w-4 text-blue-500" />;
  };

  const handleExternalClick = (url: string) => window.open(formatExternalUrl(url), '_blank', 'noopener,noreferrer');

  const effectiveQuantity = quantityType === 'per_person' ? memberCount : quantity;
  const totalCost = unitCost * effectiveQuantity;

  if (!idea) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto p-0 flex flex-col h-full border-l">
        
        <div className="p-6 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="bg-background">{category}</Badge>
            <Button onClick={handleSave} disabled={loading} size="sm" className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
          <Input 
            value={title} onChange={e => setTitle(e.target.value)} 
            className="text-2xl font-bold font-display h-auto py-2 border-transparent hover:border-input focus-visible:ring-primary/20 transition-all bg-transparent px-0 rounded-none shadow-none"
          />
        </div>

        <div className="p-6 space-y-8 flex-1">

          {/* NEW: MANUAL SCHEDULE ADJUSTER */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Schedule
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
              <div className="space-y-2">
                <Label className="text-xs">Start Time</Label>
                <Input type="datetime-local" value={startDatetime} onChange={e => setStartDatetime(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">End Time</Label>
                <Input type="datetime-local" value={endDatetime} onChange={e => setEndDatetime(e.target.value)} className="bg-background" />
              </div>
            </div>
          </div>
          
          {/* BUDGET */}
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
                    <SelectItem value="fixed">Fixed Total</SelectItem>
                    <SelectItem value="per_person">Per Person (x{memberCount})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quantityType === 'fixed' && (
                <div className="space-y-2">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="bg-background" />
                </div>
              )}

              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label className="text-xs">Unit Cost</Label>
                <div className="flex gap-2">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-[80px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="₹">₹</SelectItem>
                      <SelectItem value="$">$</SelectItem>
                      <SelectItem value="€">€</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} className="bg-background flex-1" />
                </div>
              </div>

              <div className="col-span-2 mt-2 pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Estimated Total:</div>
                <div className="text-2xl font-bold font-mono text-primary">{currency}{(totalCost).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* LOCATION */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Routing & Location
               </h3>
             </div>
             
            <div className="space-y-6">
              
              <div className="p-4 border rounded-xl bg-card space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{category === 'Transportation' ? 'Origin Address' : 'Address'}</Label>
                  <div className="flex gap-2">
                    <Input value={address} onChange={e => setAddress(e.target.value)} />
                    <Button variant="secondary" onClick={() => testGeocode(address, false)}><Target className="h-4 w-4 mr-2"/> Test API</Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1"><Label className="text-[10px] text-muted-foreground">Raw Latitude</Label><Input className="h-8 text-xs bg-muted" value={lat} onChange={e => setLat(e.target.value)} /></div>
                  <div className="flex-1 space-y-1"><Label className="text-[10px] text-muted-foreground">Raw Longitude</Label><Input className="h-8 text-xs bg-muted" value={lng} onChange={e => setLng(e.target.value)} /></div>
                </div>
              </div>

              {category === 'Transportation' && (
                <div className="p-4 border rounded-xl bg-card space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Destination Address</Label>
                    <div className="flex gap-2">
                      <Input value={endAddress} onChange={e => setEndAddress(e.target.value)} />
                      <Button variant="secondary" onClick={() => testGeocode(endAddress, true)}><Target className="h-4 w-4 mr-2"/> Test API</Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1"><Label className="text-[10px] text-muted-foreground">Raw Latitude</Label><Input className="h-8 text-xs bg-muted" value={endLat} onChange={e => setEndLat(e.target.value)} /></div>
                    <div className="flex-1 space-y-1"><Label className="text-[10px] text-muted-foreground">Raw Longitude</Label><Input className="h-8 text-xs bg-muted" value={endLng} onChange={e => setEndLng(e.target.value)} /></div>
                  </div>
                </div>
              )}

              <div className="w-full h-48 bg-muted rounded-xl border overflow-hidden relative">
                {address ? (
                  <iframe 
                    width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen 
                    src={category === 'Transportation' && endAddress 
                      ? `https://maps.google.com/maps?saddr=${encodeURIComponent(address)}&daddr=${encodeURIComponent(endAddress)}&output=embed`
                      : `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
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

          {/* MEDIA LINKS */}
          <div className="space-y-4">
             <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> References & Media
            </h3>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Paste YouTube, Instagram, or Website link..." 
                value={newLink} onChange={e => setNewLink(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())}
              />
              <Button type="button" onClick={addLink} variant="secondary">Add</Button>
            </div>

            {socialLinks.length > 0 && (
              <div className="space-y-3 mt-4">
                {socialLinks.map((link, idx) => {
                  const ytId = getYoutubeId(link);
                  return (
                    <div key={idx} className="flex flex-col gap-2 bg-muted/40 border p-3 rounded-lg group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {getLinkIcon(link)}
                          <button onClick={() => handleExternalClick(link)} className="text-sm text-left text-foreground hover:text-primary hover:underline truncate">{link}</button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => removeLink(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      
                      {ytId && (
                        <div className="w-full aspect-video rounded-md overflow-hidden mt-2 bg-black border">
                          <iframe
                            width="100%" height="100%" src={`https://www.youtube.com/embed/${ytId}`}
                            title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
                          ></iframe>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
