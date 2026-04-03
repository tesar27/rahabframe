import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-converter";
import * as tf from "@tensorflow/tfjs-core";
import * as posedetection from "@tensorflow-models/pose-detection";

import type { CreateAnalysisInput, VideoAnalysisSummary } from "@/lib/types";

type ProgressReporter = (message: string) => void;

interface FrameSnapshot {
  confidence: number;
  leftKneeAngle: number;
  rightKneeAngle: number;
  leftHipAngle: number;
  rightHipAngle: number;
  shoulderTilt: number;
  hipMidX: number;
}

let detectorPromise: Promise<posedetection.PoseDetector> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function toMegabytes(bytes: number) {
  return bytes / (1024 * 1024);
}

function getKeypoint(pose: posedetection.Pose, index: number) {
  return pose.keypoints[index];
}

function getAngle(
  first: posedetection.Keypoint | undefined,
  middle: posedetection.Keypoint | undefined,
  last: posedetection.Keypoint | undefined,
) {
  if (!first || !middle || !last) {
    return null;
  }

  const scores = [first.score ?? 0, middle.score ?? 0, last.score ?? 0];
  if (scores.some((score) => score < 0.2)) {
    return null;
  }

  const vectorA = { x: first.x - middle.x, y: first.y - middle.y };
  const vectorB = { x: last.x - middle.x, y: last.y - middle.y };
  const magnitude =
    Math.sqrt(vectorA.x ** 2 + vectorA.y ** 2) * Math.sqrt(vectorB.x ** 2 + vectorB.y ** 2);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return null;
  }

  const cosine = clamp((vectorA.x * vectorB.x + vectorA.y * vectorB.y) / magnitude, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function extractFrameSnapshot(pose: posedetection.Pose): FrameSnapshot | null {
  const leftShoulder = getKeypoint(pose, 5);
  const rightShoulder = getKeypoint(pose, 6);
  const leftHip = getKeypoint(pose, 11);
  const rightHip = getKeypoint(pose, 12);
  const leftKnee = getKeypoint(pose, 13);
  const rightKnee = getKeypoint(pose, 14);
  const leftAnkle = getKeypoint(pose, 15);
  const rightAnkle = getKeypoint(pose, 16);

  const leftKneeAngle = getAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = getAngle(rightHip, rightKnee, rightAnkle);
  const leftHipAngle = getAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = getAngle(rightShoulder, rightHip, rightKnee);

  if (
    leftKneeAngle === null ||
    rightKneeAngle === null ||
    leftHipAngle === null ||
    rightHipAngle === null ||
    !leftShoulder ||
    !rightShoulder ||
    !leftHip ||
    !rightHip
  ) {
    return null;
  }

  const confidentPoints = pose.keypoints.filter((point) => (point.score ?? 0) >= 0.2);
  const confidence = mean(confidentPoints.map((point) => point.score ?? 0));
  const torsoHeight = Math.max(Math.abs((leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2), 1);
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / torsoHeight;

  return {
    confidence,
    leftKneeAngle,
    rightKneeAngle,
    leftHipAngle,
    rightHipAngle,
    shoulderTilt,
    hipMidX: (leftHip.x + rightHip.x) / 2,
  };
}

async function once(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Video frame extraction failed."));
    };

    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };

    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function loadVideo(file: File) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  await once(video, "loadedmetadata");

  return {
    video,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

async function getDetector() {
  await tf.ready();
  await tf.setBackend("webgl").catch(() => undefined);

  if (!detectorPromise) {
    detectorPromise = posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
      modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
    });
  }

  return detectorPromise;
}

async function summarizeVideo(
  file: File,
  label: string,
  reportProgress?: ProgressReporter,
): Promise<VideoAnalysisSummary> {
  reportProgress?.(`Preparing ${label.toLowerCase()} video`);
  const detector = await getDetector();
  const { video, cleanup } = await loadVideo(file);

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    cleanup();
    throw new Error("The browser could not create a frame analysis canvas.");
  }

  const duration = Math.max(video.duration, 0.5);
  const sampleCount = clamp(Math.round(duration * 2.4), 8, 18);
  const frameSnapshots: FrameSnapshot[] = [];

  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const timePoint = ((index + 1) / (sampleCount + 1)) * duration;
      video.currentTime = timePoint;
      await once(video, "seeked");

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const poses = await detector.estimatePoses(canvas, {
        maxPoses: 1,
        flipHorizontal: false,
      });

      const pose = poses[0];
      if (pose) {
        const snapshot = extractFrameSnapshot(pose);
        if (snapshot) {
          frameSnapshots.push(snapshot);
        }
      }

      reportProgress?.(`Analyzing ${label.toLowerCase()} video ${index + 1}/${sampleCount}`);
    }
  } finally {
    cleanup();
  }

  if (frameSnapshots.length < 4) {
    throw new Error(
      `${label} video did not contain enough confidently tracked frames. Try a brighter recording with the full body visible.`,
    );
  }

  const kneeAverages = frameSnapshots.map(
    (snapshot) => (snapshot.leftKneeAngle + snapshot.rightKneeAngle) / 2,
  );
  const symmetryPenalty = mean(
    frameSnapshots.map(
      (snapshot) =>
        (Math.abs(snapshot.leftKneeAngle - snapshot.rightKneeAngle) +
          Math.abs(snapshot.leftHipAngle - snapshot.rightHipAngle)) /
        2,
    ),
  );

  return {
    fileName: file.name,
    mimeType: file.type || "video/mp4",
    sizeBytes: file.size,
    durationSec: duration,
    width: video.videoWidth,
    height: video.videoHeight,
    sampledFrames: sampleCount,
    trackedFrames: frameSnapshots.length,
    averageConfidence: clamp(mean(frameSnapshots.map((snapshot) => snapshot.confidence)), 0, 1),
    symmetryScore: clamp(1 - symmetryPenalty / 52, 0, 1),
    stabilityScore: clamp(1 - standardDeviation(frameSnapshots.map((snapshot) => snapshot.hipMidX)) / (canvas.width * 0.085), 0, 1),
    alignmentScore: clamp(1 - mean(frameSnapshots.map((snapshot) => snapshot.shoulderTilt)) / 0.18, 0, 1),
    motionRangeDeg: clamp(Math.max(...kneeAverages) - Math.min(...kneeAverages), 0, 180),
  };
}

export async function analyzeVideoPair(
  baselineFile: File,
  followupFile: File,
  reportProgress?: ProgressReporter,
): Promise<CreateAnalysisInput> {
  if (toMegabytes(baselineFile.size) > 250 || toMegabytes(followupFile.size) > 250) {
    throw new Error("For this MVP, keep each video under 250 MB.");
  }

  const baseline = await summarizeVideo(baselineFile, "Baseline", reportProgress);
  const followup = await summarizeVideo(followupFile, "Follow-up", reportProgress);

  reportProgress?.("Composing analytical summary");

  return {
    baseline,
    followup,
  };
}