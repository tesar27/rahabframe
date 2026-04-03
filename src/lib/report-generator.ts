import type {
  AnalysisInsight,
  AnalysisRecord,
  CreateAnalysisInput,
  VideoAnalysisSummary,
} from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function averageQuality(video: VideoAnalysisSummary) {
  return (
    video.averageConfidence * 0.3 +
    video.symmetryScore * 0.25 +
    video.stabilityScore * 0.25 +
    video.alignmentScore * 0.2
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDelta(value: number) {
  const percent = Math.round(value * 100);
  if (percent === 0) {
    return "no material change";
  }

  return `${percent > 0 ? "+" : ""}${percent} pts`;
}

function formatDegrees(value: number) {
  return `${Math.round(value)}°`;
}

function buildInsight(
  id: string,
  label: string,
  baselineValue: string,
  followupValue: string,
  deltaText: string,
  trend: AnalysisInsight["trend"],
  rationale: string,
): AnalysisInsight {
  return {
    id,
    label,
    baselineValue,
    followupValue,
    deltaText,
    trend,
    rationale,
  };
}

function buildSummary(input: CreateAnalysisInput, overallDelta: number) {
  const qualityDelta = input.followup.averageConfidence - input.baseline.averageConfidence;
  const symmetryDelta = input.followup.symmetryScore - input.baseline.symmetryScore;
  const stabilityDelta = input.followup.stabilityScore - input.baseline.stabilityScore;
  const motionDelta = input.followup.motionRangeDeg - input.baseline.motionRangeDeg;

  const opening =
    overallDelta >= 0.05
      ? "The follow-up clip shows a stronger overall movement pattern than the baseline sample."
      : overallDelta <= -0.05
        ? "The follow-up clip looks less controlled than the baseline sample and should be reviewed carefully."
        : "The two clips are broadly comparable, with a mixed movement signal across the tracked joints.";

  const strongestSignal =
    symmetryDelta >= stabilityDelta
      ? symmetryDelta > 0
        ? "Left and right joint behavior looks more even in the second clip."
        : "Left and right balance remains the main area to tighten up."
      : stabilityDelta > 0
        ? "The second clip holds the trunk and hip line more steadily through the sampled frames."
        : "Midline control is still inconsistent across the sampled frames.";

  const captureNote =
    qualityDelta < -0.08
      ? "Tracking confidence dropped in the follow-up recording, so camera position and lighting likely influenced the result."
      : motionDelta > 6
        ? "Range-of-motion coverage increased, which usually means the child moved more confidently through the exercise."
        : "Movement depth stayed in a similar band, so the key signal comes from symmetry and stability rather than amplitude.";

  return `${opening} ${strongestSignal} ${captureNote}`;
}

function buildRecommendations(input: CreateAnalysisInput) {
  const recommendations = new Set<string>();

  if (input.followup.symmetryScore < 0.72) {
    recommendations.add(
      "Record the next set from the same frontal angle and cue equal loading on the left and right side.",
    );
  }

  if (input.followup.stabilityScore < 0.7) {
    recommendations.add(
      "Slow the repetition tempo slightly so trunk and pelvis control stay centered through the full movement.",
    );
  }

  if (input.followup.motionRangeDeg < input.baseline.motionRangeDeg) {
    recommendations.add(
      "Encourage a comfortable but fuller range of motion on the next recording so progress is easier to compare.",
    );
  }

  if (input.followup.averageConfidence < 0.65 || input.baseline.averageConfidence < 0.65) {
    recommendations.add(
      "Improve capture quality with brighter lighting and a fixed phone position at about hip height.",
    );
  }

  if (recommendations.size === 0) {
    recommendations.add(
      "Keep the same camera setup and exercise tempo for the next session so progress trends stay comparable.",
    );
  }

  return [...recommendations];
}

function buildCautions(input: CreateAnalysisInput) {
  const cautions: string[] = [];
  const baselineTrackingRate = input.baseline.trackedFrames / input.baseline.sampledFrames;
  const followupTrackingRate = input.followup.trackedFrames / input.followup.sampledFrames;

  if (baselineTrackingRate < 0.65 || followupTrackingRate < 0.65) {
    cautions.push(
      "Pose tracking missed a noticeable share of frames, so this report should be treated as a preliminary screening output.",
    );
  }

  const durationGap = Math.abs(input.baseline.durationSec - input.followup.durationSec);
  if (durationGap > 8) {
    cautions.push(
      "The two clips differ significantly in duration, which can mix exercise tempo changes into the comparison.",
    );
  }

  if (
    input.baseline.width < 960 ||
    input.followup.width < 960 ||
    input.baseline.height < 540 ||
    input.followup.height < 540
  ) {
    cautions.push(
      "Lower-resolution footage reduces joint-tracking precision and may flatten small improvements.",
    );
  }

  cautions.push(
    "This automated summary is designed for movement review support and is not a medical diagnosis.",
  );

  return cautions;
}

export function createAnalysisRecord(input: CreateAnalysisInput): AnalysisRecord {
  const baselineQuality = averageQuality(input.baseline);
  const followupQuality = averageQuality(input.followup);
  const overallDelta = followupQuality - baselineQuality;
  const overallScore = clamp(
    Math.round(58 + overallDelta * 100 + (input.followup.motionRangeDeg - input.baseline.motionRangeDeg) * 0.18),
    0,
    100,
  );

  const insights: AnalysisInsight[] = [
    buildInsight(
      "symmetry",
      "Symmetry",
      formatPercent(input.baseline.symmetryScore),
      formatPercent(input.followup.symmetryScore),
      formatDelta(input.followup.symmetryScore - input.baseline.symmetryScore),
      input.followup.symmetryScore > input.baseline.symmetryScore + 0.02
        ? "positive"
        : input.followup.symmetryScore < input.baseline.symmetryScore - 0.02
          ? "negative"
          : "neutral",
      "Compares left and right joint behavior across the sampled frames.",
    ),
    buildInsight(
      "stability",
      "Stability",
      formatPercent(input.baseline.stabilityScore),
      formatPercent(input.followup.stabilityScore),
      formatDelta(input.followup.stabilityScore - input.baseline.stabilityScore),
      input.followup.stabilityScore > input.baseline.stabilityScore + 0.02
        ? "positive"
        : input.followup.stabilityScore < input.baseline.stabilityScore - 0.02
          ? "negative"
          : "neutral",
      "Measures how steadily the hip center stays aligned during the movement.",
    ),
    buildInsight(
      "motion-range",
      "Range of motion",
      formatDegrees(input.baseline.motionRangeDeg),
      formatDegrees(input.followup.motionRangeDeg),
      `${input.followup.motionRangeDeg - input.baseline.motionRangeDeg > 0 ? "+" : ""}${Math.round(
        input.followup.motionRangeDeg - input.baseline.motionRangeDeg,
      )}°`,
      input.followup.motionRangeDeg > input.baseline.motionRangeDeg + 4
        ? "positive"
        : input.followup.motionRangeDeg < input.baseline.motionRangeDeg - 4
          ? "negative"
          : "neutral",
      "Uses tracked knee flexion as a proxy for movement depth across the sampled clip.",
    ),
    buildInsight(
      "tracking-confidence",
      "Tracking confidence",
      formatPercent(input.baseline.averageConfidence),
      formatPercent(input.followup.averageConfidence),
      formatDelta(input.followup.averageConfidence - input.baseline.averageConfidence),
      input.followup.averageConfidence > input.baseline.averageConfidence + 0.02
        ? "positive"
        : input.followup.averageConfidence < input.baseline.averageConfidence - 0.02
          ? "negative"
          : "neutral",
      "Reflects how clearly the pose model could follow visible joints in each recording.",
    ),
  ];

  const now = new Date();
  const dayLabel = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return {
    id: crypto.randomUUID(),
    title: `Progress review ${dayLabel}`,
    createdAt: now.toISOString(),
    status: "completed",
    overallScore,
    summary: buildSummary(input, overallDelta),
    recommendations: buildRecommendations(input),
    cautions: buildCautions(input),
    baseline: input.baseline,
    followup: input.followup,
    insights,
  };
}