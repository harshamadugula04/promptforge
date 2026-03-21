import { useState } from "react";
import { TECHNIQUES } from "../data/techniques";

function CopyButton({ text, label = "Copy", t }) {
  const [state, setState] = useState("idle"); // idle | copied
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button onClick={copy} style={{ padding: "6px 14px", background: state === "copied" ? "#22c55e22" : t.accentBg, border: `1px solid ${state === "copied" ? "#22c55e55" : t.accentBorder}`, borderRadius: "7px", fontSize: "12px", color: state === "copied" ? "#22c55e" : t.accent, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s", whiteSpace: "nowrap" }}>
      {state === "copied" ? "✓ Copied!" : label}
    </button>
  );
}

function ClickToCopy({ text, t, style = {} }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div onClick={copy} title="Click to copy" style={{ position: "relative", cursor: "pointer", ...style }}>
      {copied && (
        <div style={{ position: "absolute", top: "-26px", left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#fff", fontSize: "11px", padding: "3px 8px", borderRadius: "5px", whiteSpace: "nowrap", zIndex: 10, fontFamily: "monospace" }}>
          ✓ Copied!
        </div>
      )}
      {text}
      {!copied && <span style={{ position: "absolute", top: "6px", right: "8px", fontSize: "10px", color: t.textDimmer, fontFamily: "monospace" }}>click to copy</span>}
    </div>
  );
}

export default function OptimizerPanel({ prompt: playgroundPrompt, selectedTechniques, temperature, maxTokens, ragDoc, t }) {
  const [localPrompt, setLocalPrompt]     = useState("");
  const [technique, setTechnique]         = useState(selectedTechniques[0] || "zero_shot");
  const [targetScore, setTargetScore]     = useState(80);
  const [maxIter, setMaxIter]             = useState(4);
  const [running, setRunning]             = useState(false);
  const [result, setResult]               = useState(null);
  const [error, setError]                 = useState(null);
  const [expandedIter, setExpandedIter]   = useState(null);

  // Use local prompt if typed, else fall back to playground prompt
  const activePrompt = localPrompt.trim() || playgroundPrompt.trim();
  const tech = TECHNIQUES[technique];

  const run = async () => {
    if (!activePrompt) return;
    setRunning(true); setResult(null); setError(null);
    try {
      const systemPrompt = typeof tech.systemPrompt === "function"
        ? tech.systemPrompt()
        : tech.systemPrompt;
      const res = await fetch(`${process.env.REACT_APP_API_URL||"http://localhost:5000"}/v1/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          system: systemPrompt,
          technique: tech.label,
          temperature,
          max_tokens: maxTokens,
          max_iterations: maxIter,
          target_score: targetScore,
          doc_id: ragDoc?.doc_id || "",
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setResult(data); setExpandedIter(data.best_iteration); }
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  const scoreColor = (v) => v >= 75 ? "#22c55e" : v >= 55 ? "#f59e0b" : "#ef4444";
  const scoreBg    = (v) => v >= 75 ? "#22c55e18" : v >= 55 ? "#f59e0b18" : "#ef444418";

  return (
    <div style={{ padding: "clamp(14px, 3vw, 24px)", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Config card */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ fontSize: "12px", color: t.textMuted, fontFamily: "monospace", marginBottom: "16px" }}>OPTIMIZER SETTINGS</div>

        {/* Editable prompt */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "6px" }}>
            PROMPT TO OPTIMIZE
            {playgroundPrompt.trim() && !localPrompt.trim() && (
              <span style={{ color: t.accent, marginLeft: "8px" }}>(from playground)</span>
            )}
          </div>
          <textarea
            value={localPrompt || playgroundPrompt}
            onChange={e => setLocalPrompt(e.target.value)}
            placeholder="Type your prompt here, or go to Playground and write one there..."
            rows={4}
            style={{ width: "100%", padding: "10px 12px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "8px", color: t.text, fontSize: "13px", lineHeight: "1.6", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          {/* Technique picker */}
          <div>
            <div style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "6px" }}>TECHNIQUE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {Object.values(TECHNIQUES).filter(tc => tc.id !== "custom").map(tc => (
                <button key={tc.id} onClick={() => setTechnique(tc.id)} style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: technique === tc.id ? tc.color + "22" : "transparent", color: technique === tc.id ? tc.color : t.textMuted, border: `1px solid ${technique === tc.id ? tc.color + "55" : t.border}`, borderRadius: "5px", cursor: "pointer", transition: "all 0.15s" }}>
                  {tc.icon} {tc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>
                <span>TARGET SCORE</span>
                <span style={{ color: t.accent }}>{targetScore}/100</span>
              </div>
              <input type="range" min={50} max={95} step={5} value={targetScore} onChange={e => setTargetScore(Number(e.target.value))} style={{ width: "100%", accentColor: t.accent }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: t.textDimmer }}>
                <span>Easy (50)</span><span>Hard (95)</span>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>
                <span>MAX ITERATIONS</span>
                <span style={{ color: t.accent }}>{maxIter}</span>
              </div>
              <input type="range" min={2} max={6} step={1} value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} style={{ width: "100%", accentColor: t.accent }} />
            </div>
          </div>
        </div>

        <button onClick={run} disabled={running || !activePrompt} style={{ width: "100%", padding: "10px", background: running ? t.surface2 : (!activePrompt ? t.surface2 : t.accent), border: "none", color: running || !activePrompt ? t.textMuted : "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: running || !activePrompt ? "not-allowed" : "pointer", transition: "all 0.15s", fontFamily: "monospace" }}>
          {running ? "⟳ Optimizing… (~30–60s)" : `🚀 Run Optimizer — ${tech.icon} ${tech.label}`}
        </button>
        {running && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: t.textMuted, textAlign: "center", fontFamily: "monospace" }}>
            Each iteration: run prompt → score → critique → rewrite. Be patient, this is real agentic AI.
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "#ef444411", border: "1px solid #ef444433", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#ef4444", fontFamily: "monospace" }}>
          ✗ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary banner */}
          <div style={{ background: result.converged ? "#22c55e11" : "#f59e0b11", border: `1px solid ${result.converged ? "#22c55e33" : "#f59e0b33"}`, borderRadius: "12px", padding: "16px 20px", display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ fontSize: "28px" }}>{result.converged ? "🎯" : "📈"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: result.converged ? "#22c55e" : "#f59e0b", fontWeight: 600, marginBottom: "3px" }}>
                {result.converged ? `TARGET ${targetScore} REACHED in ${result.best_iteration} iteration${result.best_iteration > 1 ? "s" : ""}` : `BEST SCORE after ${result.iterations} iterations — target ${targetScore} not reached`}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: t.text, fontFamily: "monospace" }}>
                <span style={{ color: scoreColor(result.best_score) }}>{result.best_score}</span>
                <span style={{ fontSize: "13px", color: t.textMuted, fontWeight: 400 }}>/100 · {result.iterations} iterations · {tech.icon} {tech.label}</span>
              </div>
            </div>
            <CopyButton text={result.best_prompt} label="Copy best prompt" t={t} />
          </div>

          {/* Score progression */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "12px", color: t.textMuted, fontFamily: "monospace", marginBottom: "14px" }}>SCORE PROGRESSION — click a bar to inspect</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px", marginBottom: "4px" }}>
              {result.trace.map((step, i) => {
                const score  = step.score?.overall || 0;
                const height = Math.max(6, (score / 100) * 80);
                const isActive = expandedIter === step.iteration;
                return (
                  <div key={i} onClick={() => setExpandedIter(isActive ? null : step.iteration)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
                    <div style={{ fontSize: "10px", color: scoreColor(score), fontFamily: "monospace", fontWeight: 600 }}>{score}</div>
                    <div style={{ width: "100%", height: `${height}px`, background: step.is_best ? "#22c55e" : scoreColor(score), borderRadius: "4px 4px 0 0", opacity: isActive ? 1 : 0.65, transition: "all 0.2s", outline: isActive ? `2px solid ${t.accent}` : "none" }} />
                    <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace" }}>#{i + 1}{step.is_best ? "★" : ""}</div>
                  </div>
                );
              })}
            </div>
            {/* Target score line label */}
            <div style={{ fontSize: "10px", color: t.textDimmer, fontFamily: "monospace" }}>Target: {targetScore}/100 — dashed line</div>
          </div>

          {/* Iteration cards — ascending order: first iteration at top */}
          {result.trace.map((step) => {
            const isExpanded = expandedIter === step.iteration;
            const score = step.score?.overall || 0;
            return (
              <div key={step.iteration} style={{ background: t.surface, border: `1px solid ${step.is_best ? "#22c55e55" : t.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: step.is_best ? "0 0 0 2px #22c55e18" : "none" }}>
                {/* Header */}
                <div onClick={() => setExpandedIter(isExpanded ? null : step.iteration)} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", background: isExpanded ? t.surface2 : "transparent", userSelect: "none" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: scoreBg(score), border: `1px solid ${scoreColor(score)}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: scoreColor(score), fontFamily: "monospace" }}>{score}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: t.text, fontFamily: "monospace" }}>
                      Iteration {step.iteration}
                      {step.is_best && <span style={{ marginLeft: "8px", fontSize: "10px", background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: "4px", padding: "1px 6px" }}>★ BEST</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "1px", fontStyle: "italic" }}>{step.score?.verdict || ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {[["rel", step.score?.relevance], ["dep", step.score?.depth], ["cla", step.score?.clarity], ["tec", step.score?.technique_fidelity]].map(([k, v]) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "11px", color: scoreColor(v || 0), fontFamily: "monospace", fontWeight: 600 }}>{v || 0}</div>
                        <div style={{ fontSize: "9px", color: t.textDimmer, fontFamily: "monospace" }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <span style={{ color: t.textMuted, fontSize: "11px", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${t.border}`, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>

                    {/* Prompt used — click to copy */}
                    <div>
                      <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "5px" }}>PROMPT USED — click to copy</div>
                      <ClickToCopy text={step.prompt} t={t} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "7px", padding: "10px 36px 10px 12px", fontSize: "12px", color: t.text, lineHeight: "1.6", maxHeight: "100px", overflowY: "auto", userSelect: "none" }} />
                    </div>

                    {/* Strength/Weakness summary */}
                    {(step.score?.strength || step.score?.verdict) && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
                        {step.score?.strength && (
                          <div style={{ background: "#22c55e0a", border: "1px solid #22c55e22", borderRadius: "7px", padding: "8px 12px", fontSize: "11px", color: t.text, lineHeight: "1.5" }}>
                            <span style={{ color: "#22c55e", fontFamily: "monospace", fontSize: "10px" }}>✓ STRENGTH  </span>{step.score.strength}
                          </div>
                        )}
                        {step.score?.verdict && (
                          <div style={{ background: "#f59e0b0a", border: "1px solid #f59e0b22", borderRadius: "7px", padding: "8px 12px", fontSize: "11px", color: t.text, lineHeight: "1.5" }}>
                            <span style={{ color: "#f59e0b", fontFamily: "monospace", fontSize: "10px" }}>⚠ WEAKNESS  </span>{step.score.verdict}
                          </div>
                        )}
                      </div>
                    )}



                    {/* Critique + Rewrite */}
                    {step.critique && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                          <div>
                            <div style={{ fontSize: "10px", color: "#f59e0b", fontFamily: "monospace", marginBottom: "5px" }}>🔍 CRITIQUE</div>
                            <div style={{ background: "#f59e0b08", border: "1px solid #f59e0b22", borderRadius: "7px", padding: "10px 12px", fontSize: "12px", color: t.text, lineHeight: "1.6" }}>
                              {step.critique}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "10px", color: t.accent, fontFamily: "monospace", marginBottom: "5px" }}>🎯 WHAT WAS CHANGED</div>
                            <div style={{ background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: "7px", padding: "10px 12px", fontSize: "12px", color: t.text, lineHeight: "1.6" }}>
                              {step.change || "Prompt restructured to address weakness"}
                            </div>
                          </div>
                        </div>
                        {step.next_prompt && (
                          <div>
                            <div style={{ fontSize: "10px", color: t.accent, fontFamily: "monospace", marginBottom: "5px" }}>✏️ REWRITTEN PROMPT → used in next iteration — click to copy</div>
                            <ClickToCopy text={step.next_prompt} t={t} style={{ background: t.surface2, border: `1px solid ${t.accent}33`, borderRadius: "7px", padding: "10px 36px 10px 12px", fontSize: "12px", color: t.text, lineHeight: "1.6", maxHeight: "120px", overflowY: "auto", userSelect: "none" }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Best prompt block */}
          <div style={{ background: "#22c55e08", border: "1px solid #22c55e33", borderRadius: "12px", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#22c55e", fontFamily: "monospace", fontWeight: 600 }}>⭐ BEST PROMPT — from iteration {result.best_iteration}</div>
                <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "2px" }}>This is the prompt that produced the highest score ({result.best_score}/100)</div>
              </div>
              <CopyButton text={result.best_prompt} label="Copy best prompt" t={t} />
            </div>
            <ClickToCopy text={result.best_prompt} t={t} style={{ background: t.surface, border: `1px solid #22c55e44`, borderRadius: "7px", padding: "12px 40px 12px 14px", fontSize: "13px", color: t.text, lineHeight: "1.65", marginBottom: result.best_response ? "12px" : 0, userSelect: "none", whiteSpace: "pre-wrap" }} />
            <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "8px" }}>
              Take this prompt to the Playground tab and run it across all techniques to see the full response.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
