// embed.ts  —  Node 18+, TS 5.x, "@google-cloud/aiplatform" ≥ 5.5.0

import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import type * as proto from '@google-cloud/aiplatform/build/protos/protos';

const project = process.env.PROJECT_ID!;
const location = process.env.GCP_LOCATION ?? 'us-central1';
const model = process.env.EMBED_MODEL ?? 'text-embedding-004';   // 768-D
const client = new PredictionServiceClient({ apiEndpoint: `${location}-aiplatform.googleapis.com` });

// ── simple TTL cache (30 min) ──────────────────────────────────────────────────
const cache = new Map<string, { vec: number[]; exp: number }>();
const TTL_MS = 30 * 60_000;

// ───────────────────────────────────────────────────────────────────────────────
export async function embed(
  texts: string | string[],                        // single or batch
  {
    taskType = 'RETRIEVAL_QUERY',                  // or RETRIEVAL_DOCUMENT
    dimensions,                                    // e.g. 384 to save storage
    normalize = true,
  }: {
    taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
    dimensions?: number;
    normalize?: boolean;
  } = {},
): Promise<number[] | number[][]> {

  const arr = Array.isArray(texts) ? texts : [texts];

  // return cached hits immediately
  const cached = arr.map(t => cache.get(t)?.vec);
  if (cached.every(Boolean)) {
    return Array.isArray(texts) ? cached as number[][] : cached[0]!;
  }

  const endpoint = `projects/${project}/locations/${location}/publishers/google/models/${model}`;
  const instances: proto.google.protobuf.IValue[] =
    arr.map(text => helpers.toValue({ content: text, task_type: taskType }) as proto.google.protobuf.IValue);

  const parameters = dimensions ? helpers.toValue({ outputDimensionality: dimensions }) : undefined;

  const [res] = await client.predict({ endpoint, instances, parameters });

  const out: number[][] = res.predictions!
    .map(extractVec)
    .filter(Boolean) as number[][];   // remove any nulls

  const normed = normalize
    ? out.map(v => {
      const norm = Math.hypot(...v) || 1;
      return v.map(x => x / norm);
    })
    : out;

  // write to cache
  arr.forEach((txt, i) => cache.set(txt, { vec: normed[i], exp: Date.now() + TTL_MS }));

  return Array.isArray(texts) ? normed : normed[0]!;
}

function extractVec(pred: any): number[] | null {
  // ① new schema
  if (pred?.embeddings?.values) {
    return pred.embeddings.values.map(Number);
  }

  // ② old schema
  const nested =
    pred?.structValue?.fields?.embeddings?.structValue?.fields?.values
      ?.listValue?.values;

  if (Array.isArray(nested)) {
    return nested.map((v: any) => v.numberValue);
  }
  return null;
}