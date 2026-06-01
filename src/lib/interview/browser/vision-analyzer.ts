import { composureScore, eyeContactScore } from './metrics';

export const EMOTIONS = [
  'happy',
  'calm',
  'sad',
  'angry',
  'confused',
  'surprised',
  'neutral',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

const GAZE_DOWN_PITCH = -15;
const SIDEWAYS_YAW = 15;
const SIDEWAYS_MIN_SECONDS = 3.5;
const POSTURE_DEVIATION = 7;

/** Looking-down iff pitch < −15°. */
export function classifyGazeDown(pitchDeg: number): boolean {
  return pitchDeg < GAZE_DOWN_PITCH;
}

/** Sideways distraction iff |yaw| > 15° continuously for longer than 3.5s. */
export function classifySidewaysDistraction(
  samples: { tSeconds: number; yawDeg: number }[],
): boolean {
  let runStart: number | null = null;
  for (const s of samples) {
    if (Math.abs(s.yawDeg) > SIDEWAYS_YAW) {
      if (runStart === null) runStart = s.tSeconds;
      else if (s.tSeconds - runStart > SIDEWAYS_MIN_SECONDS) return true;
    } else {
      runStart = null;
    }
  }
  return false;
}

/** Posture distortion iff |shoulder-slope deviation| > 7°. */
export function classifyPostureDistortion(slopeDeviationDeg: number): boolean {
  return Math.abs(slopeDeviationDeg) > POSTURE_DEVIATION;
}

/** Argmax over the emotion distribution; defaults to 'neutral'. */
export function dominantEmotion(distribution: Partial<Record<Emotion, number>>): Emotion {
  let best: Emotion = 'neutral';
  let bestVal = -Infinity;
  for (const e of EMOTIONS) {
    const v = distribution[e] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = e;
    }
  }
  return best;
}

export interface VisionFrame {
  yawDeg: number;
  pitchDeg: number;
  shoulderSlopeDeviationDeg: number;
  emotionDistribution: Partial<Record<Emotion, number>>;
  gazeFactor?: number;
}

export interface VisionMetrics {
  eyeContact: number;
  gazeDown: boolean;
  postureDistortion: boolean;
  dominantEmotion: Emotion;
  composure: number;
}

export function analyzeVisionFrame(frame: VisionFrame): VisionMetrics {
  const dist = frame.emotionDistribution;
  const total = EMOTIONS.reduce((sum, e) => sum + (dist[e] ?? 0), 0) || 1;
  const angryFraction = (dist.angry ?? 0) / total;
  const confusedFraction = (dist.confused ?? 0) / total;

  const rawComposure = composureScore(angryFraction, confusedFraction);
  const postureDist = classifyPostureDistortion(frame.shoulderSlopeDeviationDeg);
  
  // Deduct 30 composure points (Confidence) if posture is distorted (e.g. user sleeping or slouching)
  const composure = postureDist ? Math.max(25, rawComposure - 30) : rawComposure;

  return {
    eyeContact: eyeContactScore(frame.yawDeg, frame.pitchDeg, frame.gazeFactor ?? 1),
    gazeDown: classifyGazeDown(frame.pitchDeg),
    postureDistortion: postureDist,
    dominantEmotion: dominantEmotion(dist),
    composure,
  };
}

/**
 * Browser wiring around MediaPipe Face Landmarker + Pose Landmarker. The heavy
 * SDK is imported lazily so the pure classifiers above stay testable in Node.
 */
export class VisionAnalyzer {
  private faceLandmarker: unknown = null;
  private poseLandmarker: unknown = null;
  private yawSeries: { tSeconds: number; yawDeg: number }[] = [];

  async init(wasmBasePath: string): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBasePath);
    this.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${wasmBasePath}/face_landmarker.task` },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
    });
    this.poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${wasmBasePath}/pose_landmarker_lite.task` },
      runningMode: 'VIDEO',
    });
  }

  /** Record a yaw sample for sustained-sideways detection across frames. */
  recordYaw(tSeconds: number, yawDeg: number): void {
    this.yawSeries.push({ tSeconds, yawDeg });
  }

  hasSustainedSideways(): boolean {
    return classifySidewaysDistraction(this.yawSeries);
  }

  reset(): void {
    this.yawSeries = [];
  }
}
