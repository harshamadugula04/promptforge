import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { TECHNIQUES } from "../data/techniques";
import { useTheme, getTheme, MODALITY_META } from "../data/theme";

function CodeBlock({ code, lang, t }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ position: "relative", marginTop: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: t.surface2, borderRadius: "6px 6px 0 0", border: `1px solid ${t.border}`, borderBottom: "none" }}>
        <span style={{ fontSize: "11px", color: t.textMuted, fontFamily: "monospace" }}>{lang || "code"}</span>
        <button onClick={copy} style={{ fontSize: "11px", color: copied ? "#22c55e" : t.textMuted, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace" }}>{copied ? "✓ copied" : "copy"}</button>
      </div>
      <pre style={{ margin: 0, padding: "14px", background: t.surface2, borderRadius: "0 0 6px 6px", border: `1px solid ${t.border}`, overflowX: "auto", fontSize: "13px", lineHeight: "1.6", color: t.text, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", maxWidth: "100%", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CodeResponse({ response, t }) {
  const blocks = [];
  const parts = response.split(/(```[\s\S]*?```)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const lang = lines[0].trim();
      const code = lines.slice(1).join("\n");
      blocks.push(<CodeBlock key={i} code={code} lang={lang} t={t} />);
    } else if (part.trim()) {
      blocks.push(
        <div key={i} style={{ color: t.text, fontSize: "14px", lineHeight: "1.7", marginBottom: "8px" }} className="markdown-body">
          <ReactMarkdown>{part}</ReactMarkdown>
        </div>
      );
    }
  });
  return <div>{blocks}</div>;
}

function ToolLinksResponse({ url, t, icon, label }) {
  let data = null;
  const [copied, setCopied] = useState(false);
  try { data = JSON.parse(url); } catch {}
  if (!data || !data.tools) return null;
  const copyPrompt = () => { navigator.clipboard.writeText(data.prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ fontSize: "13px", color: t.textMuted, marginBottom: "10px" }}>
        {label} requires a browser tool. Copy the prompt and paste it into any tool below:
      </div>
      <div onClick={copyPrompt} title="Click to copy prompt"
        style={{ fontSize: "12px", fontFamily: "monospace", color: t.accent, background: t.accentBg, border: "1px solid " + t.accentBorder, borderRadius: "6px", padding: "8px 10px", marginBottom: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ flex: 1 }}>"{data.prompt}"</span>
        <span style={{ fontSize: "11px", color: copied ? "#22c55e" : t.accent, flexShrink: 0, fontWeight: 500 }}>{copied ? "✓ copied!" : "click to copy"}</span>
      </div>
      <div style={{ fontSize: "11px", color: t.textDimmer, marginBottom: "10px" }}>Then open one of these free tools:</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {data.tools.map((tool, i) => (
          <a key={i} href={tool.url} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: t.surface2, border: "1px solid " + t.border, borderRadius: "8px", textDecoration: "none", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
            <div>
              <div style={{ fontSize: "13px", color: t.text, fontWeight: 500 }}>{tool.name}</div>
              <div style={{ fontSize: "11px", color: t.textMuted }}>{tool.note}</div>
            </div>
            <span style={{ fontSize: "12px", color: t.accent }}>Open ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}



function VideoResponse({ url, t }) {
  return <ToolLinksResponse url={url} t={t} label="Video generation" />;
}

function TextAudioButton({ response, t }) {
  const [playing, setPlaying] = useState(false);
  const utterRef = useRef(null);

  const toggle = () => {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const utter = new SpeechSynthesisUtterance(response.replace(/[#*`>]/g, ""));
    utter.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const eng = voices.find(v => v.lang.startsWith("en") && v.name.includes("Natural"))
      || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (eng) utter.voice = eng;
    utter.onend = () => setPlaying(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setPlaying(true);
  };

  useEffect(() => () => window.speechSynthesis.cancel(), []);

  if (!("speechSynthesis" in window)) return null;

  return (
    <button onClick={toggle} style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "10px", padding: "5px 12px", background: "transparent", border: "1px solid " + (playing ? t.pink + "55" : t.border), borderRadius: "6px", color: playing ? t.pink : t.textDim, fontSize: "12px", cursor: "pointer", transition: "all 0.15s", fontFamily: "monospace" }}>
      {playing ? "⏹ stop" : "▶ listen"}
    </button>
  );
}

function ModalityBadge({ type, t }) {
  const m = MODALITY_META[type] || MODALITY_META.text;
  return (
    <span style={{ fontSize: "10px", fontFamily: "monospace", color: m.color, background: m.bg, border: `1px solid ${m.border}`, borderRadius: "4px", padding: "2px 6px", letterSpacing: "0.04em" }}>
      {m.icon} {m.label}
    </span>
  );
}

// rank and label are passed from parent based on position among all scored cards
function ScoreBar({ score, rank, totalRanked, t }) {
  const [showDetail, setShowDetail] = useState(false);
  if (!score) return null;

  // Rank label — relative within this run only
  const getRankInfo = () => {
    if (!rank || !totalRanked) return null;
    if (totalRanked === 1) return { label: "Only result", color: t.accent, bg: t.accentBg, border: t.accentBorder };
    if (rank === 1) return { label: "Best", color: "#00e5a0", bg: "#00e5a018", border: "#00e5a040" };
    if (rank === 2 && totalRanked >= 3) return { label: "Good", color: "#6366f1", bg: "#6366f118", border: "#6366f140" };
    if (rank === totalRanked) return { label: "Weakest", color: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b40" };
    return { label: `#${rank} of ${totalRanked}`, color: t.textMuted, bg: t.surface2, border: t.border };
  };

  const rankInfo = getRankInfo();

  const dims = [
    { key: "relevance",          label: "Relevance",  icon: "◎" },
    { key: "depth",              label: "Depth",      icon: "◈" },
    { key: "clarity",            label: "Clarity",    icon: "◻" },
    { key: "accuracy",           label: "Accuracy",   icon: "◆" },
    { key: "technique_fidelity", label: "Technique",  icon: "⟳" },
  ].filter(d => score[d.key] !== undefined);

  // Convert score to qualitative label
  const dimLabel = v => v >= 80 ? "Strong" : v >= 60 ? "Good" : "Weak";
  const dimColor = v => v >= 80 ? "#00e5a0" : v >= 60 ? "#6366f1" : "#f59e0b";

  return (
    <div style={{ borderTop: `1px solid ${t.border}`, background: t.surface2 }}>
      {/* Summary row */}
      <div onClick={() => setShowDetail(v => !v)} style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>


        {/* Rank badge instead of number */}
        {rankInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: rankInfo.color, background: rankInfo.bg, border: `1px solid ${rankInfo.border}`, borderRadius: "5px", padding: "2px 8px", fontFamily: "'Syne',sans-serif" }}>
              {rankInfo.label}
            </span>
            <span style={{ fontSize: "10px", color: t.textDimmer }}>{showDetail ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {/* Expanded detail — qualitative labels, no numbers */}
      {showDetail && (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${t.border}` }}>
          {/* Strengths and weaknesses */}
          {score.strength && (
            <div style={{ marginBottom: "8px", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "11px", color: "#00e5a0", flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: "11px", color: t.textMuted, lineHeight: "1.5" }}>{score.strength}</span>
            </div>
          )}
          {score.verdict && (
            <div style={{ marginBottom: "10px", display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "11px", color: "#f59e0b", flexShrink: 0 }}>△</span>
              <span style={{ fontSize: "11px", color: t.textMuted, lineHeight: "1.5" }}>{score.verdict}</span>
            </div>
          )}
          {/* Dimension qualitative breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
            {dims.map(({ key, label, icon }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", background: t.surface, borderRadius: "6px", border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: "10px", color: t.textDim }}>{icon}</span>
                <span style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", flex: 1 }}>{label}</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: dimColor(score[key]), fontFamily: "monospace" }}>{dimLabel(score[key])}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "8px", fontSize: "10px", color: t.textDimmer, fontFamily: "monospace", textAlign: "center" }}>
            Rankings are relative to this run only
          </div>
        </div>
      )}
    </div>
  );
}

function CardFooter({ tech, t, words, copied, onCopy, readTime, tokens }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace" }}>~{words}w · {readTime}m</span>
        {tokens && (
          <>
            <span style={{ fontSize: "10px", color: t.textDimmer }}>|</span>
            <span style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace" }}
              title={"Prompt: " + tokens.prompt + " tokens | Completion: " + tokens.completion + " tokens | Total: " + tokens.total}>
              {tokens.completion.toLocaleString()}↑ / {tokens.total.toLocaleString()} tok
            </span>
            <span style={{ fontSize: "11px", color: tokens.cost_usd < 0.001 ? "#22c55e" : tokens.cost_usd < 0.005 ? "#f59e0b" : "#ef4444", fontFamily: "monospace", fontWeight: 600 }} title="Estimated API cost (hover for token breakdown)">
              ~${tokens.cost_usd < 0.001 ? "<0.001" : tokens.cost_usd.toFixed(4)}
            </span>
          </>
        )}
      </div>
      <button onClick={onCopy} style={{ fontSize: "11px", color: copied ? "#22c55e" : t.textMuted, background: "transparent", border: `1px solid ${copied ? "#22c55e33" : t.border}`, borderRadius: "6px", padding: "3px 10px", cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s" }}>
        {copied ? "✓ copied" : "copy"}
      </button>
    </div>
  );
}

export function MasonryCard(props)      { return <UnifiedCard {...props} layout="masonry" />; }
export function EqualHeightCard(props)  { return <UnifiedCard {...props} layout="equal" />; }
export function AccordionCard(props)    { return <UnifiedCard {...props} layout="accordion" />; }

function UnifiedCard({ technique, response, responseType, isLoading, error, formattedPrompt, showFormatted, layout, cardHeight, maxWords, isExpanded, onToggle, tokens, score, isTop, rank, totalRanked }) {
  const tech = TECHNIQUES[technique];
  const [copied, setCopied] = useState(false);
  const { dark } = useTheme();
  const t = getTheme(dark);
  const words    = response ? response.replace(/[#*`]/g, "").split(/\s+/).filter(Boolean).length : 0;
  const readTime = Math.max(1, Math.round(words / 200));
  const copy     = () => { navigator.clipboard.writeText(response || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const type     = responseType || "text";

  const bodyContent = (
    <>
      {showFormatted && formattedPrompt && (
        <div style={{ marginBottom: "10px", padding: "8px 10px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "6px", fontSize: "11px", fontFamily: "monospace", color: t.textDim, whiteSpace: "pre-wrap", maxHeight: "60px", overflowY: "auto" }}>
          <span style={{ color: t.accent }}>prompt: </span>{formattedPrompt}
        </div>
      )}
      {isLoading && !response && (
        <div style={{ color: t.textMuted, fontSize: "13px", display: "flex", gap: "8px", alignItems: "center", padding: "8px 0" }}>
          <span style={{ display: "inline-block", animation: "pf-spin 1s linear infinite" }}>⟳</span>
          <span style={{ color: t.accent }}>Generating{type !== "text" ? ` ${type}` : ""}...</span>
        </div>
      )}
      {error && <div style={{ color: "#ef4444", fontSize: "13px", fontFamily: "monospace" }}>⚠ {error}</div>}
      {response && type === "image"      && <ToolLinksResponse url={response} t={t} label="Image generation" />}
      {response && type === "video"      && <VideoResponse url={response} t={t} />}
      {response && type === "audio"      && <ToolLinksResponse url={response} t={t} label="Audio generation" />}
      {response && type === "audio_file" && <ToolLinksResponse url={response} t={t} label="Audio generation" />}
      {response && type === "code"       && <CodeResponse  response={response} t={t} />}
      {response && type === "text"  && (
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ color: t.text, fontSize: "14px", lineHeight: "1.7", wordBreak: "break-word" }} className="markdown-body">
            <ReactMarkdown>{response}</ReactMarkdown>
            {isLoading && <span style={{ color: t.accent, animation: "pf-blink 1s infinite" }}>▌</span>}
          </div>
          {!isLoading && <TextAudioButton response={response} t={t} />}
        </div>
      )}
    </>
  );

  const showFooter = response && !isLoading && (type === "text" || type === "code");

  if (layout === "accordion") {
    return (
      <div style={{ background: t.surface, border: `1px solid ${isExpanded ? t.border2 : t.border}`, borderRadius: "10px", overflow: "hidden", transition: "all 0.2s" }}>
        <div onClick={onToggle} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", background: isExpanded ? t.surface2 : "transparent", userSelect: "none" }}>
          <span style={{ fontSize: "14px" }}>{tech.icon}</span>
          <span style={{ fontFamily: "monospace", color: t.text, fontSize: "13px", fontWeight: 600, flex: 1 }}>{tech.label}</span>
          {isTop && <span style={{ fontSize: "10px", background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: "4px", padding: "1px 6px", fontFamily: "monospace" }}>★ BEST</span>}
          {!isExpanded && response && <span style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace" }}>~{words}w</span>}
          {responseType && !isExpanded && <ModalityBadge type={type} t={t} />}
          {isLoading && <span style={{ color: t.accent, fontSize: "11px", fontFamily: "monospace" }}>generating...</span>}
          <span style={{ color: t.textMuted, fontSize: "12px", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
        </div>
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${t.border}` }}>
            <div style={{ padding: "14px 16px" }}>{bodyContent}</div>
            <ScoreBar score={score} rank={rank} totalRanked={totalRanked} t={t} />
            {showFooter && <div style={{ padding: "8px 16px", borderTop: `1px solid ${t.border}`, background: t.surface2 }}><CardFooter tech={tech} t={t} words={words} copied={copied} onCopy={copy} readTime={readTime} tokens={tokens} /></div>}
          </div>
        )}
      </div>
    );
  }

  const isSparse = layout === "equal" && maxWords > 0 && words / maxWords < 0.4 && response && !isLoading && (type === "text" || type === "code");

  return (
    <div className="pf-card" style={{ background: t.surface, border: `1px solid ${isTop ? "#00e5a0" : t.border}`, borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0, boxShadow: isTop ? "0 0 0 2px #00e5a022, 0 4px 20px #00e5a011" : "0 1px 4px rgba(0,0,0,0.06)", ...(layout === "equal" && window.innerWidth > 640 ? { height: `${cardHeight}px` } : {}) }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: "8px", background: t.surface2, flexShrink: 0 }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: `${tech.color || "#6366f1"}18`, border: `1px solid ${tech.color || "#6366f1"}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>{tech.icon}</div>
        <span style={{ fontFamily: "'Syne', sans-serif", color: t.text, fontWeight: 600, fontSize: "12px" }}>{tech.label}</span>
        {isTop && <span style={{ fontSize: "9px", background: "#00e5a018", color: "#00e5a0", border: "1px solid #00e5a040", borderRadius: "4px", padding: "1px 6px", fontFamily: "monospace", fontWeight: 700 }}>★ BEST</span>}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          {responseType && <ModalityBadge type={type} t={t} />}
        </div>
      </div>

      <div style={{ flex: 1, padding: "14px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {bodyContent}
      </div>

      {isSparse && (
        <div style={{ margin: "0 14px 10px", borderRadius: "8px", background: t.surface2, border: `1px solid ${t.border}`, padding: "12px", flexShrink: 0 }}>
          <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "8px", letterSpacing: "0.06em" }}>RESPONSE STATS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            {[{ label: "Words", value: words }, { label: "Sentences", value: Math.max(1, Math.round(words / 15)) }, { label: "Read", value: `${readTime}m` }].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 600, color: t.accent, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: "10px", color: t.textDim }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "10px", color: t.textDim, marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
            <span>Density</span><span style={{ color: t.accent }}>{Math.round((words / maxWords) * 100)}%</span>
          </div>
          <div style={{ height: "3px", background: t.border, borderRadius: "2px" }}>
            <div style={{ height: "100%", width: `${(words / maxWords) * 100}%`, background: t.accent, borderRadius: "2px" }} />
          </div>
        </div>
      )}

      <ScoreBar score={score} rank={rank} totalRanked={totalRanked} t={t} />
      {showFooter && (
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${t.border}`, background: t.surface2, flexShrink: 0 }}>
          <CardFooter tech={tech} t={t} words={words} copied={copied} onCopy={copy} readTime={readTime} tokens={tokens} />
        </div>
      )}
    </div>
  );
}

export default UnifiedCard;

// ── DIFF VIEWER ────────────────────────────────────────────────────────────────
export function DiffViewer({ responses, selectedTechniques, t }) {
  const [base, setBase]       = useState(selectedTechniques[0] || "");
  const [compare, setCompare] = useState(selectedTechniques[1] || "");

  const textIds = selectedTechniques.filter(id =>
    responses[id] && typeof responses[id] === "string" && responses[id].length > 10
  );

  if (textIds.length < 2) return (
    <div style={{ padding: "60px", textAlign: "center", color: t.textMuted, fontSize: "13px" }}>
      <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚡</div>
      <div style={{ fontWeight: 500, color: t.text, marginBottom: "6px" }}>Run at least 2 techniques first</div>
      <div>Go to Playground, run a prompt with multiple techniques, then come back here to compare.</div>
    </div>
  );

  // Simple word-level diff
  function computeDiff(textA, textB) {
    const wordsA = textA.split(/(\s+)/);
    const wordsB = textB.split(/(\s+)/);
    const result = [];
    const len = Math.max(wordsA.length, wordsB.length);
    for (let i = 0; i < len; i++) {
      const a = wordsA[i], b = wordsB[i];
      if (a === b)        result.push({ type: "same",    text: a || "" });
      else if (!b)        result.push({ type: "removed", text: a });
      else if (!a)        result.push({ type: "added",   text: b });
      else { result.push({ type: "removed", text: a }); result.push({ type: "added", text: b }); }
    }
    return result;
  }

  const baseText    = responses[base]    || "";
  const compareText = responses[compare] || "";
  const diff        = base && compare && baseText && compareText ? computeDiff(baseText, compareText) : [];
  const added       = diff.filter(d => d.type === "added").length;
  const removed     = diff.filter(d => d.type === "removed").length;
  const same        = diff.filter(d => d.type === "same").length;
  const similarity  = diff.length > 0 ? Math.round((same / diff.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        {[{ key: "base", val: base, set: setBase, label: "BASE" }, { key: "cmp", val: compare, set: setCompare, label: "COMPARE" }].map(({ key, val, set, label }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: t.textMuted, fontFamily: "monospace" }}>{label}</span>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ padding: "5px 10px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "6px", color: t.text, fontSize: "12px", fontFamily: "monospace", cursor: "pointer" }}>
              {textIds.map(id => <option key={id} value={id}>{TECHNIQUES[id]?.icon} {TECHNIQUES[id]?.label}</option>)}
            </select>
          </div>
        ))}
        <span style={{ color: t.textDim, fontSize: "16px" }}>↔</span>
        {diff.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "12px", fontSize: "11px", fontFamily: "monospace" }}>
            <span style={{ color: "#22c55e" }}>+{added} added</span>
            <span style={{ color: "#ef4444" }}>−{removed} removed</span>
            <span style={{ color: t.textMuted }}>{similarity}% similar</span>
          </div>
        )}
      </div>

      {/* Inline diff */}
      {diff.length > 0 && (
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "16px", fontSize: "13px", lineHeight: "1.9", overflowY: "auto", maxHeight: "400px" }}>
          {diff.map((d, i) => (
            <span key={i} style={{
              background:     d.type === "added" ? "#22c55e22" : d.type === "removed" ? "#ef444422" : "transparent",
              color:          d.type === "added" ? "#22c55e"   : d.type === "removed" ? "#ef4444"   : t.text,
              textDecoration: d.type === "removed" ? "line-through" : "none",
              borderRadius: "2px",
              padding: d.type !== "same" ? "0 1px" : 0,
            }}>{d.text}</span>
          ))}
        </div>
      )}

      {/* Side by side */}
      {base && compare && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[{ id: base, label: "BASE" }, { id: compare, label: "COMPARE" }].map(({ id, label }) => (
            <div key={id}>
              <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "5px" }}>
                {label} — {TECHNIQUES[id]?.icon} {TECHNIQUES[id]?.label}
              </div>
              <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "12px 14px", fontSize: "12px", color: t.text, lineHeight: "1.6", maxHeight: "280px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                {responses[id]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
