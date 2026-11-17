import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Receipt,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTripData } from "@/hooks/useTripData";
import { useTrips } from "@/context/TripContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Food", "Transport", "Stay", "Activities", "Shopping", "Misc"];

export default function LedgerView() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { getTrip } = useTrips();
  const { members, expenses, isTripHost, addExpense, deleteExpense } =
    useTripData(tripId);
  const { toast } = useToast();

  const trip = tripId ? getTrip(tripId) : undefined;
  const canDelete = Boolean(
    user && ((trip && trip.created_by === user.id) || isTripHost)
  );

  const [openAdd, setOpenAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [paidBy, setPaidBy] = useState<string>(user?.id || "");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.name));
    return map;
  }, [members]);

  const handleOpenModal = (isOpen: boolean) => {
    setOpenAdd(isOpen);
    if (isOpen) {
      setPaidBy(user?.id || members[0]?.user_id || "");
      setSelectedMembers(members.map((m) => m.user_id));
    }
  };

  const toggleSplitMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!title.trim() || isNaN(numericAmount) || numericAmount <= 0) return;

    const targetUsers =
      selectedMembers.length > 0
        ? selectedMembers
        : members.map((m) => m.user_id);

    if (targetUsers.length === 0) {
      toast({
        title: "Select at least one member",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const perPerson = Number((numericAmount / targetUsers.length).toFixed(2));
    const splits = targetUsers.map((uid, idx) => ({
      user_id: uid,
      amount:
        idx === targetUsers.length - 1
          ? Number(
              (numericAmount - perPerson * (targetUsers.length - 1)).toFixed(2)
            )
          : perPerson,
    }));

    const { error } = await addExpense({
      title: title.trim(),
      amount: numericAmount,
      category,
      paid_by: paidBy || user?.id || targetUsers[0],
      splits,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Could not add expense",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTitle("");
      setAmount("");
      setOpenAdd(false);
      toast({ title: "Expense added" });
    }
  };

  // Compute net balances and pairwise minimum-transfer settlements
  const { totalSpent, netBalances, settlements } = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const balances = new Map<string, number>();

    members.forEach((m) => balances.set(m.user_id, 0));

    expenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      balances.set(exp.paid_by, (balances.get(exp.paid_by) || 0) + amt);

      if (exp.splits && exp.splits.length > 0) {
        exp.splits.forEach((s) => {
          balances.set(s.user_id, (balances.get(s.user_id) || 0) - Number(s.amount || 0));
        });
      } else if (members.length > 0) {
        const share = amt / members.length;
        members.forEach((m) => {
          balances.set(m.user_id, (balances.get(m.user_id) || 0) - share);
        });
      }
    });

    const debtors: { user_id: string; amount: number }[] = [];
    const creditors: { user_id: string; amount: number }[] = [];

    balances.forEach((val, uid) => {
      const rounded = Math.round(val * 100) / 100;
      if (rounded < -0.01) debtors.push({ user_id: uid, amount: Math.abs(rounded) });
      if (rounded > 0.01) creditors.push({ user_id: uid, amount: rounded });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers: { from: string; to: string; amount: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const transferAmt = Math.min(debtors[i].amount, creditors[j].amount);
      if (transferAmt > 0.01) {
        transfers.push({
          from: memberMap.get(debtors[i].user_id) || "Member",
          to: memberMap.get(creditors[j].user_id) || "Member",
          amount: Number(transferAmt.toFixed(2)),
        });
      }
      debtors[i].amount -= transferAmt;
      creditors[j].amount -= transferAmt;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    return {
      totalSpent: total,
      netBalances: Array.from(balances.entries()).map(([uid, net]) => ({
        user_id: uid,
        name: memberMap.get(uid) || "Member",
        net: Number(net.toFixed(2)),
      })),
      settlements: transfers,
    };
  }, [expenses, members, memberMap]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Total Trip Spend
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono mt-0.5">
            ₹{totalSpent.toFixed(2)}
          </p>
        </div>

        <Dialog open={openAdd} onOpenChange={handleOpenModal}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Shared Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="exp-title">Description</Label>
                <Input
                  id="exp-title"
                  placeholder="e.g., Fuel, Dinner at Kasol, Hotel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-amount">Amount (₹)</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Paid By</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Split Equally Among
                  </Label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMembers(members.map((m) => m.user_id))
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto rounded-xl border border-border p-2.5">
                  {members.map((m) => (
                    <label
                      key={m.user_id}
                      className="flex items-center gap-2.5 text-sm cursor-pointer py-1"
                    >
                      <Checkbox
                        checked={selectedMembers.includes(m.user_id)}
                        onCheckedChange={() => toggleSplitMember(m.user_id)}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Saving…" : "Save Expense"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="balances" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balances">Balances & Settlements</TabsTrigger>
          <TabsTrigger value="expenses">
            Expense Feed ({expenses.length})
          </TabsTrigger>
        </TabsList>

        {/* Balances & How to Settle Up */}
        <TabsContent value="balances" className="space-y-6 mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                How to Settle Up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settlements.length === 0 ? (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-4 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Everyone is all settled up!</span>
                </div>
              ) : (
                settlements.map((s, idx) => (
                  <div
                    key={`${s.from}-${s.to}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-sm leading-snug">
                      <span className="font-semibold text-foreground break-words">
                        {s.from}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                        pays
                        <ArrowRightLeft className="h-3 w-3" />
                      </span>
                      <span className="font-semibold text-foreground break-words">
                        {s.to}
                      </span>
                    </div>

                    <div className="flex items-center justify-end sm:justify-start shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      <span className="rounded-lg bg-primary/15 px-2.5 py-1 font-mono text-sm font-bold text-primary">
                        ₹{s.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Net Member Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {netBalances.map((b) => (
                <div
                  key={b.user_id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0 text-sm"
                >
                  <span className="font-medium truncate min-w-0">{b.name}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      b.net > 0.01
                        ? "text-emerald-500"
                        : b.net < -0.01
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {b.net > 0.01
                      ? `+₹${b.net.toFixed(2)}`
                      : b.net < -0.01
                      ? `-₹${Math.abs(b.net).toFixed(2)}`
                      : "₹0.00"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Feed */}
        <TabsContent value="expenses" className="space-y-3 mt-4">
          {expenses.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No expenses logged yet. Tap &ldquo;Add Expense&rdquo; to start.
              </CardContent>
            </Card>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{exp.title}</p>
                    <Badge variant="secondary" className="text-[11px]">
                      {exp.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Paid by <span className="font-medium text-foreground">{exp.paid_by_name}</span>
                    {exp.splits?.length
                      ? ` • Split with ${exp.splits.length} ${
                          exp.splits.length === 1 ? "person" : "people"
                        }`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-sm">
                    ₹{Number(exp.amount).toFixed(2)}
                  </span>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteExpense(exp.id)}
                      title="Delete expense (Host)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
