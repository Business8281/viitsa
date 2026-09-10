import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyD9-2htAfkvRH6cKsDHwBBNGh3Up-4hGs4",
  authDomain: "viitsadb.firebaseapp.com",
  projectId: "viitsadb",
  storageBucket: "viitsadb.firebasestorage.app",
  messagingSenderId: "521152211314",
  appId: "1:521152211314:web:78d9850ea0386121a395eb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const DEMO_CLINIC_ID = '11111111-1111-1111-1111-111111111111';
