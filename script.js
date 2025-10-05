// 1. Importer les modules Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// 2. Charger UA-Parser-JS dynamiquement
function loadUAParser() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/ua-parser-js@1.0.38/dist/ua-parser.min.js';
    script.onload = () => resolve(window.UAParser);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// 2. Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCnC8D-XeMyW2ni_w7fM9mCXgJWoKm-b6k",
  authDomain: "the-french-economist.firebaseapp.com",
  projectId: "the-french-economist",
  storageBucket: "the-french-economist.firebasestorage.app",
  messagingSenderId: "1034383989383",
  appId: "1:1034383989383:web:3ba54f185b3c355ee53622",
  measurementId: "G-M5JLD8QEP4"
};

// 3. Initialiser Firebase et Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Fonctions de gestion des cookies
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

// 5. Récupérer le dernier ID depuis Firestore
async function getLastVisitorId() {
  try {
    const q = query(
      collection(db, "visites"),
      orderBy("visitor_id", "desc"),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const lastDoc = querySnapshot.docs[0];
      return lastDoc.data().visitor_id || 0;
    }
    return 0;
  } catch (error) {
    console.error("Erreur lors de la récupération du dernier ID :", error);
    return 0;
  }
}

// 6. Obtenir ou créer l'identifiant visiteur
async function getOrCreateVisitorId() {
  const cookieName = "visitor_id";
  let visitorId = getCookie(cookieName);
  
  if (visitorId) {
    console.log("Cookie existant trouvé :", visitorId);
    return parseInt(visitorId);
  }
  
  // Cookie non trouvé, créer un nouvel ID
  console.log("Cookie non trouvé, création d'un nouvel ID...");
  const lastId = await getLastVisitorId();
  const newId = lastId + 1;
  
  setCookie(cookieName, newId);
  console.log("Nouveau cookie créé avec l'ID :", newId);
  
  return newId;
}

// 7. Fonction principale pour collecter et enregistrer les données
async function trackVisit() {
  try {
    // Charger UA-Parser-JS
    const UAParser = await loadUAParser();
    
    // Obtenir l'ID visiteur
    const visitorId = await getOrCreateVisitorId();
    
    // Collecter les données IP
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    // Parser le User Agent avec UA-Parser-JS
    const parser = new UAParser();
    const uaResult = parser.getResult();
    
    // Données extraites du User Agent
    const parsedUA = {
      // Navigateur
      browser_name: uaResult.browser.name || 'unknown',
      browser_version: uaResult.browser.version || 'unknown',
      browser_major: uaResult.browser.major || 'unknown',
      
      // Moteur de rendu
      engine_name: uaResult.engine.name || 'unknown',
      engine_version: uaResult.engine.version || 'unknown',
      
      // Système d'exploitation
      os_name: uaResult.os.name || 'unknown',
      os_version: uaResult.os.version || 'unknown',
      
      // Appareil
      device_vendor: uaResult.device.vendor || 'unknown',
      device_model: uaResult.device.model || 'unknown',
      device_type: uaResult.device.type || 'desktop', // mobile, tablet, desktop, etc.
      
      // CPU
      cpu_architecture: uaResult.cpu.architecture || 'unknown'
    };

    // Collecter les informations de l'équipement
    const deviceInfo = {
      // Informations réseau
      network_type: navigator.connection?.effectiveType || 'unknown',
      network_downlink: navigator.connection?.downlink || null,
      network_rtt: navigator.connection?.rtt || null,
      network_saveData: navigator.connection?.saveData || false,
      
      // Support tactile
      touch_support: navigator.maxTouchPoints > 0,
      max_touch_points: navigator.maxTouchPoints || 0,
      
      // Écran
      screen_width: screen.width,
      screen_height: screen.height,
      screen_available_width: screen.availWidth,
      screen_available_height: screen.availHeight,
      screen_color_depth: screen.colorDepth,
      screen_pixel_depth: screen.pixelDepth,
      screen_orientation: screen.orientation?.type || 'unknown',
      pixel_ratio: window.devicePixelRatio || 1,
      
      // Plateforme
      platform: navigator.platform,
      os_cpu: navigator.oscpu || 'unknown',
      
      // Informations supplémentaires du navigateur
      language: navigator.language,
      languages: navigator.languages || [],
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory: navigator.deviceMemory || null,
      
      // Viewport (taille visible)
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    };

    const ipData = {
      visitor_id: visitorId,
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
      ...parsedUA,
      ...deviceInfo,
      timestamp: serverTimestamp()
    };
    
    // Enregistrer dans Firestore
    await addDoc(collection(db, "visites"), ipData);
    console.log("Données enregistrées avec succès ! Visitor ID :", visitorId);
    
  } catch (error) {
    console.error("Erreur lors du tracking :", error);
  }
}

// 8. Lancer le tracking
trackVisit();