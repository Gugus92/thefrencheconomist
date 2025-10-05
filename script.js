 // 1. Importer les modules Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // 2. Configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {{
    apiKey: "AIzaSyCnC8D-XeMyW2ni_w7fM9mCXgJWoKm-b6k",
    authDomain: "the-french-economist.firebaseapp.com",
    projectId: "the-french-economist",
    storageBucket: "the-french-economist.firebasestorage.app",
    messagingSenderId: "1034383989383",
    appId: "1:1034383989383:web:3ba54f185b3c355ee53622",
    measurementId: "G-M5JLD8QEP4"
  }};

  // 3. Initialiser Firebase et Firestore
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

// 4. Appeler ipapi et stocker les données
fetch('https://ipapi.co/json/')
  .then(response => response.json())
  .then(async data => {
    const ipData = {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country_name,
      country_code: data.country,
      postal: data.postal,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      org: data.org,
      asn: data.asn,
      version: data.version,
      user_agent: navigator.userAgent,
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "visites"), ipData);
      console.log("Données IP enregistrées avec succès !");
    } catch (error) {
      console.error("Erreur Firestore :", error);
    }
  })
  .catch(error => {
    console.error("Erreur ipapi :", error);
  });