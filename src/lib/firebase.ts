import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const getEnv = (key: string, fallback: string = ''): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // import.meta may not be available in non-Vite environments
  }
  try {
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key] as string;
    }
  } catch {
    // process may not be available in browser environments
  }
  return fallback;
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'AIzaSyD9-2htAfkvRH6cKsDHwBBNGh3Up-4hGs4'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'viitsadb.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'viitsadb'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'viitsadb.firebasestorage.app'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '521152211314'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:521152211314:web:78d9850ea0386121a395eb')
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with high-performance multi-tab IndexedDB persistence for sub-second page loads
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // Graceful fallback for environments with locked IndexedDB or existing instances
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");

export const DEFAULT_CLINIC_ID = 'cln_viitsa_main';
export const DEMO_CLINIC_ID = DEFAULT_CLINIC_ID;
