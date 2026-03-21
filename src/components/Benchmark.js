import { useState } from "react";
import { TECHNIQUES } from "../data/techniques";

const BENCHMARK_QUESTIONS = [
  // Reasoning
  { id: "r1", category: "Reasoning", difficulty: "Medium",
    question: "A bat and ball cost $1.10 total. The bat costs $1 more than the ball. How much does the ball cost?",
    answer: "5 cents", keywords: ["5 cents", "$0.05", "five cents"] },
  { id: "r2", category: "Reasoning", difficulty: "Hard",
    question: "If all Bloops are Razzles, and all Razzles are Lazzles, are all Bloops definitely Lazzles?",
    answer: "Yes", keywords: ["yes", "definitely", "all bloops are lazzles"] },
  { id: "r3", category: "Reasoning", difficulty: "Medium",
    question: "A farmer has 17 sheep. All but 9 die. How many are left?",
    answer: "9", keywords: ["9", "nine"] },
  { id: "r4", category: "Reasoning", difficulty: "Hard",
    question: "You have two ropes, each burns in exactly 1 hour but not uniformly. How do you measure 45 minutes?",
    answer: "Light both ends of rope 1 and one end of rope 2. When rope 1 burns out (30 min), light the other end of rope 2. When rope 2 burns out, 45 minutes have passed.",
    keywords: ["both ends", "30", "other end", "45"] },

  // ML/AI Knowledge
  { id: "m1", category: "ML/AI", difficulty: "Easy",
    question: "What does the 'learning rate' control in gradient descent?",
    answer: "Step size", keywords: ["step size", "how much", "how far", "update", "step"] },
  { id: "m2", category: "ML/AI", difficulty: "Medium",
    question: "What is the vanishing gradient problem and which architecture largely solved it for sequences?",
    answer: "Gradients become very small during backpropagation. LSTM/Transformer solved it.",
    keywords: ["gradient", "small", "lstm", "transformer", "vanish"] },
  { id: "m3", category: "ML/AI", difficulty: "Hard",
    question: "Explain the difference between bagging and boosting in ensemble methods.",
    answer: "Bagging trains models in parallel on random subsets (reduces variance). Boosting trains sequentially, each correcting the previous (reduces bias).",
    keywords: ["parallel", "sequential", "variance", "bias", "random"] },
  { id: "m4", category: "ML/AI", difficulty: "Medium",
    question: "What is the purpose of dropout regularization in neural networks?",
    answer: "Prevents overfitting by randomly deactivating neurons during training.",
    keywords: ["overfit", "random", "deactivat", "regulariz"] },

  // Coding
  { id: "c1", category: "Coding", difficulty: "Easy",
    question: "What is the time complexity of binary search?",
    answer: "O(log n)", keywords: ["o(log n)", "log n", "logarithmic"] },
  { id: "c2", category: "Coding", difficulty: "Medium",
    question: "What is a closure in JavaScript? Give a simple example.",
    answer: "A function that retains access to its outer scope's variables even after the outer function returns.",
    keywords: ["scope", "outer", "access", "variable", "return"] },
  { id: "c3", category: "Coding", difficulty: "Hard",
    question: "Explain the CAP theorem and what it means for distributed systems.",
    answer: "Consistency, Availability, Partition tolerance — you can only guarantee two of three.",
    keywords: ["consistency", "availability", "partition", "two", "three"] },
  { id: "c4", category: "Coding", difficulty: "Easy",
    question: "What is the difference between == and === in JavaScript?",
    answer: "== allows type coercion, === requires same type and value (strict equality).",
    keywords: ["type", "strict", "coercion", "coerce"] },

  // General Knowledge
  { id: "g1", category: "General", difficulty: "Easy",
    question: "What does API stand for and what is its purpose?",
    answer: "Application Programming Interface — allows software to communicate with other software.",
    keywords: ["application programming interface", "communicate", "software", "interface"] },
  { id: "g2", category: "General", difficulty: "Medium",
    question: "Explain the difference between supervised and unsupervised learning.",
    answer: "Supervised uses labeled data to learn mappings. Unsupervised finds patterns in unlabeled data.",
    keywords: ["label", "unlabel", "pattern", "supervised", "unsupervised"] },
  { id: "g3", category: "General", difficulty: "Hard",
    question: "What is the difference between a process and a thread?",
    answer: "A process has its own memory space. Threads share memory within a process and are lighter.",
    keywords: ["memory", "share", "lighter", "process", "thread"] },
];

function scoreAnswer(response, question) {
  const text = response.toLowerCase();
  const hits = question.keywords.filter(kw => text.includes(kw.toLowerCase()));
  const ratio = hits.length / question.keywords.length;
  if (ratio >= 0.6) return "correct";
  if (ratio >= 0.3) return "partial";
  return "incorrect";
}

const STATUS_STYLE = {
  correct:   { bg: "#22c55e18", border: "#22c55e44", color: "#22c55e", label: "✓ Correct" },
  partial:   { bg: "#f59e0b18", border: "#f59e0b44", color: "#f59e0b", label: "~ Partial" },
  incorrect: { bg: "#ef444418", border: "#ef444444", color: "#ef4444", label: "✗ Incorrect" },
  pending:   { bg: "transparent", border: "transparent", color: "#888", label: "—" },
};

export default function BenchmarkPanel({ temperature, maxTokens, model, t }) {
  const [selectedTechs, setSelectedTechs]   = useState(["zero_shot", "chain_of_thought"]);
  const [selectedCats,  setSelectedCats]    = useState(["Reasoning", "ML/AI", "Coding", "General"]);
  const [running, setRunning]               = useState(false);
  const [results, setResults]               = useState(null);
  const [progress, setProgress]             = useState({ done: 0, total: 0 });

  const categories = [...new Set(BENCHMARK_QUESTIONS.map(q => q.category))];
  const filteredQs = BENCHMARK_QUESTIONS.filter(q => selectedCats.includes(q.category));

  const toggleTech = id => setSelectedTechs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleCat  = c  => setSelectedCats(p  => p.includes(c)  ? p.filter(x => x !== c)  : [...p, c]);

  const runBenchmark = async () => {
    if (!selectedTechs.length || !filteredQs.length) return;
    setRunning(true);
    const total = selectedTechs.length * filteredQs.length;
    setProgress({ done: 0, total });

    const res = {}; // { techId: { qId: { response, verdict } } }
    selectedTechs.forEach(t => { res[t] = {}; });

    for (const tech of selectedTechs) {
      const techObj = TECHNIQUES[tech];
      const sysPrompt = typeof techObj.systemPrompt === "function" ? techObj.systemPrompt() : techObj.systemPrompt;

      for (const q of filteredQs) {
        const formatted = techObj.format ? techObj.format(q.question) : q.question;
        try {
          const resp = await fetch("http://localhost:5000/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model, system: sysPrompt, intent: "text",
              max_tokens: 300, temperature: 0.1, // low temp for factual answers
              messages: [{ role: "user", content: formatted }],
            }),
          });
          let responseText = "";
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
            for (const line of lines) {
              const d = line.slice(6);
              if (d === "[DONE]") continue;
              try { responseText += JSON.parse(d)?.delta?.text || ""; } catch {}
            }
          }
          const verdict = scoreAnswer(responseText, q);
          res[tech][q.id] = { response: responseText, verdict };
        } catch (e) {
          res[tech][q.id] = { response: "", verdict: "incorrect" };
        }
        setProgress(p => ({ ...p, done: p.done + 1 }));
      }
    }
    setResults(res);
    setRunning(false);
  };

  // Compute summary stats
  const summary = results ? selectedTechs.map(tid => {
    const techRes = results[tid] || {};
    const qs = filteredQs;
    const correct = qs.filter(q => techRes[q.id]?.verdict === "correct").length;
    const partial = qs.filter(q => techRes[q.id]?.verdict === "partial").length;
    const score   = Math.round(((correct + partial * 0.5) / qs.length) * 100);
    const byDiff  = { Easy: 0, Medium: 0, Hard: 0 };
    const byDiffTotal = { Easy: 0, Medium: 0, Hard: 0 };
    qs.forEach(q => {
      byDiffTotal[q.difficulty]++;
      if (techRes[q.id]?.verdict === "correct") byDiff[q.difficulty]++;
      else if (techRes[q.id]?.verdict === "partial") byDiff[q.difficulty] += 0.5;
    });
    return { tid, label: TECHNIQUES[tid]?.label, icon: TECHNIQUES[tid]?.icon, color: TECHNIQUES[tid]?.color, correct, partial, score, byDiff, byDiffTotal };
  }).sort((a, b) => b.score - a.score) : [];

  const scoreColor = s => s >= 75 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ padding: "24px", maxWidth: "960px", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Config */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "20px" }}>
        <div style={{ fontSize: "12px", color: t.textMuted, fontFamily: "monospace", marginBottom: "16px" }}>BENCHMARK SETTINGS</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "8px" }}>TECHNIQUES TO TEST</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {Object.values(TECHNIQUES).filter(tc => !["custom"].includes(tc.id)).map(tc => (
                <button key={tc.id} onClick={() => toggleTech(tc.id)} style={{ padding: "4px 9px", fontSize: "11px", fontFamily: "monospace", background: selectedTechs.includes(tc.id) ? tc.color + "22" : "transparent", color: selectedTechs.includes(tc.id) ? tc.color : t.textMuted, border: `1px solid ${selectedTechs.includes(tc.id) ? tc.color + "55" : t.border}`, borderRadius: "5px", cursor: "pointer", transition: "all 0.15s" }}>
                  {tc.icon} {tc.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: t.textDim, fontFamily: "monospace", marginBottom: "8px" }}>QUESTION CATEGORIES</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
              {categories.map(c => (
                <button key={c} onClick={() => toggleCat(c)} style={{ padding: "4px 12px", fontSize: "11px", fontFamily: "monospace", background: selectedCats.includes(c) ? t.accentBg : "transparent", color: selectedCats.includes(c) ? t.accent : t.textMuted, border: `1px solid ${selectedCats.includes(c) ? t.accentBorder : t.border}`, borderRadius: "5px", cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "11px", color: t.textDim }}>
              {filteredQs.length} questions · {selectedTechs.length} techniques · {filteredQs.length * selectedTechs.length} total runs
            </div>
          </div>
        </div>

        <button onClick={runBenchmark} disabled={running || !selectedTechs.length}
          style={{ width: "100%", padding: "10px", background: running ? t.surface2 : t.accent, border: "none", color: running ? t.textMuted : "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: running ? "not-allowed" : "pointer", fontFamily: "monospace" }}>
          {running ? `⟳ Running… ${progress.done}/${progress.total} answers` : `🏆 Run Benchmark — ${filteredQs.length * selectedTechs.length} questions`}
        </button>
        {running && (
          <div style={{ marginTop: "8px", height: "4px", background: t.border, borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.total ? (progress.done/progress.total)*100 : 0}%`, background: t.accent, transition: "width 0.3s ease", borderRadius: "2px" }} />
          </div>
        )}
      </div>

      {/* Results */}
      {results && summary.length > 0 && (
        <>
          {/* Leaderboard */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, fontSize: "12px", color: t.textMuted, fontFamily: "monospace" }}>
              LEADERBOARD — {filteredQs.length} questions across {selectedCats.join(", ")}
            </div>
            {summary.map((s, i) => (
              <div key={s.tid} style={{ padding: "12px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: "14px", background: i === 0 ? "#22c55e06" : "transparent" }}>
                <div style={{ fontSize: "18px", width: "28px", textAlign: "center", fontWeight: 700, color: i === 0 ? "#22c55e" : i === 1 ? "#f59e0b" : t.textMuted, fontFamily: "monospace" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                </div>
                <div style={{ fontSize: "14px" }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: t.text, fontFamily: "monospace" }}>{s.label}</div>
                  <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "2px" }}>
                    {s.correct} correct · {s.partial} partial · {filteredQs.length - s.correct - s.partial} incorrect
                  </div>
                </div>
                {/* Difficulty breakdown */}
                <div style={{ display: "flex", gap: "10px" }}>
                  {["Easy","Medium","Hard"].map(d => (
                    <div key={d} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: scoreColor(s.byDiffTotal[d] ? Math.round(s.byDiff[d]/s.byDiffTotal[d]*100) : 0), fontFamily: "monospace" }}>
                        {s.byDiffTotal[d] ? Math.round(s.byDiff[d]/s.byDiffTotal[d]*100) : 0}%
                      </div>
                      <div style={{ fontSize: "9px", color: t.textDimmer, fontFamily: "monospace" }}>{d}</div>
                    </div>
                  ))}
                </div>
                {/* Score bar */}
                <div style={{ width: "120px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace" }}>accuracy</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: scoreColor(s.score), fontFamily: "monospace" }}>{s.score}%</span>
                  </div>
                  <div style={{ height: "6px", background: t.border, borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.score}%`, background: scoreColor(s.score), borderRadius: "3px", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Question detail grid */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, fontSize: "12px", color: t.textMuted, fontFamily: "monospace" }}>
              QUESTION-BY-QUESTION BREAKDOWN
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: t.surface2 }}>
                    <th style={{ padding: "8px 14px", textAlign: "left", color: t.textMuted, fontFamily: "monospace", fontWeight: 500, fontSize: "11px", minWidth: "200px" }}>Question</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", color: t.textMuted, fontFamily: "monospace", fontWeight: 500, fontSize: "11px" }}>Diff</th>
                    {summary.map(s => (
                      <th key={s.tid} style={{ padding: "8px 10px", textAlign: "center", color: s.color, fontFamily: "monospace", fontWeight: 500, fontSize: "11px", minWidth: "80px" }}>
                        {s.icon} {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredQs.map((q, qi) => (
                    <tr key={q.id} style={{ borderTop: `1px solid ${t.border}`, background: qi % 2 === 0 ? "transparent" : t.surface2 + "44" }}>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ fontSize: "11px", color: t.textMuted, fontFamily: "monospace", marginBottom: "2px" }}>{q.category}</div>
                        <div style={{ fontSize: "12px", color: t.text, lineHeight: "1.4" }}>{q.question.length > 80 ? q.question.slice(0,80)+"…" : q.question}</div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace", background: q.difficulty === "Easy" ? "#22c55e18" : q.difficulty === "Medium" ? "#f59e0b18" : "#ef444418", color: q.difficulty === "Easy" ? "#22c55e" : q.difficulty === "Medium" ? "#f59e0b" : "#ef4444" }}>
                          {q.difficulty}
                        </span>
                      </td>
                      {summary.map(s => {
                        const verdict = results[s.tid]?.[q.id]?.verdict || "pending";
                        const st = STATUS_STYLE[verdict];
                        return (
                          <td key={s.tid} style={{ padding: "8px 10px", textAlign: "center" }}>
                            <span title={results[s.tid]?.[q.id]?.response?.slice(0,200) || ""} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: st.bg, border: `1px solid ${st.border}`, color: st.color, fontFamily: "monospace", cursor: "help" }}>
                              {st.label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insight */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "16px 20px" }}>
            <div style={{ fontSize: "12px", color: t.textMuted, fontFamily: "monospace", marginBottom: "10px" }}>KEY INSIGHTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              {[
                { label: "Best overall", value: summary[0]?.label, sub: `${summary[0]?.score}% accuracy`, color: "#22c55e" },
                { label: "Best at Hard", value: summary.sort((a,b) => (b.byDiffTotal.Hard ? b.byDiff.Hard/b.byDiffTotal.Hard : 0) - (a.byDiffTotal.Hard ? a.byDiff.Hard/a.byDiffTotal.Hard : 0))[0]?.label, sub: "most hard questions correct", color: "#f59e0b" },
                { label: "Most consistent", value: summary.reduce((best, s) => { const gap = Math.max(s.byDiff.Easy||0,s.byDiff.Medium||0,s.byDiff.Hard||0) - Math.min(s.byDiff.Easy||0,s.byDiff.Medium||0,s.byDiff.Hard||0); const bestGap = Math.max(best.byDiff?.Easy||0,best.byDiff?.Medium||0,best.byDiff?.Hard||0) - Math.min(best.byDiff?.Easy||0,best.byDiff?.Medium||0,best.byDiff?.Hard||0); return gap < bestGap ? s : best; }, summary[0])?.label, sub: "least variance across difficulty", color: "#6366f1" },
              ].map(ins => (
                <div key={ins.label} style={{ background: t.surface2, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: "10px", color: t.textDim, fontFamily: "monospace", marginBottom: "4px" }}>{ins.label.toUpperCase()}</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: ins.color, fontFamily: "monospace" }}>{ins.value}</div>
                  <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "2px" }}>{ins.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
