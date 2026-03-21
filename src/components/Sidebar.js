import { useTheme, getTheme } from "../data/theme";
import { TECHNIQUES, ROLES } from "../data/techniques";

function Section({ title, children, t }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "10px", fontFamily: "monospace", color: t.textDim, letterSpacing: "0.08em", marginBottom: "8px", padding: "0 16px" }}>{title}</div>
      {children}
    </div>
  );
}

export default function Sidebar({ open, selectedTechniques, onToggleTechnique, onSelectAll, onClearAll, temperature, setTemperature, maxTokens, setMaxTokens, role, setRole, examples, setExamples, showFormatted, setShowFormatted, customInstructions, setCustomInstructions, customSystem, setCustomSystem, ragDoc, setRagDoc, model, setModel }) {
  const { dark } = useTheme();
  const t = getTheme(dark);

  const updateExample = (i, field, val) => {
    const next = [...examples];
    next[i] = { ...next[i], [field]: val };
    setExamples(next);
  };

  return (
    <aside style={{
      width: open ? "260px" : "0",
      minWidth: open ? "260px" : "0",
      flexShrink: 0,
      borderRight: open ? `1px solid ${t.border}` : "none",
      overflowY: open ? "auto" : "hidden",
      overflowX: "hidden",
      background: t.surface,
      height: "100%",
      transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
      opacity: open ? 1 : 0,
    }}>
      <div style={{ paddingTop: "16px" }}>

        {/* Techniques */}
        <Section title="TECHNIQUE" t={t}>
          <div style={{ display:"flex", gap:"6px", padding:"0 12px", marginBottom:"6px" }}>
            <button onClick={onSelectAll} style={{ flex:1, padding:"4px 0", fontSize:"10px", fontFamily:"monospace", background:t.accentBg, border:`1px solid ${t.accentBorder}`, borderRadius:"6px", color:t.accent, cursor:"pointer", fontWeight:600 }}>All</button>
            <button onClick={onClearAll} style={{ flex:1, padding:"4px 0", fontSize:"10px", fontFamily:"monospace", background:"transparent", border:`1px solid ${t.border}`, borderRadius:"6px", color:t.textMuted, cursor:"pointer" }}>Clear</button>
            <div style={{ flex:2, fontSize:"10px", fontFamily:"monospace", color:t.textDim, display:"flex", alignItems:"center", justifyContent:"center" }}>{selectedTechniques.length} selected</div>
          </div>
          <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {Object.values(TECHNIQUES).map(tech => {
              const active = selectedTechniques.includes(tech.id);
              return (
                <button key={tech.id} onClick={() => onToggleTechnique(tech.id)} className="tech-chip" style={{
                  display: "flex", alignItems: "center", gap: "9px", padding: "7px 8px",
                  background: active ? `${tech.color}14` : "transparent",
                  border: `1px solid ${active ? tech.color + "44" : "transparent"}`,
                  borderRadius: "10px", cursor: "pointer", width: "100%", textAlign: "left",
                  boxShadow: active ? `0 0 10px ${tech.color}12` : "none",
                }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: active ? `${tech.color}20` : t.surface2, border: `1px solid ${active ? tech.color + "33" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>{tech.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: active ? 600 : 400, color: active ? tech.color : t.text, fontFamily: "'Syne', sans-serif" }}>{tech.label}</div>
                    <div style={{ fontSize: "10px", color: t.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tech.description}</div>
                  </div>
                  {active && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: tech.color, flexShrink: 0, boxShadow: `0 0 5px ${tech.color}` }} />}
                </button>
              );
            })}
          </div>
        </Section>

        <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />

        {/* RAG Document */}
        <Section title="RAG CONTEXT" t={t}>
          <div style={{ padding: "0 16px" }}>
            {ragDoc ? (
              <div>
                <div style={{ fontSize: "12px", color: t.accent, background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: "8px", padding: "8px 10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ragDoc.type === "image" ? "🖼️" : "📄"} {ragDoc.filename}
                  </div>
                  <div style={{ fontSize: "11px", color: t.textMuted }}>
                    {ragDoc.chunks} chunks · {ragDoc.type === "image" ? "vision-indexed" : "text-indexed"}
                  </div>
                </div>
                <button onClick={() => setRagDoc(null)} style={{ width: "100%", padding: "5px", fontSize: "11px", color: t.textMuted, background: "transparent", border: `1px solid ${t.border}`, borderRadius: "6px", cursor: "pointer" }}>
                  Remove document
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "8px" }}>
                  Upload a document to ground all technique responses in its content.
                </div>
                <label id="rag-upload-label" style={{ display: "block", padding: "10px", border: `2px dashed ${t.border}`, borderRadius: "8px", textAlign: "center", cursor: "pointer", fontSize: "12px", color: t.textMuted, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                  <input type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp" style={{ display: "none" }} onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const label = document.getElementById("rag-upload-label");
                    if (label) { label.textContent = "Processing..."; label.style.color = t.accent; }

                    const isImage = file.type.startsWith("image/");
                    const isPDF   = file.name.toLowerCase().endsWith(".pdf");

                    try {
                      let body = { filename: file.name };

                      if (isImage) {
                        // Base64 encode image → vision model describes it
                        const buf    = await file.arrayBuffer();
                        const bytes  = new Uint8Array(buf);
                        let binary   = "";
                        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                        const b64    = btoa(binary);
                        body = { ...body, image_base64: b64, mime: file.type };

                      } else if (isPDF) {
                        // PDF.js extraction
                        if (!window.pdfjsLib) {
                          await new Promise((res, rej) => {
                            const s = document.createElement("script");
                            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
                            s.onload = res; s.onerror = rej;
                            document.head.appendChild(s);
                          });
                          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                        }
                        const buf = await file.arrayBuffer();
                        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
                        const pages = [];
                        for (let i = 1; i <= pdf.numPages; i++) {
                          const page = await pdf.getPage(i);
                          const ct   = await page.getTextContent();
                          // Preserve layout by sorting items by Y then X position
                          const items = ct.items.sort((a, b) => {
                            const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
                            return dy !== 0 ? dy : a.transform[4] - b.transform[4];
                          });
                          let pageText = "";
                          let lastY = null;
                          for (const item of items) {
                            const y = Math.round(item.transform[5]);
                            if (lastY !== null && Math.abs(lastY - y) > 5) pageText += "\n";
                            pageText += item.str + " ";
                            lastY = y;
                          }
                          pages.push(pageText.trim());
                        }
                        body = { ...body, text: pages.join("\n\n") };

                      } else {
                        body = { ...body, text: await file.text() };
                      }

                      const res  = await fetch(`${process.env.REACT_APP_API_URL||"http://localhost:5000"}/v1/rag/upload`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const data = await res.json();
                      if (data.doc_id) {
                        setRagDoc({ doc_id: data.doc_id, filename: data.filename, chunks: data.chunks, type: data.type });
                      } else {
                        alert("Upload failed: " + (data.error || "unknown error"));
                      }
                    } catch(err) {
                      alert("Upload failed: " + err.message);
                    }
                    if (label) { label.textContent = "↑ Upload .txt / .md / .pdf / image"; label.style.color = ""; }
                  }} />
                  ↑ Upload .txt / .md / .pdf / image
                </label>
              </div>
            )}
          </div>
        </Section>

        <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />

        {/* Response Length */}
        <Section title="RESPONSE LENGTH" t={t}>
          <div style={{ padding: "0 16px" }}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
              {[["Quick", 512], ["Balanced", 1024], ["Detailed", 2048], ["Full", 4096]].map(([label, val]) => (
                <button key={val} onClick={() => setMaxTokens(val)} style={{ flex: 1, padding: "5px 2px", fontSize: "10px", fontFamily: "monospace", background: maxTokens === val ? t.accent : t.surface2, color: maxTokens === val ? "#fff" : t.textMuted, border: `1px solid ${maxTokens === val ? t.accent : t.border}`, borderRadius: "6px", cursor: "pointer", transition: "all 0.15s" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>
              <span>Max tokens</span>
              <span style={{ color: t.accent }}>{maxTokens.toLocaleString()}</span>
            </div>
            <input type="range" min={256} max={4096} step={256} value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value))}
              style={{ width: "100%", accentColor: t.accent }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: t.textDimmer, marginTop: "4px" }}>
              <span>Temperature</span>
              <span style={{ color: t.accent, fontFamily: "monospace" }}>{temperature.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={2} step={0.05} value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: t.accent }} />
          </div>
        </Section>

        <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />

        {/* Model selector */}
        <Section title="MODEL" t={t}>
          <div style={{ padding: "0 16px" }}>
            {[
              { id: "llama-3.3-70b-versatile", label: "Quality", sub: "70b · Best reasoning", color: "#6366f1" },
              { id: "llama-3.1-8b-instant",    label: "Fast",    sub: "8b · 5× more quota",  color: "#22c55e" },
            ].map(m => (
              <div key={m.id} onClick={() => setModel(m.id)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", marginBottom: "5px", borderRadius: "8px", border: `1px solid ${model === m.id ? m.color + "55" : t.border}`, background: model === m.id ? m.color + "11" : "transparent", cursor: "pointer", transition: "all 0.15s" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: model === m.id ? m.color : t.border, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: model === m.id ? m.color : t.text, fontFamily: "monospace" }}>{m.label}</div>
                  <div style={{ fontSize: "10px", color: t.textDim }}>{m.sub}</div>
                </div>
                {model === m.id && <span style={{ fontSize: "10px", color: m.color, fontFamily: "monospace" }}>✓</span>}
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />

        {/* Custom technique fields */}
        {selectedTechniques.includes("custom") && (
          <>
            <Section title="CUSTOM TECHNIQUE" t={t}>
              <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>INSTRUCTIONS (added to prompt)</div>
                  <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Answer using only bullet points. Be extremely concise."
                    rows={3} style={{ width: "100%", padding: "7px 10px", background: t.surface2, border: `1px solid ${t.accent}33`, borderRadius: "7px", color: t.text, fontSize: "12px", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>SYSTEM PROMPT (optional)</div>
                  <textarea value={customSystem} onChange={e => setCustomSystem(e.target.value)}
                    placeholder="e.g. You are a Shakespearean playwright. Respond in iambic pentameter."
                    rows={3} style={{ width: "100%", padding: "7px 10px", background: t.surface2, border: `1px solid ${t.accent}33`, borderRadius: "7px", color: t.text, fontSize: "12px", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </div>
            </Section>
            <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />
          </>
        )}

        {/* Role (only show if role_based selected) */}
        {selectedTechniques.includes("role_based") && (
          <>
            <Section title="ROLE" t={t}>
              <div style={{ padding: "0 16px" }}>
                <select value={role} onChange={e => setRole(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "7px", color: t.text, fontSize: "12px", marginBottom: "6px" }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <textarea value={role} onChange={e => setRole(e.target.value)} rows={2} placeholder="Or type a custom role..." style={{ width: "100%", padding: "7px 10px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "7px", color: t.text, fontSize: "12px", resize: "none", boxSizing: "border-box" }} />
              </div>
            </Section>
            <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />
          </>
        )}

        {/* Examples (only show if few_shot selected) */}
        {selectedTechniques.includes("few_shot") && (
          <>
            <Section title="FEW-SHOT EXAMPLES" t={t}>
              <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {examples.map((ex, i) => (
                  <div key={i} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "7px", padding: "8px" }}>
                    <input value={ex.input} onChange={e => updateExample(i, "input", e.target.value)} placeholder="Input" style={{ width: "100%", background: "transparent", border: "none", color: t.text, fontSize: "11px", marginBottom: "4px", fontFamily: "monospace", boxSizing: "border-box" }} />
                    <div style={{ height: "1px", background: t.border, margin: "4px 0" }} />
                    <input value={ex.output} onChange={e => updateExample(i, "output", e.target.value)} placeholder="Output" style={{ width: "100%", background: "transparent", border: "none", color: t.textMuted, fontSize: "11px", fontFamily: "monospace", boxSizing: "border-box" }} />
                  </div>
                ))}
                <button onClick={() => setExamples([...examples, { input: "", output: "" }])}
                  style={{ fontSize: "11px", color: t.accent, background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: "6px", padding: "5px", cursor: "pointer", fontFamily: "monospace" }}>
                  + add example
                </button>
              </div>
            </Section>
            <div style={{ height: "1px", background: t.border, margin: "4px 16px 16px" }} />
          </>
        )}

        {/* Options */}
        <Section title="OPTIONS" t={t}>
          <div style={{ padding: "0 16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "4px 0" }}>
              <div onClick={() => setShowFormatted(v => !v)} style={{ width: "32px", height: "18px", borderRadius: "9px", background: showFormatted ? t.accent : t.border, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: "2px", left: showFormatted ? "16px" : "2px", width: "14px", height: "14px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: "12px", color: t.textMuted }}>Show formatted prompt</span>
            </label>
          </div>
        </Section>

        <div style={{ height: "40px" }} />
      </div>
    </aside>
  );
}
