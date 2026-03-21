import { useState, useEffect, useRef } from "react";
import { MasonryCard, EqualHeightCard, AccordionCard } from "./components/ResponseCard";
import Sidebar from "./components/Sidebar";
import { HistoryTab, LibraryTab } from "./components/Tabs";
import OptimizerPanel from "./components/Optimizer";
import { ThemeProvider, useTheme, getTheme, MODALITY_META } from "./data/theme";
import { TECHNIQUES, DEFAULT_EXAMPLES, STORAGE_KEYS, uid, loadFromStorage, saveToStorage, callAPI, detectIntent, scoreResponse } from "./data/techniques";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── PROMPT TEMPLATES ──────────────────────────────────────────────────────────
const TEMPLATES = [
  { label: "Explain a concept", icon: "◎", prompt: "Explain [concept] in simple terms, with a real-world analogy and a practical example." },
  { label: "Code review", icon: "⌥", prompt: "Review this code for bugs, performance issues, and best practices:\n\n[paste your code here]" },
  { label: "Compare approaches", icon: "⇄", prompt: "Compare [option A] vs [option B]. Cover: key differences, when to use each, trade-offs, and a recommendation." },
  { label: "Debug help", icon: "◈", prompt: "I'm getting this error: [error message]\n\nHere's my code: [code]\n\nWhat's causing it and how do I fix it?" },
  { label: "Study guide", icon: "◻", prompt: "Create a study guide for [topic]. Include: core concepts, key terms, common misconceptions, and 5 practice questions." },
  { label: "Career advice", icon: "◆", prompt: "I'm a [role] with [X years] experience. I want to transition to [target role]. Give me a specific, actionable roadmap." },
];

const LAYOUTS = [
  { id: "masonry",   icon: "⊞" },
  { id: "equal",     icon: "⊟" },
  { id: "accordion", icon: "☰" },
];

function AnalyticsPanel({ scores, tokenData, selectedTechniques, t }) {
  const hasScores = Object.keys(scores).length > 0;
  const hasTokens = Object.keys(tokenData).length > 0;

  if (!hasScores && !hasTokens) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 20px", gap:"12px" }}>
      <div style={{ fontSize:"36px", opacity:0.3 }}>◎</div>
      <div style={{ fontSize:"15px", fontWeight:600, color:t.text, fontFamily:"'Syne',sans-serif" }}>No data yet</div>
      <div style={{ fontSize:"13px", color:t.textMuted, textAlign:"center", maxWidth:"300px", lineHeight:"1.6" }}>Run a prompt with multiple techniques to see scores and cost analytics here.</div>
    </div>
  );

  const chartData = selectedTechniques
    .filter(id => scores[id] || tokenData[id])
    .map(id => {
      const s = scores[id] || {}, tok = tokenData[id] || {};
      const overall = s.overall || 0, tokens = tok.total || 0, cost = tok.cost_usd || 0;
      const efficiency = tokens > 0 && overall > 0 ? Math.round((overall/tokens)*1000) : 0;
      return { id, label: TECHNIQUES[id]?.label || id, icon: TECHNIQUES[id]?.icon || "", color: TECHNIQUES[id]?.color || t.accent, overall, relevance: s.relevance||0, depth: s.depth||0, clarity: s.clarity||0, accuracy: s.accuracy||0, technique_fidelity: s.technique_fidelity||0, tokens, cost, efficiency };
    }).sort((a,b) => b.overall - a.overall);

  const best = chartData[0];
  const sc = v => v >= 78 ? "#00e5a0" : v >= 58 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding:"clamp(16px,3vw,28px)", display:"flex", flexDirection:"column", gap:"20px", width:"100%" }}>
      {best && best.overall > 0 && (
        <div style={{ background:"#00e5a010", border:"1px solid #00e5a030", borderRadius:"16px", padding:"18px 22px", display:"flex", alignItems:"center", gap:"16px" }}>
          <div style={{ fontSize:"28px" }}>{TECHNIQUES[best.id]?.icon}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"11px", color:"#00e5a0", fontFamily:"monospace", fontWeight:700, letterSpacing:"0.05em", marginBottom:"4px" }}>★ BEST TECHNIQUE</div>
            <div style={{ fontSize:"16px", fontWeight:700, color:t.text, fontFamily:"'Syne',sans-serif" }}>{best.label} <span style={{ fontWeight:400, color:t.textMuted, fontSize:"13px" }}>— {best.overall}/100</span></div>
            {scores[best.id]?.verdict && <div style={{ fontSize:"12px", color:t.textMuted, marginTop:"4px", fontStyle:"italic" }}>"{scores[best.id].verdict}"</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"32px", fontWeight:800, color:"#00e5a0", fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{best.overall}</div>
            <div style={{ fontSize:"11px", color:t.textMuted, fontFamily:"monospace" }}>/ 100</div>
          </div>
        </div>
      )}

      {hasScores && (
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"20px" }}>
          <div style={{ fontSize:"11px", color:t.textMuted, fontFamily:"monospace", letterSpacing:"0.06em", marginBottom:"16px" }}>QUALITY SCORES</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:36 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:t.textMuted, fontFamily:"monospace" }} angle={-25} textAnchor="end" interval={0} />
              <YAxis domain={[0,100]} tick={{ fontSize:10, fill:t.textMuted }} />
              <Tooltip contentStyle={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"8px", fontSize:"12px" }} />
              <Bar dataKey="overall" radius={[6,6,0,0]}>
                {chartData.map(d => <Cell key={d.id} fill={sc(d.overall)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasScores && (
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"14px", overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${t.border}`, fontSize:"11px", color:t.textMuted, fontFamily:"monospace", letterSpacing:"0.06em" }}>BREAKDOWN</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
              <thead><tr style={{ background:t.surface2 }}>
                {["Technique","Relevance","Depth","Clarity","Accuracy","Technique✦","Overall","Tokens","Efficiency"].map(h => (
                  <th key={h} style={{ padding:"9px 14px", textAlign:h==="Technique"?"left":"center", color:t.textMuted, fontFamily:"monospace", fontWeight:500, fontSize:"11px" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {chartData.map((d,i) => (
                  <tr key={d.id} style={{ borderTop:`1px solid ${t.border}`, background:i===0?"#00e5a006":"transparent" }}>
                    <td style={{ padding:"9px 14px", color:t.text, fontFamily:"monospace", fontWeight:i===0?600:400 }}>{i===0&&"★ "}{d.label}</td>
                    {["relevance","depth","clarity","accuracy","technique_fidelity","overall"].map(k => (
                      <td key={k} style={{ padding:"9px 14px", textAlign:"center", color:d[k]>0?sc(d[k]):t.textDim, fontFamily:"monospace" }}>{d[k]>0?d[k]:"—"}</td>
                    ))}
                    <td style={{ padding:"9px 14px", textAlign:"center", color:t.textMuted, fontFamily:"monospace" }}>{d.tokens>0?d.tokens.toLocaleString():"—"}</td>
                    <td style={{ padding:"9px 14px", textAlign:"center", color:t.accent, fontFamily:"monospace" }}>{d.efficiency>0?d.efficiency:"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasTokens && (
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"20px" }}>
          <div style={{ fontSize:"11px", color:t.textMuted, fontFamily:"monospace", letterSpacing:"0.06em", marginBottom:"16px" }}>COST PER TECHNIQUE (est. USD)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData.filter(d=>d.cost>0)} margin={{ top:4, right:8, left:-10, bottom:36 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:t.textMuted, fontFamily:"monospace" }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tickFormatter={v=>`$${v.toFixed(3)}`} tick={{ fontSize:10, fill:t.textMuted }} />
              <Tooltip contentStyle={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"8px", fontSize:"12px" }} />
              <Bar dataKey="cost" radius={[4,4,0,0]} fill={t.accent} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ fontSize:"11px", color:t.textDimmer, fontFamily:"monospace", textAlign:"center" }}>Scored by LLM-as-judge · Efficiency = quality score per 1,000 tokens</div>
    </div>
  );
}

function ResponseGrid({ layout, selectedTechniques, responses, responseTypes, loading, errors, formattedPrompts, showFormatted, tokenData, scores, topTechnique, t }) {
  const [expanded, setExpanded] = useState(null);
  useEffect(() => { if (layout==="accordion" && selectedTechniques.length>0) setExpanded(selectedTechniques[0]); }, [layout, selectedTechniques]);

  const maxWords = Math.max(...selectedTechniques.map(id => (responses[id]||"").replace(/[#*`]/g,"").split(/\s+/).filter(Boolean).length), 1);
  const cardProps = id => ({ technique:id, response:responses[id], responseType:responseTypes[id], isLoading:loading[id], error:errors[id], formattedPrompt:formattedPrompts[id], showFormatted, tokens:tokenData?.[id], score:scores?.[id], isTop:topTechnique===id });

  if (layout==="masonry") {
    const cols=[[],[]]; const heights=[0,0];
    [...selectedTechniques].sort((a,b)=>(responses[b]||"").length-(responses[a]||"").length).forEach(id=>{
      const col=heights[0]<=heights[1]?0:1; cols[col].push(id); heights[col]+=(responses[id]||"").length;
    });
    const isMobile = window.innerWidth < 640;
    return (
      <div style={{ display:"grid", gridTemplateColumns:isMobile||selectedTechniques.length===1?"1fr":"minmax(0,1fr) minmax(0,1fr)", gap:"14px", alignItems:"start" }}>
        {cols.map((col,ci)=>(
          <div key={ci} style={{ display:"flex", flexDirection:"column", gap:"14px", minWidth:0, overflow:"hidden" }}>
            {col.map(id=><MasonryCard key={id} {...cardProps(id)} layout="masonry"/>)}
          </div>
        ))}
      </div>
    );
  }
  if (layout==="equal") return (
    <div style={{ display:"grid", gridTemplateColumns:window.innerWidth<640||selectedTechniques.length===1?"1fr":"minmax(0,1fr) minmax(0,1fr)", gap:"14px" }}>
      {selectedTechniques.map(id=><EqualHeightCard key={id} {...cardProps(id)} layout="equal" cardHeight={480} maxWords={maxWords}/>)}
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
      {selectedTechniques.map(id=><AccordionCard key={id} {...cardProps(id)} layout="accordion" isExpanded={expanded===id} onToggle={()=>setExpanded(expanded===id?null:id)}/>)}
    </div>
  );
}

function AppInner() {
  const { dark, toggle } = useTheme();
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const t = getTheme(dark);

  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [activeTab, setActiveTab]       = useState("playground");
  const [layout, setLayout]             = useState("masonry");
  const [prompt, setPrompt]             = useState("");
  const [detectedIntent, setDetectedIntent] = useState(null);
  const [selectedTechniques, setSelected] = useState(["zero_shot"]);
  const [temperature, setTemperature]   = useState(0.7);
  const [maxTokens, setMaxTokens]       = useState(2048);
  const [model, setModel]               = useState("llama-3.3-70b-versatile");
  const [role, setRole]                 = useState("a senior software engineer with 20 years of experience");
  const [examples, setExamples]         = useState(DEFAULT_EXAMPLES);
  const [customInstructions, setCustomInstructions] = useState("");
  const [customSystem, setCustomSystem] = useState("");
  const [ragDoc, setRagDoc]             = useState(null);
  const [responses, setResponses]       = useState({});
  const [responseTypes, setResponseTypes] = useState({});
  const [tokenData, setTokenData]       = useState({});
  const [scores, setScores]             = useState({});
  const [topTechnique, setTopTechnique] = useState(null);
  const [formattedPrompts, setFormatted] = useState({});
  const [loading, setLoading]           = useState({});
  const [errors, setErrors]             = useState({});
  const [showFormatted, setShowFormatted] = useState(false);
  const [history, setHistory]           = useState([]);
  const [library, setLibrary]           = useState([]);
  const [showSave, setShowSave]         = useState(false);
  const [saveName, setSaveName]         = useState("");
  const [saveCat, setSaveCat]           = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [toast, setToast]               = useState(null);
  const detectTimer                     = useRef(null);
  const templatesRef                    = useRef(null);

  useEffect(() => {
    const handleClick = e => {
      if (templatesRef.current && !templatesRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    loadFromStorage(STORAGE_KEYS.history).then(setHistory);
    loadFromStorage(STORAGE_KEYS.library).then(setLibrary);
    // Auto-close sidebar on mobile
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null), 2500); };
  const toggleTechnique = id => setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const selectAll  = () => setSelected(Object.keys(TECHNIQUES).filter(id=>id!=="custom"));
  const clearAll   = () => setSelected([]);

  const handlePromptChange = val => {
    setPrompt(val);
    clearTimeout(detectTimer.current);
    if (!val.trim()) { setDetectedIntent(null); return; }
    detectTimer.current = setTimeout(async () => {
      const intent = await detectIntent(val);
      setDetectedIntent(intent !== "text" ? intent : null);
    }, 800);
  };

  const buildPrompt = id => {
    const tech = TECHNIQUES[id];
    if (id==="few_shot")   return tech.format(prompt, examples);
    if (id==="role_based") return tech.format(prompt, [], role);
    if (id==="custom")     return tech.format(prompt, [], null, customInstructions);
    return tech.format(prompt);
  };

  const getSystem = id => {
    const tech = TECHNIQUES[id];
    if (id==="role_based") return typeof tech.systemPrompt==="function" ? tech.systemPrompt(role) : tech.systemPrompt;
    if (id==="custom")     return typeof tech.systemPrompt==="function" ? tech.systemPrompt(null, customSystem) : (customSystem||tech.systemPrompt);
    return tech.systemPrompt;
  };

  const runAll = async () => {
    if (!prompt.trim() || selectedTechniques.length===0) return;
    const intent = await detectIntent(prompt, !!ragDoc);
    const formatted = {};
    selectedTechniques.forEach(id => { formatted[id] = buildPrompt(id); });
    setResponses({}); setErrors({}); setResponseTypes({}); setTokenData({}); setScores({}); setTopTechnique(null);
    setLoading(Object.fromEntries(selectedTechniques.map(id=>[id,true])));
    setFormatted(formatted);

    const finalResponses = {};
    await Promise.all(selectedTechniques.map(async (id, index) => {
      // Small stagger when RAG doc active to avoid race conditions
      if (ragDoc && index > 0) await new Promise(r => setTimeout(r, index * 300));
      try {
        const { text, type, tokens } = await callAPI({
          formattedPrompt: formatted[id], systemPrompt: getSystem(id),
          temperature, maxTokens, intent,
          mediaStyle: TECHNIQUES[id]?.mediaStyle||"",
          docId: ragDoc?.doc_id||"",
          model,
          onChunk: (partial, chunkType) => {
            setResponses(prev=>({...prev,[id]:partial}));
            setResponseTypes(prev=>({...prev,[id]:chunkType||intent}));
          },
        });
        finalResponses[id] = text;
        setResponses(prev=>({...prev,[id]:text}));
        setResponseTypes(prev=>({...prev,[id]:type||intent}));
        if (tokens) setTokenData(prev=>({...prev,[id]:tokens}));
        setLoading(prev=>({...prev,[id]:false}));
      } catch(err) {
        setErrors(prev=>({...prev,[id]:err.message}));
        setLoading(prev=>({...prev,[id]:false}));
      }
    }));

    // Score sequentially
    const textIds = selectedTechniques.filter(id => finalResponses[id] && typeof finalResponses[id]==="string" && finalResponses[id].length>30);
    (async () => {
      const allScores = {};
      for (const id of textIds) {
        try {
          const s = await scoreResponse(prompt, TECHNIQUES[id]?.label||id, finalResponses[id]);
          if (s && !s.error) { allScores[id]=s; setScores(prev=>({...prev,[id]:s})); }
          await new Promise(r=>setTimeout(r,200));
        } catch {}
      }
      const best = Object.entries(allScores).sort((a,b)=>b[1].overall-a[1].overall)[0];
      if (best) setTopTechnique(best[0]);
    })();

    const entry = { id:uid(), timestamp:Date.now(), prompt, intent, techniques:selectedTechniques, parameters:{temperature,maxTokens}, responses:finalResponses, formattedPrompts:formatted };
    const updated = [entry,...history].slice(0,50);
    setHistory(updated); saveToStorage(STORAGE_KEYS.history, updated);
  };

  // Export all responses as markdown
  const exportResponses = () => {
    const lines = [`# PromptForge Export\n**Prompt:** ${prompt}\n**Date:** ${new Date().toLocaleString()}\n`];
    selectedTechniques.forEach(id => {
      if (responses[id]) {
        lines.push(`## ${TECHNIQUES[id]?.icon} ${TECHNIQUES[id]?.label}`);
        if (scores[id]) lines.push(`**Score:** ${scores[id].overall}/100 · ${scores[id].verdict}`);
        lines.push(`\n${responses[id]}\n`);
      }
    });
    const blob = new Blob([lines.join("\n")], { type:"text/markdown" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`promptforge-${Date.now()}.md`; a.click();
    notify("Exported as markdown");
  };

  const saveToLib = () => {
    if (!saveName.trim()) return;
    const entry = {
      id:uid(), name:saveName, category:saveCat||"Uncategorized",
      prompt, techniques:selectedTechniques, parameters:{temperature,maxTokens},
      timestamp:Date.now(),
      // Save full session so loading restores everything
      responses: Object.keys(responses).length > 0 ? responses : undefined,
      scores:    Object.keys(scores).length > 0 ? scores : undefined,
      topTechnique: topTechnique || undefined,
    };
    const updated = [...library, entry];
    setLibrary(updated); saveToStorage(STORAGE_KEYS.library, updated);
    setShowSave(false); setSaveName(""); setSaveCat("");
    notify("Saved to library");
  };

  const loadItem = item => {
    setPrompt(item.prompt); setSelected(item.techniques);
    if (item.parameters) { setTemperature(item.parameters.temperature||0.7); setMaxTokens(item.parameters.maxTokens||2048); }
    // Restore full session if available
    if (item.responses) {
      setResponses(item.responses);
      setResponseTypes(Object.fromEntries(Object.keys(item.responses).map(id => [id, "text"])));
    }
    if (item.scores)       setScores(item.scores);
    if (item.topTechnique) setTopTechnique(item.topTechnique);
    setActiveTab("playground");
    notify(item.responses ? "Session restored — results loaded" : "Prompt loaded");
  };

  const isRunning = Object.values(loading).some(Boolean);
  const hasOutput = Object.keys(responses).length>0 || isRunning;
  const categories = [...new Set(library.map(i=>i.category))];

  const TABS = [
    { id:"playground", label:"Playground", icon:"◈" },
    { id:"history",    label:"History",    icon:"◷", badge: history.length||null },
    { id:"library",    label:"Library",    icon:"◻", badge: library.length||null },
    { id:"analytics",  label:"Analytics",  icon:"◎" },
    { id:"optimizer",  label:"Optimizer",  icon:"⟳" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.text, fontFamily:"'Syne','Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;min-width:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${t.border2};border-radius:2px;}
        textarea,input,select{font-family:inherit;outline:none;}
        textarea:focus,input:focus,select:focus{border-color:${t.accent}!important;}
        @keyframes pf-spin{to{transform:rotate(360deg);}}
        @keyframes pf-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pf-pop{0%{transform:scale(0.95);opacity:0}100%{transform:scale(1);opacity:1}}
        .pf-btn{transition:all 0.16s ease;}
        .pf-btn:hover{opacity:0.85;}
        .pf-btn:active{transform:scale(0.97);}
        .pf-run{transition:all 0.16s ease!important;}
        .pf-run:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 24px ${t.accent}55!important;}
        .pf-run:active:not(:disabled){transform:scale(0.97);}
        .pf-card{transition:transform 0.16s ease,box-shadow 0.16s ease;}
        .pf-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.12);}
        .tech-chip{transition:all 0.16s ease;cursor:pointer;}
        .tech-chip:hover{transform:translateY(-1px);}
        .markdown-body p{margin-bottom:9px;word-break:break-word;line-height:1.72;}
        .markdown-body h1,.markdown-body h2,.markdown-body h3{margin:14px 0 6px;font-weight:700;font-family:'Syne',sans-serif;}
        .markdown-body ul,.markdown-body ol{padding-left:20px;margin-bottom:9px;}
        .markdown-body li{margin-bottom:4px;line-height:1.65;}
        .markdown-body code{background:${t.surface2};border:1px solid ${t.border};padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12px;}
        .markdown-body pre{background:${t.surface2};border:1px solid ${t.border};padding:14px;border-radius:10px;overflow-x:auto;margin-bottom:10px;}
        .markdown-body strong{font-weight:700;}
        .markdown-body blockquote{border-left:3px solid ${t.accent};padding-left:14px;color:${t.textMuted};margin:10px 0;font-style:italic;}
        nav::-webkit-scrollbar{display:none;}
        @media(max-width:768px){
          .tab-label{display:none!important;}
          .layout-switcher{display:none!important;}
          .logo-text{display:none!important;}
          .pf-run{padding:7px 12px!important;font-size:12px!important;}
        }
        @media(max-width:480px){
          nav button{padding:4px 5px!important;}
        }
        /* Fix blank space on mobile scroll */
        main > div { min-height: 0; }
        .pf-response-grid { min-height: 0; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:"16px", left:"50%", transform:"translateX(-50%)", zIndex:1000, background:t.surface, border:`1px solid ${t.border}`, color:t.text, padding:"10px 20px", borderRadius:"10px", fontSize:"13px", fontFamily:"monospace", boxShadow:"0 8px 24px rgba(0,0,0,0.15)", animation:"pf-fade 0.2s ease", whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header — mobile first: hamburger | logo | [theme] | [export] | tabs scroll */}
      <header style={{ height:"56px", borderBottom:`1px solid ${t.border}`, padding:"0 10px", display:"flex", alignItems:"center", gap:"6px", background:t.surface, position:"sticky", top:0, zIndex:100 }}>

        {/* Sidebar toggle */}
        <button className="pf-btn" onClick={()=>setSidebarOpen(o=>!o)} style={{ width:"32px", height:"32px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:sidebarOpen?t.accentBg:"transparent", border:`1px solid ${sidebarOpen?t.accentBorder:t.border}`, borderRadius:"8px", cursor:"pointer", color:sidebarOpen?t.accent:t.textMuted, fontSize:"15px" }}>☰</button>

        {/* Logo icon only on mobile */}
        <div style={{ width:"30px", height:"30px", flexShrink:0, background:t.accent, borderRadius:"9px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", color:"#fff", fontWeight:800, boxShadow:`0 2px 10px ${t.accent}55` }}>P</div>
        <span className="logo-text" style={{ fontWeight:800, fontSize:"14px", letterSpacing:"-0.02em", flexShrink:0 }}>PromptForge</span>

        {/* Theme toggle — always visible, right after logo */}
        <button className="pf-btn" onClick={toggle} style={{ width:"30px", height:"30px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:`1px solid ${t.border}`, borderRadius:"8px", cursor:"pointer", color:t.textMuted, fontSize:"13px" }}>
          {dark?"☀":"☾"}
        </button>

        {/* Export — icon only */}
        {hasOutput && Object.keys(responses).length > 0 && (
          <button className="pf-btn" onClick={exportResponses} title="Export as Markdown" style={{ width:"30px", height:"30px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:t.surface2, border:`1px solid ${t.border}`, borderRadius:"8px", color:t.textMuted, fontSize:"13px", cursor:"pointer" }}>↓</button>
        )}

        {/* Layout switcher — hidden on mobile via CSS */}
        {activeTab==="playground" && (
          <div className="layout-switcher" style={{ display:"flex", flexShrink:0, gap:"2px", background:t.surface2, border:`1px solid ${t.border}`, borderRadius:"8px", padding:"2px" }}>
            {LAYOUTS.map(l=>(
              <button key={l.id} onClick={()=>setLayout(l.id)} title={l.id} style={{ width:"24px", height:"22px", background:layout===l.id?t.accent:"transparent", border:"none", borderRadius:"4px", color:layout===l.id?"#fff":t.textMuted, fontSize:"11px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {l.icon}
              </button>
            ))}
          </div>
        )}

        {/* Tabs — scrollable, takes remaining space */}
        <nav style={{ display:"flex", gap:"2px", flex:1, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", minWidth:0 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ padding:"5px 8px", background:activeTab===tab.id?t.accentBg:"transparent", border:`1px solid ${activeTab===tab.id?t.accentBorder:"transparent"}`, borderRadius:"7px", color:activeTab===tab.id?t.accent:t.textMuted, fontSize:"11px", cursor:"pointer", fontWeight:activeTab===tab.id?700:400, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"3px", fontFamily:"'Syne',sans-serif", transition:"all 0.16s", flexShrink:0 }}>
              <span style={{ fontSize:"12px" }}>{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.badge > 0 && <span style={{ fontSize:"9px", background:t.accent, color:"#fff", borderRadius:"8px", padding:"1px 4px", fontFamily:"monospace", fontWeight:700, lineHeight:"14px" }}>{tab.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div style={{ display:"flex", height:"calc(100vh - 56px)", overflow:"hidden", position:"relative" }}>
        {/* Mobile overlay backdrop */}
        {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{ display: typeof window !== "undefined" && window.innerWidth < 768 ? "block" : "none", position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:90, top:"56px" }} />}
        <Sidebar open={sidebarOpen} selectedTechniques={selectedTechniques} onToggleTechnique={toggleTechnique} onSelectAll={selectAll} onClearAll={clearAll} temperature={temperature} setTemperature={setTemperature} maxTokens={maxTokens} setMaxTokens={setMaxTokens} role={role} setRole={setRole} examples={examples} setExamples={setExamples} showFormatted={showFormatted} setShowFormatted={setShowFormatted} customInstructions={customInstructions} setCustomInstructions={setCustomInstructions} customSystem={customSystem} setCustomSystem={setCustomSystem} ragDoc={ragDoc} setRagDoc={setRagDoc} model={model} setModel={setModel} t={t} />

        <main style={{ flex:1, overflowY:"auto", padding:activeTab==="playground" ? "clamp(12px,2vw,20px)" : "0", display:"flex", flexDirection:"column", gap:"16px", minWidth:0 }}>

          {activeTab==="playground" && (
            <div style={{ display:"flex", flexDirection:"column", gap:"16px", width:"100%", animation:"pf-fade 0.2s ease" }}>

              {/* Prompt area */}
              <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"16px", boxShadow:`0 1px 3px rgba(0,0,0,0.06)` }}>
                {/* Top bar: technique badges + intent badge */}
                <div style={{ padding:"10px 14px 8px", display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", borderBottom:`1px solid ${t.border}`, background:t.surface2 }}>
                  <span style={{ fontSize:"10px", color:t.textDim, fontFamily:"monospace", letterSpacing:"0.05em", flexShrink:0 }}>prompt</span>
                  {selectedTechniques.map(id=>(
                    <span key={id} style={{ fontSize:"10px", color:TECHNIQUES[id].color, background:`${TECHNIQUES[id].color}12`, border:`1px solid ${TECHNIQUES[id].color}30`, borderRadius:"5px", padding:"2px 7px", fontFamily:"monospace", fontWeight:600 }}>
                      {TECHNIQUES[id].icon} {TECHNIQUES[id].label}
                    </span>
                  ))}
                  {detectedIntent && detectedIntent!=="text" && (() => { const m=MODALITY_META[detectedIntent]; return m ? <span style={{ fontSize:"10px", color:m.color, background:m.bg, border:`1px solid ${m.border}`, borderRadius:"5px", padding:"2px 7px", fontFamily:"monospace" }}>{m.icon} {m.label}</span> : null; })()}
                </div>

                {/* Textarea */}
                <textarea value={prompt} onChange={e=>handlePromptChange(e.target.value)} placeholder="Enter your prompt… (Ctrl+Enter to run)" rows={5} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))runAll();}} style={{ width:"100%", background:"transparent", border:"none", color:t.text, padding:"16px", fontSize:"14px", lineHeight:"1.7", resize:"vertical", fontFamily:"inherit" }} />

                {/* Bottom toolbar */}
                <div style={{ padding:"8px 12px", borderTop:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:"6px", background:t.surface2, flexWrap:"wrap" }}>
                  {/* Paperclip upload */}
                  <label title="Upload document or image" style={{ width:"32px", height:"32px", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"8px", border:`1px solid ${ragDoc?t.accent:t.border}`, background:ragDoc?t.accentBg:"transparent", cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=ragDoc?t.accent:t.border}>
                    <input type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp" style={{ display:"none" }} onChange={async e=>{
                      const file=e.target.files[0]; if(!file) return;
                      const isImage=file.type.startsWith("image/"), isPDF=file.name.toLowerCase().endsWith(".pdf");
                      try {
                        let body={filename:file.name};
                        if(isImage){const buf=await file.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);body={...body,image_base64:btoa(bin),mime:file.type};}
                        else if(isPDF){
                          if(!window.pdfjsLib){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";}
                          const buf=await file.arrayBuffer();const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;const pages=[];
                          for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const ct=await page.getTextContent();const items=ct.items.sort((a,b)=>{const dy=Math.round(b.transform[5])-Math.round(a.transform[5]);return dy!==0?dy:a.transform[4]-b.transform[4]});let pt="";let lastY=null;for(const item of items){const y=Math.round(item.transform[5]);if(lastY!==null&&Math.abs(lastY-y)>5)pt+="\n";pt+=item.str+" ";lastY=y;}pages.push(pt.trim());}
                          body={...body,text:pages.join("\n\n")};
                        } else { body={...body,text:await file.text()}; }
                        const res=await fetch(`${API_BASE}/v1/rag/upload`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
                        const data=await res.json();
                        if(data.doc_id){setRagDoc({doc_id:data.doc_id,filename:data.filename,chunks:data.chunks,type:data.type});notify(`Indexed ${data.chunks} chunks from ${data.filename}`);}
                        else alert("Upload failed: "+(data.error||"unknown"));
                      } catch(err){alert("Upload failed: "+err.message);}
                    }} />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ragDoc?t.accent:t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  </label>

                  {/* Templates button */}
                  <div style={{ position:"relative" }} ref={templatesRef}>
                    <button className="pf-btn" onClick={()=>setShowTemplates(o=>!o)} title="Prompt templates" style={{ height:"32px", padding:"0 10px", background:showTemplates?t.accentBg:"transparent", border:`1px solid ${showTemplates?t.accentBorder:t.border}`, borderRadius:"8px", color:showTemplates?t.accent:t.textMuted, fontSize:"12px", cursor:"pointer", fontFamily:"monospace", display:"flex", alignItems:"center", gap:"5px" }}>
                      ◈ Templates
                    </button>
                    {showTemplates && (
                      <div style={{ position:"absolute", top:"38px", left:0, zIndex:500, background:t.surface, border:`1px solid ${t.border}`, borderRadius:"12px", padding:"6px", width:"280px", boxShadow:"0 8px 32px rgba(0,0,0,0.15)", animation:"pf-pop 0.15s ease" }}>
                        {TEMPLATES.map(tpl=>(
                          <button key={tpl.label} onClick={()=>{setPrompt(tpl.prompt);setShowTemplates(false);}} style={{ width:"100%", padding:"9px 12px", background:"transparent", border:"none", borderRadius:"8px", color:t.text, fontSize:"12px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"10px", transition:"background 0.1s" }}
                            onMouseEnter={e=>e.currentTarget.style.background=t.surface2}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <span style={{ fontSize:"14px", flexShrink:0 }}>{tpl.icon}</span>
                            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:500 }}>{tpl.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RAG doc pill */}
                  {ragDoc && (
                    <div style={{ display:"flex", alignItems:"center", gap:"5px", padding:"3px 9px", background:t.accentBg, border:`1px solid ${t.accentBorder}`, borderRadius:"7px", fontSize:"11px", color:t.accent, fontFamily:"monospace", maxWidth:"180px" }}>
                      <span style={{ flexShrink:0 }}>{ragDoc.type==="image"?"🖼":"📄"}</span>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ragDoc.filename.length>16?ragDoc.filename.slice(0,16)+"…":ragDoc.filename}</span>
                      <button onClick={()=>setRagDoc(null)} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", padding:"0 0 0 2px", fontSize:"13px", lineHeight:1, flexShrink:0 }}>×</button>
                    </div>
                  )}

                  <span style={{ fontSize:"11px", color:t.textDimmer, fontFamily:"monospace", marginLeft:"auto" }}>
                    {prompt.trim() ? `${prompt.trim().split(/\s+/).length} words` : "Ctrl+Enter to run"}
                  </span>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button className="pf-btn" onClick={()=>setShowSave(true)} disabled={!prompt.trim()} style={{ padding:"6px 14px", background:"transparent", border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"9px", fontSize:"12px", cursor:"pointer", opacity:prompt.trim()?1:0.4, fontFamily:"'Syne',sans-serif" }}>Save</button>
                    <button className="pf-run" onClick={runAll} disabled={!prompt.trim()||isRunning||selectedTechniques.length===0}
                      style={{ padding:"7px 22px", background:t.accent, border:"none", color:"#fff", borderRadius:"9px", fontSize:"13px", fontWeight:700, cursor:"pointer", opacity:(!prompt.trim()||selectedTechniques.length===0)?0.4:1, fontFamily:"'Syne',sans-serif", letterSpacing:"0.01em", boxShadow:(!prompt.trim()||selectedTechniques.length===0)?"none":`0 4px 20px ${t.accent}55` }}>
                      {isRunning?`⟳ Running…`:`▶ Run${selectedTechniques.length>1?` ×${selectedTechniques.length}`:""}`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Empty state */}
              {!hasOutput && selectedTechniques.length===0 && (
                <div style={{ padding:"60px 24px", textAlign:"center", color:t.textDim, fontSize:"13px", border:`1px dashed ${t.border}`, borderRadius:"14px" }}>
                  <div style={{ fontSize:"28px", marginBottom:"12px", opacity:0.3 }}>◈</div>
                  <div style={{ fontWeight:600, color:t.text, marginBottom:"6px", fontFamily:"'Syne',sans-serif" }}>Select a technique to get started</div>
                  <div style={{ color:t.textMuted }}>Pick one or more from the sidebar, then type your prompt</div>
                </div>
              )}

              {hasOutput && selectedTechniques.length>0 && (
                <ResponseGrid layout={layout} selectedTechniques={selectedTechniques} responses={responses} responseTypes={responseTypes} loading={loading} errors={errors} formattedPrompts={formattedPrompts} showFormatted={showFormatted} tokenData={tokenData} scores={scores} topTechnique={topTechnique} t={t} />
              )}
            </div>
          )}

          {activeTab==="history"   && <HistoryTab history={history} setHistory={setHistory} onLoad={loadItem} />}
          {activeTab==="library"   && <LibraryTab library={library} setLibrary={setLibrary} onLoad={loadItem} />}
          {activeTab==="analytics" && <AnalyticsPanel scores={scores} tokenData={tokenData} selectedTechniques={selectedTechniques} t={t} />}
          {activeTab==="optimizer" && <OptimizerPanel prompt={prompt} selectedTechniques={selectedTechniques} temperature={temperature} maxTokens={maxTokens} ragDoc={ragDoc} t={t} />}
        </main>
      </div>

      {/* Save modal */}
      {showSave && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShowSave(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:"16px", padding:"28px", width:"380px", animation:"pf-pop 0.2s ease", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontWeight:700, fontSize:"16px", marginBottom:"4px", fontFamily:"'Syne',sans-serif" }}>Save to library</h3>
            <p style={{ fontSize:"12px", color:t.textMuted, marginBottom:"18px" }}>
              {Object.keys(responses).length > 0
                ? `Saving full session — prompt + ${Object.keys(responses).length} responses + scores`
                : "Saving prompt and techniques (run it first to also save responses)"}
            </p>
            <div style={{ marginBottom:"12px" }}>
              <label style={{ fontSize:"11px", color:t.textDim, fontFamily:"monospace", display:"block", marginBottom:"5px", letterSpacing:"0.05em" }}>NAME</label>
              <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="e.g. Code review prompt" autoFocus style={{ width:"100%", padding:"9px 12px", background:t.surface2, border:`1px solid ${t.border}`, color:t.text, borderRadius:"9px", fontSize:"13px" }} />
            </div>
            <div style={{ marginBottom:"20px" }}>
              <label style={{ fontSize:"11px", color:t.textDim, fontFamily:"monospace", display:"block", marginBottom:"5px", letterSpacing:"0.05em" }}>CATEGORY</label>
              <input value={saveCat} onChange={e=>setSaveCat(e.target.value)} placeholder="e.g. Coding, Writing…" list="cats" style={{ width:"100%", padding:"9px 12px", background:t.surface2, border:`1px solid ${t.border}`, color:t.text, borderRadius:"9px", fontSize:"13px" }} />
              <datalist id="cats">{categories.map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
              <button className="pf-btn" onClick={()=>setShowSave(false)} style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"9px", fontSize:"13px", cursor:"pointer" }}>Cancel</button>
              <button onClick={saveToLib} disabled={!saveName.trim()} style={{ padding:"8px 20px", background:t.accent, border:"none", color:"#fff", borderRadius:"9px", fontSize:"13px", fontWeight:700, cursor:"pointer", opacity:saveName.trim()?1:0.5, fontFamily:"'Syne',sans-serif" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <ThemeProvider><AppInner /></ThemeProvider>;
}
