// 1. Importer les modules Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// 2. Charger UA-Parser-JS dynamiquement
function loadUAParser() {
  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/ua-parser-js@1.0.38/dist/ua-parser.min.js';
      script.onload = () => {
        if (window.UAParser) {
          console.log('✓ UA-Parser chargé avec succès');
          resolve(window.UAParser);
        } else {
          console.error('✗ UA-Parser chargé mais non disponible');
          reject(new Error('UAParser non disponible après chargement'));
        }
      };
      script.onerror = (error) => {
        console.error('✗ Erreur de chargement UA-Parser:', error);
        reject(new Error('Échec du chargement de UA-Parser'));
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('✗ Exception lors du chargement UA-Parser:', error);
      reject(error);
    }
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
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop().split(';').shift();
      console.log(`✓ Cookie "${name}" trouvé:`, cookieValue);
      return cookieValue;
    }
    console.log(`ℹ Cookie "${name}" non trouvé`);
    return null;
  } catch (error) {
    console.error(`✗ Erreur lecture cookie "${name}":`, error);
    return null;
  }
}

function setCookie(name, value, days = 365) {
  try {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax${secure}`;
    
    // Vérifier que le cookie a bien été créé
    const verification = getCookie(name);
    if (verification === value.toString()) {
      console.log(`✓ Cookie "${name}" créé avec succès`);
      return true;
    } else {
      console.warn(`⚠ Cookie "${name}" créé mais vérification échouée`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Erreur création cookie "${name}":`, error);
    return false;
  }
}

// 5. Récupérer le dernier ID depuis Firestore
async function getLastVisitorId() {
  try {
    console.log('ℹ Recherche du dernier visitor_id dans Firestore...');
    const q = query(
      collection(db, "visites"),
      orderBy("visitor_id", "desc"),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const lastDoc = querySnapshot.docs[0];
      const lastId = lastDoc.data().visitor_id || 0;
      console.log(`✓ Dernier visitor_id trouvé: ${lastId}`);
      return lastId;
    }
    console.log('ℹ Aucun visitor_id trouvé, démarrage à 0');
    return 0;
  } catch (error) {
    console.error("✗ Erreur lors de la récupération du dernier ID:", error);
    console.error("  Type d'erreur:", error.name);
    console.error("  Message:", error.message);
    if (error.code) console.error("  Code Firebase:", error.code);
    
    // Si erreur d'index, afficher un message explicatif
    if (error.message.includes('index')) {
      console.warn('⚠ Index Firestore manquant. Créez un index sur "visitor_id" (desc)');
    }
    return 0;
  }
}

// 6. Obtenir ou créer l'identifiant visiteur
async function getOrCreateVisitorId() {
  const cookieName = "visitor_id";
  
  try {
    let visitorId = getCookie(cookieName);
    
    if (visitorId) {
      console.log(`✓ Visiteur connu, ID: ${visitorId}`);
      return parseInt(visitorId);
    }
    
    // Cookie non trouvé, créer un nouvel ID
    console.log('ℹ Nouveau visiteur détecté');
    const lastId = await getLastVisitorId();
    const newId = lastId + 1;
    
    const cookieCreated = setCookie(cookieName, newId);
    if (!cookieCreated) {
      console.warn('⚠ Cookie non créé - possible blocage antitracking');
      console.warn('⚠ Utilisation d\'un ID temporaire pour cette session');
    }
    
    console.log(`✓ Nouveau visitor_id assigné: ${newId}`);
    return newId;
  } catch (error) {
    console.error('✗ Erreur dans getOrCreateVisitorId:', error);
    // Générer un ID temporaire en cas d'erreur
    const tempId = Date.now();
    console.warn(`⚠ Utilisation d'un ID temporaire basé sur timestamp: ${tempId}`);
    return tempId;
  }
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

    // Collecter les informations de l'équipement (avec gestion antitracking)
    const deviceInfo = {
      // Informations réseau (peut être bloqué par antitracking)
      network_type: navigator.connection?.effectiveType || 'blocked',
      network_downlink: navigator.connection?.downlink || null,
      network_rtt: navigator.connection?.rtt || null,
      network_saveData: navigator.connection?.saveData || false,
      
      // Support tactile (généralement accessible)
      touch_support: navigator.maxTouchPoints > 0,
      max_touch_points: navigator.maxTouchPoints || 0,
      
      // Écran (peut être arrondi par antitracking)
      screen_width: screen.width,
      screen_height: screen.height,
      screen_available_width: screen.availWidth,
      screen_available_height: screen.availHeight,
      screen_color_depth: screen.colorDepth,
      screen_pixel_depth: screen.pixelDepth,
      screen_orientation: screen.orientation?.type || 'unknown',
      pixel_ratio: window.devicePixelRatio || 1,
      
      // Plateforme (peut être généralisé)
      platform: navigator.platform || 'unknown',
      os_cpu: navigator.oscpu || 'unknown',
      
      // Informations supplémentaires du navigateur
      language: navigator.language || 'unknown',
      languages: navigator.languages || [],
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory: navigator.deviceMemory || null,
      
      // Viewport (taille visible)
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      
      // Indicateurs de protection de la vie privée
      doNotTrack: navigator.doNotTrack || 'unknown',
      globalPrivacyControl: navigator.globalPrivacyControl || false
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