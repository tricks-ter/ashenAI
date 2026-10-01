# ==============================================================================
# 🚀 ASHENAI - KAGGLE GPU SERVER FOR "huihui-ai/Qwen3-14B-abliterated"
# ==============================================================================
# 📌 INSTRUCTIONS IN KAGGLE:
# 1. Open your Kaggle Notebook (with GPU T4 x2 or P100, Internet ON).
# 2. Add your 'HF_TOKEN' in Add-ons -> Secrets.
# 3. Paste and run this script!
# 4. Copy the printed LIVE URL and paste into AshenAI web app Settings!
# ==============================================================================

import os
import re
import time
import json
import uuid
import asyncio
import threading
import subprocess
from typing import List, Optional

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from kaggle_secrets import UserSecretsClient
from huggingface_hub import login
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TextIteratorStreamer
)

# 1. Hugging Face Authentication
try:
    user_secrets = UserSecretsClient()
    hf_token = user_secrets.get_secret("HF_TOKEN")
    login(token=hf_token)
    print("✅ Hugging Face login verified.")
except Exception as e:
    print(f"ℹ️ HF_TOKEN note: {e}")

model_id = "huihui-ai/Qwen3-14B-abliterated"
PORT = 8000

# 2. 4-bit Quantization Config for 2x T4
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)

print(f"📥 Loading {model_id} across Kaggle 2x T4 GPUs...")
tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, padding_side="left")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=quantization_config,
    device_map="auto",
    low_cpu_mem_usage=True,
    trust_remote_code=True
)

print(f"✨ Model loaded across: {model.hf_device_map}")

# 3. FastAPI App Setup
app = FastAPI(title="AshenAI Kaggle Inference Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Concurrency lock to prevent GPU crashes on parallel hits
inference_lock = asyncio.Lock()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.6
    top_p: Optional[float] = 0.95
    top_k: Optional[int] = 20
    repetition_penalty: Optional[float] = 1.1
    max_tokens: Optional[int] = 2048
    stream: Optional[bool] = True

@app.get("/health")
async def health():
    return {
        "status": "online",
        "model": model_id,
        "gpus": torch.cuda.device_count()
    }

@app.get("/v1/models")
async def get_models():
    return {"data": [{"id": model_id, "object": "model"}]}

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    messages_payload = [{"role": m.role, "content": m.content} for m in req.messages]
    
    try:
        prompt = tokenizer.apply_chat_template(
            messages_payload,
            tokenize=False,
            add_generation_prompt=True
        )
    except Exception:
        prompt = "\n".join([f"{m.role}: {m.content}" for m in req.messages]) + "\nassistant:"

    model_inputs = tokenizer([prompt], return_tensors="pt").to(model.device)
    
    max_new_tokens = req.max_tokens or 2048
    temp = max(0.01, req.temperature if req.temperature is not None else 0.6)
    top_p = req.top_p if req.top_p is not None else 0.95
    top_k = req.top_k if req.top_k is not None else 20
    rep_penalty = req.repetition_penalty if req.repetition_penalty is not None else 1.1

    if req.stream:
        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
        gen_kwargs = dict(
            input_ids=model_inputs.input_ids,
            attention_mask=model_inputs.attention_mask,
            streamer=streamer,
            max_new_tokens=max_new_tokens,
            do_sample=True if temp > 0.05 else False,
            temperature=temp,
            top_p=top_p,
            top_k=top_k,
            repetition_penalty=rep_penalty,
            pad_token_id=tokenizer.eos_token_id
        )

        async def stream_generator():
            async with inference_lock:
                thread = threading.Thread(target=model.generate, kwargs=gen_kwargs)
                thread.start()

                chunk_id = "chatcmpl-" + uuid.uuid4().hex[:8]
                yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': model_id, 'choices': [{'index': 0, 'delta': {'role': 'assistant'}, 'finish_reason': None}]})}\n\n"
                
                for text_chunk in streamer:
                    if text_chunk:
                        yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': model_id, 'choices': [{'index': 0, 'delta': {'content': text_chunk}, 'finish_reason': None}]})}\n\n"
                    await asyncio.sleep(0.001)

                thread.join()
                yield f"data: {json.dumps({'id': chunk_id, 'object': 'chat.completion.chunk', 'model': model_id, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
        )
    else:
        async with inference_lock:
            with torch.no_grad():
                outputs = model.generate(
                    input_ids=model_inputs.input_ids,
                    attention_mask=model_inputs.attention_mask,
                    max_new_tokens=max_new_tokens,
                    do_sample=True if temp > 0.05 else False,
                    temperature=temp,
                    top_p=top_p,
                    top_k=top_k,
                    repetition_penalty=rep_penalty,
                    pad_token_id=tokenizer.eos_token_id
                )
            input_len = model_inputs.input_ids.shape[1]
            resp_tokens = outputs[0][input_len:]
            resp_text = tokenizer.decode(resp_tokens, skip_special_tokens=True)
            return {
                "id": "chatcmpl-" + uuid.uuid4().hex[:8],
                "object": "chat.completion",
                "model": model_id,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": resp_text}, "finish_reason": "stop"}]
            }

# 4. Start Cloudflare Tunnel with Robust Regex Capture
cf_proc = subprocess.Popen(
    ["./cloudflared", "tunnel", "--url", f"http://127.0.0.1:{PORT}"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

tunnel_url = None
start_time = time.time()
while time.time() - start_time < 30:
    line = cf_proc.stdout.readline()
    if not line:
        continue
    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
    if match:
        tunnel_url = match.group(0)
        break

print("=" * 60)
print(f"🎉 LIVE URL: {tunnel_url}")
print("=" * 60)

# Clean, native execution inside Jupyter / Kaggle event loops
config = uvicorn.Config(app=app, host="0.0.0.0", port=PORT, log_level="info")
server = uvicorn.Server(config)

await server.serve()
