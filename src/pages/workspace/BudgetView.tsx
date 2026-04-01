import { useParams } from 'react-router-dom';
import { useTripData } from '@/hooks/useTripData';
import { Loader2, PieChart as PieChartIcon, DollarSign, Users, TrendingUp, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  'Locations': '#3b82f6',
  'Transportation': '#a855f7',
  'Lodging': '#f59e0b',
  'Food': '#f97316',
  'Excursions': '#10b981',
  'Entertainment': '#ec4899',
  'Other': '#64748b'
};

export default function BudgetView() {
  const { tripId } = useParams();
  
  // 🔥 THE INSTANT CACHE ENGINE 🔥
  const { ideas, members, loading } = useTripData(tripId);
  
  const membersCount = members.length || 1;
  const currency = ideas.length > 0 && ideas[0].currency ? ideas[0].currency : '₹';

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  let totalGroupCost = 0;
  const categoryTotals: Record<string, number> = {};

  ideas.forEach(idea => {
    if (!idea.unit_cost) return;
    const effectiveQty = idea.quantity_type === 'per_person' ? membersCount : (idea.quantity || 1);
    const itemTotal = idea.unit_cost * effectiveQty;
    
    totalGroupCost += itemTotal;
    if (!categoryTotals[idea.category]) categoryTotals[idea.category] = 0;
    categoryTotals[idea.category] += itemTotal;
  });

  const costPerPerson = totalGroupCost / membersCount;
  const chartData = Object.keys(categoryTotals).map(key => ({
    name: key,
    value: categoryTotals[key],
    color: CATEGORY_COLORS[key] || CATEGORY_COLORS['Other']
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="p-6 h-[calc(100vh-73px)] overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <PieChartIcon className="h-8 w-8 text-primary" /> Forecasting Engine
        </h2>
        <p className="text-muted-foreground mt-2">Estimated budget based on your saved Idea Cards.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary text-primary-foreground shadow-lg border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/80 font-medium text-sm uppercase tracking-wider">Total Est. Trip Cost</p>
                <h3 className="text-4xl font-bold mt-2 font-mono">{currency}{totalGroupCost.toLocaleString()}</h3>
              </div>
              <div className="h-12 w-12 bg-primary-foreground/20 rounded-full flex items-center justify-center"><DollarSign className="h-6 w-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground font-medium text-sm uppercase tracking-wider">Cost Per Person</p>
                <h3 className="text-3xl font-bold mt-2 font-mono text-foreground">{currency}{costPerPerson.toLocaleString()}</h3>
              </div>
              <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center"><Users className="h-6 w-6 text-muted-foreground" /></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Divided equally among {membersCount} travelers</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground font-medium text-sm uppercase tracking-wider">Tracked Items</p>
                <h3 className="text-3xl font-bold mt-2 text-foreground">{ideas.filter(i => i.unit_cost > 0).length}</h3>
              </div>
              <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center"><CreditCard className="h-6 w-6 text-muted-foreground" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" /> Cost by Category</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Estimated Cost']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[300px] flex items-center justify-center text-muted-foreground">No cost data available yet.</div>}
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50 flex flex-col h-full max-h-[400px]">
          <CardHeader className="shrink-0"><CardTitle className="text-lg">Top Expenses</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {ideas.filter(i => i.unit_cost > 0).sort((a, b) => {
                  const aTotal = a.unit_cost * (a.quantity_type === 'per_person' ? membersCount : (a.quantity || 1));
                  const bTotal = b.unit_cost * (b.quantity_type === 'per_person' ? membersCount : (b.quantity || 1));
                  return bTotal - aTotal;
                }).map(idea => {
                  const total = idea.unit_cost * (idea.quantity_type === 'per_person' ? membersCount : (idea.quantity || 1));
                  const percentage = ((total / totalGroupCost) * 100).toFixed(1);
                  return (
                    <div key={idea.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idea.category] || CATEGORY_COLORS['Other'] }} />
                        <div><p className="font-semibold text-sm leading-tight">{idea.title}</p><p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{idea.category}</p></div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-sm text-foreground">{currency}{total.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{percentage}% of budget</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
