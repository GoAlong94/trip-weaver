import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Receipt, ArrowRightLeft, Plus, Wallet, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function LedgerView() {
  const { tripId } = useParams();
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState('₹');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitAmong, setSplitAmong] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [tripId, user]);

  const fetchData = async () => {
    try {
      // 1. Fetch Member IDs
      const { data: memberData, error: memberError } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', tripId);
      
      if (memberError) throw memberError;

      // 2. Safely Fetch Profiles (The Two-Step Fetch)
      if (memberData && memberData.length > 0) {
        const userIds = memberData.map(m => m.user_id);
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        
        const enrichedMembers = memberData.map(m => ({
          user_id: m.user_id,
          profiles: profileMap.get(m.user_id) || null
        }));

        setMembers(enrichedMembers);
        
        // Default the form selections
        setSplitAmong(userIds); 
        if (user) setPaidBy(user.id); 
      } else {
        setMembers([]);
      }

      // 3. Fetch Expenses
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
        
      if (expError) throw expError;
      setExpenses(expData || []);
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || splitAmong.length === 0) return toast.error("Please fill all fields and select at least one person to split with.");

    try {
      const newExp = {
        trip_id: tripId,
        title,
        amount: Number(amount),
        currency,
        paid_by: paidBy,
        split_among: splitAmong
      };

      const { error } = await supabase.from('expenses').insert([newExp]);
      if (error) throw error;

      toast.success("Expense added successfully!");
      setShowForm(false);
      setTitle(''); setAmount('');
      fetchData(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleSplitMember = (memberId: string) => {
    setSplitAmong(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
  };

  const deleteExpense = async (id: string) => {
    try {
      await supabase.from('expenses').delete().eq('id', id);
      setExpenses(expenses.filter(e => e.id !== id));
      toast.success("Expense deleted");
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  // Helper to safely get names locally
  const getMemberName = (id: string) => {
    const m = members.find(m => m.user_id === id);
    return m?.profiles?.name || 'Unknown User';
  };

  // --- THE SPLITWISE MATH ENGINE ---
  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.user_id] = 0);

    expenses.forEach(exp => {
      const splitCount = exp.split_among?.length || 1;
      const share = exp.amount / splitCount;

      // The person who paid gets the FULL amount added to their positive balance
      if (balances[exp.paid_by] !== undefined) {
        balances[exp.paid_by] += exp.amount;
      }

      // Everyone involved gets their share subtracted from their balance
      exp.split_among.forEach((uid: string) => {
        if (balances[uid] !== undefined) {
          balances[uid] -= share;
        }
      });
    });

    return balances;
  };

  // Generate "Who owes Who" Settlement Plan
  const calculateSettlements = (balances: Record<string, number>) => {
    const debtors = Object.keys(balances).filter(k => balances[k] < -0.01).map(k => ({ id: k, amount: -balances[k] }));
    const creditors = Object.keys(balances).filter(k => balances[k] > 0.01).map(k => ({ id: k, amount: balances[k] }));
    
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let i = 0; let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      settlements.push({ from: debtor.id, to: creditor.id, amount: amount });

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return settlements;
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const balances = calculateBalances();
  const settlements = calculateSettlements(balances);

  return (
    <div className="p-6 h-[calc(100vh-73px)] overflow-y-auto custom-scrollbar relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" /> The Ledger
          </h2>
          <p className="text-muted-foreground mt-2">Track real expenses and settle debts automatically.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4"/> Add Expense</>}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8 border-primary/20 bg-muted/30 shadow-inner">
          <CardContent className="pt-6">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>What was this for?</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinner at Cafe" required />
                </div>
                <div className="space-y-2">
                  <Label>How much did it cost?</Label>
                  <div className="flex gap-2">
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-[80px] bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="₹">₹</SelectItem>
                        <SelectItem value="$">$</SelectItem>
                        <SelectItem value="€">€</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required className="bg-background flex-1" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Who paid?</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name || 'Unknown'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 bg-background p-4 rounded-xl border">
                <Label className="mb-2 block">Split equally among:</Label>
                <div className="flex flex-wrap gap-4">
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`split-${m.user_id}`} 
                        checked={splitAmong.includes(m.user_id)} 
                        onCheckedChange={() => toggleSplitMember(m.user_id)}
                      />
                      <label htmlFor={`split-${m.user_id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {m.profiles?.name || 'Unknown'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full">Save Expense</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="expenses">Transactions</TabsTrigger>
          <TabsTrigger value="balances">Balances & Settlements</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
             <Card className="md:col-span-3 bg-card border shadow-sm">
               <CardContent className="p-6 flex items-center justify-between">
                 <div>
                   <p className="text-muted-foreground font-medium text-sm uppercase tracking-wider">Total Realized Spend</p>
                   <h3 className="text-4xl font-bold mt-2 font-mono">₹{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                 </div>
                 <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                   <Wallet className="h-6 w-6 text-primary" />
                 </div>
               </CardContent>
             </Card>
          </div>

          <div className="space-y-3">
            {expenses.length === 0 ? (
               <div className="text-center p-12 text-muted-foreground border rounded-xl border-dashed">
                 No expenses tracked yet. Add one to see the magic happen!
               </div>
            ) : (
              expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-shadow group">
                  <div className="flex gap-4 items-center">
                    <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{exp.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Paid by <span className="font-medium text-foreground">{getMemberName(exp.paid_by)}</span> 
                        {' • '} {format(new Date(exp.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="font-mono font-bold text-lg">{exp.currency}{exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Tabs/TabsContent>

        <TabsContent value="balances">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="shadow-sm">
              <CardHeader><CardTitle>Net Balances</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(balances).map(uid => {
                  const balance = balances[uid];
                  const isPositive = balance > 0.01;
                  const isNegative = balance < -0.01;
                  const isSettled = Math.abs(balance) <= 0.01;

                  return (
                    <div key={uid} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                      <div className="font-medium">{getMemberName(uid)}</div>
                      <div className={`flex items-center gap-2 font-mono font-bold ${isPositive ? 'text-emerald-500' : isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {isPositive ? <TrendingUp className="h-4 w-4" /> : isNegative ? <TrendingDown className="h-4 w-4" /> : null}
                        {isSettled ? 'Settled Up' : `${balance > 0 ? '+' : ''}₹${Math.abs(balance).toFixed(2)}`}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> How to Settle Up</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {settlements.length === 0 ? (
                  <div className="text-center p-6 text-muted-foreground">Everyone is completely settled up! 🍻</div>
                ) : (
                  settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-background border rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{getMemberName(s.from)}</span>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{getMemberName(s.to)}</span>
                      </div>
                      <div className="font-mono font-bold text-lg text-primary">₹{s.amount.toFixed(2)}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
