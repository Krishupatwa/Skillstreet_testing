import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD8FLY3Yo6g8eAFJMTgPuOaH_Rv5XIojas",
  authDomain: "skillstreetofficial.firebaseapp.com",
  projectId: "skillstreetofficial",
  storageBucket: "skillstreetofficial.firebasestorage.app",
  messagingSenderId: "1518002311",
  appId: "1:1518002311:web:24acfa0a6e7fa84e951822",
  measurementId: "G-JXWT315DGQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
