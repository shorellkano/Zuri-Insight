import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, Plus, Trash2, X, Check, UserCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;

const EVENT_TYPES = [
  "birthday", "staff_birthday", "ceo_birthday", "company_anniversary",
  "product_launch", "sale_period", "company_event", "custom"
];

const TYPE_COLORS: Record<string, string> = {
  birthday: "bg-pink-100 text-pink-700 border-pink-200",
  staff_birthday: "bg-pink-100 text-pink-700 border-pink-200",
  ceo_birthday: "bg-pink-100 text-pink-700 border-pink-200",
  company_anniversary: "bg-amber-100 text-amber-700 border-amber-200",
  product_launch: "bg-blue-100 text-blue-700 border-blue-200",
  sale_period: "bg-green-100 text-green-700 border-green-200",
  company_event: "bg-purple-100 text-purple-700 border-purple-200",
  custom: "bg-muted text-muted-foreground border-border",
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface BrandEvent {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  isRecurring: boolean;
  personName?: string;
  personRole?: string;
  notes?: string;
  autoGenerate: boolean;
  leadDays: number;
}

interface PeopleAsset {
  id: string;
  name: string;
  role?: string;
  photoUrl: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function BrandCalendarPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showAddSheet, setShowAddSheet] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("custom");
  const [formDate, setFormDate] = useState("");
  const [formRecurring, setFormRecurring] = useState(true);
  const [formPersonName, setFormPersonName] = useState("");
  const [formPersonRole, setFormPersonRole] = useState("");
  const [formAutoGenerate, setFormAutoGenerate] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [addPerson, setAddPerson] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [personSaving, setPersonSaving] = useState(false);

  const { data: events = [] } = useQuery<BrandEvent[]>({
    queryKey: ["brand-calendar-events", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/calendar-events`)).then(r => r.json()),
    enabled: !!brandId,
  });

  const { data: people = [] } = useQuery<PeopleAsset[]>({
    queryKey: ["people-assets", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/people-assets`)).then(r => r.json()),
    enabled: !!brandId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/calendar-events/${id}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-calendar-events", brandId] }),
  });

  const deletePersonMutation = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/people-assets/${id}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people-assets", brandId] }),
  });

  async function saveEvent() {
    if (!formName || !formDate) return;
    setFormSaving(true);
    try {
      const r = await fetch(API(`/brands/${brandId}/calendar-events`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName, eventType: formType, eventDate: formDate,
          isRecurring: formRecurring, personName: formPersonName || undefined,
          personRole: formPersonRole || undefined, autoGenerate: formAutoGenerate,
          notes: formNotes || undefined,
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast({ title: "Event added" });
      qc.invalidateQueries({ queryKey: ["brand-calendar-events", brandId] });
      setShowAddSheet(false);
      setFormName(""); setFormType("custom"); setFormDate("");
      setFormPersonName(""); setFormPersonRole(""); setFormNotes("");
    } catch {
      toast({ title: "Failed to save event", variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  }

  async function savePerson() {
    if (!personName) return;
    setPersonSaving(true);
    try {
      const r = await fetch(API(`/brands/${brandId}/people-assets`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: personName, role: personRole || undefined, photoUrl: "/placeholder-person.png" }),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast({ title: "Person added" });
      qc.invalidateQueries({ queryKey: ["people-assets", brandId] });
      setPersonName(""); setPersonRole(""); setAddPerson(false);
    } catch {
      toast({ title: "Failed to add person", variant: "destructive" });
    } finally {
      setPersonSaving(false);
    }
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const isBirthdayType = ["birthday", "staff_birthday", "ceo_birthday"].includes(formType);

  function eventsForDay(day: number) {
    return events.filter(e => {
      const d = new Date(e.eventDate + "T00:00:00");
      return d.getMonth() === month && d.getDate() === day;
    });
  }

  function nextOccurrence(eventDate: string): string {
    const d = new Date(eventDate + "T00:00:00");
    const now = new Date();
    d.setFullYear(now.getFullYear());
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div data-testid="brand-calendar-page">
      <BrandSubNav brandId={brandId!} />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Brand Calendar</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Important dates for your brand - staff birthdays, anniversaries, launches.</p>
          </div>
          <button
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold text-foreground">{MONTH_NAMES[month]} {year}</h2>
          <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDay + 1;
              const isValid = day >= 1 && day <= daysInMonth;
              const isToday = isValid && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
              const dayEvents = isValid ? eventsForDay(day) : [];
              return (
                <div key={i} className={cn("border-b border-r border-border p-1.5 min-h-[72px]", !isValid && "bg-muted/20", i % 7 === 6 && "border-r-0")}>
                  {isValid && (
                    <>
                      <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                        {day}
                      </div>
                      {dayEvents.map(e => (
                        <div key={e.id} className={cn("text-[10px] px-1 py-0.5 rounded font-medium truncate border", TYPE_COLORS[e.eventType] ?? TYPE_COLORS.custom)}>
                          {e.name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {events.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">All events</h3>
            <div className="space-y-2">
              {[...events].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()).map(event => (
                <div key={event.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className={cn("px-2 py-1 rounded-lg border text-xs font-medium capitalize whitespace-nowrap", TYPE_COLORS[event.eventType] ?? TYPE_COLORS.custom)}>
                    {event.eventType?.replace(/_/g, " ")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{event.name}</p>
                    {event.personName && (
                      <p className="text-xs text-muted-foreground">{event.personName}{event.personRole ? ` - ${event.personRole}` : ""}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-foreground">{nextOccurrence(event.eventDate)}</p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      {event.isRecurring && <span className="text-[10px] text-muted-foreground">Recurring</span>}
                      {event.autoGenerate && <span className="text-[10px] text-green-600">Auto-generate on</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteMutation.mutate(event.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
            <CalendarHeart className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No brand events yet</p>
            <p className="text-xs text-muted-foreground mb-4">Add staff birthdays, company anniversary, product launches - Zuri will include them in every content plan.</p>
            <button onClick={() => setShowAddSheet(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Add your first event
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">People assets</h3>
            <button onClick={() => setAddPerson(true)} className="text-xs text-primary font-medium hover:underline">
              + Add person
            </button>
          </div>
          {addPerson && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <input type="text" value={personRole} onChange={e => setPersonRole(e.target.value)} placeholder="Role (optional)" className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-2">
                <button onClick={savePerson} disabled={personSaving || !personName} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-60">
                  {personSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setAddPerson(false); setPersonName(""); setPersonRole(""); }} className="px-4 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {people.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {people.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 group">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                    {p.role && <p className="text-[10px] text-muted-foreground truncate">{p.role}</p>}
                  </div>
                  <button onClick={() => deletePersonMutation.mutate(p.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No people added yet. Add team members to personalise birthday posts.</p>
          )}
        </div>
      </div>

      {showAddSheet && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddSheet(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-background border-l border-border flex flex-col shadow-xl z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Add Event</h2>
              <button onClick={() => setShowAddSheet(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. CEO Birthday, Company Anniversary"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              {isBirthdayType && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Person's name</label>
                    <input type="text" value={formPersonName} onChange={e => setFormPersonName(e.target.value)} placeholder="Name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
                    <input type="text" value={formPersonRole} onChange={e => setFormPersonRole(e.target.value)} placeholder="e.g. CEO"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Recurring annually</p>
                  <p className="text-xs text-muted-foreground">Repeat this event every year</p>
                </div>
                <button
                  onClick={() => setFormRecurring(r => !r)}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", formRecurring ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", formRecurring ? "left-5.5 translate-x-0.5" : "left-0.5")} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-generate post</p>
                  <p className="text-xs text-muted-foreground">Zuri includes this in content plans automatically</p>
                </div>
                <button
                  onClick={() => setFormAutoGenerate(r => !r)}
                  className={cn("relative h-6 w-11 rounded-full transition-colors", formAutoGenerate ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", formAutoGenerate ? "left-5.5 translate-x-0.5" : "left-0.5")} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Any context for Zuri when generating posts..."
                  rows={3} className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border">
              <button onClick={saveEvent} disabled={formSaving || !formName || !formDate}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
                {formSaving ? "Saving..." : "Save Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
