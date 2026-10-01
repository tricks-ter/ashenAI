/**
 * AshenAI Remote Backend & Streaming API Client
 * Compatible with standard OpenAI `/v1/chat/completions` specification
 */

import { mockStreamGenerator } from './mockEngine';
import { logger } from './logger';

export async function checkBackendHealth(baseUrl, apiKey = '') {
  const cleanUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  if (!cleanUrl) {
    logger.info('SYSTEM', 'Backend health check skipped: No URL provided');
    return { online: false, error: 'No URL provided' };
  }

  const startTime = performance.now();
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  logger.info('NETWORK', `Testing connection to: ${cleanUrl}/health`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/health`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latency = Math.round(performance.now() - startTime);
    if (res.ok) {
      const data = await res.json();
      const gpuInfo = data.gpus ? `${data.gpus}x GPU (Kaggle)` : (data.device?.gpu || (data.cuda_available ? 'CUDA GPU' : 'GPU Server'));
      logger.info('NETWORK', `Backend online (${latency}ms): ${data.model || 'Model ready'}`, { latency, gpu: gpuInfo, data });
      return {
        online: true,
        latency,
        data,
        model: data.model || 'huihui-ai/Qwen3-14B-abliterated',
        gpu: gpuInfo
      };
    } else {
      const errMsg = `HTTP ${res.status}: ${res.statusText}`;
      logger.warn('NETWORK', `Backend returned status ${res.status}`, { status: res.status, statusText: res.statusText });
      return { online: false, error: errMsg, latency };
    }
  } catch (err) {
    // Also try /v1/models if /health is not implemented
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${cleanUrl}/v1/models`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        const modelName = data.data?.[0]?.id || 'Remote LLM';
        logger.info('NETWORK', `Backend /v1/models reachable (${latency}ms): ${modelName}`, data);
        return { online: true, latency, data, model: modelName };
      }
    } catch (_) {
      // Ignore fallback error
    }

    const errorMsg = err.name === 'AbortError' ? 'Connection timed out (6s)' : (err.message || 'Cannot connect to remote server');
    logger.error('NETWORK', `Connection failed: ${errorMsg}`, { error: String(err), url: cleanUrl });
    return {
      online: false,
      error: errorMsg
    };
  }
}

/**
 * Stream chat completions from Colab/Kaggle or local backend
 */
export async function streamChatCompletions({
  messages,
  settings,
  signal,
  onDelta,
  onError,
  onFinish
}) {
  const cleanUrl = settings.backendUrl ? settings.backendUrl.replace(/\/+$/, '') : '';

  // Prepare system prompt if defined
  const fullMessages = [];
  if (settings.systemPrompt && settings.systemPrompt.trim()) {
    fullMessages.push({
      role: 'system',
      content: settings.systemPrompt.trim()
    });
  }

  // Format message history
  for (const msg of messages) {
    fullMessages.push({
      role: msg.role,
      content: msg.content
    });
  }

  // If no backend URL or mock forced
  if (!cleanUrl) {
    if (settings.useMockWhenOffline) {
      logger.info('STREAM', 'Running in local simulation mode (No remote backend URL configured)');
      try {
        const lastUserPrompt = messages[messages.length - 1]?.content || 'Hello';
        for await (const chunk of mockStreamGenerator(lastUserPrompt, settings.systemPrompt)) {
          if (signal?.aborted) break;
          try {
            onDelta(chunk);
          } catch (e) {
            console.error('onDelta error in mock:', e);
          }
        }
        onFinish();
        return;
      } catch (e) {
        logger.error('STREAM', `Mock generation failed: ${e.message}`, e);
        onError(e.message);
        return;
      }
    } else {
      const err = 'No backend URL configured. Please configure your Colab/Kaggle backend URL in Settings.';
      logger.error('STREAM', err);
      onError(err);
      return;
    }
  }

  const endpoint = `${cleanUrl}/v1/chat/completions`;
  const payload = {
    model: settings.modelName || 'huihui-ai/Qwen3-14B-abliterated',
    messages: fullMessages,
    temperature: Number(settings.temperature) ?? 0.6,
    top_p: Number(settings.topP) ?? 0.95,
    top_k: Number(settings.topK) ?? 20,
    repetition_penalty: Number(settings.repetitionPenalty) ?? 1.1,
    max_tokens: Number(settings.maxTokens) ?? 2048,
    stream: true
  };

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  };

  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  logger.info('NETWORK', `POST ${endpoint} (${fullMessages.length} messages, max_tokens=${payload.max_tokens})`, {
    endpoint,
    parameters: {
      temperature: payload.temperature,
      top_p: payload.top_p,
      top_k: payload.top_k,
      repetition_penalty: payload.repetition_penalty,
      max_tokens: payload.max_tokens
    },
    latestUserPrompt: fullMessages[fullMessages.length - 1]?.content?.slice(0, 300) + '...'
  });

  let tokenCount = 0;
  let charCount = 0;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Server error (${response.status}): ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) errorMsg = parsed.error.message;
        else if (parsed.detail) errorMsg = parsed.detail;
      } catch (_) {}
      logger.error('NETWORK', `Inference request rejected (${response.status}): ${errorMsg}`, { responseText: errorText });
      throw new Error(errorMsg);
    }

    logger.info('STREAM', `SSE Stream connected (HTTP 200 OK) from ${cleanUrl}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete trailing line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.substring(6).trim();
          if (dataStr === '[DONE]') {
            logger.info('STREAM', `Stream finished cleanly ([DONE] received). Total tokens: ~${tokenCount}, chars: ${charCount}`);
            onFinish();
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              tokenCount++;
              charCount += delta.length;
              try {
                onDelta(delta);
              } catch (callbackErr) {
                console.error('Error inside onDelta callback:', callbackErr);
                logger.error('STREAM', `onDelta callback error: ${callbackErr.message}`, callbackErr);
              }
            }
          } catch (e) {
            // Ignore JSON parse chunk anomalies
          }
        }
      }
    }

    logger.info('STREAM', `Stream completed (reader done). Total tokens: ~${tokenCount}, chars: ${charCount}`);
    onFinish();
  } catch (err) {
    if (signal?.aborted) {
      logger.info('STREAM', 'Generation stopped by user.');
      onFinish();
      return;
    }

    logger.error('STREAM', `Streaming failed: ${err.message}`, { error: String(err) });

    // If server fails and mock fallback is enabled, switch smoothly to mock
    if (settings.useMockWhenOffline) {
      logger.warn('STREAM', 'Falling back to local simulation engine due to network error.');
      try {
        const lastUserPrompt = messages[messages.length - 1]?.content || 'Hello';
        for await (const chunk of mockStreamGenerator(lastUserPrompt, settings.systemPrompt)) {
          if (signal?.aborted) break;
          try {
            onDelta(chunk);
          } catch (cbErr) {
            console.error('Mock onDelta callback error:', cbErr);
          }
        }
        onFinish();
        return;
      } catch (mockErr) {
        logger.error('STREAM', `Mock simulation failed: ${mockErr.message}`, mockErr);
        onError(mockErr.message);
        return;
      }
    }

    onError(err.message || 'Failed to stream response from backend.');
  }
}

