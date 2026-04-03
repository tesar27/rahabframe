import { z } from "zod";

export const videoAnalysisSummarySchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
  durationSec: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sampledFrames: z.number().int().positive(),
  trackedFrames: z.number().int().nonnegative(),
  averageConfidence: z.number().min(0).max(1),
  symmetryScore: z.number().min(0).max(1),
  stabilityScore: z.number().min(0).max(1),
  alignmentScore: z.number().min(0).max(1),
  motionRangeDeg: z.number().min(0).max(180),
});

export const createAnalysisInputSchema = z.object({
  baseline: videoAnalysisSummarySchema,
  followup: videoAnalysisSummarySchema,
});