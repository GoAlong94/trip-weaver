import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { tripSections, type SectionVisibility, type TripSectionVisibility } from '@/lib/trip-sections';

interface TripSectionSettingsProps {
  visibility: TripSectionVisibility;
  onSave: (visibility: TripSectionVisibility) => Promise<void>;
}

export default function TripSectionSettings({ visibility, onSave }: TripSectionSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(visibility);
  const [saving, setSaving] = useState(false);

  const updateGroup = (group: 'host' | 'members', key: keyof SectionVisibility, checked: boolean) => {
    setDraft(current => ({ ...current, [group]: { ...current[group], [key]: checked } }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(visibility);
    setOpen(nextOpen);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Section visibility settings"
        title="Section visibility settings"
        onClick={() => handleOpenChange(true)}
      >
        <Settings2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Section visibility</DialogTitle>
            <DialogDescription>Choose which sections appear in each trip menu.</DialogDescription>
          </DialogHeader>
          {(['host', 'members'] as const).map(group => (
            <section key={group} className="space-y-3">
              <h3 className="font-semibold">{group === 'host' ? 'Your menu' : 'Member menus'}</h3>
              <div className="grid grid-cols-1 gap-2">
                {tripSections.map(section => {
                  const id = `${group}-${section.key}`;
                  return (
                    <div key={id} className="flex min-h-10 items-center gap-3">
                      <Checkbox
                        id={id}
                        checked={draft[group][section.key]}
                        onCheckedChange={checked => updateGroup(group, section.key, checked === true)}
                      />
                      <Label htmlFor={id} className="cursor-pointer font-normal">{section.title}</Label>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}