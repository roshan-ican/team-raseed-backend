import { ImageAnnotatorClient } from '@google-cloud/vision';

// Get the path to the credentials file from the environment variable.
const credentialsPath = process.env.CLOUD_VISION_API_CONFIGURATION_PATH;

// Basic validation: Ensure the environment variable is set.
if (!credentialsPath) {
  // Log an error and exit or throw an error if the path is not provided.
  // In a real application, you might have more sophisticated error handling.
  console.error('Error: CLOUD_VISION_API_CONFIGURATION_PATH environment variable is not set.');
  console.error('Please set this variable to the absolute path of your credentials.json file.');
  process.exit(1); // Exit the process as the client cannot be initialized without credentials.
}

// Initialize the Google Cloud Vision client using the path from the environment variable.
const visionClient = new ImageAnnotatorClient({
  keyFilename: credentialsPath,
});

export default visionClient;