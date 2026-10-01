"""
AshenAI Local Inference Server
==============================
Run this script on your local machine to host the inference server locally.
It matches your exact Kaggle FastAPI server structure with GPU auto-detection.

Usage:
  python local_inference_server.py --model huihui-ai/Qwen3-14B-abliterated --port 8000
"""

import os
import time
import json
import uuid
import asyncio
import threading
import argparse
from typing import List, Optional

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TextIteratorStreamer
)

# Optional HF login from environment variable
hf_token = os.getenv("HF_TOKEN")
if hf_token:
    try:
        from huggingface_hub import login
        login(token=hf_token)
        print("✅ Logged into Hugging Face via HF_TOKEN environment variable.")
    except Exception as e:
        print(f"Hugging Face login note: {e}")

parser = argparse.ArgumentParser(description="AshenAI Local Inference Server")
parser.add_argument("--model", type=str, default="huihui-ai/Qwen3-14B-abliterated", help="HuggingFace model ID")
parser.add_argument("--port", type=int, default=8000, help="Port to run the FastAPI server")
parser.add_argument("--no-4bit", dest="load_in_4bit", action="store_false", default=True, help="Disable 4-bit quantization")
args = parser.parse_args()

model_id = args.model
PORT = args.port

print(f"\n=======================================================")
print(f"🚀 Initializing Local Inference Server: {model_id}")
print(f"🔥 CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    for i in range(torch.cuda.device_count()):
        print(f"   ⚡ GPU {i}: {torch.cuda.get_device_name(i)}")
print(f"=======================================================\n")

tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, padding_side="left")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

if args.load_in_4bit and torch.cuda.is_available():
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True
    )
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=quantization_config,
        device_map="auto",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
else:
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        device_map="auto" if torch.cuda.is_available() else None,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    if not torch.cuda.is_available():
        model.to("cpu")

print(f"\n✅ Model '{model_id}' ready for local inference!\n")

# FastAPI App
app = FastAPI(title="AshenAI Local Inference Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "online",
        "model": model_id,
        "gpus": torch.cuda.device_count() if torch.cuda.is_available() else 0,
        "cuda_available": torch.cuda.is_available()
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

if __name__ == "__main__":
    print("=" * 60)
    print(f"👉 Local server running on: http://127.0.0.1:{PORT}")
    print(f"👉 Open your local website Settings (⚙️) and enter: http://127.0.0.1:{PORT}")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=PORT)

