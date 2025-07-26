// // src/lib/firebase-admin.ts

// import admin from "firebase-admin";
// import serviceAccount from "../config/serviceAccountKey.json";

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
//   });
// }

// export { admin };


// src/lib/firebase-admin.ts
import admin from "firebase-admin";
import serviceAccount from "../config/raseed-app.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// ✅ Add this line to ignore undefined properties
db.settings({ ignoreUndefinedProperties: true });

export { admin, db };

