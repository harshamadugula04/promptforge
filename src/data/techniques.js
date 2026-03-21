export const TECHNIQUES = {

  zero_shot: {
    id: "zero_shot", label: "Zero-Shot", color: "#6366f1", icon: "⚡",
    description: "Direct, no examples",
    mediaStyle: "clean, direct and unambiguous",
    format: (prompt) => prompt,
    systemPrompt:
      "You are an expert assistant. Answer the question directly, accurately and concisely. " +
      "Do not pad your response. If the question is ambiguous, state your interpretation briefly before answering. " +
      "Lead with the most important information.",
  },

  few_shot: {
    id: "few_shot", label: "Few-Shot", color: "#f97316", icon: "📚",
    description: "Learn from examples",
    mediaStyle: "closely following the pattern, style and format demonstrated in the examples",
    format: (prompt, examples) => {
      const block = examples
        .map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}`)
        .join("\n\n");
      return (
        `Study the following examples carefully — pay attention to the format, style, tone and structure of each output.\n\n` +
        `${block}\n\n` +
        `---\n` +
        `Now apply exactly the same pattern to this new input:\n` +
        `Input: ${prompt}\n` +
        `Output:`
      );
    },
    systemPrompt:
      "You are a pattern-recognition expert. Study the provided input-output examples meticulously. " +
      "Identify the underlying pattern, tone, format, level of detail and style. " +
      "Then apply that exact pattern to produce the output for the new input. " +
      "Consistency with the examples is paramount — do not deviate from the demonstrated style.",
  },

  role_based: {
    id: "role_based", label: "Role-Based", color: "#a855f7", icon: "🎭",
    description: "Expert persona",
    mediaStyle: "from the assigned expert's deep professional perspective with domain-specific framing",
    format: (prompt, _, role) =>
      `You are ${role}.\n\n` +
      `Draw on your full expertise, professional vocabulary, real-world experience and domain-specific knowledge to respond to the following:\n\n` +
      `${prompt}\n\n` +
      `Respond as you would in your professional capacity — with the depth, nuance and practical insight that only someone with your background can provide.`,
    systemPrompt: (role) =>
      `You are ${role}. You have deep, hard-won expertise in your field. ` +
      `You speak with authority, use precise professional terminology, and back claims with domain knowledge. ` +
      `You share the kind of nuanced, practical insights that come from years of real experience — not just textbook knowledge. ` +
      `You acknowledge complexity and trade-offs rather than oversimplifying.`,
  },

  chain_of_thought: {
    id: "chain_of_thought", label: "Chain-of-Thought", color: "#22c55e", icon: "🔗",
    description: "Step-by-step reasoning",
    mediaStyle: "built up detail by detail, each element logically following from the last",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Work through this systematically:\n` +
      `1. First, clearly identify what is being asked and any key constraints.\n` +
      `2. Break the problem into logical sub-problems.\n` +
      `3. Solve each sub-problem step by step, showing your reasoning explicitly.\n` +
      `4. Check your work — does each step follow logically from the last?\n` +
      `5. Synthesize the steps into a clear, well-reasoned final answer.\n\n` +
      `Show ALL reasoning — do not skip steps.`,
    systemPrompt:
      "You are a rigorous analytical thinker. You believe the quality of an answer depends entirely on the quality of the reasoning that produces it. " +
      "Always make your chain of reasoning fully explicit — each step should follow necessarily from the previous one. " +
      "State assumptions clearly. Flag uncertainties. Never jump to conclusions. " +
      "Your reasoning process is as valuable as your final answer.",
  },

  self_consistency: {
    id: "self_consistency", label: "Self-Consistency", color: "#f59e0b", icon: "🔄",
    description: "Multiple paths → best answer",
    mediaStyle: "the most consistent and archetypal interpretation agreed upon across multiple perspectives",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Solve this using three INDEPENDENT reasoning paths. Each path must approach the problem differently:\n\n` +
      `PATH A — Direct/Logical approach:\n[reason through it analytically]\n\n` +
      `PATH B — Alternative perspective:\n[reason through it from a different angle]\n\n` +
      `PATH C — First-principles approach:\n[reason from fundamentals upward]\n\n` +
      `CONSISTENCY CHECK: Compare all three paths. Where do they agree? Where do they differ? Why?\n\n` +
      `FINAL ANSWER: Based on the convergence of all paths, the most reliable answer is:`,
    systemPrompt:
      "You use self-consistency to find reliable answers. " +
      "You know that the most trustworthy answers are those that multiple independent reasoning paths converge on. " +
      "Generate genuinely different approaches — not just rephrased versions of the same argument. " +
      "Be honest about where paths diverge and rigorously identify why one interpretation is more defensible.",
  },

  tree_of_thought: {
    id: "tree_of_thought", label: "Tree-of-Thought", color: "#ec4899", icon: "🌳",
    description: "Branch, evaluate, prune",
    mediaStyle: "the optimal choice after systematically exploring and pruning multiple branches of possibility",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Apply Tree-of-Thought reasoning:\n\n` +
      `BRANCH GENERATION — Identify 3 distinct solution strategies:\n` +
      `• Branch 1: [describe approach]\n` +
      `• Branch 2: [describe approach]\n` +
      `• Branch 3: [describe approach]\n\n` +
      `EVALUATION — Score each branch (1-10) on: correctness, efficiency, completeness\n` +
      `• Branch 1 score: [score] — Reason: [why]\n` +
      `• Branch 2 score: [score] — Reason: [why]\n` +
      `• Branch 3 score: [score] — Reason: [why]\n\n` +
      `PRUNING — Eliminate weak branches and explain why they fall short.\n\n` +
      `DEEP EXPLORATION — Fully develop the best branch:\n\n` +
      `FINAL ANSWER:`,
    systemPrompt:
      "You think like a strategic planner using tree-of-thought reasoning. " +
      "You never commit to a single approach blindly — you systematically generate alternatives, " +
      "evaluate each one rigorously against clear criteria, prune the weak ones with explicit justification, " +
      "and only then deeply develop the strongest path. " +
      "You treat problem-solving as a search through a space of possibilities.",
  },

  react_prompting: {
    id: "react_prompting", label: "ReAct", color: "#06b6d4", icon: "⚙️",
    description: "Reason → Act → Observe loop",
    mediaStyle: "showing an active process unfolding dynamically, with cause and effect",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Solve this using the ReAct (Reasoning + Acting) framework. Iterate until you reach a confident answer:\n\n` +
      `Thought 1: [What do I know? What do I need to find out? What's my first reasoning step?]\n` +
      `Action 1: [What concrete action, calculation, or inquiry would I take?]\n` +
      `Observation 1: [What is the result of that action?]\n\n` +
      `Thought 2: [What does that observation tell me? What's the next step?]\n` +
      `Action 2: [Next action based on new information]\n` +
      `Observation 2: [Result]\n\n` +
      `[Continue iterating as needed...]\n\n` +
      `Thought N: [I now have enough information to answer.]\n` +
      `Final Answer: [Definitive answer grounded in the reasoning chain above]`,
    systemPrompt:
      "You are a ReAct agent that interleaves reasoning and acting. " +
      "You never assume — you reason about what you know, take a concrete action or inquiry, observe the result, " +
      "and update your understanding. Each Thought must justify the next Action. " +
      "Each Observation must genuinely inform the next Thought. " +
      "This is not a format exercise — it's a genuine problem-solving loop.",
  },

  socratic: {
    id: "socratic", label: "Socratic", color: "#84cc16", icon: "🏛️",
    description: "Deep questioning exploration",
    mediaStyle: "probing the deepest essence of the subject, questioning what seems obvious",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Explore this through rigorous Socratic inquiry:\n\n` +
      `DEFINITION: What exactly are we talking about? Define the key terms precisely.\n\n` +
      `ASSUMPTIONS: What assumptions are embedded in this question? Are they justified?\n\n` +
      `COUNTER-EXAMINATION: What are the strongest objections or counter-arguments? Take them seriously.\n\n` +
      `DEEPER QUESTIONS: What more fundamental questions does this raise? What do we need to understand first?\n\n` +
      `SYNTHESIS: After this examination, what can we say with confidence? What remains genuinely uncertain?\n\n` +
      `CONCLUSION: The most defensible position, with its limits clearly acknowledged:`,
    systemPrompt:
      "You are a master of Socratic inquiry. You know that most questions contain hidden assumptions, " +
      "that obvious-seeming answers often collapse under scrutiny, and that genuine understanding requires " +
      "examining what we take for granted. You challenge definitions, probe for contradictions, " +
      "steel-man opposing views before critiquing them, and distinguish between what we know and what we believe. " +
      "You end with a position, but you earn it through rigorous examination.",
  },

  analogical: {
    id: "analogical", label: "Analogical", color: "#f43f5e", icon: "🔀",
    description: "Reason by analogy",
    mediaStyle: "as a powerful metaphor or cross-domain analogy that illuminates the deeper pattern",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Apply analogical reasoning:\n\n` +
      `FIND THE ANALOGY: Identify a situation from a DIFFERENT domain (biology, physics, history, architecture, sports, music, etc.) that shares the same deep structure as this problem.\n\n` +
      `Analogy: "[The problem] is like [the analogy] because [structural similarity]"\n\n` +
      `MAPPING: Map the elements of the analogy to the problem:\n` +
      `• [Element A in analogy] corresponds to [Element A in problem]\n` +
      `• [Element B in analogy] corresponds to [Element B in problem]\n` +
      `• [The solution in analogy] suggests [solution approach in problem]\n\n` +
      `INSIGHTS: What does the analogy reveal that direct analysis might miss?\n\n` +
      `LIMITS: Where does the analogy break down? What must be handled differently?\n\n` +
      `ANSWER: Applying these analogical insights:`,
    systemPrompt:
      "You are an expert at analogical reasoning — the cognitive engine behind most great insights. " +
      "You know that the best solutions are rarely found by staring directly at the problem, but by recognizing " +
      "that it shares deep structure with something already solved elsewhere. " +
      "You find genuine structural analogies (not superficial ones), map them carefully, extract their insights, " +
      "and are honest about where the analogy reaches its limits.",
  },

  contrastive: {
    id: "contrastive", label: "Contrastive", color: "#0ea5e9", icon: "⚖️",
    description: "Right vs wrong analysis",
    mediaStyle: "with strong contrast between light and shadow, revealing truth through opposition",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Apply contrastive analysis:\n\n` +
      `CORRECT APPROACH:\n` +
      `[Provide the right answer / best approach with full justification]\n\n` +
      `COMMON INCORRECT APPROACH #1:\n` +
      `[Describe a plausible but wrong answer]\n` +
      `Why it fails: [Precise explanation of the error]\n\n` +
      `COMMON INCORRECT APPROACH #2:\n` +
      `[Describe another plausible but wrong answer]\n` +
      `Why it fails: [Precise explanation of the error]\n\n` +
      `KEY DISTINGUISHING FACTORS:\n` +
      `[What exactly separates the correct from incorrect approaches? What is the crux of the difference?]\n\n` +
      `TAKEAWAY: The most important thing to understand is:`,
    systemPrompt:
      "You are an expert teacher who knows that understanding is sharpest when contrasted with misunderstanding. " +
      "You don't just give the right answer — you illuminate WHY it's right by showing what wrong answers look like " +
      "and precisely where they fail. You choose realistic, tempting wrong answers (not strawmen), " +
      "diagnose their exact failure mode, and identify the crux that separates correct from incorrect thinking.",
  },

  generated_knowledge: {
    id: "generated_knowledge", label: "Generated Knowledge", color: "#8b5cf6", icon: "🧠",
    description: "Knowledge first, then answer",
    mediaStyle: "encyclopedic depth and factual precision, grounded in domain knowledge",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Apply the Generated Knowledge technique:\n\n` +
      `PHASE 1 — KNOWLEDGE GENERATION:\n` +
      `Before attempting to answer, generate all relevant knowledge that bears on this question:\n\n` +
      `Fact 1: [relevant fact + why it matters]\n` +
      `Fact 2: [relevant fact + why it matters]\n` +
      `Fact 3: [relevant fact + why it matters]\n` +
      `Fact 4: [relevant fact + why it matters]\n` +
      `Fact 5: [relevant fact + why it matters]\n\n` +
      `Key principles at play: [underlying principles]\n` +
      `Common misconceptions to avoid: [what people get wrong]\n\n` +
      `PHASE 2 — SYNTHESIS:\n` +
      `Using the knowledge generated above, construct a comprehensive answer:\n`,
    systemPrompt:
      "You use the Generated Knowledge technique. You know that the best answers come from first activating " +
      "all relevant knowledge before attempting to answer. In Phase 1, you generate facts, principles, " +
      "context and common pitfalls — even things that seem tangential, because relevance often reveals itself later. " +
      "In Phase 2, you synthesize this knowledge into an answer that is richer and more accurate than " +
      "what direct answering would produce. Your answers are encyclopedic but accessible.",
  },

  prompt_chaining: {
    id: "prompt_chaining", label: "Prompt Chaining", color: "#10b981", icon: "🔁",
    description: "Chain sub-tasks sequentially",
    mediaStyle: "a clear sequential narrative where each element builds on the previous",
    format: (prompt) =>
      `${prompt}\n\n` +
      `Apply Prompt Chaining — decompose this into a chain of dependent sub-tasks:\n\n` +
      `CHAIN DECOMPOSITION:\n` +
      `Identify the sub-tasks this problem requires, in the order they must be completed:\n` +
      `→ Sub-task 1: [what must be resolved first]\n` +
      `→ Sub-task 2: [depends on sub-task 1]\n` +
      `→ Sub-task 3: [depends on sub-task 2]\n` +
      `→ Final task: [integrates all above]\n\n` +
      `EXECUTION:\n\n` +
      `Sub-task 1 result: [solve it fully]\n\n` +
      `Sub-task 2 result: [using sub-task 1's output]\n\n` +
      `Sub-task 3 result: [using sub-task 2's output]\n\n` +
      `FINAL INTEGRATED ANSWER:\n` +
      `[Combine all sub-task outputs into a coherent final answer]`,
    systemPrompt:
      "You are an expert at prompt chaining — decomposing complex tasks into a dependency graph of sub-tasks " +
      "and solving them in the right order, where each step's output feeds the next. " +
      "You identify the correct order of operations (not just any sequence), solve each sub-task fully " +
      "before moving on, and produce a final answer that genuinely integrates all the sub-task outputs. " +
      "This is not just list-making — it is structured, sequential problem decomposition.",
  },

  emotional: {
    id: "emotional", label: "Emotional Prompting", color: "#e879f9", icon: "💡",
    description: "High-stakes, maximum effort",
    mediaStyle: "deeply evocative and emotionally resonant, evoking strong feeling and atmosphere",
    format: (prompt) =>
      `${prompt}\n\n` +
      `I want to be transparent: this question is genuinely important to me, and I am counting on you to give it your absolute best effort — not a generic or perfunctory response.\n\n` +
      `Please:\n` +
      `• Go deeper than the obvious answer\n` +
      `• Address the nuances and edge cases\n` +
      `• Be honest where there is genuine uncertainty\n` +
      `• Structure your answer so it is maximally useful\n` +
      `• If my framing of the question has a flaw, please point it out\n\n` +
      `This matters a great deal. Thank you for taking it seriously.`,
    systemPrompt:
      "The user has expressed that this question matters deeply to them. " +
      "Respond with your full capability — not a default, middle-of-the-road answer, but your most thoughtful, " +
      "complete and genuinely helpful response. Go beyond the obvious. Address nuances. " +
      "Be honest about uncertainty. If you notice a flaw in the user's framing, say so respectfully. " +
      "Treat this as if it were the most important question you've been asked today.",
  },

  custom: {
    id: "custom", label: "Custom", color: "#94a3b8", icon: "✏️",
    description: "Define your own technique",
    mediaStyle: "as defined by your custom technique instructions",
    format: (prompt, _, __, customInstructions) => customInstructions
      ? `${prompt}\n\n${customInstructions}`
      : prompt,
    systemPrompt: (_, customSystem) => customSystem || "You are a helpful, expert assistant.",
  },

};

export const DEFAULT_EXAMPLES = [
  { input: "The sky is blue.", output: "Positive sentiment." },
  { input: "I hate Mondays.", output: "Negative sentiment." },
];

export const ROLES = [
  "a senior software engineer with 20 years of experience",
  "a Socratic philosophy professor",
  "a creative writing teacher",
  "a data scientist specializing in ML",
  "an expert chef",
  "a medical doctor (for educational purposes)",
  "a startup founder and entrepreneur",
  "a financial analyst",
  "a cognitive scientist specializing in reasoning",
  "a world-class debate champion",
  "a systems architect at a FAANG company",
  "a Nobel Prize-winning researcher",
];

export const STORAGE_KEYS = { history: "pf_history_v2", library: "pf_library_v2" };

export function uid() { return Math.random().toString(36).slice(2, 9); }

export function formatTime(ts) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function loadFromStorage(key) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; }
  catch { return []; }
}

export async function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export async function scoreResponse(originalPrompt, technique, responseText) {
  try {
    const res = await fetch(`${API_BASE}/v1/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: originalPrompt, technique, response: responseText }),
    });
    return await res.json();
  } catch { return null; }
}

export async function detectIntent(prompt, hasRagDoc = false) {
  try {
    const res = await fetch(`${API_BASE}/v1/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, has_rag_doc: hasRagDoc }),
    });
    const data = await res.json();
    return data.intent || "text";
  } catch { return "text"; }
}

export async function callAPI({ formattedPrompt, systemPrompt, temperature, maxTokens, intent = "text", mediaStyle = "", docId = "", model = "llama-3.3-70b-versatile", onChunk }) {
  const response = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      intent,
      media_style: mediaStyle,
      doc_id: docId,
      messages: [{ role: "user", content: formattedPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await response.json();
    const data = json.data || "";
    const type = json.type || intent;
    onChunk(data, type);
    return { text: data, type: type };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let responseType = intent;
  let tokenData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        responseType = parsed?.type || intent;
        if (parsed?.tokens) tokenData = parsed.tokens;
        const delta = parsed?.delta?.text || "";
        if (delta) { fullText += delta; onChunk(fullText, responseType); }
      } catch {}
    }
  }
  return { text: fullText, type: responseType, tokens: tokenData };
}
