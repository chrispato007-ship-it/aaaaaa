import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyAERGxQ8wwSm9GsTWJIa3PDUg3zCbcSWWM",
  authDomain: "smiling-oath-x7z9n.firebaseapp.com",
  projectId: "smiling-oath-x7z9n",
  storageBucket: "smiling-oath-x7z9n.firebasestorage.app",
  messagingSenderId: "478722086989",
  appId: "1:478722086989:web:a306d4efa3ac17df87e404"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId assigned in the applet config using getFirestore
const db = getFirestore(app, "ai-studio-4dada8a1-a670-4df7-9a5b-2c05babcee1d");

export { db };
export default db;
