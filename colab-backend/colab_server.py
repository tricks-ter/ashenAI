"""
AshenAI Colab & Kaggle Backend Server
=====================================
Run this script inside Google Colab (Free T4 GPU) or Kaggle (T4 / P100 GPU).
It hosts an OpenAI-compatible FastAPI streaming server with 4-bit quantized LLM inference
and exposes a public HTTPS tunnel via Cloudflare Tunnel or ngrok.

Supports:
- Llama 3.1 8B Instruct (meta-llama/Meta-Llama-3.1-8B-Instruct)
- Qwen 2.5 7B Instruct (Qwen/Qwen2.5-7B-Instruct)
- DeepSeek R1 Distill Qwen 7B (deepseek-ai/DeepSeek-R1-Distill-Qwen-7B)
- Gemma 2 9B IT (google/gemma-2-9b-it)
- Mistral 7B Instruct (mistralai/Mistral-7B-Instruct-v0.3)
- Any custom HuggingFace / CausalLM model
"""

import os
import sys
import time
import json
import uuid
import asyncio
import argparse
import threading
from typing import List, Dict, Any, Optional, AsyncGenerator

import torch
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# HuggingFace & Transformers
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TextIteratorStreamer
)

# -------------------------------------------------------------------
# Configuration & Arguments
# -------------------------------------------------------------------
DEFAULT_MODEL = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
API_KEY = os.getenv("API_KEY", "")  # Optional API key for auth

app = FastAPI(
    title="AshenAI Remote Inference Backend",
    description="OpenAI-compatible LLM inference server for Google Colab and Kaggle",
    version="1.0.0"
)

# Enable CORS for local web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and tokenizer
model = None
tokenizer = None
current_model_name = DEFAULT_MODEL
device_info = {}

# -------------------------------------------------------------------
# Models & Request Schemas (OpenAI Compatible)
# -------------------------------------------------------------------
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
    stop: Optional[List[str]] = None

# -------------------------------------------------------------------
# Model Loader
# -------------------------------------------------------------------
def load_llm_model(model_name: str, load_in_4bit: bool = True):
    global model, tokenizer, current_model_name, device_info

    print(f"\n=======================================================")
    print(f"Loading Model: {model_name}")
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        print(f"GPU: {gpu_name} ({vram:.2f} GB VRAM)")
        device_info = {"gpu": gpu_name, "vram_gb": round(vram, 2)}
    print(f"=======================================================\n")

    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        padding_side="left"
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 4-bit Quantization Config for Colab / Kaggle Free GPU
    if load_in_4bit and torch.cuda.is_available():
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True,
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True
        )
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True,
            torch_dtype=dtype,
            low_cpu_mem_usage=True
        )
        if device == "cpu":
            model.to(device)

    current_model_name = model_name
    print(f"\n>>> Model '{model_name}' successfully loaded and ready for inference! <<<\n")

# -------------------------------------------------------------------
# Authentication Dependency
# -------------------------------------------------------------------
async def verify_api_key(authorization: Optional[str] = Header(None)):
    if not API_KEY:
        return True
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.replace("Bearer ", "").strip()
    if token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return True

# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------
@app.get("/")
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "AshenAI Remote Colab/Kaggle GPU Backend",
        "model": current_model_name,
        "cuda_available": torch.cuda.is_available(),
        "device": device_info,
        "time": time.time()
    }

@app.get("/v1/models")
async def list_models(auth: bool = Depends(verify_api_key)):
    return {
        "object": "list",
        "data": [
            {
                "id": current_model_name,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "ashen-ai"
            }
        ]
    }

def format_openai_stream_chunk(content: str, model_id: str, finish_reason: Optional[str] = None):
    chunk = {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model_id,
        "choices": [
            {
                "index": 0,
                "delta": {"content": content} if content else {},
                "finish_reason": finish_reason
            }
        ]
    }
    return f"data: {json.dumps(chunk)}\n\n"

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, auth: bool = Depends(verify_api_key)):
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model is still loading or not initialized")

    # Format prompt using chat template
    messages_payload = [{"role": m.role, "content": m.content} for m in request.messages]
    
    try:
        prompt = tokenizer.apply_chat_template(
            messages_payload,
            tokenize=False,
            add_generation_prompt=True
        )
    except Exception:
        # Fallback if chat template is not defined
        prompt = ""
        for m in request.messages:
            prompt += f"<|im_start|>{m.role}\n{m.content}<|im_end|>\n"
        prompt += "<|im_start|>assistant\n"

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    max_new_tokens = request.max_tokens or 2048
    temperature = max(0.01, request.temperature or 0.7)
    top_p = request.top_p or 0.9

    if request.stream:
        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
        generation_kwargs = dict(
            **inputs,
            streamer=streamer,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=True if temperature > 0.05 else False,
            pad_token_id=tokenizer.pad_token_id
        )

        thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
        thread.start()

        async def token_generator() -> AsyncGenerator[str, None]:
            # Initial role delta chunk
            role_chunk = {
                "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": current_model_name,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]
            }
            yield f"data: {json.dumps(role_chunk)}\n\n"

            for new_text in streamer:
                if new_text:
                    yield format_openai_stream_chunk(new_text, current_model_name)
                await asyncio.sleep(0.001)

            yield format_openai_stream_chunk("", current_model_name, finish_reason="stop")
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            token_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Non-streaming response
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True if temperature > 0.05 else False,
                pad_token_id=tokenizer.pad_token_id
            )
        response_text = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": current_model_name,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response_text
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": inputs.input_ids.shape[1],
                "completion_tokens": len(outputs[0]) - inputs.input_ids.shape[1],
                "total_tokens": len(outputs[0])
            }
        }

# -------------------------------------------------------------------
# Cloudflare Tunnel Helper
# -------------------------------------------------------------------
def start_cloudflare_tunnel(port: int = 8000):
    import subprocess
    import re

    print("Setting up free Cloudflare Tunnel (no account required)...")
    # Download cloudflared if not present
    if not os.path.exists("./cloudflared"):
        subprocess.run(["wget", "-q", "-nc", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", "-O", "./cloudflared"])
        subprocess.run(["chmod", "+x", "./cloudflared"])

    process = subprocess.Popen(
        ["./cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    tunnel_url = None
    start_time = time.time()
    while time.time() - start_time < 30:
        line = process.stdout.readline()
        if not line:
            break
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            break

    if tunnel_url:
        print("\n" + "="*70)
        print("🎉 SUCCESS! YOUR ASHENAI BACKEND IS ONLINE 🎉")
        print("="*70)
        print(f"👉 Copy & Paste this URL into AshenAI Settings Modal:")
        print(f"   {tunnel_url}")
        print("="*70 + "\n")
    else:
        print("Cloudflare tunnel is running. Check console logs for .trycloudflare.com URL.")

    return tunnel_url

# -------------------------------------------------------------------
# Main Entry Point
# -------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AshenAI Remote Server")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Hugging Face Model ID")
    parser.add_argument("--port", type=int, default=8000, help="Local Port")
    parser.add_argument("--4bit", dest="four_bit", action="store_true", default=True, help="Use 4-bit quantization")
    parser.add_argument("--tunnel", type=str, default="cloudflare", choices=["cloudflare", "ngrok", "none"], help="Tunnel provider")
    parser.add_argument("--ngrok-token", type=str, default=None, help="Ngrok Auth Token if using ngrok")
    args = parser.parse_args()

    # Load model
    load_llm_model(args.model, load_in_4bit=args.four_bit)

    # Start Tunnel
    if args.tunnel == "cloudflare":
        start_cloudflare_tunnel(args.port)
    elif args.tunnel == "ngrok":
        try:
            from pyngrok import ngrok
            if args.ngrok_token:
                ngrok.set_auth_token(args.ngrok_token)
            public_url = ngrok.connect(args.port).public_url
            print("\n" + "="*70)
            print(f"🎉 NGROK TUNNEL ONLINE: {public_url}")
            print("="*70 + "\n")
        except Exception as e:
            print(f"Failed to start ngrok: {e}")

    # Start Uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)

