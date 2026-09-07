// Vaachan Unified Speech Recognition & Audio Resource Manager
(function() {
  class VaachanSpeechEngine {
    constructor() {
      this.isNative = false;
      this.isRecording = false;
      this.isRestarting = false;
      this.recognizer = null;
      this.onResultCallback = null;
      this.onErrorCallback = null;
      this.onEndCallback = null;
      this.selectedLang = 'english';
      this.CapacitorSR = null;
      this.restartTimer = null;

      // Cumulative transcript tracking across continuous mobile auto-restarts
      this.sessionFinalTranscript = "";
      this.currentPhrase = "";
      this.lastSpeechTime = 0;
      this.isSpeaking = false;

      this.checkEnvironment();
    }

    async checkEnvironment() {
      try {
        if (window.Capacitor) {
          const isNative = typeof window.Capacitor.isNativePlatform === 'function' 
            ? window.Capacitor.isNativePlatform() 
            : !!(window.Capacitor.platform && window.Capacitor.platform !== 'web');

          if (isNative) {
            this.isNative = true;
            if (window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) {
              this.CapacitorSR = window.Capacitor.Plugins.SpeechRecognition;
            } else if (typeof window.Capacitor.registerPlugin === 'function') {
              try {
                this.CapacitorSR = window.Capacitor.registerPlugin('SpeechRecognition');
              } catch (e) {
                console.warn("Could not register Capacitor SpeechRecognition plugin:", e);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Environment check error:", err);
      }
    }

    async requestPermissions() {
      if (!this.isNative || !this.CapacitorSR) return true;
      try {
        // 1. Modern Capacitor 6 Plugin API
        if (typeof this.CapacitorSR.checkPermissions === 'function') {
          const status = await this.CapacitorSR.checkPermissions();
          const needsMic = status.microphone && status.microphone !== 'granted';
          const needsSR = status.speechRecognition && status.speechRecognition !== 'granted';

          if (needsMic || needsSR) {
            if (typeof this.CapacitorSR.requestPermissions === 'function') {
              const reqStatus = await this.CapacitorSR.requestPermissions();
              if ((reqStatus.microphone && reqStatus.microphone !== 'granted') ||
                  (reqStatus.speechRecognition && reqStatus.speechRecognition !== 'granted')) {
                console.warn("User denied native speech recognition or mic permissions");
                return false;
              }
            }
          }
          return true;
        }

        // 2. Legacy Capacitor Plugin API fallback
        if (typeof this.CapacitorSR.hasPermission === 'function') {
          const has = await this.CapacitorSR.hasPermission();
          if (!has.permission && typeof this.CapacitorSR.requestPermission === 'function') {
            await this.CapacitorSR.requestPermission();
          }
          return true;
        }
      } catch (e) {
        console.warn("Capacitor SpeechRecognition permission check error:", e);
      }
      return true;
    }

    async start(lang = 'english', onResult, onError, onEnd) {
      this.selectedLang = lang;
      this.onResultCallback = onResult;
      this.onErrorCallback = onError;
      this.onEndCallback = onEnd;
      this.isRecording = true;
      this.isRestarting = false;
      this.sessionFinalTranscript = "";
      this.currentPhrase = "";
      this.lastSpeechTime = 0;
      this.isSpeaking = false;

      await this.checkEnvironment();

      const langCode = (lang === 'hindi' || lang === 'hi') ? 'hi-IN' : 'en-IN';

      // 1. NATIVE CAPACITOR APK PATH
      if (this.isNative && this.CapacitorSR) {
        const permitted = await this.requestPermissions();
        if (permitted) {
          const nativeStarted = await this.startNativeSR(langCode);
          if (nativeStarted) return true;
        }
        console.warn("Native Capacitor Speech Recognition start failed, falling back to Web Speech API");
      }

      // 2. WEB SPEECH API PATH (Chrome / Edge / Safari fallback)
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        if (this.onErrorCallback) this.onErrorCallback('not-supported');
        return false;
      }

      return this.startWebSR(SR, langCode);
    }

    async startNativeSR(langCode) {
      if (!this.isRecording || !this.CapacitorSR) return false;

      try {
        try {
          await this.CapacitorSR.removeAllListeners();
        } catch (e) {}

        // Listen for real-time partial results
        this.CapacitorSR.addListener('partialResults', (data) => {
          if (!this.isRecording) return;
          if (data && data.matches && data.matches.length > 0) {
            const bestMatch = data.matches[0];
            this.currentPhrase = bestMatch;
            this.lastSpeechTime = performance.now();
            this.isSpeaking = true;

            const fullText = (this.sessionFinalTranscript + " " + bestMatch).trim();
            if (this.onResultCallback) {
              this.onResultCallback(fullText);
            }
          }
        });

        // Listen for native listening state changes (handles Android pause/silence timeout)
        this.CapacitorSR.addListener('listeningState', (data) => {
          if (!this.isRecording) return;
          if (data && data.status === 'stopped') {
            this.onNativeSessionStopped(langCode);
          }
        });

        await this.CapacitorSR.start({
          language: langCode,
          maxResults: 3,
          prompt: 'Reading passage...',
          partialResults: true,
          popup: false
        });

        return true;
      } catch (e) {
        console.warn("Native Capacitor Speech Recognition start exception:", e);
        return false;
      }
    }

    onNativeSessionStopped(langCode) {
      this.isSpeaking = false;
      // Commit the current phrase to the session accumulated transcript
      if (this.currentPhrase) {
        this.sessionFinalTranscript = (this.sessionFinalTranscript + " " + this.currentPhrase).trim();
        this.currentPhrase = "";
      }

      // If user is still recording, auto-restart to ensure continuous reading assessment
      if (this.isRecording && !this.isRestarting) {
        this.isRestarting = true;
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(async () => {
          this.isRestarting = false;
          if (this.isRecording && this.CapacitorSR) {
            try {
              await this.CapacitorSR.start({
                language: langCode,
                maxResults: 3,
                prompt: 'Reading passage...',
                partialResults: true,
                popup: false
              });
            } catch (err) {
              console.warn("Native SR restart failed:", err);
            }
          }
        }, 150);
      }
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
        // Mobile Chrome frequently cuts off if continuous=true; continuous=false with auto-restart is most reliable
        r.continuous = !isMobile;
        r.interimResults = true;
        r.lang = langCode;
        r.maxAlternatives = 1;

        r.onresult = (event) => {
          if (!this.isRecording) return;
          let newFinal = "";
          let interim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) newFinal += res[0].transcript + " ";
            else interim += res[0].transcript;
          }

          if (newFinal) {
            this.sessionFinalTranscript = (this.sessionFinalTranscript + " " + newFinal).trim();
          }
          this.currentPhrase = interim;
          this.lastSpeechTime = performance.now();
          this.isSpeaking = true;

          const fullText = (this.sessionFinalTranscript + " " + interim).trim();
          if (this.onResultCallback) {
            this.onResultCallback(fullText);
          }
        };

        r.onend = () => {
          this.isSpeaking = false;
          if (this.currentPhrase) {
            this.sessionFinalTranscript = (this.sessionFinalTranscript + " " + this.currentPhrase).trim();
            this.currentPhrase = "";
          }

          if (this.isRecording) {
            // Auto-restart for continuous mobile speech recognition without losing previous words
            if (this.restartTimer) clearTimeout(this.restartTimer);
            this.restartTimer = setTimeout(() => {
              if (this.isRecording) this.startWebSR(SR, langCode);
            }, 100);
          } else {
            if (this.onEndCallback) this.onEndCallback();
          }
        };

        r.onerror = (e) => {
          console.warn("Web Speech API error:", e.error);
          if (e.error === 'no-speech') {
            // Normal pause during reading; continue listening
            return;
          }
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            this.isRecording = false;
            if (this.onErrorCallback) this.onErrorCallback(e.error);
          } else if (this.isRecording) {
            if (this.restartTimer) clearTimeout(this.restartTimer);
            this.restartTimer = setTimeout(() => {
              if (this.isRecording) this.startWebSR(SR, langCode);
            }, 250);
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
      this.isRestarting = false;
      this.isSpeaking = false;

      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }

      if (this.currentPhrase) {
        this.sessionFinalTranscript = (this.sessionFinalTranscript + " " + this.currentPhrase).trim();
        this.currentPhrase = "";
      }

      // 1. Stop Native Capacitor SR
      if (this.isNative && this.CapacitorSR) {
        try {
          await this.CapacitorSR.stop();
        } catch (e) {}
        try {
          await this.CapacitorSR.removeAllListeners();
        } catch (e) {}
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

    // Helper: returns true if user was speaking recently (< 1.2s)
    isUserSpeaking() {
      if (!this.isRecording) return false;
      return this.isSpeaking || (performance.now() - this.lastSpeechTime < 1200);
    }
  }

  window.VaachanSpeech = new VaachanSpeechEngine();
})();
