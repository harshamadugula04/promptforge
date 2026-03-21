import { useState } from "react";
import { TECHNIQUES, formatTime, saveToStorage, STORAGE_KEYS } from "../data/techniques";
import { useTheme, getTheme } from "../data/theme";

// ── HISTORY TAB ───────────────────────────────────────────────────────────────
export function HistoryTab({ history, setHistory, onLoad }) {
  const { dark } = useTheme();
  const t = getTheme(dark);
  const [expandedId, setExpandedId] = useState(null);

  const deleteItem = id => {
    const updated = history.filter(i => i.id !== id);
    setHistory(updated);
    saveToStorage(STORAGE_KEYS.history, updated);
  };

  return (
    <div style={{ padding: "clamp(16px,3vw,28px)", width: "100%" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(18px,3vw,24px)", fontWeight:800, color:t.text, marginBottom:"4px" }}>Experiment History</h2>
          <p style={{ color:t.textMuted, fontSize:"13px" }}>{history.length} sessions saved</p>
        </div>
        {history.length > 0 && (
          <button onClick={()=>{ setHistory([]); saveToStorage(STORAGE_KEYS.history,[]); }}
            style={{ background:"transparent", border:"1px solid #ef444433", color:"#ef4444", borderRadius:"8px", padding:"6px 14px", fontSize:"12px", cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" }}>
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState t={t} icon="◷" msg="No history yet" sub="Run experiments in the Playground to see them here." />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {history.map(item => {
            const isOpen = expandedId === item.id;
            return (
              <div key={item.id} style={{ background:t.surface, border:`1px solid ${isOpen ? t.accent+"44" : t.border}`, borderRadius:"12px", overflow:"hidden", transition:"border-color 0.15s" }}>
                {/* Row */}
                <div onClick={()=>setExpandedId(isOpen ? null : item.id)} style={{ padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ color:t.textDim, fontSize:"11px", fontFamily:"monospace", flexShrink:0 }}>{formatTime(item.timestamp)}</span>
                  <span style={{ flex:1, color:t.text, fontSize:"13px", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.prompt}</span>
                  <div style={{ display:"flex", gap:"3px", flexShrink:0 }}>
                    {item.techniques?.slice(0,4).map(tech => (
                      <span key={tech} title={TECHNIQUES[tech]?.label} style={{ width:"8px", height:"8px", borderRadius:"50%", background:TECHNIQUES[tech]?.color||t.border, display:"block" }} />
                    ))}
                    {item.techniques?.length > 4 && <span style={{ fontSize:"9px", color:t.textDim, fontFamily:"monospace" }}>+{item.techniques.length-4}</span>}
                  </div>
                  <span style={{ color:t.textDim, fontSize:"10px", transform:isOpen?"rotate(180deg)":"none", transition:"transform 0.2s", display:"inline-block" }}>▼</span>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop:`1px solid ${t.border}`, padding:"14px 16px" }}>
                    {/* Technique tags */}
                    <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"12px" }}>
                      {item.techniques?.map(tech => (
                        <span key={tech} style={{ fontSize:"11px", color:TECHNIQUES[tech]?.color, background:`${TECHNIQUES[tech]?.color}15`, border:`1px solid ${TECHNIQUES[tech]?.color}33`, borderRadius:"5px", padding:"2px 7px", fontFamily:"monospace" }}>
                          {TECHNIQUES[tech]?.icon} {TECHNIQUES[tech]?.label}
                        </span>
                      ))}
                    </div>
                    {/* Full prompt */}
                    <div style={{ background:t.surface2, borderRadius:"8px", padding:"10px 12px", fontSize:"12px", color:t.textMuted, lineHeight:"1.6", marginBottom:"12px", whiteSpace:"pre-wrap" }}>
                      {item.prompt}
                    </div>
                    {/* Response previews */}
                    {item.responses && Object.keys(item.responses).length > 0 && (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"8px", marginBottom:"12px" }}>
                        {Object.entries(item.responses).slice(0,4).map(([tech, resp]) => (
                          <div key={tech} style={{ background:t.surface2, borderRadius:"8px", padding:"10px 12px", border:`1px solid ${t.border}` }}>
                            <div style={{ fontSize:"10px", color:TECHNIQUES[tech]?.color||t.accent, fontFamily:"monospace", fontWeight:600, marginBottom:"5px" }}>
                              {TECHNIQUES[tech]?.icon} {TECHNIQUES[tech]?.label}
                            </div>
                            <div style={{ fontSize:"11px", color:t.textMuted, lineHeight:"1.55", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical" }}>
                              {resp}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Actions */}
                    <div style={{ display:"flex", gap:"8px" }}>
                      <button onClick={()=>{ onLoad(item); }} style={{ padding:"7px 16px", background:t.accent, border:"none", color:"#fff", borderRadius:"8px", fontSize:"12px", cursor:"pointer", fontWeight:600, fontFamily:"'Syne',sans-serif" }}>
                        ↺ Load in Playground
                      </button>
                      <button onClick={()=>deleteItem(item.id)} style={{ padding:"7px 12px", background:"transparent", border:"1px solid #ef444433", color:"#ef4444", borderRadius:"8px", fontSize:"12px", cursor:"pointer" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LIBRARY TAB ───────────────────────────────────────────────────────────────
export function LibraryTab({ library, setLibrary, onLoad }) {
  const { dark } = useTheme();
  const t = getTheme(dark);
  const [search, setSearch] = useState("");

  const deleteItem = id => {
    const updated = library.filter(i => i.id !== id);
    setLibrary(updated);
    saveToStorage(STORAGE_KEYS.library, updated);
  };

  const categories = [...new Set(library.map(i => i.category))];
  const filtered = library.filter(i =>
    !search.trim() ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.prompt.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCats = [...new Set(filtered.map(i => i.category))];

  return (
    <div style={{ padding:"clamp(16px,3vw,28px)", width:"100%" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(18px,3vw,24px)", fontWeight:800, color:t.text, marginBottom:"4px" }}>Prompt Library</h2>
          <p style={{ color:t.textMuted, fontSize:"13px" }}>{library.length} saved prompts · {categories.length} {categories.length===1?"category":"categories"}</p>
        </div>
        {/* Search */}
        {library.length > 3 && (
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search prompts…"
            style={{ padding:"7px 12px", background:t.surface2, border:`1px solid ${t.border}`, borderRadius:"9px", color:t.text, fontSize:"13px", width:"220px", maxWidth:"100%" }} />
        )}
      </div>

      {library.length === 0 ? (
        <EmptyState t={t} icon="◻" msg="Library is empty" sub='Save prompts using the "Save" button in the Playground.' />
      ) : filtered.length === 0 ? (
        <EmptyState t={t} icon="◎" msg="No results" sub="Try a different search term." />
      ) : (
        filteredCats.map(cat => (
          <div key={cat} style={{ marginBottom:"28px" }}>
            {/* Category header */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
              <div style={{ height:"1px", background:t.border, flex:"0 0 16px" }} />
              <span style={{ fontSize:"10px", color:t.textDim, fontFamily:"monospace", letterSpacing:"0.12em", flexShrink:0 }}>{cat.toUpperCase()}</span>
              <div style={{ height:"1px", background:t.border, flex:1 }} />
            </div>
            {/* Cards grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,280px),1fr))", gap:"12px" }}>
              {filtered.filter(i=>i.category===cat).map(item => (
                <div key={item.id} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"16px", display:"flex", flexDirection:"column", gap:"10px", transition:"border-color 0.15s, transform 0.15s", cursor:"default" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=t.accent+"66"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=t.border; e.currentTarget.style.transform="none"; }}>
                  {/* Title + date */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"8px" }}>
                    <div style={{ fontWeight:700, fontSize:"14px", color:t.text, fontFamily:"'Syne',sans-serif", lineHeight:1.3 }}>{item.name}</div>
                    <span style={{ fontSize:"10px", color:t.textDim, fontFamily:"monospace", flexShrink:0 }}>{formatTime(item.timestamp)}</span>
                  </div>
                  {/* Prompt preview */}
                  <div style={{ fontSize:"12px", color:t.textMuted, lineHeight:"1.55", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical" }}>
                    {item.prompt}
                  </div>
                  {/* Technique tags */}
                  <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                    {item.techniques?.map(tech => (
                      <span key={tech} style={{ fontSize:"10px", color:TECHNIQUES[tech]?.color, background:`${TECHNIQUES[tech]?.color}15`, border:`1px solid ${TECHNIQUES[tech]?.color}25`, borderRadius:"4px", padding:"1px 6px", fontFamily:"monospace" }}>
                        {TECHNIQUES[tech]?.icon} {TECHNIQUES[tech]?.label}
                      </span>
                    ))}
                  </div>
                  {/* Session badge */}
                  {item.responses && (
                    <div style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"10px", color:t.accent, fontFamily:"monospace" }}>
                      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.accent, display:"inline-block" }} />
                      Full session saved · {Object.keys(item.responses).length} responses
                      {item.scores && Object.keys(item.scores).length > 0 && (
                        <span style={{ marginLeft:"4px", color:"#00e5a0" }}>
                          · best: {Math.max(...Object.values(item.scores).map(s=>s.overall||0))}/100
                        </span>
                      )}
                    </div>
                  )}
                  {/* Actions */}
                  <div style={{ display:"flex", gap:"6px", marginTop:"2px" }}>
                    <button onClick={()=>onLoad(item)} style={{ flex:1, padding:"7px", background:item.responses?t.accent:t.accentBg, border:`1px solid ${t.accentBorder}`, color:item.responses?"#fff":t.accent, borderRadius:"8px", fontSize:"12px", cursor:"pointer", fontWeight:600, fontFamily:"'Syne',sans-serif" }}>
                      {item.responses ? "↺ Restore Session" : "↺ Load Prompt"}
                    </button>
                    <button onClick={()=>deleteItem(item.id)} style={{ padding:"7px 10px", background:"transparent", border:"1px solid #ef444422", color:"#ef4444", borderRadius:"8px", fontSize:"12px", cursor:"pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ t, icon, msg, sub }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 20px", gap:"10px", textAlign:"center" }}>
      <div style={{ fontSize:"36px", opacity:0.2, fontFamily:"monospace" }}>{icon}</div>
      <div style={{ fontSize:"16px", fontWeight:700, color:t.text, fontFamily:"'Syne',sans-serif" }}>{msg}</div>
      <div style={{ fontSize:"13px", color:t.textMuted, maxWidth:"300px", lineHeight:"1.6" }}>{sub}</div>
    </div>
  );
}
