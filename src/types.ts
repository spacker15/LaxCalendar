export type EventType = "Practice" | "Game" | "Tournament" | "Clinic" | "Tryout" | "Team Event" | "Holiday" | "Blackout";
export interface Program { id:string; name:string; color:string; active:boolean; }
export interface Field { id:string; name:string; active:boolean; }
export interface Availability { id:string; fieldId:string; date:string; startTime:string; endTime:string; notes?:string; }
export interface CalendarEvent { id:string; programId?:string; fieldId:string; type:EventType; title:string; date:string; endDate?:string; startTime:string; endTime:string; location?:string; notes?:string; }
export interface AppData { programs:Program[]; fields:Field[]; availability:Availability[]; events:CalendarEvent[]; }
