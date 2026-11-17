import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TripSectionVisibility,
  tripSections,
  TripSectionKey,
} from "@/lib/trip-sections";
import { useToast } from "@/hooks/use-toast";

interface TripSectionSettingsProps {
  tripId: string;
  visibility: TripSectionVisibility;
  onSave: (tripId: string, next: TripSectionVisibility) => Promise<boolean>;
}

export function TripSectionSettings({
  tripId,
  visibility,
  onSave,
}: TripSectionSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TripSectionVisibility>(visibility);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDraft(visibility);
  }, [visibility, open]);

  const toggleSection = (
    target: "host" | "members",
    key: TripSectionKey,
    checked: boolean
  ) => {
    setDraft((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        [key]: checked,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(tripId, draft);
    setSaving(false);
    if (ok) {
      toast({
        title: "Menu visibility updated",
        description: "Trip navigation has been updated for you and trip members.",
      });
      setOpen(false);
    } else {
      toast({
        title: "Could not save settings",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 px-2.5 text-xs"
          title="Configure visible trip menus"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Menus</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85dvh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>Trip Menu Visibility (Host)</DialogTitle>
          <DialogDescription>
            Choose which trip menus appear in your own navigation and which ones are shown to members.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
          <div className="grid grid-cols-12 items-center text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
            <span className="col-span-6">Section</span>
            <span className="col-span-3 text-center">Your Menu</span>
            <span className="col-span-3 text-center">Members</span>
          </div>

          {tripSections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.key}
                className="grid grid-cols-12 items-center py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {section.label}
                  </span>
                </div>
                <div className="col-span-3 flex justify-center">
                  <Checkbox
                    checked={draft.host[section.key]}
                    onCheckedChange={(v) =>
                      toggleSection("host", section.key, Boolean(v))
                    }
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  <Checkbox
                    checked={draft.members[section.key]}
                    onCheckedChange={(v) =>
                      toggleSection("members", section.key, Boolean(v))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/30 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
