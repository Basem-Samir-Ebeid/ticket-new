const MUTE_KEY = 'notif_sound_muted'

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === 'true'
}

export function setMuted(val) {
  localStorage.setItem(MUTE_KEY, val ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent('sound:mute_changed', { detail: val }))
}

export function toggleMute() {
  setMuted(!isMuted())
}

export function playNotificationSound() {
  if (isMuted()) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const notes = [
      { freq: 880, start: 0,    dur: 0.08 },
      { freq: 1100, start: 0.09, dur: 0.08 },
      { freq: 1320, start: 0.18, dur: 0.14 },
    ]

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.01)
    })

    setTimeout(() => ctx.close(), 700)
  } catch {}
}
