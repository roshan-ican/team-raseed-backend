import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import * as common from '@google-cloud/aiplatform/build/protos/protos'; // Import protos for types

const project = process.env.PROJECT_ID as string;
const location = process.env.LOCATION as string;

const client = new PredictionServiceClient({
  apiEndpoint: `${location}-aiplatform.googleapis.com`,
});

async function createEmbedding(text: string): Promise<number[]> {
  const endpoint = `projects/${project}/locations/${location}/publishers/google/models/text-embedding-004`;

  // Ensure instances are correctly typed as IValue[]
  const instances: common.google.protobuf.IValue[] = [helpers.toValue({ content: text }) as common.google.protobuf.IValue];

  const request: common.google.cloud.aiplatform.v1.IPredictRequest = {
    endpoint,
    instances,
  };

  const [response] = await client.predict(request);

  if (response.predictions && response.predictions.length > 0) {
    const prediction = response.predictions[0];
    // Navigate the protobuf.Value structure to get the embedding values
    const embeddingValues = (prediction as any).structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values;
    if (embeddingValues) {
      return embeddingValues.map((v: any) => v.numberValue);
    }
  }
  return [];
}

export { createEmbedding };