from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from groq import Groq
import json, re, urllib.parse, urllib.request, base64, random, time, math, io, os

# Load .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed — use system env vars (production)

app = Flask(__name__)
CORS(app, 
     origins="*",
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"],
     supports_credentials=False)

@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,Accept"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "PromptForge API"})

@app.route("/<path:path>", methods=["OPTIONS"])
def options_handler(path):
    response = jsonify({})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,Accept"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response, 200

# Load from environment — set these in Railway/Netlify dashboard
API_KEY  = os.environ.get("GROQ_API_KEY", "")
HF_TOKEN = os.environ.get("HF_API_KEY", "")

if not API_KEY:
    print("⚠️  WARNING: GROQ_API_KEY not set")

client = Groq(api_key=API_KEY)

IMAGE_KEYWORDS = r'\b(draw|paint|sketch|illustrate|render|visualize|picture|image|photo|artwork|logo|icon|poster|banner|portrait|landscape|scene|illustration)\b'
AUDIO_KEYWORDS = r'\b(say|speak|read|narrate|voice|audio|speech|tts|pronounce|recite|aloud|sound|noise|meow|bark|music|song|tone|hear|listen)\b'
AUDIO_CONTEXT  = r'(generate|create|make|produce).{0,20}(audio|sound|noise|music|meow|bark|song|tone|voice|speech|singing)'
CODE_KEYWORDS  = r'\b(code|program|script|function|class|algorithm|implement|debug|html|css|javascript|python|java|sql)\b'
VIDEO_KEYWORDS = r'\b(animate|animation|video|clip|motion|movie|gif|moving)\b'

PERSON_MAP = {
    "albert einstein": "an elderly white-haired physicist with a bushy mustache",
    "einstein":        "an elderly white-haired physicist with a bushy mustache",
    "newton":          "a 17th century scientist with long curly hair",
    "tesla":           "a tall thin inventor in a Victorian suit",
    "darwin":          "a bearded Victorian naturalist",
    "shakespeare":     "an Elizabethan writer with a ruff collar",
    "napoleon":        "a French military general in a bicorne hat",
    "lincoln":         "a tall man in a top hat and black suit with a beard",
    "gandhi":          "a thin elderly man in white dhoti with round glasses",
    "cleopatra":       "an ancient Egyptian queen in golden headdress",
    "da vinci":        "a Renaissance artist with a long beard",
    "picasso":         "a bold modern artist with intense dark eyes",
    "mozart":          "an 18th century musician in powdered wig",
    "beethoven":       "a brooding composer with wild dark hair",
}

def detect_intent(prompt: str, has_rag_doc: bool = False) -> str:
    """
    LLM-first intent classification using llama-3.1-8b-instant.
    No regex guessing — the LLM understands context and figurative language.
    Regex is emergency fallback only if Groq is unreachable.
    """
    p = prompt.lower().strip()

    rag_note = (
        "Note: User has an uploaded document/image open. "
        "Only classify as image/audio/video if they want NEW media CREATED, not analyzed.\n"
    ) if has_rag_doc else ""

    try:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify user prompts into ONE intent. Respond with ONE word only.\n"
                        "Categories:\n"
                        "  text  — questions, explanations, analysis, writing, advice, research, summaries\n"
                        "  code  — write/fix/explain/debug code, algorithms, scripts, programming\n"
                        "  image — explicitly CREATE/GENERATE/DRAW a NEW image, photo, artwork, logo\n"
                        "  audio — explicitly CREATE/GENERATE new audio, music, sound effects, speech\n"
                        "  video — explicitly CREATE/GENERATE/ANIMATE a new video or animation\n\n"
                        "CRITICAL RULES — these catch all edge cases:\n"
                        "  'illustrate' in context of explanation = text (not image)\n"
                        "  'picture this' / 'paint a picture of' (figurative) = text\n"
                        "  'visualize' when meaning 'understand' = text\n"
                        "  'show me how X works' = text\n"
                        "  'draw a comparison/parallel/conclusion' = text\n"
                        "  'render an opinion/judgment' = text\n"
                        "  Only image/audio/video if user wants actual media FILE created\n"
                        "  When in doubt = text\n\n"
                        "Examples:\n"
                        "  'explain ML with illustrations' → text\n"
                        "  'generate an image of a cat' → image\n"
                        "  'draw me a logo' → image\n"
                        "  'write a python sort' → code\n"
                        "  'what AI project should I do' → text\n"
                        "  'create a video of sunset' → video\n"
                        "  'make music for my game' → audio\n"
                        "  'provide real world examples to illustrate' → text"
                    )
                },
                {
                    "role": "user",
                    "content": f"{rag_note}Prompt: '{prompt[:300]}'"
                }
            ],
            temperature=0.0,
            max_tokens=3,
        )
        result = resp.choices[0].message.content.strip().lower().split()[0]
        if result in ("text", "code", "image", "audio", "video"):
            print(f"[INTENT] '{prompt[:60]}' → {result}")
            return result
        return "text"

    except Exception as e:
        # Emergency regex fallback — only fires if Groq API is down
        print(f"[INTENT] LLM unavailable ({type(e).__name__}), regex fallback")
        if re.search(CODE_KEYWORDS,  p, re.IGNORECASE): return "code"
        if re.search(VIDEO_KEYWORDS, p, re.IGNORECASE): return "video"
        if re.search(AUDIO_CONTEXT,  p, re.IGNORECASE): return "audio"
        if re.search(IMAGE_KEYWORDS, p, re.IGNORECASE): return "image"
        return "text"

# ── RAG IN-MEMORY STORE ────────────────────────────────────────────────────────
# RAG store — uses /tmp for persistence across gunicorn worker reloads
import pickle, pathlib

RAG_DIR = pathlib.Path("/tmp/rag_store")
RAG_DIR.mkdir(exist_ok=True)

rag_store = {}  # in-memory cache

def _rag_path(doc_id):
    return RAG_DIR / f"{doc_id}.pkl"

def rag_save(doc_id, doc):
    """Save doc to memory + disk."""
    rag_store[doc_id] = doc
    try:
        with open(_rag_path(doc_id), "wb") as f:
            pickle.dump(doc, f)
    except Exception as e:
        print(f"[RAG] disk save failed: {e}")

def rag_get(doc_id):
    """Get doc from memory, fall back to disk."""
    if doc_id in rag_store:
        return rag_store[doc_id]
    path = _rag_path(doc_id)
    if path.exists():
        try:
            with open(path, "rb") as f:
                doc = pickle.load(f)
            rag_store[doc_id] = doc  # cache in memory
            print(f"[RAG] Loaded doc_id={doc_id} from disk")
            return doc
        except Exception as e:
            print(f"[RAG] disk load failed: {e}")
    return None

# ── CHUNKING ────────────────────────────────────────────────────────────────────
def clean_text(text: str) -> str:
    """Normalize extracted text — fix spacing, remove junk chars."""
    # Fix PDF ligatures and common extraction artifacts
    text = text.replace("\x00", " ").replace("\uf0b7", "•")
    # Collapse multiple spaces but preserve newlines
    text = re.sub(r"[ \t]+", " ", text)
    # Remove lines that are just symbols/numbers (page numbers, borders)
    lines = [l for l in text.split("\n") if len(re.sub(r"[^a-zA-Z]", "", l)) >= 2]
    text  = "\n".join(lines)
    # Collapse 3+ newlines into 2
    text  = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text: str) -> list:
    """
    High-quality semantic chunker:
    1. Split on section boundaries (headers, double newlines)
    2. Merge tiny chunks (< 30 words) with neighbours
    3. Split huge chunks (> 200 words) with overlap
    4. Each chunk gets a position index for ordering
    """
    text = clean_text(text)
    
    # Detect section headers: lines that are ALL CAPS or Title Case short lines
    header_pattern = re.compile(
        r"(?:^|\n)(?:"
        r"[A-Z][A-Z\s]{2,30}|"          # ALL CAPS headers like "WORK EXPERIENCE"
        r"[A-Z][a-z]+(\s[A-Z][a-z]+){0,3}"  # Title Case like "Work Experience"
        r")\s*(?:\n|$)"
    )
    
    # Split into raw sections by double newline first
    raw_sections = re.split(r"\n\s*\n", text)
    raw_sections  = [s.strip() for s in raw_sections if s.strip()]
    
    chunks = []
    buffer = ""
    
    for section in raw_sections:
        words = section.split()
        # Tiny section: merge into buffer
        if len(words) < 25:
            buffer = (buffer + " " + section).strip() if buffer else section
            if len(buffer.split()) >= 40:
                chunks.append(buffer); buffer = ""
        # Normal section: flush buffer + add section
        elif len(words) <= 200:
            if buffer:
                chunks.append(buffer); buffer = ""
            chunks.append(section)
        # Large section: flush buffer + slide window
        else:
            if buffer:
                chunks.append(buffer); buffer = ""
            step = 120
            for i in range(0, max(1, len(words) - 30), step):
                c = " ".join(words[i:i + 150])
                if c.strip():
                    chunks.append(c)
    
    if buffer:
        chunks.append(buffer)
    
    # Final safety: if still < 4 chunks, force smaller windows
    if len(chunks) < 4:
        words = text.split()
        chunks = []
        for i in range(0, max(1, len(words) - 30), 100):
            c = " ".join(words[i:i + 130])
            if c.strip(): chunks.append(c)
    
    return chunks or [text[:3000]]

# ── EMBEDDINGS: BM25-style TF-IDF ───────────────────────────────────────────────
def build_vocab(texts: list) -> dict:
    vocab = {}
    for text in texts:
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            if word not in vocab:
                vocab[word] = len(vocab)
    return vocab

def tfidf_embed(text: str, vocab: dict, idf: dict, dim: int) -> list:
    words = re.findall(r"[a-z0-9]+", text.lower())
    tf = {}
    for w in words:
        if w in vocab and vocab[w] < dim:
            tf[vocab[w]] = tf.get(vocab[w], 0) + 1
    vec = [0.0] * dim
    total = len(words) + 1
    for idx, cnt in tf.items():
        vec[idx] = (cnt / total) * idf.get(idx, 1.0)
    mag = math.sqrt(sum(x*x for x in vec)) or 1.0
    return [x / mag for x in vec]

def build_idf(chunks: list, vocab: dict, dim: int) -> dict:
    N = len(chunks)
    df = {}
    for chunk in chunks:
        seen = set()
        for w in re.findall(r"[a-z0-9]+", chunk.lower()):
            if w in vocab and vocab[w] < dim:
                idx = vocab[w]
                if idx not in seen:
                    df[idx] = df.get(idx, 0) + 1
                    seen.add(idx)
    return {idx: math.log((N + 1) / (cnt + 1)) + 1 for idx, cnt in df.items()}

def embed_chunks(chunks: list) -> dict:
    """Embed all chunks, return dict with vocab, idf, embeddings."""
    vocab = build_vocab(chunks)
    dim   = min(len(vocab), 768)
    idf   = build_idf(chunks, vocab, dim)
    embs  = [tfidf_embed(c, vocab, idf, dim) for c in chunks]
    return {"vocab": vocab, "idf": idf, "dim": dim, "embeddings": embs}

def cosine_sim(a: list, b: list) -> float:
    dot = sum(x*y for x, y in zip(a, b))
    ma  = math.sqrt(sum(x*x for x in a))
    mb  = math.sqrt(sum(x*x for x in b))
    return dot / (ma * mb + 1e-9)

def retrieve_chunks(query: str, doc_id: str, top_k: int = 6) -> list:
    """
    Hybrid retrieval:
    1. TF-IDF cosine similarity (semantic)
    2. Keyword overlap bonus (exact match boost)
    Combined score = 0.7 * cosine + 0.3 * keyword_overlap
    """
    doc = rag_get(doc_id)
    if not doc:
        return []
    if doc.get("type") == "image":
        return []  # images handled separately

    emb_data  = doc["emb_data"]
    vocab     = emb_data["vocab"]
    idf       = emb_data["idf"]
    dim       = emb_data["dim"]
    q_emb     = tfidf_embed(query, vocab, idf, dim)
    q_words   = set(re.findall(r"[a-z0-9]+", query.lower()))

    scored = []
    for i, (chunk, emb) in enumerate(zip(doc["chunks"], emb_data["embeddings"])):
        cos   = cosine_sim(q_emb, emb)
        # Keyword overlap bonus
        chunk_words = set(re.findall(r"[a-z0-9]+", chunk.lower()))
        overlap     = len(q_words & chunk_words) / (len(q_words) + 1)
        score       = 0.7 * cos + 0.3 * overlap
        scored.append((score, i, chunk))

    scored.sort(reverse=True)
    # Return top_k but also include positional diversity (don't take all from same doc area)
    results, seen_positions = [], set()
    for score, pos, chunk in scored:
        bucket = pos // 3  # group chunks into buckets of 3
        if bucket not in seen_positions or len(results) < 3:
            results.append(chunk)
            seen_positions.add(bucket)
        if len(results) >= top_k:
            break
    return results

# ── IMAGE UNDERSTANDING VIA GROQ VISION ─────────────────────────────────────────
def describe_image_for_rag(base64_img: str, mime: str, filename: str) -> str:
    """Use Groq vision to generate a rich text description of the image for RAG."""
    # Try models in order — Groq vision model names change frequently
    vision_models = [
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.2-11b-vision-preview",
    ]
    
    extraction_prompt = (
        "You are an expert at analyzing and extracting information from images. "
        "Describe this image in exhaustive detail. Include:\n"
        "- ALL visible text, word for word (names, titles, headings, body text, labels, numbers)\n"
        "- Layout and structure (sections, columns, formatting)\n"
        "- Visual elements (charts, tables, diagrams, photos, logos)\n"
        "- People (names, roles, appearance if relevant)\n"
        "- Any data, statistics, dates, contact info\n"
        "If this is a resume/CV: extract every section header, job title, company, date, skill, and bullet point exactly.\n"
        "If this is a document/slide: transcribe all text content.\n"
        "Be exhaustive — this text will be used to answer questions about this image."
    )

    for model in vision_models:
        try:
            print(f"[RAG] Trying vision model: {model}")
            resp = client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{base64_img}"
                            }
                        },
                        {
                            "type": "text",
                            "text": extraction_prompt
                        }
                    ]
                }],
                temperature=0.1,
                max_tokens=2000,
            )
            result = resp.choices[0].message.content.strip()
            print(f"[RAG] Vision success with {model}: {len(result)} chars")
            return result
        except Exception as e:
            print(f"[RAG] Vision model {model} failed: {e}")
            continue
    
    print("[RAG] All vision models failed")
    return f"Image file: {filename}. Could not extract content automatically."

# ── RAG ROUTES ──────────────────────────────────────────────────────────────────
# ── RAG ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/v1/rag/upload", methods=["POST", "OPTIONS"])
def rag_upload():
    if request.method == "OPTIONS":
        return "", 200
    try:
        body     = request.get_json(force=True)
        filename = body.get("filename", "document.txt")
        doc_id   = body.get("doc_id", None)

        # ── IMAGE UPLOAD ──────────────────────────────────────────
        img_data = body.get("image_base64", "")
        img_mime = body.get("mime", "image/jpeg")
        if img_data:
            description = describe_image_for_rag(img_data, img_mime, filename)
            chunks      = chunk_text(description)
            emb_data    = embed_chunks(chunks)
            import hashlib
            doc_id = doc_id or hashlib.md5(img_data[:100].encode()).hexdigest()[:12]
            rag_save(doc_id, {
                "chunks": chunks, "emb_data": emb_data,
                "filename": filename, "type": "image",
                "description": description[:500],
                "image_base64": img_data,
                "mime": img_mime,
            })
            print(f"[RAG] Image '{filename}': {len(chunks)} chunks from vision description, doc_id={doc_id}")
            return jsonify({"doc_id": doc_id, "chunks": len(chunks), "filename": filename, "type": "image"})

        # ── TEXT/PDF UPLOAD ───────────────────────────────────────
        text = body.get("text", "").strip()
        if not text:
            return jsonify({"error": "no text or image provided"}), 400

        chunks   = chunk_text(text)
        emb_data = embed_chunks(chunks)
        import hashlib
        doc_id = doc_id or hashlib.md5(text[:200].encode()).hexdigest()[:12]
        rag_save(doc_id, {
            "chunks": chunks, "emb_data": emb_data,
            "filename": filename, "type": "text"
        })
        avg_words = sum(len(c.split()) for c in chunks) // max(len(chunks), 1)
        print(f"[RAG] Stored '{filename}': {len(chunks)} chunks, ~{avg_words} words/chunk, doc_id={doc_id}")
        for i, c in enumerate(chunks[:3]):
            print(f"  chunk {i+1}: {c[:100]}...")
        return jsonify({"doc_id": doc_id, "chunks": len(chunks), "filename": filename, "type": "text"})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/v1/rag/status", methods=["GET", "OPTIONS"])
def rag_status():
    if request.method == "OPTIONS":
        return "", 200
    docs = [{"doc_id": k, "filename": v["filename"], "chunks": len(v["chunks"])} for k, v in rag_store.items()]
    return jsonify({"docs": docs})

@app.route("/v1/rag/clear", methods=["POST", "OPTIONS"])
def rag_clear():
    if request.method == "OPTIONS":
        return "", 200
    rag_store.clear()
    return jsonify({"ok": True})

def rewrite_image_prompt(prompt_text: str) -> str:
    clean = re.sub(r"Here are some examples:[\s\S]*?Now answer:\s*", "", prompt_text)
    clean = re.sub(r"Input:\s*", "", clean)
    clean = re.sub(r"Output:\s*$", "", clean.strip())
    clean = re.sub(r"^As [^,\n]+,\s*respond to:\s*", "", clean.strip())
    for marker in [r"\nLet's think", r"\nUse (ReAct|tree)", r"\nProvide 3", r"\nExplore", r"\nThought:"]:
        clean = re.split(marker, clean, flags=re.IGNORECASE)[0]
    lines = [l.strip() for l in clean.strip().split("\n") if l.strip()]
    core  = lines[0] if lines else prompt_text
    core  = re.sub(r"^Input:\s*", "", core).strip()
    result = core.lower()
    for name, desc in PERSON_MAP.items():
        if name in result:
            result = result.replace(name, desc)
    result = (result[0].upper() + result[1:]) if result else core
    result += ", highly detailed, dramatic lighting, 4k, professional"
    print(f"[REWRITE] {core} -> {result}")
    return result

def extract_media_description(technique_prompt: str, media_type: str, system_prompt: str = "", media_style: str = "") -> str:
    """
    Produce a unique media prompt per technique using the technique's mediaStyle.
    """
    try:
        style_hint = media_style if media_style else "clear and descriptive"
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": (
                    f"You extract {media_type} generation prompts from reasoning text. "
                    f"The prompt you write must be styled as: {style_hint}. "
                    f"RULES: Output ONLY the prompt, max 20 words. "
                    f"No 'Thought:', no 'Action:', no 'Approach:', no 'Final Answer:'. "
                    f"Start directly with the subject."
                )},
                {"role": "user", "content": technique_prompt}
            ],
            temperature=0.6,
            max_tokens=50,
        )
        result = resp.choices[0].message.content.strip()
        for prefix in ["Thought:", "Action:", "Approach 1:", "Approach 2:", "Final Answer:", "Description:", "Image:", "Prompt:"]:
            if result.lower().startswith(prefix.lower()):
                result = result[len(prefix):].strip()
        print(f"[EXTRACT] ({style_hint[:30]}): {result}")
        return result
    except Exception as e:
        print(f"[EXTRACT] Failed: {e}")
        return technique_prompt

GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

def fetch_image(prompt: str) -> str | None:
    """Try Gemini image gen if key set, else return Pollinations URL."""
    # Option 1: Gemini (best, 500/day free, no card)
    if GEMINI_KEY:
        try:
            import google.generativeai as genai
            import io as _io
            genai.configure(api_key=GEMINI_KEY)
            model_g = genai.GenerativeModel("gemini-2.0-flash-preview-image-generation")
            resp_g  = model_g.generate_content(
                prompt,
                generation_config={"response_modalities": ["IMAGE"]}
            )
            for part in resp_g.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    b64 = base64.b64encode(part.inline_data.data).decode()
                    mime = part.inline_data.mime_type
                    print(f"[IMAGE] Gemini success!")
                    return f"data:{mime};base64,{b64}"
        except Exception as e:
            print(f"[IMAGE] Gemini failed: {e}")

    # Option 2: Pollinations URL (free but sometimes busy)
    time.sleep(random.uniform(0.3, 2.0))
    encoded = urllib.parse.quote(prompt)
    seed    = random.randint(1, 99999)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&model=flux&nologo=true&seed={seed}"
    print(f"[IMAGE] Pollinations URL: {url[:80]}...")
    return url

def fetch_audio_tts(text: str, voice: str = "onyx") -> str | None:
    """Generate TTS audio via Pollinations — free, no key."""
    try:
        url     = "https://gen.pollinations.ai/v1/audio/speech"
        payload = json.dumps({"model": "tts-1", "input": text, "voice": voice}).encode("utf-8")
        print(f"[AUDIO] Pollinations TTS voice={voice}: {text[:60]}")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 200:
                audio_bytes = resp.read()
                if len(audio_bytes) > 500:
                    b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    print(f"[AUDIO] TTS success {len(audio_bytes)} bytes")
                    return f"data:audio/mpeg;base64,{b64}"
    except Exception as e:
        print(f"[AUDIO] TTS failed: {e}")
    return None

@app.route("/v1/detect", methods=["POST", "OPTIONS"])
def detect():
    if request.method == "OPTIONS":
        return "", 200
    body        = request.get_json(force=True)
    prompt      = body.get("prompt", "")
    has_rag_doc = bool(body.get("has_rag_doc", False))
    return jsonify({"intent": detect_intent(prompt, has_rag_doc)})

@app.route("/v1/messages", methods=["POST", "OPTIONS"])
def messages():
    if request.method == "OPTIONS":
        return "", 200
    try:
        body          = request.get_json(force=True)
        system_prompt = body.get("system", "You are a helpful assistant.")
        msgs          = body.get("messages", [])
        temperature   = body.get("temperature", 0.7)
        max_tokens    = int(body.get("max_tokens", 1000))
        max_tokens    = max(64, min(max_tokens, 4096))  # clamp between 64 and 4096
        intent        = body.get("intent", "text")
        doc_id        = body.get("doc_id", "")
        req_model     = body.get("model", "llama-3.3-70b-versatile")
        # Only allow known safe model IDs
        ALLOWED_MODELS = {
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
        }
        req_model = req_model if req_model in ALLOWED_MODELS else "llama-3.3-70b-versatile"

        # Intent already correctly classified by LLM in /v1/detect — no override needed

        # ── RAG CONTEXT INJECTION ───────────────────────────────────────────
        doc = rag_get(doc_id) if doc_id else None
        if doc_id and doc:
            # Extract user query text safely — content may be str or list
            last_content = msgs[-1]["content"] if msgs else ""
            if isinstance(last_content, list):
                user_query = " ".join(p.get("text","") for p in last_content if p.get("type")=="text")
            else:
                user_query = last_content

            # For IMAGE docs: inject image directly into the conversation + use description as context
            if doc.get("type") == "image" and doc.get("image_base64"):
                img_b64  = doc["image_base64"]
                img_mime = doc.get("mime", "image/jpeg")
                # Replace last text message with multimodal message (only if not already multimodal)
                if msgs and isinstance(msgs[-1].get("content"), str):
                    msgs[-1]["content"] = [
                        {"type": "image_url", "image_url": {"url": f"data:{img_mime};base64,{img_b64}"}},
                        {"type": "text", "text": msgs[-1]["content"]}
                    ]
                system_prompt = system_prompt + "\n\nThe user has uploaded an image. You can see it directly. Answer questions about it thoroughly."
                print(f"[RAG] Injected image for doc_id={doc_id}, technique context applied")

            # For TEXT docs (and image fallback): inject retrieved chunks
            retrieved = retrieve_chunks(user_query, doc_id, top_k=6)
            if retrieved:
                context_block = "\n\n---\n\n".join(retrieved)
                rag_prefix = (
                    f"You have been given the following context to help answer the question.\n"
                    f"Use this context as your primary source of information.\n\n"
                    f"CONTEXT:\n{context_block}\n\n"
                    f"---\nNow answer the following using the context above:"
                )
                system_prompt = system_prompt + "\n\n" + rag_prefix
                print(f"[RAG] Injected {len(retrieved)} chunks from doc_id={doc_id}")

        # ── IMAGE ──────────────────────────────────────────────────
        if intent == "image":
            technique_prompt = msgs[-1]["content"] if msgs else ""
            media_style      = body.get("media_style", "")
            raw_description  = extract_media_description(technique_prompt, "image", system_prompt, media_style)
            safe_prompt      = rewrite_image_prompt(raw_description)
            image_links = {
                "prompt": safe_prompt,
                "tools": [
                    {"name": "Midjourney", "url": "https://www.midjourney.com/", "note": "Best quality, free trial"},
                    {"name": "Adobe Firefly", "url": "https://firefly.adobe.com/", "note": "25 free credits/month, no card"},
                    {"name": "Bing Image Creator", "url": "https://www.bing.com/images/create", "note": "Free, powered by DALL-E"},
                    {"name": "Leonardo.ai", "url": "https://leonardo.ai/", "note": "150 free tokens/day"},
                    {"name": "Ideogram", "url": "https://ideogram.ai/", "note": "Free tier, great for text in images"},
                ]
            }
            return jsonify({"type": "image", "data": json.dumps(image_links)})

        # ── VIDEO ──────────────────────────────────────────────────
        if intent == "video":
            technique_prompt = msgs[-1]["content"] if msgs else ""
            media_style      = body.get("media_style", "")
            raw_description  = extract_media_description(technique_prompt, "video", system_prompt, media_style)
            safe_prompt      = rewrite_image_prompt(raw_description)
            video_links = {
                "prompt": safe_prompt,
                "tools": [
                    {"name": "Google AI Studio (Veo 3)", "url": "https://aistudio.google.com/", "note": "Best quality, free, no card"},
                    {"name": "Kling AI", "url": "https://klingai.com/", "note": "Realistic motion, free tier"},
                    {"name": "Pika Labs", "url": "https://pika.art/", "note": "Browser-based, free"},
                ]
            }
            return jsonify({"type": "video", "data": json.dumps(video_links)})

        # ── AUDIO ──────────────────────────────────────────────────
        if intent == "audio":
            technique_prompt = msgs[-1]["content"] if msgs else ""
            media_style      = body.get("media_style", "")
            raw_description  = extract_media_description(technique_prompt, "audio/speech", system_prompt, media_style)
            audio_links = {
                "prompt": raw_description,
                "tools": [
                    {"name": "ElevenLabs", "url": "https://elevenlabs.io/", "note": "Best AI voice & sound, free tier"},
                    {"name": "Suno AI", "url": "https://suno.com/", "note": "AI music & audio generation, free"},
                    {"name": "Freesound.org", "url": "https://freesound.org/", "note": "Real sound effects library, free"},
                    {"name": "Mubert", "url": "https://mubert.com/", "note": "AI music generation, free tier"},
                ]
            }
            return jsonify({"type": "audio", "data": json.dumps(audio_links)})

        # ── CODE ───────────────────────────────────────────────────
        if intent == "code":
            system_prompt = "You are an expert programmer. Wrap all code in markdown code blocks with language (e.g. ```python). Brief explanation before, short run instructions after."

        # ── TEXT / AUDIO fallback / CODE via Groq ──────────────────
        groq_messages = [{"role": "system", "content": system_prompt}]
        for msg in msgs:
            groq_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        # Use vision model if image is in the conversation
        has_image = any(
            isinstance(m.get("content"), list) and
            any(c.get("type") == "image_url" for c in m["content"])
            for m in groq_messages
        )
        model_name = "meta-llama/llama-4-scout-17b-16e-instruct" if has_image else req_model

        response  = client.chat.completions.create(
            model=model_name,
            messages=groq_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        full_text     = response.choices[0].message.content
        prompt_tokens = getattr(response.usage, "prompt_tokens", 0)
        compl_tokens  = getattr(response.usage, "completion_tokens", 0)
        total_tokens  = getattr(response.usage, "total_tokens", 0)

        # Cost estimates (llama-3.3-70b via Groq free tier, approx GPT-4o rates for display)
        COST_PER_1K_IN  = 0.003   # $0.003 per 1K input tokens
        COST_PER_1K_OUT = 0.015   # $0.015 per 1K output tokens
        cost_usd = (prompt_tokens / 1000 * COST_PER_1K_IN) + (compl_tokens / 1000 * COST_PER_1K_OUT)

        def generate():
            payload = {
                "delta": {"text": full_text},
                "type": intent,
                "tokens": {
                    "prompt": prompt_tokens,
                    "completion": compl_tokens,
                    "total": total_tokens,
                    "cost_usd": round(cost_usd, 6),
                }
            }
            yield f"data: {json.dumps(payload)}\n\n"
            yield "data: [DONE]\n\n"
        return Response(generate(), mimetype="text/event-stream")

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": {"message": str(e)}}), 500

# ── G-EVAL STYLE SCORER ────────────────────────────────────────────────────────
# Based on: G-Eval (Liu et al. 2023), MT-Bench, Prometheus eval methodology
# Key improvements over naive scoring:
# 1. Chain-of-thought reasoning BEFORE assigning score (reduces anchoring bias)
# 2. Detailed rubrics per dimension (not just "rate 1-10")
# 3. Calibration examples so model understands what each score means
# 4. Separate judge calls per dimension (reduces interference between scores)
# 5. Positional bias mitigation via explicit instructions

SCORER_SYSTEM = """You are an expert, calibrated AI response evaluator trained on G-Eval and MT-Bench methodologies.
You evaluate responses accurately — neither inflating nor deflating scores.
Your scores reflect genuine quality:
- A poor response (off-topic, shallow, confusing) scores 20-45.
- An average response (addresses the question but lacks depth) scores 46-65.
- A good response (clear, relevant, reasonably deep) scores 66-80.
- An excellent response (expert-level, thorough, well-structured) scores 81-92.
- A near-perfect response scores 93+. These are rare.
You score each dimension independently based on its specific rubric.
You always reason before scoring, and your reasoning drives the score — not the other way around."""

def build_dimension_prompt(dimension: str, rubric: str, original: str, technique: str, response: str) -> str:
    return f"""Evaluate this AI response on ONE dimension: **{dimension}**.

Original prompt: "{original[:300]}"
Technique: {technique}
Response:
---
{response[:1800]}
---

Rubric for {dimension}:
{rubric}

Scoring bands:
- 85-100: Excellent — this dimension is a clear strength of the response
- 70-84:  Good — solid, with only minor weaknesses
- 55-69:  Adequate — passable but has meaningful gaps
- 35-54:  Weak — significant problems in this dimension
- 0-34:   Poor — fails on this dimension

Instructions:
1. Write 2 sentences of specific reasoning (cite actual content from the response).
2. Name the single biggest weakness for this dimension.
3. Assign a score that matches your reasoning — don't round to round numbers.

Respond ONLY in this JSON (no markdown):
{{"reasoning": "<2 specific sentences>", "strength": "<what works>", "weakness": "<specific gap>", "score": <int>}}"""

RUBRICS = {
    "relevance": """Does the response directly address what the user asked?
- High score: Every sentence serves the user's actual intent. No padding or tangents.
- Low score: Answers a different question, includes irrelevant information, or misses the core ask.
- Watch for: Responses that sound good but don't answer the specific question asked.""",

    "accuracy": """Is the information factually correct and logically sound?
- High score: All claims are accurate, reasoning is valid, no contradictions.
- Low score: Contains factual errors, logical fallacies, or unsupported claims.
- Watch for: Confident-sounding but incorrect statements ("hallucinations").""",

    "depth": """Does the response go beyond surface-level answers?
- High score: Covers important nuances, edge cases, trade-offs. Demonstrates real understanding.
- Low score: Only states obvious facts. No analysis, no "why", no implications.
- Watch for: Long responses that are still shallow (lots of words, little insight).""",

    "clarity": """Is the response clear, well-structured, and easy to understand?
- High score: Logically organized, precise language, appropriate examples, no ambiguity.
- Low score: Confusing structure, jargon without explanation, or contradictory statements.
- Watch for: Technically correct but nearly incomprehensible responses.""",

    "technique_fidelity": """Does the response properly leverage its prompting technique?
- High score: The technique's unique strengths are evident in the response structure and quality.
- Low score: The technique made no meaningful difference — could have been zero-shot.
- Examples: CoT should show explicit reasoning steps; ReAct should show Thought/Action cycles;
  Self-Consistency should show multiple paths; Socratic should challenge assumptions.""",
}

def score_single_dimension(dimension: str, original: str, technique: str, response: str) -> dict:
    prompt = build_dimension_prompt(dimension, RUBRICS[dimension], original, technique, response)
    resp = client.chat.completions.create(
        model="llama-3.1-8b-instant",  # fast + token-efficient for scoring
        messages=[
            {"role": "system", "content": SCORER_SYSTEM},
            {"role": "user",   "content": prompt}
        ],
        temperature=0.1,
        max_tokens=200,
    )
    raw   = resp.choices[0].message.content.strip()
    if "```" in raw:
        raw = raw.split("```")[1].replace("json","").strip()
    start = raw.find("{"); end = raw.rfind("}") + 1
    return json.loads(raw[start:end])

@app.route("/v1/score", methods=["POST", "OPTIONS"])
def score_response():
    if request.method == "OPTIONS":
        return "", 200
    body          = request.get_json(force=True)
    original      = body.get("prompt", "")
    technique     = body.get("technique", "")
    response_text = body.get("response", "")
    if not response_text or not original:
        return jsonify({"error": "missing fields"}), 400

    try:
        # Single structured call — same approach as optimizer scorer, fast + reliable
        judge = (
            f"Score this AI response on 5 dimensions (0-100 each). Be accurate and differentiated.\n"
            f"PROMPT: {original[:250]}\n"
            f"TECHNIQUE: {technique}\n"
            f"RESPONSE: {response_text[:600]}\n\n"
            f"Score guides: 30=poor 50=weak 65=adequate 78=good 90=excellent\n"
            f"Good responses score 66-80. Only exceptional ones exceed 85.\n"
            f"Each dimension must be scored independently based on evidence.\n\n"
            f"Respond ONLY in JSON (no markdown):\n"
            f"{{\"relevance\":<int>,\"accuracy\":<int>,\"depth\":<int>,"
            f"\"clarity\":<int>,\"technique_fidelity\":<int>,"
            f"\"relevance_reason\":\"<why>\",\"depth_reason\":\"<why>\","
            f"\"clarity_reason\":\"<why>\",\"verdict\":\"<main weakness>\","
            f"\"strength\":\"<main strength>\"}}"
        )
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": (
                    "You are a calibrated AI evaluator. Give differentiated scores — "
                    "don't give the same score to every dimension. "
                    "Base each score on specific evidence from the response."
                )},
                {"role": "user", "content": judge}
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = resp.choices[0].message.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1].replace("json","").strip()
        s, e2 = raw.find("{"), raw.rfind("}") + 1
        d = json.loads(raw[s:e2])

        rel = int(d.get("relevance", 60))
        acc = int(d.get("accuracy", 60))
        dep = int(d.get("depth", 60))
        cla = int(d.get("clarity", 60))
        fid = int(d.get("technique_fidelity", 60))

        # Weighted overall
        overall = round(rel*0.25 + acc*0.20 + dep*0.25 + cla*0.15 + fid*0.15)

        result = {
            "overall":   overall,
            "relevance": rel, "accuracy": acc, "depth": dep,
            "clarity": cla, "technique_fidelity": fid,
            "relevance_reason":  d.get("relevance_reason", ""),
            "depth_reason":      d.get("depth_reason", ""),
            "clarity_reason":    d.get("clarity_reason", ""),
            "accuracy_reason":   d.get("accuracy_reason", ""),
            "technique_fidelity_reason": d.get("technique_fidelity_reason", ""),
            "verdict":   d.get("verdict", ""),
            "strength":  d.get("strength", ""),
        }
        print(f"[SCORE] {technique}: {overall}/100 (rel={rel} acc={acc} dep={dep} cla={cla} fid={fid})")
        return jsonify(result)
    except Exception as e:
        print(f"[SCORE] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/v1/optimize", methods=["POST", "OPTIONS"])
def optimize():
    """
    Agentic Prompt Optimizer:
    1. Run prompt with given technique
    2. Score the response (LLM-as-judge)
    3. Critique: what's wrong / what could be better
    4. Rewrite: improve the prompt based on critique
    5. Repeat until score >= threshold or max iterations
    Returns: full optimization trace for UI display
    """
    if request.method == "OPTIONS":
        return "", 200

    body          = request.get_json(force=True)
    original_prompt = body.get("prompt", "")
    system_prompt   = body.get("system", "You are a helpful assistant.")
    technique_label = body.get("technique", "Zero-Shot")
    temperature     = float(body.get("temperature", 0.7))
    max_tokens      = int(body.get("max_tokens", 1024))
    max_iterations  = int(body.get("max_iterations", 5))
    target_score    = int(body.get("target_score", 85))
    doc_id          = body.get("doc_id", "")

    if not original_prompt:
        return jsonify({"error": "prompt required"}), 400

    def run_prompt(prompt_text):
        """Run a single prompt and return response text."""
        groq_msgs = [{"role": "user", "content": prompt_text}]
        sys = system_prompt
        # Inject RAG if active
        if doc_id and rag_get(doc_id):
            retrieved = retrieve_chunks(prompt_text, doc_id, top_k=4)
            if retrieved:
                sys += "\n\nCONTEXT:\n" + "\n---\n".join(retrieved)
        # Use 8b for optimizer loop — saves 70b quota for playground
        opt_max_tokens = min(max_tokens, 600)
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": prompt_text}],
            temperature=temperature,
            max_tokens=opt_max_tokens,
        )
        return resp.choices[0].message.content.strip()

    def score_prompt(prompt_text, response_text, prev_response=None):
        """
        Comparative scorer: scores against the original prompt's intent
        AND relative to previous response if available.
        Uses a single well-structured call with chain-of-thought.
        """
        comparison_block = ""
        if prev_response:
            comparison_block = (
                f"\nPREVIOUS RESPONSE (for comparison):\n{prev_response[:400]}\n"
                f"Note: If current response is better than previous, scores should reflect that improvement.\n"
            )

        judge = (
            f"Score this AI response on 4 dimensions (0-100 each).\n"
            f"PROMPT: {prompt_text[:200]}\n"
            f"TECHNIQUE: {technique_label}\n"
            f"RESPONSE: {response_text[:400]}\n"
            f"{comparison_block}"
            f"Score guides: 30=poor 50=weak 65=adequate 78=good 90=excellent\n"
            f"Respond ONLY in JSON:\n"
            f"{{\"relevance\":<int>,\"relevance_analysis\":\"<why>\","
            f"\"depth\":<int>,\"depth_analysis\":\"<why>\","
            f"\"clarity\":<int>,\"clarity_analysis\":\"<why>\","
            f"\"technique\":<int>,\"technique_analysis\":\"<why>\","
            f"\"main_weakness\":\"<specific gap>\",\"main_strength\":\"<best part>\"}}"
        )

        try:
            r = client.chat.completions.create(
                model="llama-3.1-8b-instant",  # fast + cheap for scoring
                messages=[
                    {"role": "system", "content": (
                        "You are a precise AI evaluator. You give DIFFERENTIATED scores — "
                        "good responses score 70-85, average ones 50-65, poor ones below 50, "
                        "exceptional ones above 85. You cite specific evidence from the response. "
                        "Scores must reflect the actual quality described in your analysis."
                    )},
                    {"role": "user", "content": judge}
                ],
                temperature=0.1,
                max_tokens=400,
            )
            raw = r.choices[0].message.content.strip()
            # Handle markdown code blocks
            if "```" in raw:
                raw = raw.split("```")[1].replace("json","").strip()
            s, e2 = raw.find("{"), raw.rfind("}") + 1
            d = json.loads(raw[s:e2])

            rel = int(d.get("relevance", 55))
            dep = int(d.get("depth", 55))
            cla = int(d.get("clarity", 55))
            tec = int(d.get("technique", 55))

            # Weighted overall
            overall = round(rel * 0.35 + dep * 0.30 + cla * 0.20 + tec * 0.15)

            verdict = d.get("main_weakness", "")
            strength = d.get("main_strength", "")

            print(f"[OPTIMIZER] rel={rel} dep={dep} cla={cla} tec={tec} → {overall}/100")
            print(f"[OPTIMIZER] Weakness: {verdict[:80]}")

            return {
                "overall":   overall,
                "relevance": rel,
                "depth":     dep,
                "clarity":   cla,
                "technique_fidelity": tec,
                "accuracy":  rel,
                "verdict":   verdict,
                "strength":  strength,
                "analyses":  {
                    "relevance": d.get("relevance_analysis",""),
                    "depth":     d.get("depth_analysis",""),
                    "clarity":   d.get("clarity_analysis",""),
                    "technique": d.get("technique_analysis",""),
                }
            }
        except Exception as e:
            print(f"[OPTIMIZER] Score parse error: {e}, raw: {raw[:200] if 'raw' in dir() else 'N/A'}")
            return {"overall": 50, "relevance": 50, "depth": 50, "clarity": 50,
                    "technique_fidelity": 50, "accuracy": 50, "verdict": str(e)}

    def critique_and_rewrite(original, current_prompt, response, score_data, iteration, history):
        """
        Surgical rewriter: identifies the exact weakest dimension,
        applies a targeted strategy, and guarantees a structurally different prompt.
        """
        rel = score_data.get("relevance", 50)
        dep = score_data.get("depth", 50)
        cla = score_data.get("clarity", 50)
        tec = score_data.get("technique_fidelity", 50)

        dim_scores = {"relevance": rel, "depth": dep, "clarity": cla, "technique": tec}
        weakest    = min(dim_scores, key=dim_scores.get)
        weakness   = score_data.get("verdict", "")
        analyses   = score_data.get("analyses", {})

        # Specific addition to make for each weak dimension
        additions = {
            "relevance": (
                "Add explicit constraints to keep the response focused:\n"
                "- Specify EXACTLY what to include and what to exclude\n"
                "- Add: 'Focus only on [specific aspect]'\n"
                "- Add: 'Do not include [irrelevant tangent]'\n"
                "- Restate the core question more precisely"
            ),
            "depth": (
                "Add depth-forcing instructions:\n"
                "- Add: 'Explain the underlying reasoning for each point'\n"
                "- Add: 'Include at least one concrete real-world example'\n"
                "- Add: 'Cover trade-offs and when this approach fails'\n"
                "- Add: 'Go beyond the obvious — what do most people miss?'"
            ),
            "clarity": (
                "Add structure-forcing instructions:\n"
                "- Specify exact output format (numbered steps, sections, etc.)\n"
                "- Add: 'Start with a one-sentence direct answer'\n"
                "- Add: 'Use concrete examples to illustrate each point'\n"
                "- Specify target audience level"
            ),
            "technique": (
                f"Force the {technique_label} technique to engage properly:\n"
                "- Add explicit cues that trigger the technique's structure\n"
                "- Reference the technique's key mechanism in the prompt\n"
                "- Add step-by-step process that aligns with the technique"
            ),
        }

        # History context
        history_ctx = ""
        if history:
            tried = "; ".join([h["change"] for h in history[-2:]])
            history_ctx = f"\nALREADY TRIED (do NOT repeat): {tried}\n"

        rewrite_prompt = (
            f"You are an expert prompt engineer doing targeted prompt optimization.\n"
            f"\nUSER INTENT: {original}"
            f"\nCURRENT PROMPT:\n{current_prompt}"
            f"\nCURRENT SCORES: relevance={rel}/100, depth={dep}/100, clarity={cla}/100, technique={tec}/100"
            f"\nWEAKEST DIMENSION: {weakest} ({dim_scores[weakest]}/100)"
            f"\nSPECIFIC WEAKNESS: {weakness}"
            f"\nANALYSIS: {analyses.get(weakest, '')}"
            f"{history_ctx}"
            f"\n\nYOUR TASK: Rewrite the prompt to fix the {weakest} weakness."
            f"\nSTRATEGY TO APPLY:\n{additions[weakest]}"
            f"\n\nRULES:"
            f"\n- The rewritten prompt MUST add at least 20 new words of specific instructions"
            f"\n- Do NOT just rephrase — add concrete requirements"
            f"\n- Keep the original intent: '{original[:100]}'"
            f"\n- The first line should still be the core request"
            f"\n\nRespond in this exact format:"
            f"\nCRITIQUE: <2 sentences citing specific evidence from the response>"
            f"\nCHANGE: <1 sentence: exactly what you added and why>"
            f"\nREWRITTEN PROMPT:\n<the complete improved prompt>"
        )

        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",  # use 8b to preserve 70b daily quota
            messages=[
                {"role": "system", "content": (
                    "You are an expert prompt engineer. You make surgical, targeted improvements. "
                    "Every rewrite adds specific, actionable instructions. "
                    "You never just rephrase — you always add concrete requirements."
                )},
                {"role": "user", "content": rewrite_prompt}
            ],
            temperature=0.6,
            max_tokens=500,  # trimmed from 700
        )
        text = resp.choices[0].message.content.strip()

        critique, change_desc, rewritten = "", "", ""
        current_section = None
        rewritten_lines = []

        for line in text.split("\n"):
            if line.startswith("CRITIQUE:"):
                current_section = "critique"
                critique = line.replace("CRITIQUE:", "").strip()
            elif line.startswith("CHANGE:"):
                current_section = "change"
                change_desc = line.replace("CHANGE:", "").strip()
            elif line.startswith("REWRITTEN PROMPT:"):
                current_section = "rewrite"
                rest = line.replace("REWRITTEN PROMPT:", "").strip()
                if rest: rewritten_lines.append(rest)
            elif current_section == "rewrite":
                rewritten_lines.append(line)
            elif current_section == "critique" and line.strip():
                critique += " " + line.strip()
            elif current_section == "change" and line.strip() and not line.startswith("REWRITTEN"):
                change_desc += " " + line.strip()

        rewritten = "\n".join(rewritten_lines).strip()

        # Guarantee the rewrite is meaningfully different
        if not rewritten or rewritten.strip() == current_prompt.strip() or len(rewritten) < len(current_prompt) * 0.8:
            rewritten = (
                f"{original}\n\n"
                f"Requirements:\n"
                f"1. Start with a direct, precise answer in 1-2 sentences\n"
                f"2. Provide detailed explanation with specific, concrete examples\n"
                f"3. Cover the key trade-offs, limitations, or when this does NOT apply\n"
                f"4. End with a practical takeaway or recommendation\n"
                f"\nBe specific. Avoid generic statements. Use precise language."
            )
            critique = critique or f"The response scored low on {weakest} ({dim_scores[weakest]}/100). {weakness}"
            change_desc = change_desc or "Added explicit 4-part output structure to force depth and precision."

        print(f"[OPTIMIZER] Rewrite targets: {weakest}. Change: {change_desc[:80]}")
        return critique, change_desc, rewritten

    # ── OPTIMIZATION LOOP ────────────────────────────────────────────────────
    # ── OPTIMIZATION LOOP ────────────────────────────────────────────────────
    trace          = []
    current_prompt = original_prompt
    best_score     = 0
    best_iteration = 0
    rewrite_history = []  # track what was tried to avoid repetition

    print(f"[OPTIMIZER] Starting: technique={technique_label}, target={target_score}, max_iter={max_iterations}")

    for iteration in range(1, max_iterations + 1):
        print(f"[OPTIMIZER] ── Iteration {iteration}/{max_iterations} ──")
        print(f"[OPTIMIZER] Prompt: {current_prompt[:80]}...")

        # Step 1: Run
        try:
            response = run_prompt(current_prompt)
            print(f"[OPTIMIZER] Response: {response[:80]}...")
        except Exception as e:
            print(f"[OPTIMIZER] Run failed: {e}")
            trace.append({"iteration": iteration, "prompt": current_prompt, "response": "", "score": {"overall": 0}, "error": str(e), "is_best": False})
            break

        # Step 2: Score — pass previous response for comparative scoring
        prev_response = trace[-1]["response"] if trace else None
        try:
            score_data = score_prompt(current_prompt, response, prev_response)
        except Exception as e:
            print(f"[OPTIMIZER] Score failed: {e}")
            score_data = {"overall": 50, "clarity": 50, "depth": 50, "relevance": 50, "technique_fidelity": 50, "verdict": "Scoring error"}

        overall = score_data.get("overall", 0)
        if overall > best_score:
            best_score     = overall
            best_iteration = iteration
            print(f"[OPTIMIZER] ★ New best: {overall}/100")
        else:
            print(f"[OPTIMIZER] Score {overall}/100 (best so far: {best_score})")

        step = {
            "iteration": iteration,
            "prompt":    current_prompt,
            "response":  response,
            "score":     score_data,
            "is_best":   False,
        }
        trace.append(step)

        # Step 3: Check convergence
        if overall >= target_score:
            print(f"[OPTIMIZER] ✓ Target {target_score} reached!")
            break

        # Step 4: Critique + Rewrite (skip on last iteration)
        if iteration < max_iterations:
            try:
                critique, change_desc, new_prompt = critique_and_rewrite(
                    original_prompt, current_prompt, response, score_data,
                    iteration, rewrite_history
                )
                rewrite_history.append({"iter": iteration, "score": overall, "change": change_desc})
                trace[-1]["critique"]    = critique
                trace[-1]["change"]      = change_desc
                trace[-1]["next_prompt"] = new_prompt
                print(f"[OPTIMIZER] Change: {change_desc[:80]}")
                current_prompt = new_prompt
            except Exception as e:
                print(f"[OPTIMIZER] Rewrite failed: {e}")
                break

    # Mark best iteration
    for step in trace:
        step["is_best"] = (step["iteration"] == best_iteration)

    best_step = trace[best_iteration - 1] if trace and best_iteration > 0 else (trace[0] if trace else {})

    # The "best prompt" is the one that PRODUCED the best response —
    # i.e. the prompt field of the best iteration step (not the rewritten one)
    best_prompt   = best_step.get("prompt", original_prompt)
    best_response = best_step.get("response", "")

    # If there's a better rewritten prompt from the best iteration (next iteration prompt), use that
    # Only if score improved — the rewrite of best is even better
    if best_step.get("next_prompt") and best_iteration == len(trace):
        # Last iteration had a rewrite but we ran out of iterations — that rewrite is untested
        # Don't use it, stick with the tested best
        pass

    print(f"[OPTIMIZER] Done. Best: iteration {best_iteration}, score {best_score}/100")
    print(f"[OPTIMIZER] Best prompt: {best_prompt[:100]}...")

    return jsonify({
        "trace":          trace,
        "best_score":     best_score,
        "best_iteration": best_iteration,
        "best_prompt":    best_prompt,
        "best_response":  best_response,
        "converged":      best_score >= target_score,
        "iterations":     len(trace),
    })


if __name__ == "__main__":
    print("✅ PromptForge v2 backend running at http://localhost:5000")
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
