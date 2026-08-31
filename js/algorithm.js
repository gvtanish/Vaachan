// Reading Fluency Analysis Engine
(function() {
  window.algorithm = {
    // Clean text helper (removes punctuation, normalizes spacing)
    cleanText(str, lang) {
      if (!str) return "";
      let cleaned = str.toLowerCase();
      // Strip common punctuation (English & Hindi specific)
      cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()।?|'"\u201c\u201d\u2018\u2019]/g, "");
      // Replace double spaces
      cleaned = cleaned.replace(/\s+/g, " ");
      return cleaned.trim();
    },

    // Wagner-Fischer word-level alignment algorithm
    alignWords(refText, heardText, lang) {
      const cleanRef = this.cleanText(refText, lang);
      const cleanHeard = this.cleanText(heardText, lang);

      const refWords = cleanRef.split(" ").filter(Boolean);
      const heardWords = cleanHeard.split(" ").filter(Boolean);

      const M = refWords.length;
      const N = heardWords.length;

      if (M === 0) return { path: [], accuracy: 0, errors: 0 };
      if (N === 0) {
        // All words omitted
        const path = refWords.map((w, idx) => ({
          refIndex: idx,
          heardIndex: -1,
          refWord: w,
          heardWord: null,
          type: 'omission'
        }));
        return { path, accuracy: 0, errors: M };
      }

      // Cost matrix
      const dp = Array(M + 1).fill(null).map(() => Array(N + 1).fill(0));
      for (let i = 0; i <= M; i++) dp[i][0] = i * 1.0; // Omissions
      for (let j = 0; j <= N; j++) dp[0][j] = j * 0.5; // Insertions (lower penalty)

      for (let i = 1; i <= M; i++) {
        for (let j = 1; j <= N; j++) {
          const cost = (refWords[i - 1] === heardWords[j - 1]) ? 0 : 1.0;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1.0,     // Omission
            dp[i][j - 1] + 0.5,     // Insertion
            dp[i - 1][j - 1] + cost // Match or Substitution
          );
        }
      }

      // Backtracking to find the alignment path
      let i = M, j = N;
      const path = [];
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
          const cost = (refWords[i - 1] === heardWords[j - 1]) ? 0 : 1.0;
          const omit = dp[i - 1][j] + 1.0;
          const insert = dp[i][j - 1] + 0.5;
          const matchSub = dp[i - 1][j - 1] + cost;

          if (Math.abs(dp[i][j] - matchSub) < 0.0001) {
            path.push({
              refIndex: i - 1,
              heardIndex: j - 1,
              refWord: refWords[i - 1],
              heardWord: heardWords[j - 1],
              type: cost === 0 ? 'correct' : 'substitution'
            });
            i--; j--;
          } else if (Math.abs(dp[i][j] - omit) < 0.0001) {
            path.push({
              refIndex: i - 1,
              heardIndex: -1,
              refWord: refWords[i - 1],
              heardWord: null,
              type: 'omission'
            });
            i--;
          } else {
            path.push({
              refIndex: -1,
              heardIndex: j - 1,
              refWord: null,
              heardWord: heardWords[j - 1],
              type: 'insertion'
            });
            j--;
          }
        } else if (i > 0) {
          path.push({
            refIndex: i - 1,
            heardIndex: -1,
            refWord: refWords[i - 1],
            heardWord: null,
            type: 'omission'
          });
          i--;
        } else {
          path.push({
            refIndex: -1,
            heardIndex: j - 1,
            refWord: null,
            heardWord: heardWords[j - 1],
            type: 'insertion'
          });
          j--;
        }
      }

      path.reverse();

      // Calculate error count & accuracy
      const correct = path.filter(p => p.type === 'correct').length;
      const substitutions = path.filter(p => p.type === 'substitution').length;
      const omissions = path.filter(p => p.type === 'omission').length;
      const insertions = path.filter(p => p.type === 'insertion').length;

      const totalErrors = substitutions + omissions + (insertions * 0.5);
      const accuracy = Math.max(0, (M - totalErrors) / M);

      return {
        path,
        accuracy,
        correct,
        substitutions,
        omissions,
        insertions
      };
    },

    // Bell curve scoring helper (10 peak)
    bellScore(value, ideal, halfSpread, edgeScore = 0.8) {
      const k = Math.sqrt(-0.5 / Math.log(edgeScore));
      const sigma = Math.max(halfSpread * k, 1e-6);
      const z = (value - ideal) / sigma;
      return Math.max(0, Math.min(10, 10 * Math.exp(-0.5 * z * z)));
    },

    // Percentile helper
    percentile(arr, p) {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = (sorted.length - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    },

    // Median filter for smoothing arrays
    medianFilter(arr, windowSize = 3) {
      const half = Math.floor(windowSize / 2);
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        const lo = Math.max(0, i - half);
        const hi = Math.min(arr.length, i + half + 1);
        const slice = arr.slice(lo, hi).sort((a, b) => a - b);
        result.push(slice[Math.floor(slice.length / 2)]);
      }
      return result;
    },

    // Octave error corrector for pitch contours
    fixOctaveErrors(pitches) {
      const result = [];
      let ref = null;
      for (const p of pitches) {
        let v = p;
        if (ref && v > 0) {
          const ratio = v / ref;
          if (ratio > 1.6) v = v / 2;
          else if (ratio < 0.62) v = v * 2;
        }
        result.push(v);
        if (v > 0) {
          ref = ref === null ? v : ref * 0.7 + v * 0.3;
        }
      }
      return result;
    },

    // Standard deviation helper
    stdev(arr, mean) {
      if (arr.length <= 1) return 0;
      const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / arr.length;
      return Math.sqrt(variance);
    },

    // Main Compute Engine
    compute(samples, durationSec, currentStory, finalTranscript, lang) {
      const targetWords = currentStory.text.split(/\s+/).filter(Boolean).length;
      const heardWords = finalTranscript.split(/\s+/).filter(Boolean).length;

      // 1. Adaptive VAD Threshold
      const rmsValues = samples.map(s => s.rms);
      const smoothedRms = this.medianFilter(rmsValues, 3);
      
      // Calculate noise floor from the quietest 20% frames
      const bottom20 = [...smoothedRms].sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(smoothedRms.length * 0.2)));
      const noiseFloor = bottom20.length ? bottom20[bottom20.length - 1] : 0.01;
      const voiceThreshold = Math.max(noiseFloor * 3.0, 0.015);

      // Trim speaking duration (first voiced to last voiced)
      let speakingSec = durationSec;
      const voicedIndices = [];
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].rms > voiceThreshold) {
          voicedIndices.push(i);
        }
      }

      if (voicedIndices.length >= 2) {
        const firstT = samples[voicedIndices[0]].t;
        const lastT = samples[voicedIndices[voicedIndices.length - 1]].t;
        const trimmed = (lastT - firstT) / 1000;
        // Apply floor guard to prevent extreme WPM estimates
        speakingSec = Math.max(trimmed, durationSec * 0.4);
      }
      const speakingMinutes = Math.max(speakingSec / 60, 0.05);

      // 2. Alignment & Accuracy
      const hasASR = heardWords > 0;
      let alignResult = null;
      let accuracyScore = 10;
      let accuracyPct = 100;
      let correctWords = targetWords;

      if (hasASR) {
        alignResult = this.alignWords(currentStory.text, finalTranscript, lang);
        accuracyPct = alignResult.accuracy * 100;
        correctWords = alignResult.correct;
        // Score Accuracy: ideal 100%, 80% accuracy gets ~7.5, below 50% drops quickly
        accuracyScore = this.bellScore(alignResult.accuracy, 1.0, 0.20, 0.65);
      } else {
        accuracyPct = null; // NA or estimated
        accuracyScore = null;
      }

      // 3. Speed / CWPM calculation
      const cwpm = Math.max(5, Math.min(350, correctWords / speakingMinutes));
      
      // Benchmarks based on class targets
      const benchmarks = {
        3: { english: [53, 82], hindi: [45, 70] },
        4: { english: [78, 115], hindi: [65, 95] },
        5: { english: [95, 140], hindi: [80, 115] }
      };
      
      const classLevel = currentStory.classNum || 3;
      const range = benchmarks[classLevel]?.[lang] || [50, 80];
      const speedMid = (range[0] + range[1]) / 2;
      const speedHalfRange = (range[1] - range[0]) / 2;
      // Ideal target centers on speedMid. Fast readers are okay, slow ones penalized.
      const speedScore = this.bellScore(cwpm, speedMid, speedHalfRange * 1.3, 0.7);

      // 4. Phrasing / Pause Consistency
      // Segment pauses
      const pauses = [];
      let inPause = false;
      let pauseStart = 0;
      let speechStarted = false;

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (s.rms > voiceThreshold) speechStarted = true;
        if (!speechStarted) continue;

        if (s.rms <= voiceThreshold) {
          if (!inPause) {
            inPause = true;
            pauseStart = s.t;
          }
        } else if (inPause) {
          const pauseDur = s.t - pauseStart;
          if (pauseDur > 200) {
            pauses.push(pauseDur);
          }
          inPause = false;
        }
      }

      const shortPauses = pauses.filter(p => p >= 200 && p < 600).length;
      const mediumPauses = pauses.filter(p => p >= 600 && p < 1400).length;
      const longPauses = pauses.filter(p => p >= 1400).length;

      // Rate Consistency (windowed voicing density)
      // Chunk samples into 5-second bins
      const binSizeMs = 5000;
      const bins = {};
      samples.forEach(s => {
        const binIndex = Math.floor(s.t / binSizeMs);
        if (!bins[binIndex]) bins[binIndex] = [];
        bins[binIndex].push(s);
      });

      const binDensities = Object.values(bins).map(binSamples => {
        const voicedCount = binSamples.filter(s => s.rms > voiceThreshold).length;
        return voicedCount / binSamples.length;
      });

      const meanDensity = binDensities.reduce((a, b) => a + b, 0) / binDensities.length || 0.5;
      const sdDensity = this.stdev(binDensities, meanDensity);
      const densityCV = meanDensity > 0 ? sdDensity / meanDensity : 1.0;

      // Consistent speed (CV ~ 0.15 - 0.25) scores highest
      const rateScore = this.bellScore(densityCV, 0.20, 0.18, 0.7);

      // Pause placement check vs punctuations
      const punctCount = Math.max((currentStory.text.match(/[,।.!?]/g) || []).length, 2);
      const idealPauses = punctCount * 1.25;
      const actualTotalPauses = shortPauses + mediumPauses + longPauses;
      
      const pauseCountScore = this.bellScore(actualTotalPauses, idealPauses, Math.max(idealPauses * 0.8, 2.0), 0.75);

      // Phrasing combines consistency, count matching punctuation, and penalties for stumbles
      let phrasingScore = (rateScore * 0.4) + (pauseCountScore * 0.6) - (mediumPauses * 0.5) - (longPauses * 1.5);
      phrasingScore = Math.max(0.5, Math.min(10, phrasingScore));

      // 5. Expression / Modulation
      const voicedSamples = samples.filter(s => s.rms > voiceThreshold);
      const pitchSamples = voicedSamples.filter(s => s.pitch > 0);
      let expressionScore = 5.0;

      if (pitchSamples.length >= 10) {
        // Octave error correction & median filter
        const rawPitches = pitchSamples.map(s => s.pitch);
        const smoothPitches = this.medianFilter(this.fixOctaveErrors(rawPitches), 3);

        const pMedian = this.percentile(smoothPitches, 0.5);
        const p25 = this.percentile(smoothPitches, 0.25);
        const p75 = this.percentile(smoothPitches, 0.75);
        const pIQR = p75 - p25;
        const iqrRatio = pMedian > 0 ? pIQR / pMedian : 0;

        // Expressive speech has an IQR ratio of ~20% to 35%
        const pitchScore = this.bellScore(iqrRatio, 0.25, 0.12, 0.75);

        // Volume Dynamic Range
        const voicedRmsVals = voicedSamples.map(s => s.rms);
        const rms90 = this.percentile(voicedRmsVals, 0.90);
        const rms10 = this.percentile(voicedRmsVals, 0.10);
        const rmsRange = rms90 - rms10;
        const volumeScore = this.bellScore(rmsRange, 0.15, 0.08, 0.65);

        // Sentence Final Lowering: check pitch trajectory in 500ms before long pauses (>1000ms)
        let loweringMatches = 0;
        let evaluatedPauses = 0;
        
        // Find indices near pauses
        for (let i = 0; i < samples.length - 10; i++) {
          if (samples[i].rms <= voiceThreshold && samples[i+10] && samples[i+10].rms <= voiceThreshold) {
            // Found a pause region. Backtrack to find pre-pause voiced frames
            const prePauseVoiced = [];
            for (let k = i - 1; k >= Math.max(0, i - 15); k--) {
              if (samples[k].rms > voiceThreshold && samples[k].pitch > 0) {
                prePauseVoiced.push(samples[k].pitch);
              }
            }
            if (prePauseVoiced.length >= 6) {
              evaluatedPauses++;
              const recent = prePauseVoiced.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
              const older = prePauseVoiced.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
              if (recent < older * 0.98) { // Pitch lowered
                loweringMatches++;
              }
            }
            // Skip past this pause region
            i += 15;
          }
        }
        
        const finalLoweringScore = evaluatedPauses > 0 ? (loweringMatches / evaluatedPauses) * 10 : 8.0;

        expressionScore = (pitchScore * 0.4) + (volumeScore * 0.3) + (finalLoweringScore * 0.3);
      }
      expressionScore = Math.max(1.0, Math.min(10, expressionScore));

      // 6. Overall Composite Score & Grading
      let overall = 5.0;
      if (hasASR) {
        overall = (accuracyScore * 0.35) + (speedScore * 0.30) + (phrasingScore * 0.20) + (expressionScore * 0.15);
      } else {
        overall = (speedScore * 0.45) + (phrasingScore * 0.35) + (expressionScore * 0.20);
      }
      overall = Math.max(0, Math.min(10, overall));

      // NAEP Level mapping
      let naepLevel = 1;
      let naepText = "Non-fluent";
      if (overall >= 7.5) {
        naepLevel = 4;
        naepText = "Fluent";
      } else if (overall >= 5.5) {
        naepLevel = 3;
        naepText = "Primarily Fluent";
      } else if (overall >= 3.5) {
        naepLevel = 2;
        naepText = "Developing";
      }

      // Grade letters
      let grade = "E";
      if (overall >= 9.0) grade = "A+";
      else if (overall >= 8.0) grade = "A";
      else if (overall >= 7.0) grade = "B+";
      else if (overall >= 6.0) grade = "B";
      else if (overall >= 5.0) grade = "C";
      else if (overall >= 4.0) grade = "D";

      return {
        accuracyScore: hasASR ? Math.round(accuracyScore * 10) / 10 : null,
        accuracyPct: accuracyPct !== null ? Math.round(accuracyPct) : null,
        speedScore: Math.round(speedScore * 10) / 10,
        phrasingScore: Math.round(phrasingScore * 10) / 10,
        expressionScore: Math.round(expressionScore * 10) / 10,
        overallScore: Math.round(overall * 10) / 10,
        cwpm: Math.round(cwpm),
        speakingSec: Math.round(speakingSec * 10) / 10,
        naepLevel,
        naepText,
        grade,
        alignResult: alignResult ? {
          correct: alignResult.correct,
          substitutions: alignResult.substitutions,
          omissions: alignResult.omissions,
          insertions: alignResult.insertions,
          path: alignResult.path
        } : null
      };
    }
  };
})();
