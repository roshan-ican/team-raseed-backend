import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

function readEnv(): FirebaseEnv {
  const env = {
    // apiKey: process.env.FIRE_STORE_APIKEY,
    // authDomain: process.env.FIRE_STORE_AUTH_DOMAIN,
    // projectId: process.env.FIRE_STORE_PROJECT_ID,
    // storageBucket: process.env.FIRE_STORE_STORAGE_BUCKET,
    // messagingSenderId: process.env.FIRE_STORE_MESSAGING_SENDER_ID,
    // appId: process.env.FIRE_STORE_APP_ID,
    // measurementId: process.env.FIRE_STORE_MEASUREMENT_ID // optional

    apiKey: "AIzaSyD666KmnzlRrGKmqigMmo8POXJNnQhWcTI",
    authDomain: "raseed-app-dbbeb.firebaseapp.com",
    projectId: "raseed-app-dbbeb",
    storageBucket: "raseed-app-dbbeb.firebasestorage.app",
    messagingSenderId: "631440225521",
    appId: "1:631440225521:web:55d0f0a6d993531f152550",
    measurementId: "G-DY75ZBD70E",
  };

  const missing = Object.entries(env)
    .filter(([k, v]) => k !== "measurementId" && !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(`Missing Firebase env vars: ${missing.join(", ")}`);
  }

  return env as FirebaseEnv;
}

const firebaseConfig = readEnv();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

if (typeof window !== "undefined") {
  // wrap analytics in feature detection
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      getAnalytics(app);
    }
  });
}
