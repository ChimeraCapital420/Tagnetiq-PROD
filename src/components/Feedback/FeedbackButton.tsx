import React, { useState } from "react";

export default function FeedbackButton({version}:{version:string}){
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category:"General", message:"" });
  const [sent, setSent] = useState(false);
  const categories = ["General","Bug","Feature","UI/UX","Performance"];

  async function submit(){
    try{
      await fetch("/api/feedback", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, version, ts: Date.now() })
      });
      setSent(true);
      setTimeout(()=>{ setOpen(false); setSent(false); setForm({category:"General", message:""}); }, 900);
    }catch(e){ console.error(e); }
  }

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{padding:"6px 10px", borderRadius:8, border:"1px solid #ddd", background:"#fff", cursor:"pointer"}}>
        Feedback
      </button>
      {open && (
        <div role="dialog" aria-modal="true" onClick={()=>setOpen(false)}
             style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"grid", placeItems:"center", zIndex:110}}>
          <div onClick={(e)=>e.stopPropagation()} style={{width:"min(520px,92vw)", background:"#fff", borderRadius:12, padding:16}}>
            <h3 style={{marginTop:0}}>Send Feedback</h3>
            <div style={{display:"flex", gap:10, alignItems:"center"}}>
              <label>Category:</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))}>
                {categories.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{marginLeft:"auto", fontSize:12, opacity:0.7}}>Version {version}</span>
            </div>
            <textarea value={form.message} onChange={e=>setForm(f=>({...f, message:e.target.value}))}
                      placeholder="Tell us what's up…" rows={6} style={{width:"100%", marginTop:10}} />
            <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
              <button onClick={()=>setOpen(false)} style={{padding:"6px 10px"}}>Cancel</button>
              <button onClick={submit} style={{padding:"6px 12px", background:"#111827", color:"#fff", borderRadius:8}}>Submit</button>
            </div>
            {sent && <div style={{marginTop:8, color:"green"}}>Thanks! Sent.</div>}
          </div>
        </div>
      )}
    </>
  );
}
