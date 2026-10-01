/**
 * Realistic Mock Streaming Engine for AshenAI
 * Generates rich markdown, reasoning (<think>), math, and code responses
 * when testing offline or before starting the Colab/Kaggle GPU.
 */

const SAMPLE_RESPONSES = [
  {
    keywords: ['code', 'python', 'script', 'function', 'program'],
    text: `<think>
The user is asking for code implementation. I will provide a clean, modern Python solution with type hints, docstrings, and a concise explanation.
</think>

Here is an efficient, clean implementation in Python:

\`\`\`python
import time
from typing import Generator, List, Dict, Any

class ModelInferenceStreamer:
    """Simulates token-by-token text streaming with latency control."""
    
    def __init__(self, model_name: str = "Qwen/Qwen2.5-7B-Instruct"):
        self.model_name = model_name
        self.is_ready = True
        
    def stream_tokens(self, prompt: str, delay_sec: float = 0.02) -> Generator[str, None, None]:
        tokens = prompt.split(" ")
        for token in tokens:
            time.sleep(delay_sec)
            yield token + " "

# Example execution
if __name__ == "__main__":
    streamer = ModelInferenceStreamer()
    print(f"Connected to {streamer.model_name}")
    for chunk in streamer.stream_tokens("AshenAI is running on high-speed remote GPU."):
        print(chunk, end="", flush=True)
\`\`\`

### Key Features:
1. **Generator-based**: Streams chunks asynchronously without blocking the event loop.
2. **Type Annotations**: Clean Python 3.10+ typing for high maintainability.
3. **Plug-and-Play**: Compatible with standard FastAPI \`StreamingResponse\`.`
  },
  {
    keywords: ['math', 'quantum', 'physics', 'formula', 'calculate', 'equation'],
    text: `<think>
The user is inquiring about a scientific or mathematical concept. I should explain clearly and use LaTeX math notation ($ for inline and $$ for display).
</think>

In quantum physics and neural network optimization, mathematical formulations provide the rigorous basis for behavior:

### The Schrödinger Equation
The time-dependent Schrödinger equation is given by:

$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\left[ -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r}, t) \\right] \\Psi(\\mathbf{r}, t)$$

Where:
- $\\Psi(\\mathbf{r}, t)$ is the quantum wave function.
- $\\hbar = \\frac{h}{2\\pi}$ represents the reduced Planck constant.
- $-\\frac{\\hbar^2}{2m}\\nabla^2$ denotes the kinetic energy operator.

### Attention Mechanism in Transformers
Similarly, Scaled Dot-Product Attention in modern LLMs is computed as:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

Where $d_k$ is the dimensionality of query/key vectors preventing small gradients during softmax saturation.`
  },
  {
    keywords: ['hello', 'hi', 'who are you', 'ashen', 'help', 'test'],
    text: `Hello! I am **AshenAI**, your high-performance AI chat interface. 

✨ **Current Status**:
- **UI Mode**: Fully Responsive (Desktop & Mobile Optimized)
- **Theme**: Dark & Light Theme Ready
- **GPU Backend**: Connects directly to **Google Colab** or **Kaggle** (via Cloudflare Tunnel or ngrok).

### Quick Actions:
1. Click the **⚙️ Settings** icon in the header to enter your Colab/Kaggle Cloudflare tunnel URL.
2. Use the **Colab Guide** tab in Settings to launch your free GPU server with 1 click.
3. You can toggle **Dark / Light** mode anytime in the top right.

How can I help you today? Feel free to ask for code, explanations, math formulas, or writing!`
  }
];

export async function* mockStreamGenerator(prompt, systemPrompt = '') {
  const lower = prompt.toLowerCase();
  let selected = SAMPLE_RESPONSES.find(s => s.keywords.some(k => lower.includes(k)));

  let fullResponse = selected ? selected.text : `<think>
Analyzing user query: "${prompt}"
Synthesizing structured response with formatting, key points, and clear explanations.
</think>

Thank you for your prompt: **"${prompt}"**.

### Overview
This is a live simulated response from **AshenAI** running in local preview mode. Once you start your Google Colab or Kaggle backend, your prompts will be processed directly by your loaded LLM (such as Llama 3.1, Qwen 2.5, or DeepSeek R1)!

### What you can do:
- **Markdown formatting**: *Italics*, **Bold**, lists, and tables.
- **Math LaTeX**: Inline $E = mc^2$ or block $$\\sum_{i=1}^{n} x_i = X$$
- **Code Highlighting**: Copy-ready code snippets with line numbers.
- **Voice Recognition**: Click the microphone icon to speak.

> 💡 *Tip: Open Settings (⚙️) to connect your Colab / Kaggle Cloudflare tunnel URL.*`;

  // Split into realistic chunks (words / punctuation)
  const chunks = fullResponse.match(/[\s\S]{1,6}/g) || [fullResponse];
  for (const chunk of chunks) {
    await new Promise(r => setTimeout(r, 20 + Math.random() * 25));
    yield chunk;
  }
}

