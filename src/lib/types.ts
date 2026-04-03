export interface VideoAnalysisSummary {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  sampledFrames: number;
  trackedFrames: number;
  averageConfidence: number;
  symmetryScore: number;
  stabilityScore: number;
  alignmentScore: number;
  motionRangeDeg: number;
}

export interface CreateAnalysisInput {
  baseline: VideoAnalysisSummary;
  followup: VideoAnalysisSummary;
}

export interface AnalysisInsight {
  id: string;
  label: string;
  baselineValue: string;
  followupValue: string;
  deltaText: string;
  trend: "positive" | "negative" | "neutral";
  rationale: string;
}

export interface AnalysisRecord {
  id: string;
  title: string;
  createdAt: string;
  status: "completed";
  overallScore: number;
  summary: string;
  recommendations: string[];
  cautions: string[];
  baseline: VideoAnalysisSummary;
  followup: VideoAnalysisSummary;
  insights: AnalysisInsight[];
}