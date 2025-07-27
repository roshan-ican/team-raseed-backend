// src/lib/bucket-config.ts
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'raseed-credentials-storage';

// Properly typed cache variables
let cachedConfig: Record<string, string> | null = null;
let cachedCredentials: Record<string, any> | null = null;

// Load environment variables from bucket
export async function loadConfigFromBucket(): Promise<Record<string, string>> {
    if (cachedConfig) {
        return cachedConfig;
    }

    try {
        console.log('📦 Loading config from bucket...');

        const [configContents] = await storage
            .bucket(BUCKET_NAME)
            .file('raseed-app.json')
            .download();

        cachedConfig = JSON.parse(configContents.toString('utf8')) as Record<string, string>;

        // Set environment variables
        Object.keys(cachedConfig).forEach(key => {
            process.env[key] = cachedConfig![key];
        });

        console.log('✅ Config loaded from bucket');
        return cachedConfig;
    } catch (error) {
        console.error('❌ Failed to load config from bucket:', error);
        throw error;
    }
}

// Load credentials from bucket
export async function loadCredentialsFromBucket(): Promise<Record<string, any>> {
    if (cachedCredentials) {
        return cachedCredentials;
    }

    try {
        console.log('🔑 Loading credentials from bucket...');

        const [credContents] = await storage
            .bucket(BUCKET_NAME)
            .file('credentials.json')
            .download();

        cachedCredentials = JSON.parse(credContents.toString('utf8')) as Record<string, any>;

        console.log('✅ Credentials loaded from bucket');
        return cachedCredentials;
    } catch (error) {
        console.error('❌ Failed to load credentials from bucket:', error);
        throw error;
    }
}