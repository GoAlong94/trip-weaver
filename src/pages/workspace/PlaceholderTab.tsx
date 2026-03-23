import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

const labels: Record<string, string> = {
  ideas: 'Idea Board',
  timeline: 'Timeline',
  forecast: 'Forecast',
  ledger: 'Ledger',
};

export default function PlaceholderTab() {
  const { pathname } = useLocation();
  const segment = pathname.split('/').pop() || '';
  const label = labels[segment] || segment;

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
      <Construction className="h-12 w-12 mb-4 text-primary/40" />
      <h2 className="text-xl font-display font-semibold text-foreground mb-2">{label}</h2>
      <p className="text-sm">This workspace tab is coming soon.</p>
    </div>
  );
}
