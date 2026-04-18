"use client";

import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { analyzeVideoPair } from "@/lib/client/movenet-analysis";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { AnalysisRecord } from "@/lib/types";

interface AnalysisWorkspaceProps {
  initialAnalyses: AnalysisRecord[];
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainder}`;
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function trendStyles(trend: AnalysisRecord["insights"][number]["trend"]) {
  switch (trend) {
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "negative":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

function scoreStyles(score: number) {
  if (score >= 75) {
    return "bg-emerald-500";
  }

  if (score >= 55) {
    return "bg-amber-500";
  }

  return "bg-orange-500";
}

function VideoDropzone({
  label,
  dropLabel,
  file,
  onFileSelect,
  tDropzone,
}: {
  label: string;
  dropLabel: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  tDropzone: ReturnType<typeof useTranslations<"dropzone">>;
}) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);

        const candidate = event.dataTransfer.files[0];
        if (candidate && candidate.type.startsWith("video/")) {
          onFileSelect(candidate);
        }
      }}
      className={[
        "flex min-h-24 cursor-pointer flex-col justify-between rounded-[20px] border border-dashed p-3.5 transition-all sm:min-h-36 sm:rounded-[28px] sm:p-5",
        isDragging
          ? "border-accent bg-accent-soft shadow-[0_0_0_4px_rgba(204,111,69,0.08)]"
          : "border-line bg-white/70 hover:border-sage hover:bg-white",
      ].join(" ")}
    >
      <input
        id={inputId}
        className="hidden"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold tracking-[0.14em] text-muted uppercase sm:text-sm sm:tracking-[0.16em]">
            {label}
          </span>
          <span className="hidden rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage sm:inline">
            {tDropzone("videoBadge")}
          </span>
        </div>
        <div>
          <p className="line-clamp-1 text-sm font-semibold text-foreground sm:text-base">
            {file
              ? file.name
              : tDropzone("dropHere", { label: dropLabel.toLowerCase() })}
          </p>
          <p className="mt-0.5 hidden text-xs text-muted sm:mt-1 sm:block sm:text-sm">
            {file
              ? `${formatFileSize(file.size)} · ${file.type || "Unknown format"}`
              : tDropzone("fileTypes")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted sm:mt-5 sm:text-sm">
        <span className="hidden sm:inline">
          {file ? tDropzone("readyForAnalysis") : tDropzone("clickToChoose")}
        </span>
        {file ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onFileSelect(null);
            }}
            className="rounded-full border border-line px-3 py-1 font-medium text-foreground transition hover:border-sage"
          >
            {tDropzone("clear")}
          </button>
        ) : (
          <span className="rounded-full border border-line px-3 py-1 font-medium text-foreground">
            {tDropzone("browse")}
          </span>
        )}
      </div>
    </label>
  );
}

export function AnalysisWorkspace({ initialAnalyses }: AnalysisWorkspaceProps) {
  const locale = useLocale();
  const t = useTranslations();
  const tDropzone = useTranslations("dropzone");

  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [selectedId, setSelectedId] = useState(initialAnalyses[0]?.id ?? null);
  const [baselineFile, setBaselineFile] = useState<File | null>(null);
  const [followupFile, setFollowupFile] = useState<File | null>(null);
  const [statusText, setStatusText] = useState(() =>
    t("bottomBar.initialStatus"),
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedAnalysis =
    analyses.find((analysis) => analysis.id === selectedId) ?? null;

  async function handleAnalyze() {
    if (!baselineFile || !followupFile) {
      setErrorText(t("bottomBar.errorBothVideos"));
      return;
    }

    setErrorText(null);

    try {
      const payload = await analyzeVideoPair(
        baselineFile,
        followupFile,
        setStatusText,
      );
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(t("bottomBar.errorServerSave"));
      }

      const data = (await response.json()) as { analysis: AnalysisRecord };

      startTransition(() => {
        setAnalyses((current) => [data.analysis, ...current]);
        setSelectedId(data.analysis.id);
        setBaselineFile(null);
        setFollowupFile(null);
      });

      setStatusText(t("bottomBar.analysisComplete"));
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : t("bottomBar.errorAnalysis"),
      );
      setStatusText(t("bottomBar.analysisStopped"));
    }
  }

  return (
    <div className="flex min-h-screen bg-transparent text-foreground">
      <aside className="hidden w-[320px] shrink-0 border-r border-white/60 bg-[#f7efe4]/85 p-6 backdrop-blur md:flex md:flex-col">
        <div className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-(--shadow)">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cc6f45,#547063)] text-lg font-bold text-white">
              R
            </div>
            <div>
              <p className="text-lg font-semibold">RehabFrame</p>
              <p className="text-sm text-muted">{t("sidebar.subtitle")}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            {t("sidebar.mvpNote")}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
            {t("sidebar.historyTitle")}
          </h2>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-sage">
            {analyses.length}
          </span>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {analyses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-white/55 p-5 text-sm leading-6 text-muted">
              {t("sidebar.emptyHistory")}
            </div>
          ) : null}

          {analyses.map((analysis) => {
            const isSelected = analysis.id === selectedId;

            return (
              <button
                key={analysis.id}
                type="button"
                onClick={() => setSelectedId(analysis.id)}
                className={[
                  "w-full rounded-3xl border p-4 text-left transition",
                  isSelected
                    ? "border-accent bg-white shadow-[0_16px_40px_rgba(201,104,63,0.14)]"
                    : "border-transparent bg-white/60 hover:border-line hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {analysis.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(analysis.createdAt, locale)}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${scoreStyles(
                      analysis.overallScore,
                    )}`}
                  >
                    {analysis.overallScore}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                  {analysis.summary}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-white/60 px-4 py-5 backdrop-blur md:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
                {t("header.subtitle")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
                {t("header.title")}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-medium text-muted lg:block">
                {t("header.disclaimer")}
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-6 md:px-8">
          <section className="flex-1 space-y-6 overflow-y-auto pb-8">
            {!selectedAnalysis ? (
              <div className="mx-auto grid max-w-4xl gap-6 pt-8 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-4xl border border-white/80 bg-white/85 p-8 shadow-(--shadow)">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-[0.16em] text-accent uppercase">
                    {t("landing.badge")}
                  </span>
                  <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance">
                    {t("landing.headline")}
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
                    {t("landing.description")}
                  </p>
                </div>

                <div className="rounded-4xl border border-line bg-[#fbf4ea]/80 p-6">
                  <h3 className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
                    {t("landing.measuresTitle")}
                  </h3>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
                    <p>{t("landing.measures.symmetry")}</p>
                    <p>{t("landing.measures.stability")}</p>
                    <p>{t("landing.measures.kneeFlexion")}</p>
                    <p>{t("landing.measures.tracking")}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <div className="flex justify-end">
                  <div className="max-w-2xl rounded-[30px] rounded-br-md bg-[linear-gradient(135deg,#cc6f45,#b95b34)] px-6 py-5 text-white shadow-[0_18px_45px_rgba(184,88,49,0.28)]">
                    <p className="text-sm font-semibold tracking-[0.16em] uppercase text-white/80">
                      {t("analysisView.uploadedComparison")}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-white/12 p-4">
                        <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
                          {t("analysisView.baseline")}
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {selectedAnalysis.baseline.fileName}
                        </p>
                        <p className="mt-1 text-sm text-white/80">
                          {formatDuration(
                            selectedAnalysis.baseline.durationSec,
                          )}{" "}
                          · {selectedAnalysis.baseline.width}×
                          {selectedAnalysis.baseline.height}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/12 p-4">
                        <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
                          {t("analysisView.followup")}
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {selectedAnalysis.followup.fileName}
                        </p>
                        <p className="mt-1 text-sm text-white/80">
                          {formatDuration(
                            selectedAnalysis.followup.durationSec,
                          )}{" "}
                          · {selectedAnalysis.followup.width}×
                          {selectedAnalysis.followup.height}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="w-full max-w-3xl rounded-4xl rounded-bl-md border border-white/80 bg-white/90 px-6 py-6 shadow-(--shadow)">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
                          {t("analysisView.automatedReport")}
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold">
                          {selectedAnalysis.title}
                        </h2>
                      </div>
                      <div className="rounded-full bg-sage-soft px-4 py-2 text-sm font-semibold text-sage">
                        {t("analysisView.overallScore", {
                          score: selectedAnalysis.overallScore,
                        })}
                      </div>
                    </div>

                    <p className="mt-5 text-base leading-7 text-foreground/90">
                      {selectedAnalysis.summary}
                    </p>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      {selectedAnalysis.insights.map((insight) => (
                        <div
                          key={insight.id}
                          className="rounded-3xl border border-line bg-[#fcf8f1] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-foreground">
                              {insight.label}
                            </p>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${trendStyles(
                                insight.trend,
                              )}`}
                            >
                              {insight.deltaText}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-4 text-sm text-muted">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em]">
                                {t("insights.baseline")}
                              </p>
                              <p className="mt-1 font-semibold text-foreground">
                                {insight.baselineValue}
                              </p>
                            </div>
                            <div className="h-px flex-1 bg-line" />
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.14em]">
                                {t("insights.followup")}
                              </p>
                              <p className="mt-1 font-semibold text-foreground">
                                {insight.followupValue}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted">
                            {insight.rationale}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl bg-[#f3ede2] p-5">
                        <p className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
                          {t("analysisView.suggestedNextSteps")}
                        </p>
                        <div className="mt-3 space-y-3 text-sm leading-6 text-foreground/85">
                          {selectedAnalysis.recommendations.map(
                            (recommendation) => (
                              <p key={recommendation}>• {recommendation}</p>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="rounded-3xl bg-[#eef3ef] p-5">
                        <p className="text-sm font-semibold tracking-[0.16em] text-muted uppercase">
                          {t("analysisView.reviewNotes")}
                        </p>
                        <div className="mt-3 space-y-3 text-sm leading-6 text-foreground/85">
                          {selectedAnalysis.cautions.map((caution) => (
                            <p key={caution}>• {caution}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="sticky bottom-0 mt-4 rounded-[28px] border border-white/80 bg-white/90 p-3 shadow-(--shadow) backdrop-blur sm:rounded-[36px] sm:p-4 md:p-5">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <VideoDropzone
                label={t("dropzone.baselineLabel")}
                dropLabel={t("dropzone.baselineLabel")}
                file={baselineFile}
                onFileSelect={setBaselineFile}
                tDropzone={tDropzone}
              />
              <VideoDropzone
                label={t("dropzone.followupLabel")}
                dropLabel={t("dropzone.followupLabel")}
                file={followupFile}
                onFileSelect={setFollowupFile}
                tDropzone={tDropzone}
              />
              <div className="col-span-2 flex items-center gap-2 lg:col-span-1 lg:w-60 lg:flex-col lg:gap-3">
                <div className="hidden flex-1 rounded-3xl bg-[#fbf4ea] p-3 text-sm leading-6 text-muted lg:block lg:p-4">
                  {statusText}
                </div>
                <button
                  type="button"
                  disabled={isPending || !baselineFile || !followupFile}
                  onClick={handleAnalyze}
                  className="flex-1 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cc6f45,#a94f27)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-[20px] sm:py-4 lg:w-full"
                >
                  {isPending
                    ? t("bottomBar.savingReport")
                    : t("bottomBar.analyzeProgress")}
                </button>
                {isPending && (
                  <p className="text-xs text-muted lg:hidden">{statusText}</p>
                )}
              </div>
            </div>

            {errorText ? (
              <div className="mt-4 rounded-[22px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                {errorText}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
