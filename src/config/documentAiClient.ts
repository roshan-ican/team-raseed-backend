import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { loadCredentialsFromBucket } from '../utils/bucket-config';


let client: DocumentProcessorServiceClient;

async function initializeClient() {
  const credentials = await loadCredentialsFromBucket();
  // console.log((credentials), "credentials___")
  client = new DocumentProcessorServiceClient({
    credentials
  });
}

initializeClient().catch(console.error);

export { client };