import React from "react";

export default function VersionSplash({version, onClose}:{version:string; onClose:()=>void}){
  return (
    <div role="dialog" aria-modal="true"
         onClick={onClose}
         style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"grid", placeItems:"center", zIndex:100}}>
      <div onClick={(e)=>e.stopPropagation()}
           style={{background:"#111827", color:"#e5e7eb", borderRadius:16, padding:24, width:"min(560px, 92vw)", boxShadow:"0 10px 30px rgba(0,0,0,0.35)"}}>
        <h2 style={{margin:0, fontSize:22}}>Welcome to TagnetIQ</h2>
        <p style={{margin:"6px 0 0 0", opacity:0.85}}>{version}</p>
        <ul style={{marginTop:16, lineHeight:1.7}}>
          <li>• Settings menu restored (header)</li>
          <li>• Feedback modal with auto-version tagging</li>
          <li>• Admin-only Beta Controls + Investor Suite</li>
          <li>• Watermark overlay toggle</li>
        </ul>
        <button onClick={onClose}
                style={{marginTop:14, padding:"8px 12px", borderRadius:8, border:"1px solid #374151", background:"#1f2937", color:"#e5e7eb", cursor:"pointer"}}>
          Continue
        </button>
      </div>
    </div>
  );
}
