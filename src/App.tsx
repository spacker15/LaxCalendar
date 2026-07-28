import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Copy, Download, LogIn, LogOut, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { defaultData } from "./data";
import type { AppData, Availability, CalendarEvent, EventType, Field, Program, UserRole } from "./types";
import { isSupabaseConfigured, loadSharedData, loadUserRole, saveSharedData, supabase } from "./supabase";

const KEY = "lax-calendar-v3";
const uid = () => crypto.randomUUID();
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmt = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const duration = (a: string, b: string) => { const n = minutes(b) - minutes(a), h = Math.floor(n / 60), m = n % 60; return [h ? `${h} hr${h === 1 ? "" : "s"}` : "", m ? `${m} min` : ""].filter(Boolean).join(" "); };
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return dateKey(d); };
const overlap = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) => minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);
const readableText = (hex: string) => { const c = hex.replace("#", ""); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#172033" : "#fff"; };
const loadLocal = (): AppData => { try { return JSON.parse(localStorage.getItem(KEY) || "") as AppData; } catch { return defaultData; } };

function openSlots(a: Availability, events: CalendarEvent[], excludeId?: string) {
  const busy = events.filter(e => e.id !== excludeId && e.date === a.date && e.fieldId === a.fieldId && e.type !== "Holiday")
    .map(e => ({ s: Math.max(minutes(e.startTime), minutes(a.startTime)), e: Math.min(minutes(e.endTime), minutes(a.endTime)) }))
    .filter(x => x.s < x.e).sort((x, y) => x.s - y.s);
  const merged: { s: number; e: number }[] = [];
  busy.forEach(x => { const last = merged.at(-1); if (last && x.s <= last.e) last.e = Math.max(last.e, x.e); else merged.push({ ...x }); });
  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = minutes(a.startTime);
  for (const b of merged) { if (cursor < b.s) slots.push({ startTime: time(cursor), endTime: time(b.s) }); cursor = Math.max(cursor, b.e); }
  if (cursor < minutes(a.endTime)) slots.push({ startTime: time(cursor), endTime: a.endTime });
  return slots;
}

export default function App() {
  const [data, setData] = useState<AppData>(loadLocal);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "agenda" | "availability">("month");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [syncState, setSyncState] = useState<"local" | "loading" | "synced" | "saving" | "error">(isSupabaseConfigured ? "loading" : "local");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [eventEdit, setEventEdit] = useState<CalendarEvent | null>(null);
  const [availabilityEdit, setAvailabilityEdit] = useState<Availability | null>(null);
  const [manage, setManage] = useState(false);

  const canEdit = role === "admin" || role === "scheduler";
  const canAdmin = role === "admin";
  const pmap = useMemo(() => new Map(data.programs.map(p => [p.id, p])), [data.programs]);
  const fmap = useMemo(() => new Map(data.fields.map(f => [f.id, f])), [data.fields]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const hydrate = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setRole("viewer");
        setSyncState("local");
        return;
      }

      setSyncState("loading");
      try {
        const [remote, remoteRole] = await Promise.all([
          loadSharedData(),
          loadUserRole(nextSession.user.id),
        ]);
        if (!active) return;
        setRole(remoteRole);
        if (remote) {
          setData(remote);
          localStorage.setItem(KEY, JSON.stringify(remote));
        }
        setSyncState("synced");
      } catch (error) {
        console.error(error);
        if (active) setSyncState("error");
      }
    };

    void supabase.auth.getSession().then(({ data: auth }) => hydrate(auth.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession);
    });

    const channel = supabase
      .channel("scheduler-state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduler_state", filter: "id=eq.default" },
        payload => {
          const next = (payload.new as { data?: AppData }).data;
          if (next) {
            setData(next);
            localStorage.setItem(KEY, JSON.stringify(next));
            setSyncState("synced");
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, []);

  const save = async (next: AppData) => {
    setData(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    if (!supabase || !session) {
      setSyncState("local");
      return;
    }

    setSyncState("saving");
    try {
      await saveSharedData(next, session);
      setSyncState("synced");
    } catch (error) {
      console.error(error);
      setSyncState("error");
      alert("The change was saved on this device but could not be synced to Supabase.");
    }
  };

  const signIn = async () => {
    if (!supabase || !authEmail.trim()) return;
    setAuthMessage("Sending sign-in link…");
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setAuthMessage(error ? error.message : "Check your email for the sign-in link.");
  };

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.events.filter(e => !q || [e.title, e.type, pmap.get(e.programId || "")?.name, fmap.get(e.fieldId)?.name].some(v => v?.toLowerCase().includes(q)));
  }, [data.events, query, pmap, fmap]);

  const monthDays = useMemo(() => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1), start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [date]);

  const weekDays = useMemo(() => {
    const s = new Date(date);
    s.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [date]);

  const firstFieldForDate = (day: string) => data.fields.find(f => f.active && data.availability.some(a => a.date === day && a.fieldId === f.id))?.id || data.fields.find(f => f.active)?.id || "";
  const newEvent = (day = dateKey(date), fieldId = firstFieldForDate(day), slot?: { startTime: string; endTime: string }): CalendarEvent => ({ id: uid(), programId: data.programs.find(p => p.active)?.id, fieldId, type: "Practice", title: "", date: day, startTime: slot?.startTime || "17:30", endTime: slot?.endTime || "19:00" });
  const deleteEvent = (id: string) => { if (confirm("Delete this event?")) { void save({ ...data, events: data.events.filter(e => e.id !== id) }); setEventEdit(null); } };
  const deleteAvailability = (id: string) => { if (confirm("Delete this availability window?")) { void save({ ...data, availability: data.availability.filter(a => a.id !== id) }); setAvailabilityEdit(null); } };
  const duplicate = (e: CalendarEvent) => setEventEdit({ ...e, id: uid(), seriesId: undefined, title: `${e.title} copy` });
  const exportJSON = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "lacrosse-calendar-backup.json"; a.click(); URL.revokeObjectURL(url); };
  const move = (n: number) => setDate(view === "month" ? new Date(date.getFullYear(), date.getMonth() + n, 1) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * n));

  return <div className="app">
    <header><div><p className="eyebrow">LACROSSE FIELD SCHEDULER</p><h1>{date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1><small>{isSupabaseConfigured ? `${session ? role : "Signed out"} · ${syncState}` : "Local-only mode"}</small></div><div className="actions">
      {isSupabaseConfigured && session && <button onClick={() => void supabase?.auth.signOut()}><LogOut size={17}/>Sign out</button>}
      {canAdmin && <button onClick={() => setManage(true)}><Settings size={17}/>Programs & Fields</button>}
      <button onClick={exportJSON}><Download size={17}/>Backup</button>
      {canAdmin && <button onClick={() => setAvailabilityEdit({ id: uid(), fieldId: data.fields[0]?.id || "", date: dateKey(date), startTime: "09:00", endTime: "15:00" })}><Plus size={17}/>Availability</button>}
      {canEdit && <button className="primary" onClick={() => setEventEdit(newEvent())}><Plus size={17}/>Event</button>}
    </div></header>

    {isSupabaseConfigured && !session && <section className="auth-panel"><LogIn size={20}/><div><strong>Sign in to the shared calendar</strong><small>A magic link will be emailed to you.</small></div><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email address"/><button className="primary" onClick={() => void signIn()}>Send link</button>{authMessage && <span>{authMessage}</span>}</section>}

    <section className="controls"><div className="nav"><button onClick={() => move(-1)}><ChevronLeft/></button><button onClick={() => setDate(new Date())}>Today</button><strong>{date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><button onClick={() => move(1)}><ChevronRight/></button></div><div className="views">{(["month", "week", "agenda", "availability"] as const).map(v => <button className={view === v ? "active" : ""} key={v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div></section>
    <section className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search team, program, field, or event"/></section>

    <main>{view === "month" && <Month days={monthDays} current={date} data={data} events={filteredEvents} pmap={pmap} fmap={fmap} onDay={(d: string) => canEdit && setEventEdit(newEvent(d))} onEvent={setEventEdit} onSlot={(a: Availability, s: { startTime: string; endTime: string }) => canEdit && setEventEdit(newEvent(a.date, a.fieldId, s))}/>} {view === "week" && <Week days={weekDays} data={data} events={filteredEvents} pmap={pmap} onEvent={setEventEdit} onSlot={(a: Availability, s: { startTime: string; endTime: string }) => canEdit && setEventEdit(newEvent(a.date, a.fieldId, s))}/>} {view === "agenda" && <Agenda events={filteredEvents} pmap={pmap} fmap={fmap} onEvent={setEventEdit}/>} {view === "availability" && <AvailabilityList data={data} fmap={fmap} canEdit={canAdmin} onEdit={setAvailabilityEdit} onSlot={(a: Availability, s: { startTime: string; endTime: string }) => canEdit && setEventEdit(newEvent(a.date, a.fieldId, s))}/>}</main>

    {eventEdit && <EventModal event={eventEdit} data={data} canEdit={canEdit} onClose={() => setEventEdit(null)} onDuplicate={duplicate} onDelete={deleteEvent} onSave={(events: CalendarEvent[], mode: string) => { let current = data.events; if (mode === "series" && events[0].seriesId) current = current.filter(e => e.seriesId !== events[0].seriesId); else current = current.filter(e => !events.some(n => n.id === e.id)); void save({ ...data, events: [...current, ...events] }); setEventEdit(null); }}/>} 
    {availabilityEdit && <AvailabilityModal item={availabilityEdit} fields={data.fields} onClose={() => setAvailabilityEdit(null)} onDelete={deleteAvailability} onSave={(a: Availability) => { void save({ ...data, availability: data.availability.some(x => x.id === a.id) ? data.availability.map(x => x.id === a.id ? a : x) : [...data.availability, a] }); setAvailabilityEdit(null); }}/>} 
    {manage && <ManageModal data={data} onClose={() => setManage(false)} onSave={(next: AppData) => { void save(next); setManage(false); }}/>} 
  </div>;
}

function EventCard({ e, p, onClick }: { e: CalendarEvent; p?: Program; onClick: () => void }) { const bg = p?.color || "#fdecec"; return <button className={`event ${e.type === "Blackout" || e.type === "Holiday" ? "blackout" : ""}`} style={{ background: bg, color: readableText(bg) }} onClick={x => { x.stopPropagation(); onClick(); }}><strong>{e.title}</strong><small>{p?.name ? `${p.name} · ` : ""}{fmt(e.startTime)}–{fmt(e.endTime)} · {duration(e.startTime, e.endTime)}</small></button>; }
function Month({ days, current, data, events, pmap, fmap, onDay, onEvent, onSlot }: any) { return <><div className="weekday">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(x => <div key={x}>{x}</div>)}</div><div className="month">{days.map((d: Date) => { const k = dateKey(d), ev = events.filter((e: CalendarEvent) => e.date === k), av = data.availability.filter((a: Availability) => a.date === k), hasContent = av.length || ev.length; return <section data-empty={!hasContent} className={`${d.getMonth() === current.getMonth() ? "" : "muted"} clickable-day`} key={k} onClick={() => onDay(k)}><button className="day" onClick={x => { x.stopPropagation(); onDay(k); }}>{d.getDate()}</button>{av.flatMap((a: Availability) => openSlots(a, data.events).map((s: { startTime: string; endTime: string }, i: number) => <button className="avail" key={`${a.id}-${i}`} onClick={x => { x.stopPropagation(); onSlot(a, s); }}>Available {fmt(s.startTime)}–{fmt(s.endTime)}<small>{fmap.get(a.fieldId)?.name}</small></button>))}{ev.map((e: CalendarEvent) => <EventCard key={e.id} e={e} p={e.programId ? pmap.get(e.programId) : undefined} onClick={() => onEvent(e)}/>)}{!hasContent && <span className="empty-day">Tap to add</span>}</section>; })}</div></>; }
function Week({ days, data, events, pmap, onEvent, onSlot }: any) { return <div className="week">{days.map((d: Date) => { const k = dateKey(d), av = data.availability.filter((a: Availability) => a.date === k), ev = events.filter((e: CalendarEvent) => e.date === k); if (!av.length && !ev.length) return null; return <section key={k}><h3>{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h3>{av.flatMap((a: Availability) => openSlots(a, data.events).map((s: { startTime: string; endTime: string }, i: number) => <button className="avail" key={`${a.id}-${i}`} onClick={() => onSlot(a, s)}>Available {fmt(s.startTime)}–{fmt(s.endTime)}</button>))}{ev.map((e: CalendarEvent) => <EventCard key={e.id} e={e} p={e.programId ? pmap.get(e.programId) : undefined} onClick={() => onEvent(e)}/>)}</section>; })}</div>; }
function Agenda({ events, pmap, fmap, onEvent }: any) { const visible = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)); return <div className="agenda">{visible.map((e: CalendarEvent) => { const p = e.programId ? pmap.get(e.programId) : undefined; return <button key={e.id} onClick={() => onEvent(e)}><span>{new Date(`${e.date}T12:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span><i style={{ background: p?.color || "#ddd" }}/><strong>{e.title}</strong><small>{fmt(e.startTime)}–{fmt(e.endTime)} · {duration(e.startTime, e.endTime)} · {fmap.get(e.fieldId)?.name}</small></button>; })}</div>; }
function AvailabilityList({ data, fmap, canEdit, onEdit, onSlot }: any) { const rows = [...data.availability].sort((a: Availability, b: Availability) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)); const total = rows.reduce((n: number, a: Availability) => n + minutes(a.endTime) - minutes(a.startTime), 0), open = rows.reduce((n: number, a: Availability) => n + openSlots(a, data.events).reduce((x: number, s: { startTime: string; endTime: string }) => x + minutes(s.endTime) - minutes(s.startTime), 0), 0); return <div className="availability-list"><div className="availability-summary"><div><strong>{Math.round(total / 60 * 10) / 10}</strong><span>permit hours</span></div><div><strong>{Math.round(open / 60 * 10) / 10}</strong><span>open hours</span></div><div><strong>{rows.filter((a: Availability) => openSlots(a, data.events).length === 0).length}</strong><span>fully booked</span></div></div>{rows.map((a: Availability) => { const slots = openSlots(a, data.events); return <article className="availability-row" key={a.id}><button className="row-main" onClick={() => canEdit && onEdit(a)}><span>{new Date(`${a.date}T12:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span><strong>{fmap.get(a.fieldId)?.name}</strong><small>Permit {fmt(a.startTime)}–{fmt(a.endTime)}</small></button><div>{slots.length ? slots.map((s: { startTime: string; endTime: string }, i: number) => <button key={i} onClick={() => onSlot(a, s)}>Open {fmt(s.startTime)}–{fmt(s.endTime)}</button>) : <em>Fully booked</em>}</div></article>; })}</div>; }

function EventModal({ event, data, canEdit, onClose, onDuplicate, onDelete, onSave }: any) {
  const existing = data.events.some((e: CalendarEvent) => e.id === event.id), [d, setD] = useState<CalendarEvent>(event), [repeat, setRepeat] = useState(1), [until, setUntil] = useState(""), [editScope, setEditScope] = useState<"one" | "series">("one");
  const special = d.type === "Holiday" || d.type === "Blackout";
  const slots = data.availability.filter((a: Availability) => a.date === d.date && a.fieldId === d.fieldId).flatMap((a: Availability) => openSlots(a, data.events, d.id));
  const selectedSlot = slots.find((s: { startTime: string; endTime: string }) => minutes(d.startTime) >= minutes(s.startTime) && minutes(d.endTime) <= minutes(s.endTime));
  const startOptions = slots.flatMap((s: { startTime: string; endTime: string }) => Array.from({ length: Math.max(0, Math.floor((minutes(s.endTime) - minutes(s.startTime)) / 30)) }, (_, i) => time(minutes(s.startTime) + i * 30)));
  const endOptions = selectedSlot ? Array.from({ length: Math.floor((minutes(selectedSlot.endTime) - minutes(d.startTime)) / 30) }, (_, i) => time(minutes(d.startTime) + (i + 1) * 30)) : [];
  const dates = until ? (() => { const out: string[] = []; for (let x = d.date; x <= until; x = addDays(x, 7)) out.push(x); return out; })() : Array.from({ length: repeat }, (_, i) => addDays(d.date, i * 7));
  const blocked = !canEdit || !d.title || (!special && !selectedSlot) || dates.some(day => !special && !data.availability.some((a: Availability) => a.date === day && a.fieldId === d.fieldId && minutes(d.startTime) >= minutes(a.startTime) && minutes(d.endTime) <= minutes(a.endTime))) || dates.some(day => data.events.some((e: CalendarEvent) => e.id !== d.id && e.date === day && e.fieldId === d.fieldId && overlap(e, d)));
  const set = (k: keyof CalendarEvent, v: string | undefined) => setD({ ...d, [k]: v });
  const submit = () => { const seriesId = existing ? d.seriesId : dates.length > 1 ? uid() : undefined; const created = dates.map((day, i) => ({ ...d, id: i === 0 ? d.id : uid(), date: day, seriesId })); onSave(created, existing && editScope === "series" ? "series" : "one"); };
  return <Modal title={existing ? "Edit event" : "Add event"} onClose={onClose}><div className="form"><label className="wide">Title<input value={d.title} disabled={!canEdit} onChange={e => set("title", e.target.value)}/></label><label>Type<select value={d.type} disabled={!canEdit} onChange={e => set("type", e.target.value as EventType)}>{["Practice", "Game", "Tournament", "Clinic", "Tryout", "Team Event", "Holiday", "Blackout"].map(x => <option key={x}>{x}</option>)}</select></label><label>Program<select value={d.programId || ""} disabled={!canEdit || special} onChange={e => set("programId", e.target.value || undefined)}><option value="">None</option>{data.programs.filter((p: Program) => p.active).map((p: Program) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Field<select value={d.fieldId} disabled={!canEdit} onChange={e => set("fieldId", e.target.value)}>{data.fields.filter((f: Field) => f.active).map((f: Field) => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Date<input type="date" value={d.date} disabled={!canEdit} onChange={e => set("date", e.target.value)}/></label>{special ? <><label>Start<input type="time" value={d.startTime} onChange={e => set("startTime", e.target.value)}/></label><label>End<input type="time" value={d.endTime} onChange={e => set("endTime", e.target.value)}/></label></> : <><label>Start<select value={d.startTime} disabled={!canEdit || !startOptions.length} onChange={e => setD({ ...d, startTime: e.target.value, endTime: time(minutes(e.target.value) + 30) })}><option value="">Select available time</option>{startOptions.map((x: string) => <option key={x}>{x}</option>)}</select></label><label>End<select value={d.endTime} disabled={!canEdit || !endOptions.length} onChange={e => set("endTime", e.target.value)}>{endOptions.map((x: string) => <option key={x}>{x}</option>)}</select></label></>}{!existing && !special && <><label>Repeat weekly<select value={repeat} onChange={e => { setRepeat(Number(e.target.value)); setUntil(""); }}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => <option value={n} key={n}>{n === 1 ? "Does not repeat" : `${n} weeks`}</option>)}</select></label><label>Or repeat until<input type="date" min={d.date} value={until} onChange={e => setUntil(e.target.value)}/></label></>}{existing && d.seriesId && <label>Edit scope<select value={editScope} onChange={e => setEditScope(e.target.value as "one" | "series")}><option value="one">This event only</option><option value="series">Entire series</option></select></label>}<label className="wide">Notes<textarea rows={3} value={d.notes || ""} disabled={!canEdit} onChange={e => set("notes", e.target.value)}/></label></div>{!special && !slots.length && <p className="alert">No available time remains for this field and date.</p>}<div className="modal-actions">{existing && canEdit && <button className="danger" onClick={() => onDelete(d.id)}><Trash2 size={16}/>Delete</button>}{existing && canEdit && <button onClick={() => onDuplicate(d)}><Copy size={16}/>Duplicate</button>}<span/><button onClick={onClose}>Close</button>{canEdit && <button className="primary" disabled={blocked} onClick={submit}>Save</button>}</div></Modal>;
}

function AvailabilityModal({ item, fields, onClose, onSave, onDelete }: any) { const [d, setD] = useState<Availability>(item); return <Modal title="Field availability" onClose={onClose}><div className="form"><label className="wide">Field<select value={d.fieldId} onChange={e => setD({ ...d, fieldId: e.target.value })}>{fields.filter((f: Field) => f.active).map((f: Field) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Date<input type="date" value={d.date} onChange={e => setD({ ...d, date: e.target.value })}/></label><label>Start<input type="time" value={d.startTime} onChange={e => setD({ ...d, startTime: e.target.value })}/></label><label>End<input type="time" value={d.endTime} onChange={e => setD({ ...d, endTime: e.target.value })}/></label></div><div className="modal-actions"><button className="danger" onClick={() => onDelete(d.id)}><Trash2 size={16}/>Delete</button><span/><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(d)}>Save</button></div></Modal>; }
function ManageModal({ data, onClose, onSave }: any) { const [d, setD] = useState<AppData>(data), palette = ["#cfe8ff", "#d9f2d9", "#eadcff", "#ffe0cc", "#fff2b3", "#d8f3ef"]; return <Modal title="Programs & fields" onClose={onClose}><h3>Programs</h3>{d.programs.map((p, i) => <div className="manage-row" key={p.id}><span className="color-preview" style={{ background: p.color, color: readableText(p.color) }}>{p.name.slice(0, 2).toUpperCase()}</span><input type="color" value={p.color} onChange={e => setD({ ...d, programs: d.programs.map((x, j) => j === i ? { ...x, color: e.target.value } : x) })}/><input value={p.name} onChange={e => setD({ ...d, programs: d.programs.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}/><label><input type="checkbox" checked={p.active} onChange={e => setD({ ...d, programs: d.programs.map((x, j) => j === i ? { ...x, active: e.target.checked } : x) })}/>Active</label></div>)}<button onClick={() => setD({ ...d, programs: [...d.programs, { id: uid(), name: "New Program", color: palette[d.programs.length % palette.length], active: true }] })}><Plus size={16}/>Add program</button><h3>Fields</h3>{d.fields.map((f, i) => <div className="manage-row fields" key={f.id}><input value={f.name} onChange={e => setD({ ...d, fields: d.fields.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}/><label><input type="checkbox" checked={f.active} onChange={e => setD({ ...d, fields: d.fields.map((x, j) => j === i ? { ...x, active: e.target.checked } : x) })}/>Active</label></div>)}<button onClick={() => setD({ ...d, fields: [...d.fields, { id: uid(), name: "New Field", active: true }] })}><Plus size={16}/>Add field</button><div className="modal-actions"><span/><span/><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(d)}>Save</button></div></Modal>; }
function Modal({ title, onClose, children }: any) { return <div className="backdrop"><div className="modal"><div className="modal-title"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</div></div>; }
