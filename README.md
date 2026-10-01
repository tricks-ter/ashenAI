# AshenAI ⚡ - Modern AI Chat Interface with Remote Colab / Kaggle GPU Backend

> A responsive, high-performance web interface inspired by **Gemini** and **ChatGPT**, featuring dark/light themes, LaTeX math formula rendering, syntax-highlighted code blocks with one-click copy, and seamless connectivity to open-source LLMs running on free **Google Colab** or **Kaggle** GPUs.

---

## ✨ Features

- 🌓 **Dark & Light Mode**: High-contrast, theme support with smooth transitions.
- 📱 **Desktop & Mobile Responsive**:
  - Desktop: Collapsible sidebar, multi-session management, keyboard shortcuts (`Ctrl+K` for new chat, `Ctrl+,` for settings).
  - Mobile: Slide-out drawer with backdrop blur, touch-friendly UI, and responsive safe areas.
- 🧮 **Rich Markdown & LaTeX Math**:
  - Full GitHub-Flavored Markdown (headers, tables, blockquotes, lists).
  - LaTeX Math rendering via KaTeX ($E = mc^2$ inline and $$\\sum x_i$$ block display).
- 💻 **Syntax Highlighted Code**:
  - Multi-language syntax highlighting via PrismJS with language tags and copy button.
- 🧠 **Thought Process & Reasoning View**:
  - Animated collapsible `<think>` thought block for reasoning models like **DeepSeek-R1** and **Gemini 2.0 Flash Thinking**.
- 🎙️ **Voice Recognition & Speech**:
  - Dictate queries with the microphone button (Web Speech Recognition API).
  - Text-to-Speech playback to read assistant responses aloud.
- 🚀 **Free Remote GPU Bridge (Colab & Kaggle)**:
  - Connects to remote FastAPI servers hosted on Google Colab or Kaggle via **Cloudflare Tunnel** (100% free, no account needed) or **ngrok**.
  - True token-by-token streaming with Server-Sent Events (SSE).
  - Standard OpenAI `/v1/chat/completions` API compatibility.
- 💾 **Local Persistence & Export**:
  - Multi-conversation history with date grouping (Today, Yesterday, Previous 7 Days).
  - Export conversations to Markdown (`.md`) or full backup in JSON.

---

## 🏗️ Architecture

```
                                  +---------------------------------------+
                                  |        AshenAI Web Interface          |
                                  |   (Desktop & Mobile Responsive UI)    |
                                  |   - Dark / Light / System Theme       |
                                  |   - Chat History (LocalStorage)       |
                                  |   - Markdown + KaTeX Math + Code Copy |
                                  |   - Speech-to-Text & Text-to-Speech   |
                                  +-------------------+-------------------+
                                                      |
                                         (HTTPS / SSE Streaming)
                                                      |
                                                      v
                                  +---------------------------------------+
                                  | Cloudflare Tunnel / Ngrok / Custom URL|
                                  +-------------------+-------------------+
                                                      |
                                                      v
                        +-------------------------------------------------------------+
                        |           Google Colab / Kaggle GPU Runtime                 |
                        |                                                             |
                        |  - FastAPI OpenAI-compatible Server (/v1/chat/completions)  |
                        |  - Transformers + BitsAndBytes (4-bit/8-bit Quantization)   |
                        |  - Model options: Qwen 2.5, Llama 3.1, DeepSeek-R1, Gemma 2 |
                        +-------------------------------------------------------------+
```

---

## 🚀 Quick Start (Local Web Interface)

### 1. Start the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 2. Build for Production
```bash
npm run build
npm run preview
```

---

## ☁️ Running Your Model on Google Colab or Kaggle GPU

### Option A: Google Colab (Free T4 GPU - Recommended)
1. Open [Google Colab](https://colab.research.google.com).
2. Go to **Runtime** > **Change runtime type** and select **T4 GPU**.
3. Upload the included notebook: [`colab-backend/colab_kaggle_backend.ipynb`](colab-backend/colab_kaggle_backend.ipynb).
4. Run all cells. In ~1 minute, the cell will print your public Cloudflare Tunnel URL:
   ```
   🎉 SUCCESS! YOUR ASHENAI BACKEND URL IS: https://random-name.trycloudflare.com
   ```
5. In AshenAI, click the **⚙️ Settings** icon in the header, paste the URL into **Remote Backend URL**, and click **Test Connection**!

### Option B: Kaggle Notebooks (2x T4 or P100 GPU)
1. Create a new notebook on [Kaggle](https://www.kaggle.com/code).
2. In the right panel under **Settings**, select **Accelerator: GPU T4 x2** and turn **Internet: ON**.
3. Copy the code from `colab-backend/colab_server.py` or import `colab-backend/colab_kaggle_backend.ipynb`.
4. Run the notebook and paste the generated Cloudflare tunnel URL into AshenAI settings.

---

## ⚙️ Supported Models for Free Colab T4 GPU (4-bit NF4)

| Model Name | HuggingFace Identifier | Recommended VRAM | Speed |
| :--- | :--- | :--- | :--- |
| **Qwen 2.5 7B Instruct** | `Qwen/Qwen2.5-7B-Instruct` | ~6.5 GB | ⚡⚡⚡ Fast |
| **DeepSeek R1 Distill 7B** | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | ~6.5 GB | ⚡⚡ Fast (Reasoning) |
| **Llama 3.1 8B Instruct** | `meta-llama/Meta-Llama-3.1-8B-Instruct` | ~7.2 GB | ⚡⚡ Fast |
| **Gemma 2 9B IT** | `google/gemma-2-9b-it` | ~8.0 GB | ⚡⚡ Fast |
| **Mistral 7B Instruct v0.3** | `mistralai/Mistral-7B-Instruct-v0.3` | ~6.5 GB | ⚡⚡⚡ Fast |

---

## ⌨️ Keyboard Shortcuts

- `Enter`: Send message
- `Shift + Enter`: New line in prompt input
- `Ctrl + K` / `Cmd + K`: Create new conversation
- `Ctrl + ,` / `Cmd + ,`: Open Settings modal

