// 1. Importer les modules Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Version du script
const SCRIPT_VERSION = "2.0";
console.log(`📊  Script v${SCRIPT_VERSION}`);

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

// 3. Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCnC8D-XeMyW2ni_w7fM9mCXgJWoKm-b6k",
  authDomain: "the-french-economist.firebaseapp.com",
  projectId: "the-french-economist",
  storageBucket: "the-french-economist.firebasestorage.app",
  messagingSenderId: "1034383989383",
  appId: "1:1034383989383:web:3ba54f185b3c355ee53622",
  measurementId: "G-M5JLD8QEP4"
};

// 4. Initialiser Firebase et Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 5. Fonctions de gestion des cookies
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

// 6. Récupérer le dernier ID depuis Firestore
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
    
    if (error.message.includes('index')) {
      console.warn('⚠ Index Firestore manquant. Créez un index sur "visitor_id" (desc)');
    }
    return 0;
  }
}

// 7. Obtenir ou créer l'identifiant visiteur
async function getOrCreateVisitorId() {
  const cookieName = "visitor_id";
  
  try {
    let visitorId = getCookie(cookieName);
    
    if (visitorId) {
      console.log(`✓ Visiteur connu, ID: ${visitorId}`);
      return parseInt(visitorId);
    }
    
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
    const tempId = Date.now();
    console.warn(`⚠ Utilisation d'un ID temporaire basé sur timestamp: ${tempId}`);
    return tempId;
  }
}

// 8. Fonction pour collecter les données IP
async function collectIPData() {
  console.log('🌍 Récupération des données de géolocalisation IP...');
  
  let data = {};
  try {
    console.log('📡 Tentative avec ipwho.is...');
    const response = await fetch('https://ipwho.is/');
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP ipwho.is: ${response.status}`);
    }
    
    const geoData = await response.json();
    
    if (!geoData.success) {
      throw new Error(`ipwho.is a retourné success=false: ${geoData.message || 'unknown'}`);
    }
    
    data = {
      ip: geoData.ip,
      city: geoData.city,
      region: geoData.region,
      country_name: geoData.country,
      country: geoData.country_code,
      postal: geoData.postal || null,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      timezone: geoData.timezone?.id || 'unknown',
      org: geoData.connection?.org || 'unknown',
      asn: geoData.connection?.asn ? String(geoData.connection.asn) : 'unknown',
      version: geoData.type || 'IPv4'
    };
    console.log('✓ Données IP récupérées via ipwho.is');
    
  } catch (error) {
    console.error('✗ Erreur avec ipwho.is:', error.message);
    console.warn('⚠ Tentative avec freeipapi.com...');
    
    try {
      const response = await fetch('https://freeipapi.com/api/json');
      if (!response.ok) {
        throw new Error(`Erreur HTTP freeipapi: ${response.status}`);
      }
      const apiData = await response.json();
      
      data = {
        ip: apiData.ipAddress,
        city: apiData.cityName || 'unknown',
        region: apiData.regionName || 'unknown',
        country_name: apiData.countryName || 'unknown',
        country: apiData.countryCode || 'unknown',
        postal: apiData.zipCode || null,
        latitude: apiData.latitude || null,
        longitude: apiData.longitude || null,
        timezone: apiData.timeZone || 'unknown',
        org: 'unknown',
        asn: 'unknown',
        version: 'IPv4'
      };
      console.log('✓ Données IP récupérées via freeipapi.com');
      
    } catch (fallbackError) {
      console.error('✗ Erreur avec freeipapi.com:', fallbackError.message);
      console.warn('⚠ Tentative avec ipapi.is...');
      
      try {
        const response = await fetch('https://ipapi.is/');
        if (!response.ok) {
          throw new Error(`Erreur HTTP ipapi.is: ${response.status}`);
        }
        const apiData = await response.json();
        
        data = {
          ip: apiData.ip,
          city: apiData.location?.city || 'unknown',
          region: apiData.location?.state || 'unknown',
          country_name: apiData.location?.country || 'unknown',
          country: apiData.location?.country_code || 'unknown',
          postal: apiData.location?.postal || null,
          latitude: apiData.location?.latitude || null,
          longitude: apiData.location?.longitude || null,
          timezone: apiData.location?.timezone || 'unknown',
          org: apiData.company?.name || 'unknown',
          asn: apiData.asn?.asn || 'unknown',
          version: 'IPv4'
        };
        console.log('✓ Données IP récupérées via ipapi.is');
        
      } catch (lastError) {
        console.error('✗ Erreur avec ipapi.is:', lastError.message);
        console.error('✗ Toutes les APIs ont échoué, utilisation de données minimales');
        
        data = {
          ip: 'unknown',
          city: 'unknown',
          region: 'unknown',
          country_name: 'unknown',
          country: 'unknown',
          postal: null,
          latitude: null,
          longitude: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          org: 'unknown',
          asn: 'unknown',
          version: 'unknown'
        };
      }
    }
  }
  
  console.log('✓ Données IP finales:', data.ip, data.city, data.country_name);
  return data;
}

// 9. Fonction principale pour collecter et enregistrer les données
async function trackVisit() {
  console.log('═══════════════════════════════════════');
  console.log('🚀 Démarrage du tracking de visite');
  console.log('═══════════════════════════════════════');
  
  let UAParser = null;
  let parsedUA = null;
  
  // Charger UA-Parser-JS
  console.log('📦 Chargement de UA-Parser...');
  try {
    UAParser = await loadUAParser();
  } catch (uaError) {
    console.warn('⚠ UA-Parser non disponible, utilisation des données basiques uniquement');
    console.warn('  Détails:', uaError.message);
  }
  
  // Obtenir l'ID visiteur
  console.log('🔑 Récupération de l\'identifiant visiteur...');
  const visitorId = await getOrCreateVisitorId();
  
  // Parser le User Agent si disponible
  if (UAParser) {
    console.log('🔍 Parsing du User Agent...');
    try {
      const parser = new UAParser();
      const uaResult = parser.getResult();
      
      parsedUA = {
        browser_name: uaResult.browser.name || 'unknown',
        browser_version: uaResult.browser.version || 'unknown',
        browser_major: uaResult.browser.major || 'unknown',
        engine_name: uaResult.engine.name || 'unknown',
        engine_version: uaResult.engine.version || 'unknown',
        os_name: uaResult.os.name || 'unknown',
        os_version: uaResult.os.version || 'unknown',
        device_vendor: uaResult.device.vendor || 'unknown',
        device_model: uaResult.device.model || 'unknown',
        device_type: uaResult.device.type || 'desktop',
        cpu_architecture: uaResult.cpu.architecture || 'unknown'
      };
      console.log('✓ User Agent parsé:', parsedUA.browser_name, parsedUA.os_name);
    } catch (parseError) {
      console.error('✗ Erreur lors du parsing UA:', parseError);
      parsedUA = null;
    }
  }

  // Collecter les informations de l'équipement
  console.log('📊 Collection des informations de l\'équipement...');
  const deviceInfo = {};
  
  try {
    deviceInfo.network_type = navigator.connection?.effectiveType || 'blocked';
    deviceInfo.network_downlink = navigator.connection?.downlink || null;
    deviceInfo.network_rtt = navigator.connection?.rtt || null;
    deviceInfo.network_saveData = navigator.connection?.saveData || false;
  } catch (e) {
    console.warn('⚠ Informations réseau bloquées');
    deviceInfo.network_type = 'error';
  }
  
  try {
    deviceInfo.touch_support = navigator.maxTouchPoints > 0;
    deviceInfo.max_touch_points = navigator.maxTouchPoints || 0;
  } catch (e) {
    console.warn('⚠ Informations tactiles bloquées');
    deviceInfo.touch_support = null;
  }
  
  try {
    deviceInfo.screen_width = screen.width;
    deviceInfo.screen_height = screen.height;
    deviceInfo.screen_available_width = screen.availWidth;
    deviceInfo.screen_available_height = screen.availHeight;
    deviceInfo.screen_color_depth = screen.colorDepth;
    deviceInfo.screen_pixel_depth = screen.pixelDepth;
    deviceInfo.screen_orientation = screen.orientation?.type || 'unknown';
    deviceInfo.pixel_ratio = window.devicePixelRatio || 1;
  } catch (e) {
    console.warn('⚠ Informations écran bloquées');
    deviceInfo.screen_width = null;
  }
  
  try {
    deviceInfo.platform = navigator.platform || 'unknown';
    deviceInfo.os_cpu = navigator.oscpu || 'unknown';
    deviceInfo.language = navigator.language || 'unknown';
    deviceInfo.languages = navigator.languages || [];
    deviceInfo.hardware_concurrency = navigator.hardwareConcurrency || null;
    deviceInfo.device_memory = navigator.deviceMemory || null;
  } catch (e) {
    console.warn('⚠ Informations navigateur bloquées');
  }
  
  try {
    deviceInfo.viewport_width = window.innerWidth;
    deviceInfo.viewport_height = window.innerHeight;
    deviceInfo.doNotTrack = navigator.doNotTrack || 'unknown';
    deviceInfo.globalPrivacyControl = navigator.globalPrivacyControl || false;
  } catch (e) {
    console.warn('⚠ Informations viewport bloquées');
  }
  
  console.log('✓ Informations équipement collectées');

  // Collecter les données IP
  const ipData = await collectIPData();
  
  // Créer l'objet de données complet
  const visitData = {
    visitor_id: visitorId,
    script_version: SCRIPT_VERSION,
    ip: ipData.ip,
    city: ipData.city,
    region: ipData.region,
    country: ipData.country_name,
    country_code: ipData.country,
    postal: ipData.postal,
    latitude: ipData.latitude,
    longitude: ipData.longitude,
    timezone: ipData.timezone,
    org: ipData.org,
    asn: ipData.asn,
    version: ipData.version,
    user_agent: navigator.userAgent,
    ...(parsedUA || {}),
    ...deviceInfo,
    clicked_links: [],
    timestamp: serverTimestamp()
  };
  
  // Enregistrer dans Firestore
  try {
    console.log('💾 Enregistrement dans Firestore...');
    const docRef = await addDoc(collection(db, "visites"), visitData);
    console.log('✓ Données enregistrées avec succès !');
    console.log('  Document ID:', docRef.id);
    console.log('  Visitor ID:', visitorId);
    console.log('═══════════════════════════════════════');
    
    return docRef.id;
    
  } catch (error) {
    console.error('═══════════════════════════════════════');
    console.error('❌ ERREUR CRITIQUE lors de l\'enregistrement Firestore');
    console.error('═══════════════════════════════════════');
    console.error('Type:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    if (error.code) console.error('Code Firebase:', error.code);
    console.error('═══════════════════════════════════════');
    return null;
  }
}

// 10. Variable globale pour stocker l'ID du document de visite
let visitDocId = null;

// 11. Lancer le tracking et stocker l'ID du document
async function initTracking() {
  console.log('🎬 Initialisation du tracking...');
  visitDocId = await trackVisit();
  
  console.log('📋 visitDocId après trackVisit:', visitDocId);
  
  if (visitDocId) {
    console.log('✓ Document de visite créé, activation du tracking des liens');
    attachLinkTracking();
    observeDOMChanges(); // Activer l'observateur pour les liens dynamiques
  } else {
    console.error('✗ Pas de visitDocId, tracking des liens désactivé');
  }
}

// 12. Fonction pour ajouter un clic au document de visite
async function addClickToVisit(linkElement, event) {
  if (!visitDocId) {
    console.warn('⚠ Document de visite non encore créé');
    return;
  }
  
  try {
    // Créer le timestamp au timezone de Paris
    const parisTime = new Date().toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const clickInfo = {
      url: linkElement.href,
      timestamp: parisTime
    };
    
    const visitRef = doc(db, "visites", visitDocId);
    await updateDoc(visitRef, {
      clicked_links: arrayUnion(clickInfo)
    });
    
    console.log('✓ Clic ajouté au document de visite:', linkElement.href);
    
  } catch (error) {
    console.error('✗ Erreur lors de l\'ajout du clic:', error);
  }
}

// 13. Attacher les listeners aux liens
function attachLinkTracking() {
  console.log('🔗 Initialisation du tracking des liens...');
  console.log('📍 État du DOM:', document.readyState);
  
  const links = document.querySelectorAll('a[href]');
  console.log(`ℹ ${links.length} liens détectés sur la page`);
  
  if (links.length === 0) {
    console.warn('⚠ Aucun lien trouvé ! Le DOM est peut-être pas encore chargé.');
    console.log('📝 Contenu du body:', document.body?.innerHTML?.substring(0, 200));
  }
  
  links.forEach((link, index) => {
    // Ignorer les liens déjà trackés
    if (link.dataset.tracked === 'true') {
      return;
    }
    
    // Marquer comme tracké
    link.dataset.tracked = 'true';
    
    // console.log(`  Lien ${index + 1}: ${link.href} - "${link.textContent.trim().substring(0, 30)}"`);
    
    link.addEventListener('click', function(event) {
      // Ignorer les liens avec href vide ou javascript:
      if (!this.href || this.href.startsWith('javascript:') || this.href.includes('#')) {
        console.log('🔗 Lien ignoré (ancre ou javascript):', this.href);
        return;
      }
      
      console.log('🖱️ CLIC DÉTECTÉ sur:', this.href);
      event.preventDefault();
      
      const targetUrl = this.href;
      
      addClickToVisit(this, event)
        .then(() => {
          console.log('→ Navigation vers:', targetUrl);
          window.location.href = targetUrl;
        })
        .catch((error) => {
          console.error('✗ Erreur lors du tracking, navigation quand même:', error);
          window.location.href = targetUrl;
        });
    });
  });
  
  console.log('✓ Tracking des liens activé');
}

// 13b. Observer les changements du DOM pour tracker les nouveaux liens
function observeDOMChanges() {
  console.log('👁️ Activation de l\'observateur DOM pour les liens dynamiques...');
  
  const observer = new MutationObserver((mutations) => {
    let hasNewLinks = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Vérifier si le nœud ajouté contient des liens
        if (node.nodeType === 1) { // ELEMENT_NODE
          if (node.tagName === 'A' && node.href) {
            hasNewLinks = true;
          } else if (node.querySelectorAll) {
            const links = node.querySelectorAll('a[href]');
            if (links.length > 0) {
              hasNewLinks = true;
            }
          }
        }
      });
    });
    
    // Si de nouveaux liens ont été ajoutés, les tracker
    if (hasNewLinks) {
      console.log('🔄 Nouveaux liens détectés, réattachement du tracking...');
      attachLinkTracking();
    }
  });
  
  // Observer tout le body pour les changements
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('✓ Observateur DOM activé');
}

// 14. Démarrer le tracking
initTracking();