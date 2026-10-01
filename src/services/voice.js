/**
 * Real-Time Voice Input & Speech-to-Text Service using Web Speech API
 */

import { logger } from './logger';

export class VoiceRecognitionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;
    this._init();
  }

  _init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.isSupported = false;
      return;
    }
    this.isSupported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      logger.info('SYSTEM', 'Voice recognition listening started');
      if (this.onStateChangeCallback) this.onStateChangeCallback(true);
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(finalTranscript, interimTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      logger.warn('SYSTEM', `Voice recognition error: ${event.error}`);
      this.isListening = false;
      if (this.onErrorCallback) this.onErrorCallback(event.error);
      if (this.onStateChangeCallback) this.onStateChangeCallback(false);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChangeCallback) this.onStateChangeCallback(false);
    };
  }

  start(onTranscript, onError, onStateChange) {
    if (!this.isSupported) {
      if (onError) onError('Speech recognition not supported in this browser.');
      return;
    }

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
    this.onStateChangeCallback = onStateChange;

    try {
      this.recognition.start();
    } catch (e) {
      console.warn('Voice start exception:', e);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  toggle(onTranscript, onError, onStateChange) {
    if (this.isListening) {
      this.stop();
    } else {
      this.start(onTranscript, onError, onStateChange);
    }
  }
}

export const voiceService = new VoiceRecognitionService();

