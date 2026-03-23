import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, ArrowRight, Map, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Map, title: 'Plan Visually', desc: 'Kanban boards & day-by-day timelines' },
  { icon: Users, title: 'Collaborate', desc: 'Invite friends, plan together in real-time' },
  { icon: Wallet, title: 'Split Costs', desc: 'Track expenses, settle up fairly' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Plane className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight text-primary-foreground">Wanderloom</span>
        </div>
        <Button
          variant="outline"
          className="border-primary/30 text-primary-foreground hover:bg-primary/10 hover:text-primary"
          onClick={() => navigate('/auth')}
        >
          Sign In
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-2xl"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
            Plan trips that
            <span className="text-primary"> actually happen</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/60 mb-10 max-w-lg mx-auto">
            Organize itineraries, coordinate with friends, and split costs — all in one beautiful workspace.
          </p>
          <Button
            size="lg"
            className="gradient-warm text-primary-foreground shadow-warm px-8 py-6 text-base font-semibold gap-2"
            onClick={() => navigate('/auth')}
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-3xl w-full"
        >
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur-sm p-6 text-left">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-primary-foreground font-semibold mb-1 font-sans text-base">{f.title}</h3>
              <p className="text-primary-foreground/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="py-6 text-center text-primary-foreground/30 text-sm">
        © 2026 Wanderloom
      </footer>
    </div>
  );
}
