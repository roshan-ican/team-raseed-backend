// src/lib/firebase-admin.ts
import admin from "firebase-admin";
import { loadConfigFromBucket } from "../utils/bucket-config";

let db: admin.firestore.Firestore;
let initialized = false;

async function initializeFirebase() {
  if (initialized) return db;
  
  if (!admin.apps.length) {
    const credentials = await loadConfigFromBucket();
    console.log(credentials, "backend");
    
    // 🔍 Debug: Log the project ID from credentials
    console.log('🔍 Project ID from credentials:', credentials.project_id);
    
    admin.initializeApp({
      credential: admin.credential.cert(credentials as admin.ServiceAccount),
      // 🔍 Explicitly set project ID if needed
      projectId: credentials.project_id,
    });
  }

  db = admin.firestore();
  
  // ✅ MUST call settings() BEFORE any other operations
  db.settings({ ignoreUndefinedProperties: true });
  
  // 🔍 Debug: Test basic connectivity (AFTER settings)
  try {
    console.log('🔍 Testing Firestore connectivity...');
    const testDoc = await db.collection('_test').limit(1).get();
    console.log('✅ Firestore connection successful');
  } catch (error: any) {
    console.error('❌ Firestore connection failed:', error.message);
    
    // Check if it's a permissions issue
    if (error.code === 7) {
      console.error('🚫 PERMISSION_DENIED: Check service account roles');
    } else if (error.code === 5) {
      console.error('🔍 NOT_FOUND: Project or database might not exist');
    }
  }
  
  initialized = true;
  return db;
}

// Initialize immediately when module loads
initializeFirebase().catch(console.error);

export { admin, db };