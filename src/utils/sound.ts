/**
 * Shared Web Audio helpers for the POS / kitchen screens.
 *
 * The AudioContext is created lazily and must be unlocked from a user gesture
 * (see unlockAudio() — called from the POS login tap and the first kitchen-screen
 * tap), otherwise Chrome/Safari silently block playback.
 *
 * Every function is feature-detected and a silent no-op when Web Audio is
 * unavailable — nothing here ever throws.
 */

type WebkitAudioContextCtor = typeof AudioContext | undefined;

let sharedCtx: AudioContext | null = null;

/** Two chimes closer than this are one event (direct play + SSE echo of the same order). */
const CHIME_DEDUPE_MS = 1000;
let lastChimeAt = 0;

/** Lazily create (or return) the shared AudioContext — never throws. */
function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  try {
    const ctor: WebkitAudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctor) return null;
    sharedCtx = new ctor();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Best-effort resume of a suspended context — meaningful inside a user gesture. */
function resumeIfSuspended(ctx: AudioContext): void {
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        /* still blocked — the next user gesture retries via unlockAudio() */
      });
    }
  } catch {
    /* silent */
  }
}

/**
 * Unlock audio playback. Call this from a user gesture (POS login, kitchen tap).
 * Idempotent and a no-op when Web Audio is unavailable.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx) resumeIfSuspended(ctx);
}

/**
 * New-order chime — ascending A5 → C#6 → E6 sine tone, 0.4s.
 * Behaviour identical to the original useKitchenEvents implementation.
 */
export function playNewOrderChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  // Dedupe: SuccessScreen plays this on order placement and the SSE echo of the
  // same order plays it again ~100ms later — one audible chime, not two.
  const now = Date.now();
  if (now - lastChimeAt < CHIME_DEDUPE_MS) return;
  lastChimeAt = now;
  try {
    resumeIfSuspended(ctx);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);           // A5
    osc.frequency.setValueAtTime(1108.73, t + 0.1); // C#6
    osc.frequency.setValueAtTime(1318.51, t + 0.2); // E6
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch {
    /* audio not available — silent fallback */
  }
}

interface TonePulse {
  freq: number;
  /** Seconds from the start of the alert */
  start: number;
  /** Duration in seconds */
  dur: number;
}

function playPulses(type: OscillatorType, volume: number, pulses: TonePulse[]): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    resumeIfSuspended(ctx);
    const t0 = ctx.currentTime;
    for (const p of pulses) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(p.freq, t0 + p.start);
      gain.gain.setValueAtTime(volume, t0 + p.start);
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + p.start + p.dur);
      osc.start(t0 + p.start);
      osc.stop(t0 + p.start + p.dur);
    }
  } catch {
    /* audio not available — silent fallback */
  }
}

/**
 * Overdue-ticket alert — two quick, lower-pitched square-wave pulses
 * (C5 → F5, ~0.47s) so it can't be mistaken for the new-order chime.
 */
export function playOverdueAlert(): void {
  playPulses("square", 0.2, [
    { freq: 523.25, start: 0, dur: 0.2 },     // C5
    { freq: 698.46, start: 0.25, dur: 0.22 }, // F5
  ]);
}

let unlockInstalled = false;

/**
 * Install a one-time global unlock: the first pointer or keyboard gesture
 * anywhere in the app resumes the shared AudioContext. Covers session-restore
 * reloads where LoginScreen (and its unlockAudio call) never mounts.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled) return;
  unlockInstalled = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
    unlockAudio();
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}
