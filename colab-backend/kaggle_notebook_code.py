# ==============================================================================
# 🚀 ASHENAI - KAGGLE GPU INFERENCE BRIDGE (OPENAI COMPATIBLE + STREAMING)
# ==============================================================================
# 📌 INSTRUCTIONS FOR KAGGLE:
# 1. On Kaggle (kaggle.com/code), create a "New Notebook".
# 2. In the right panel under 'Notebook Options':
#    - Accelerator: Select "GPU T4 x2" (or "GPU P100")
#    - Internet: Set to "Internet ON" (REQUIRED)
# 3. Paste and run this code cell!
# 4. Copy the printed https://xxxx.trycloudflare.com URL and paste into AshenAI Settings!
# ==============================================================================

# --- STEP 1: Install Dependencies & Cloudflared Tunnel ---
print("📦 [1/4] Installing high-performance inference packages...")
import subprocess, sys

def run_quiet(cmd):
    subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

run_quiet("pip install -q torch transformers accelerate bitsandbytes fastapi uvicorn pydantic nest_asyncio")
run_quiet("wget -q -nc https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O ./cloudflared")
run_quiet("chmod +x ./cloudflared")

# --- STEP 2: Configure Model ---
# You can choose any of these popular models:
# - "Qwen/Qwen2.5-7B-Instruct" (Recommended: Fast & Smart)
# - "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B" (Deep Reasoning & Thinking)
# - "meta-llama/Meta-Llama-3.1-8B-Instruct" (Llama 3.1)
# - "google/gemma-2-9b-it" (Google Gemma 2)
# - "mistralai/Mistral-7B-Instruct-v0.3" (Mistral)
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
PORT = 8000

import os, time, json, uuid, asyncio, threading, re
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import nest_asyncio
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, TextIteratorStreamer

print(f"🔥 [2/4] CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    gpu_count = torch.cuda.device_count()
    for i in range(gpu_count):
        print(f"   ⚡ GPU {i}: {torch.cuda.get_device_name(i)} ({torch.cuda.get_device_properties(i).total_memory / (1024**3):.2f} GB VRAM)")

# --- STEP 3: Load Model into GPU with 4-bit Quantization ---
print(f"📥 [3/4] Loading '{MODEL_NAME}' into GPU memory (takes ~45-60s)...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True, padding_side="left")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# 4-bit quantization allows 7B/8B models to use only ~6GB VRAM on Kaggle T4!
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.float16,
    low_cpu_mem_usage=True
)

print(f"✅ Model '{MODEL_NAME}' successfully loaded on GPU!")

# --- STEP 4: Setup FastAPI & Cloudflare Tunnel ---
print("🌐 [4/4] Starting FastAPI Server & Cloudflare HTTPS Tunnel...")

app = FastAPI(title="AshenAI Kaggle Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 2048
    stream: Optional[bool] = True

@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "online",
        "platform": "Kaggle GPU",
        "model": MODEL_NAME,
        "cuda_available": torch.cuda.is_available(),
        "device": {
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0
        }
    }

@app.get("/v1/models")
async def get_models():
    return {"data": [{"id": MODEL_NAME, "object": "model"}]}

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    messages_payload = [{"role": m.role, "content": m.content} for m in req.messages]
    
    # Format chat template
    try:
        prompt = tokenizer.apply_chat_template(
            messages_payload,
            tokenize=False,
            add_generation_prompt=True
        )
    except Exception:
        prompt = "\n".join([f"{m.role}: {m.content}" for m in req.messages]) + "\nassistant:"

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    max_tokens = req.max_tokens or 2048
    temp = max(0.01, req.temperature or 0.7)
    top_p = req.top_p or 0.9

    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
    gen_kwargs = dict(
        **inputs,
        streamer=streamer,
        max_new_tokens=max_tokens,
        temperature=temp,
        top_p=top_p,
        do_sample=True if temp > 0.05 else False,
        pad_token_id=tokenizer.pad_token_id
    )

    thread = threading.Thread(target=model.generate, kwargs=gen_kwargs)
    thread.start()

    async def stream_generator():
        # First delta with role
        chunk_id = "chatcmpl-" + uuid.uuid4().hex[:8]
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': MODEL_NAME, 'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}]})}\n\n"
        
        for text_chunk in streamer:
            if text_chunk:
                yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': MODEL_NAME, 'choices': [{'index': 0, 'delta': {'content': text_chunk}, 'finish_reason': None}]})}\n\n"
            await asyncio.sleep(0.001)
            
        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': MODEL_NAME, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

# --- Start Cloudflare Tunnel ---
cf_proc = subprocess.Popen(["./cloudflared", "tunnel", "--url", f"http://127.0.0.1:{PORT}"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
time.sleep(3)
tunnel_url = None
for _ in range(35):
    line = cf_proc.stdout.readline()
    if not line:
        break
    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
    if match:
        tunnel_url = match.group(0)
        break

print("\n" + "="*75)
print("🎉🎉🎉 ASHENAI KAGGLE GPU INFERENCE IS ONLINE! 🎉🎉🎉")
print("="*75)
print(f"👉 YOUR LIVE BACKEND URL: \033[1;32m{tunnel_url}\033[0m")
print("="*75)
print("📌 Next Step: Open your local AshenAI web app -> Settings (⚙️) -> Paste this URL -> Test Connection!\n")

# --- Run Uvicorn in current notebook thread ---
nest_asyncio.apply()
uvicorn.run(app, host="0.0.0.0", port=PORT)

