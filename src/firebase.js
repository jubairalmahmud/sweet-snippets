// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPOxWfBFevsfBTqI9I4bwqEAtiXhmJVFc",
  authDomain: "sk-love-v2.firebaseapp.com",
  projectId: "sk-love-v2",
  storageBucket: "sk-love-v2.firebasestorage.app",
  messagingSenderId: "187957777452",
  appId: "1:187957777452:web:73f253090e8581cfd62d89",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
