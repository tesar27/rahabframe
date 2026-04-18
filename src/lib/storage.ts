import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { AnalysisRecord } from "@/lib/types";

const dataDirectory = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "data");
const storePath = path.join(dataDirectory, "analyses.json");

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
}

async function readStore(): Promise<AnalysisRecord[]> {
  await ensureStore();

  try {
    const file = await readFile(storePath, "utf8");
    const parsed = JSON.parse(file) as AnalysisRecord[];
    return parsed.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

async function writeStore(records: AnalysisRecord[]) {
  await ensureStore();
  const temporaryPath = `${storePath}.${randomUUID()}.tmp`;
  const body = `${JSON.stringify(records, null, 2)}\n`;

  await writeFile(temporaryPath, body, "utf8");
  await rename(temporaryPath, storePath);
}

export async function listAnalyses() {
  return readStore();
}

export async function saveAnalysis(record: AnalysisRecord) {
  const records = await readStore();
  records.unshift(record);
  await writeStore(records);
  return record;
}