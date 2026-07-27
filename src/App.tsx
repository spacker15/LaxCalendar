import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Settings, TriangleAlert, Trash2, X } from "lucide-react";
import { defaultData } from "./data";
import type { AppData, Availability, CalendarEvent, Field, Program } from "./types";

const STORAGE_KEY = "lax-calendar-v2";
const loadData = (): AppData => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "") as AppData; }
  catch { return defaultData; }
};
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const minutes = (t: string) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const formatTime = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
const overlaps = (a: CalendarEvent, b: CalendarEvent) => minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);
const uid = () => crypto.randomUUID();

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [view, setView] = useState<"month"|"week"|"agenda">("month");
  const [programFilter, setProgramFilter] = useState(data.programs.filter(p=>p.active).map(p=>p.id));
  const [fieldFilter, setFieldFilter] = useState(data.fields.filter(f=>f.active).map(f=>f.id));
  const [showAvailability, setShowAvailability] = useState(true);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent|null>(null);
  const [editingAvailability, setEditingAvailability] = useState<Availability|null>(null);
  const [showManage, setShowManage] = useState(false);

  const save = (next: AppData) => { setData(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const programMap = useMemo(() => new Map(data.programs.map(p=>[p.id,p])), [data.programs]);
  const fieldMap = useMemo(() => new Map(data.fields.map(f=>[f.id,f])), [data.fields]);
  const visibleEvents = data.events.filter(e => fieldFilter.includes(e.fieldId) && (e.type === "Blackout" || !e.programId || programFilter.includes(e.programId)));
  const conflictCount = visibleEvents.filter((e,i) => visibleEvents.some((o,j)=>i!==j && e.date===o.date && e.fieldId===o.fieldId && overlaps(e,o))).length;

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first); start.setDate(1-first.getDay());
    return Array.from({length:42}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
  }, [month]);

  const saveEvent = (event: CalendarEvent) => {
    save({...data, events:data.events.some(e=>e.id===event.id) ? data.events.map(e=>e.id===event.id?event:e) : [...data.events,event]});
    setEditingEvent(null);
  };
  const saveAvailability = (item: Availability) => {
    save({...data, availability:data.availability.some(a=>a.id===item.id) ? data.availability.map(a=>a.id===item.id?item:a) : [...data.availability,item]});
    setEditingAvailability(null);
  };
  const exportICS = () => {
    const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//LaxCalendar//EN", ...visibleEvents.flatMap(e=>[
      "BEGIN:VEVENT",`UID:${e.id}@laxcalendar`,`DTSTART:${e.date.replaceAll("-","")}T${e.startTime.replace(":","")}00`,`DTEND:${e.date.replaceAll("-","")}T${e.endTime.replace(":","")}00`,`SUMMARY:${e.title}`,`LOCATION:${fieldMap.get(e.fieldId)?.name || ""}`,"END:VEVENT"
    ]), "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], {type:"text/calendar"}));
    const a = document.createElement("a"); a.href=url; a.download="lacrosse-calendar.ics"; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="app">
    <header><div><p className="eyebrow">LACROSSE FIELD SCHEDULER</p><h1>Fall 2026</h1></div><div className="actions">
      <button onClick={()=>setShowManage(true)}><Settings size={17}/>Programs & Fields</button>
      <button onClick={exportICS}><Download size={17}/>Export ICS</button>
      <button onClick={()=>setEditingAvailability({id:uid(),fieldId:data.fields[0]?.id||"",date:dateKey(month),startTime:"09:00",endTime:"15:00"})}><Plus size={17}/>Availability</button>
      <button className="primary" onClick={()=>setEditingEvent({id:uid(),programId:data.programs[0]?.id,fieldId:data.fields[0]?.id||"",type:"Practice",title:"",date:dateKey(month),startTime:"17:30",endTime:"19:00"})}><Plus size={17}/>Event</button>
    </div></header>

    <section className="controls"><div className="nav"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><strong>{month.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</strong><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div><div className="views">{(["month","week","agenda"] as const).map(v=><button className={view===v?"active":""} onClick={()=>setView(v)} key={v}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div></section>

    <section className="filters"><div><strong>Programs</strong>{data.programs.filter(p=>p.active).map(p=><label key={p.id}><input type="checkbox" checked={programFilter.includes(p.id)} onChange={()=>setProgramFilter(programFilter.includes(p.id)?programFilter.filter(x=>x!==p.id):[...programFilter,p.id])}/><i style={{background:p.color}}/>{p.name}</label>)}</div><div><strong>Fields</strong>{data.fields.filter(f=>f.active).map(f=><label key={f.id}><input type="checkbox" checked={fieldFilter.includes(f.id)} onChange={()=>setFieldFilter(fieldFilter.includes(f.id)?fieldFilter.filter(x=>x!==f.id):[...fieldFilter,f.id])}/>{f.name}</label>)}</div><label><input type="checkbox" checked={showAvailability} onChange={e=>setShowAvailability(e.target.checked)}/>Show available time</label>{conflictCount>0&&<span className="warning"><TriangleAlert size={16}/>{conflictCount} conflicts</span>}</section>

    <main>
      {view==="month" && <MonthView days={days} month={month} data={data} events={visibleEvents} showAvailability={showAvailability} programMap={programMap} fieldMap={fieldMap} onEvent={setEditingEvent} onAvailability={setEditingAvailability} onDay={date=>setEditingEvent({id:uid(),programId:data.programs[0]?.id,fieldId:data.fields[0]?.id||"",type:"Practice",title:"",date,startTime:"17:30",endTime:"19:00"})}/>}
      {view==="week" && <WeekView month={month} data={data} events={visibleEvents} showAvailability={showAvailability} programMap={programMap} onEvent={setEditingEvent} onAvailability={setEditingAvailability}/>} 
      {view==="agenda" && <AgendaView events={visibleEvents} programMap={programMap} fieldMap={fieldMap} onEvent={setEditingEvent}/>} 
    </main>

    {editingEvent && <EventModal event={editingEvent} data={data} onClose={()=>setEditingEvent(null)} onSave={saveEvent} onDelete={id=>{save({...data,events:data.events.filter(e=>e.id!==id)});setEditingEvent(null)}}/>}
    {editingAvailability && <AvailabilityModal item={editingAvailability} fields={data.fields} onClose={()=>setEditingAvailability(null)} onSave={saveAvailability} onDelete={id=>{save({...data,availability:data.availability.filter(a=>a.id!==id)});setEditingAvailability(null)}}/>}
    {showManage && <ManageModal data={data} onClose={()=>setShowManage(false)} onSave={next=>{save(next);setProgramFilter(next.programs.filter(p=>p.active).map(p=>p.id));setFieldFilter(next.fields.filter(f=>f.active).map(f=>f.id));setShowManage(false)}}/>}
  </div>;
}

function MonthView({days,month,data,events,showAvailability,programMap,fieldMap,onEvent,onAvailability,onDay}:any){return <><div className="weekday">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=><div key={x}>{x}</div>)}</div><div className="month">{days.map((d:Date)=>{const k=dateKey(d);return <section className={d.getMonth()===month.getMonth()?"":"muted"} key={k}><button className="day" onClick={()=>onDay(k)}>{d.getDate()}</button>{showAvailability&&data.availability.filter((a:Availability)=>a.date===k).map((a:Availability)=><button className="avail" key={a.id} onClick={()=>onAvailability(a)}>Available {formatTime(a.startTime)}–{formatTime(a.endTime)}<small>{fieldMap.get(a.fieldId)?.name}</small></button>)}{events.filter((e:CalendarEvent)=>e.date===k).map((e:CalendarEvent)=>{const p=e.programId?programMap.get(e.programId):undefined;return <button className={`event ${e.type==="Blackout"?"blackout":""}`} style={p?{background:p.color}:undefined} key={e.id} onClick={()=>onEvent(e)}><strong>{e.title}</strong><small>{formatTime(e.startTime)}–{formatTime(e.endTime)}</small></button>})}</section>})}</div></>}

function WeekView({month,data,events,showAvailability,programMap,onEvent,onAvailability}:any){const start=new Date(month);start.setDate(month.getDate()-month.getDay());const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});return <div className="week">{days.map((d:Date)=>{const k=dateKey(d);return <section key={k}><h3>{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</h3>{data.fields.filter((f:Field)=>f.active).map((f:Field)=><div className="field" key={f.id}><strong>{f.name}</strong>{showAvailability&&data.availability.filter((a:Availability)=>a.date===k&&a.fieldId===f.id).map((a:Availability)=><button className="avail" onClick={()=>onAvailability(a)} key={a.id}>Available {formatTime(a.startTime)}–{formatTime(a.endTime)}</button>)}{events.filter((e:CalendarEvent)=>e.date===k&&e.fieldId===f.id).map((e:CalendarEvent)=>{const p=e.programId?programMap.get(e.programId):undefined;return <button className={`event ${e.type==="Blackout"?"blackout":""}`} style={p?{background:p.color}:undefined} onClick={()=>onEvent(e)} key={e.id}>{formatTime(e.startTime)}–{formatTime(e.endTime)} · {e.title}</button>})}</div>)}</section>})}</div>}

function AgendaView({events,programMap,fieldMap,onEvent}:any){return <div className="agenda">{[...events].sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)).map((e:CalendarEvent)=>{const p=e.programId?programMap.get(e.programId):undefined;return <button key={e.id} onClick={()=>onEvent(e)}><span>{new Date(`${e.date}T12:00`).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span><i style={{background:p?.color||"#fdecec"}}/><strong>{e.title}</strong><small>{formatTime(e.startTime)}–{formatTime(e.endTime)} · {fieldMap.get(e.fieldId)?.name}</small></button>})}</div>}

function EventModal({event,data,onClose,onSave,onDelete}:any){const [draft,setDraft]=useState(event);const set=(k:string,v:any)=>setDraft({...draft,[k]:v});const conflict=data.events.some((e:CalendarEvent)=>e.id!==draft.id&&e.date===draft.date&&e.fieldId===draft.fieldId&&overlaps(e,draft));const outside=!data.availability.some((a:Availability)=>a.date===draft.date&&a.fieldId===draft.fieldId&&minutes(draft.startTime)>=minutes(a.startTime)&&minutes(draft.endTime)<=minutes(a.endTime));return <Modal title="Lacrosse event" onClose={onClose}><div className="form"><label className="wide">Title<input value={draft.title} onChange={e=>set("title",e.target.value)}/></label><label>Type<select value={draft.type} onChange={e=>set("type",e.target.value)}>{["Practice","Game","Tournament","Clinic","Tryout","Team Event","Blackout"].map(x=><option key={x}>{x}</option>)}</select></label><label>Program<select disabled={draft.type==="Blackout"} value={draft.programId||""} onChange={e=>set("programId",e.target.value||undefined)}><option value="">None</option>{data.programs.filter((p:Program)=>p.active).map((p:Program)=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Field<select value={draft.fieldId} onChange={e=>set("fieldId",e.target.value)}>{data.fields.filter((f:Field)=>f.active).map((f:Field)=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Date<input type="date" value={draft.date} onChange={e=>set("date",e.target.value)}/></label><label>Start<input type="time" value={draft.startTime} onChange={e=>set("startTime",e.target.value)}/></label><label>End<input type="time" value={draft.endTime} onChange={e=>set("endTime",e.target.value)}/></label><label className="wide">Notes<textarea rows={3} value={draft.notes||""} onChange={e=>set("notes",e.target.value)}/></label></div>{conflict&&<p className="alert"><TriangleAlert size={16}/>Overlaps another event on this field.</p>}{outside&&draft.type!=="Blackout"&&<p className="alert"><TriangleAlert size={16}/>Outside recorded field availability.</p>}<div className="modal-actions"><button className="danger" onClick={()=>onDelete(draft.id)}><Trash2 size={16}/>Delete</button><span/><button onClick={onClose}>Cancel</button><button className="primary" disabled={!draft.title} onClick={()=>onSave(draft)}>Save</button></div></Modal>}

function AvailabilityModal({item,fields,onClose,onSave,onDelete}:any){const [draft,setDraft]=useState(item);const set=(k:string,v:any)=>setDraft({...draft,[k]:v});return <Modal title="Field availability" onClose={onClose}><div className="form"><label className="wide">Field<select value={draft.fieldId} onChange={e=>set("fieldId",e.target.value)}>{fields.filter((f:Field)=>f.active).map((f:Field)=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Date<input type="date" value={draft.date} onChange={e=>set("date",e.target.value)}/></label><label>Start<input type="time" value={draft.startTime} onChange={e=>set("startTime",e.target.value)}/></label><label>End<input type="time" value={draft.endTime} onChange={e=>set("endTime",e.target.value)}/></label></div><div className="modal-actions"><button className="danger" onClick={()=>onDelete(draft.id)}><Trash2 size={16}/>Delete</button><span/><button onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(draft)}>Save</button></div></Modal>}

function ManageModal({data,onClose,onSave}:any){const [draft,setDraft]=useState(data);return <Modal title="Programs & fields" onClose={onClose}><h3>Programs</h3>{draft.programs.map((p:Program,i:number)=><div className="manage-row" key={p.id}><input type="color" value={p.color} onChange={e=>setDraft({...draft,programs:draft.programs.map((x:Program,j:number)=>j===i?{...x,color:e.target.value}:x)})}/><input value={p.name} onChange={e=>setDraft({...draft,programs:draft.programs.map((x:Program,j:number)=>j===i?{...x,name:e.target.value}:x)})}/><label><input type="checkbox" checked={p.active} onChange={e=>setDraft({...draft,programs:draft.programs.map((x:Program,j:number)=>j===i?{...x,active:e.target.checked}:x)})}/>Active</label></div>)}<button onClick={()=>setDraft({...draft,programs:[...draft.programs,{id:uid(),name:"New Program",color:"#f3e8c8",active:true}]})}><Plus size={16}/>Add program</button><h3>Fields</h3>{draft.fields.map((f:Field,i:number)=><div className="manage-row fields" key={f.id}><input value={f.name} onChange={e=>setDraft({...draft,fields:draft.fields.map((x:Field,j:number)=>j===i?{...x,name:e.target.value}:x)})}/><label><input type="checkbox" checked={f.active} onChange={e=>setDraft({...draft,fields:draft.fields.map((x:Field,j:number)=>j===i?{...x,active:e.target.checked}:x)})}/>Active</label></div>)}<button onClick={()=>setDraft({...draft,fields:[...draft.fields,{id:uid(),name:"New Field",active:true}]})}><Plus size={16}/>Add field</button><div className="modal-actions"><span/><span/><button onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(draft)}>Save</button></div></Modal>}

function Modal({title,onClose,children}:any){return <div className="backdrop"><div className="modal"><div className="modal-title"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</div></div>}
