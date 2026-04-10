import { useState } from "react";
import { Globe, ChevronDown, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const COUNTRY_FLAGS: Record<string, string> = {
  NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", ZA: "🇿🇦", EG: "🇪🇬",
  ET: "🇪🇹", TZ: "🇹🇿", UG: "🇺🇬", CI: "🇨🇮", SN: "🇸🇳",
};

const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
];

const LANGUAGES = ["English", "Pidgin English", "Yoruba", "Igbo", "Hausa", "Swahili", "French", "Arabic", "Afrikaans", "Amharic"];

export interface CulturalContext {
  country: string;
  countryCode: string;
  language: string;
}

interface CulturalContextBadgeProps {
  value: CulturalContext;
  onChange: (ctx: CulturalContext) => void;
}

export function CulturalContextBadge({ value, onChange }: CulturalContextBadgeProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CulturalContext>(value);

  const flag = COUNTRY_FLAGS[value.countryCode] ?? "🌍";

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setDraft(value); setOpen(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
        data-testid="cultural-context-badge"
      >
        <span className="text-sm">{flag}</span>
        {value.country} - {value.language}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-w-sm mx-auto">
          <DrawerHeader className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-600" />
              Cultural Context
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="p-1 rounded-md text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <p className="text-xs text-muted-foreground">Override cultural context for this generation only. Your brand settings are not changed.</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Country</Label>
              <Select value={draft.countryCode} onValueChange={(code) => {
                const c = COUNTRIES.find(c => c.code === code);
                if (c) setDraft(d => ({ ...d, country: c.name, countryCode: code }));
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {COUNTRY_FLAGS[c.code] ?? "🌍"} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Language / Dialect</Label>
              <Select value={draft.language} onValueChange={(lang) => setDraft(d => ({ ...d, language: lang }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={apply}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Apply for this generation
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
