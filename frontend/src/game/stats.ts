export interface StatsSnapshot {
  rawWPM:     number
  avgWPM:     number
  rawCPM:     number
  avgCPM:     number
  accuracy:   number
  elapsed:    number
  rawCorrect: number
  rawWrong:   number
}

export class Stats {
  private startTime: number | null = null
  private totalCharsTyped = 0
  private totalCorrectChars = 0
  private wordsCompleted = 0
  private wpmHistory: { time: number; wpm: number }[] = []
  private lastSampleTime = 0

  start() {
    if (this.startTime === null) {
      this.startTime = performance.now()
      this.lastSampleTime = this.startTime
    }
  }

  recordChar(correct: boolean) {
    this.totalCharsTyped++
    if (correct) this.totalCorrectChars++
  }

  recordWordComplete(_wordLength: number) {
    this.wordsCompleted++
    const now = performance.now()
    // sample WPM every 2 seconds
    if (now - this.lastSampleTime >= 2000 && this.startTime !== null) {
      const elapsed = (now - this.startTime) / 60000
      const wpm = elapsed > 0 ? this.totalCorrectChars / 5 / elapsed : 0
      this.wpmHistory.push({ time: now, wpm })
      this.lastSampleTime = now
      // keep last 30 samples
      if (this.wpmHistory.length > 30) this.wpmHistory.shift()
    }
  }

  snapshot(): StatsSnapshot {
    const zero = { rawWPM: 0, avgWPM: 0, rawCPM: 0, avgCPM: 0, accuracy: 0, elapsed: 0, rawCorrect: 0, rawWrong: 0 }
    if (this.startTime === null) return zero
    const elapsed = (performance.now() - this.startTime) / 60000 // minutes
    if (elapsed < 0.001) return zero
    const rawCPM = this.totalCharsTyped / elapsed
    const rawWPM = rawCPM / 5

    // avg = mean of sampled WPM history (smoothed)
    let avgWPM = rawWPM
    if (this.wpmHistory.length >= 2) {
      const sum = this.wpmHistory.reduce((a, b) => a + b.wpm, 0)
      avgWPM = sum / this.wpmHistory.length
    }

    const accuracy = this.totalCharsTyped > 0
      ? (this.totalCorrectChars / this.totalCharsTyped) * 100
      : 100

    return {
      rawWPM:     Math.round(rawWPM),
      avgWPM:     Math.round(avgWPM),
      rawCPM:     Math.round(rawCPM),
      avgCPM:     Math.round(avgWPM * 5),
      accuracy:   Math.round(accuracy),
      elapsed:    Math.floor((performance.now() - this.startTime) / 1000),
      rawCorrect: this.totalCorrectChars,
      rawWrong:   this.totalCharsTyped - this.totalCorrectChars,
    }
  }

  reset() {
    this.startTime = null
    this.totalCharsTyped = 0
    this.totalCorrectChars = 0
    this.wordsCompleted = 0
    this.wpmHistory = []
    this.lastSampleTime = 0
  }
}
