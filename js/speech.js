// Vaachan Unified Speech Recognition & Audio Resource Manager
(function() {
  class VaachanSpeechEngine {
    constructor() {
      this.isNative = false;
      this.isRecording = false;
      this.recognizer = null;
      this.onResultCallback = null;
      this.onErrorCallback = null;
      this.onEndCallback = null;
      this.selectedLang = 'english';
      this.CapacitorSR = null;

      this.checkEnvironment();
    }

    async checkEnvironment() {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        this.isNative = true;
        if (window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) {
          this.CapacitorSR = window.Capacitor.Plugins.SpeechRecognition;
        }
      }
    }

    async requestPermissions() {
      if (this.isNative && this.CapacitorSR) {
        try {
          const hasPermission = await this.CapacitorSR.hasPermission();
          if (!hasPermission.permission) {
            await this.CapacitorSR.requestPermission();
          }
        } catch (e) {
          console.warn("Capacitor SpeechRecognition permission request error:", e);
        }
      }
    }

    async start(lang = 'english', onResult, onError, onEnd) {
      this.selectedLang = lang;
      this.onResultCallback = onResult;
      this.onErrorCallback = onError;
      this.onEndCallback = onEnd;
      this.isRecording = true;

      const langCode = (lang === 'hindi' || lang === 'hi') ? 'hi-IN' : 'en-IN';

      // 1. NATIVE CAPACITOR APK PATH
      if (this.isNative && this.CapacitorSR) {
        try {
          await this.requestPermissions();
          
          // Add partial result listener
          this.CapacitorSR.removeAllListeners();
          this.CapacitorSR.addListener('partialResults', (data) => {
            if (!this.isRecording) return;
            if (data && data.matches && data.matches.length > 0) {
              const text = data.matches.join(' ');
              if (this.onResultCallback) this.onResultCallback(text, false);
            }
          });

          await this.CapacitorSR.start({
            language: langCode,
            maxResults: 5,
            prompt: 'Say something...',
            partialResults: true,
            popup: false
          });
          return true;
        } catch (e) {
          console.warn("Native Capacitor Speech Recognition start failed, falling back to Web Speech API:", e);
          // Fall through to Web Speech API
        }
      }

      // 2. WEB SPEECH API PATH (Chrome / Edge / Safari fallback)
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        if (this.onErrorCallback) this.onErrorCallback('not-supported');
        return false;
      }

      return this.startWebSR(SR, langCode);
    }

    startWebSR(SR, langCode) {
      if (!this.isRecording) return false;

      try {
        if (this.recognizer) {
          try { this.recognizer.abort(); } catch (e) {}
          this.recognizer = null;
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const r = new SR();
        r.continuous = !isMobile; // Mobile Chrome requires continuous = false
        r.interimResults = true;
        r.lang = langCode;
        r.maxAlternatives = 1;

        r.onresult = (event) => {
          if (!this.isRecording) return;
          let final = "";
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) final += res[0].transcript + " ";
            else interim += res[0].transcript;
          }
          if (this.onResultCallback) {
            this.onResultCallback((final + " " + interim).trim(), true);
          }
        };

        r.onend = () => {
          if (this.isRecording) {
            // Auto-restart for continuous mobile speech recognition
            setTimeout(() => {
              if (this.isRecording) this.startWebSR(SR, langCode);
            }, 150);
          } else {
            if (this.onEndCallback) this.onEndCallback();
          }
        };

        r.onerror = (e) => {
          console.warn("Web Speech API error:", e.error);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
            if (this.onErrorCallback) this.onErrorCallback(e.error);
          } else if (this.isRecording) {
            setTimeout(() => {
              if (this.isRecording) this.startWebSR(SR, langCode);
            }, 300);
          }
        };

        r.start();
        this.recognizer = r;
        return true;
      } catch (err) {
        console.warn("Web SR start exception:", err);
        if (this.onErrorCallback) this.onErrorCallback(err.message || 'start-failed');
        return false;
      }
    }

    async stop() {
      this.isRecording = false;

      // 1. Stop Native Capacitor SR
      if (this.isNative && this.CapacitorSR) {
        try {
          await this.CapacitorSR.stop();
          this.CapacitorSR.removeAllListeners();
        } catch (e) {
          console.warn("Capacitor SR stop error:", e);
        }
      }

      // 2. Stop Web SR
      if (this.recognizer) {
        try {
          this.recognizer.stop();
        } catch (e) {
          try { this.recognizer.abort(); } catch (err) {}
        }
        this.recognizer = null;
      }
    }
  }

  window.VaachanSpeech = new VaachanSpeechEngine();
})();
