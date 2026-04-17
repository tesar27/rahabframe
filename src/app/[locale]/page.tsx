import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { listAnalyses } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analyses = await listAnalyses();

  return <AnalysisWorkspace initialAnalyses={analyses} />;
}
