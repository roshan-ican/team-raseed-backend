
import admin from "firebase-admin";

const serviceAccount = process.env.FIRE_BASE_CONFIGURATION_PATH!
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// ✅ Add this line to ignore undefined properties
db.settings({ ignoreUndefinedProperties: true });

export { admin, db };

