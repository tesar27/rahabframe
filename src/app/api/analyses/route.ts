import { NextResponse } from "next/server";

import { createAnalysisRecord } from "@/lib/report-generator";
import { createAnalysisInputSchema } from "@/lib/schemas";
import { listAnalyses, saveAnalysis } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const analyses = await listAnalyses();
  return NextResponse.json({ analyses });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createAnalysisInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analysis payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const record = createAnalysisRecord(parsed.data);
  await saveAnalysis(record);

  return NextResponse.json({ analysis: record }, { status: 201 });
}