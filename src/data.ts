import type { AppData } from "./types";
export const defaultData: AppData = {
  programs:[
    {id:"creeks",name:"Creeks Girls",color:"#d9eaf7",active:true},
    {id:"nfyll",name:"NFYLL Girls",color:"#e2f0d9",active:true},
    {id:"tournament",name:"Tournament Team",color:"#e4dfec",active:true}
  ],
  fields:[
    {id:"durbin",name:"Durbin Crossings – Ball Wall",active:true},
    {id:"plantation",name:"Plantation Park",active:true}
  ],
  availability:[
    {id:"a1",fieldId:"durbin",date:"2026-09-02",startTime:"17:30",endTime:"21:00"},
    {id:"a2",fieldId:"durbin",date:"2026-09-03",startTime:"17:30",endTime:"21:00"},
    {id:"a3",fieldId:"durbin",date:"2026-09-06",startTime:"12:00",endTime:"18:30"},
    {id:"a4",fieldId:"durbin",date:"2026-09-19",startTime:"09:00",endTime:"15:00"},
    {id:"a5",fieldId:"durbin",date:"2026-09-26",startTime:"09:00",endTime:"15:00"},
    {id:"a6",fieldId:"durbin",date:"2026-10-03",startTime:"09:00",endTime:"15:00"},
    {id:"a7",fieldId:"durbin",date:"2026-10-24",startTime:"09:00",endTime:"15:00"},
    {id:"a8",fieldId:"durbin",date:"2026-10-31",startTime:"09:00",endTime:"15:00"},
    {id:"a9",fieldId:"durbin",date:"2026-11-07",startTime:"09:00",endTime:"15:00"},
    {id:"a10",fieldId:"durbin",date:"2026-11-14",startTime:"09:00",endTime:"15:00"},
    {id:"a11",fieldId:"plantation",date:"2026-09-04",startTime:"17:30",endTime:"21:00"}
  ],
  events:[
    {id:"e1",programId:"creeks",fieldId:"durbin",type:"Practice",title:"Creeks Girls Practice",date:"2026-09-02",startTime:"17:30",endTime:"19:00"},
    {id:"e2",programId:"creeks",fieldId:"durbin",type:"Practice",title:"Creeks Girls Practice",date:"2026-09-03",startTime:"17:30",endTime:"19:00"},
    {id:"e3",programId:"creeks",fieldId:"durbin",type:"Clinic",title:"Free Clinic",date:"2026-09-06",startTime:"12:00",endTime:"13:00"},
    {id:"e4",programId:"nfyll",fieldId:"durbin",type:"Game",title:"NFYLL Fall Ball",date:"2026-09-19",startTime:"09:00",endTime:"15:00"},
    {id:"e5",programId:"nfyll",fieldId:"durbin",type:"Game",title:"NFYLL Fall Ball",date:"2026-09-26",startTime:"09:00",endTime:"15:00"},
    {id:"e6",programId:"nfyll",fieldId:"durbin",type:"Game",title:"NFYLL Fall Ball",date:"2026-10-03",startTime:"09:00",endTime:"15:00"},
    {id:"e7",fieldId:"durbin",type:"Blackout",title:"Soccer Tournament – No Field Access",date:"2026-10-10",startTime:"09:00",endTime:"15:00"},
    {id:"e8",programId:"creeks",fieldId:"durbin",type:"Clinic",title:"Skills Academy #1",date:"2026-10-24",startTime:"09:00",endTime:"10:00"},
    {id:"e9",programId:"tournament",fieldId:"durbin",type:"Practice",title:"Tournament Team Practice",date:"2026-10-24",startTime:"10:30",endTime:"12:00"}
  ]
};
