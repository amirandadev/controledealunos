// ═════════════════════════════════════════════════════════════
// Configuração e inicialização do Firebase
// ═════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            'AIzaSyBEPUmXCRkivhzHLs9cWBmNVM6zxAhs-pU',
  authDomain:        'dashboard-kimbelly-24fc4.firebaseapp.com',
  projectId:         'dashboard-kimbelly-24fc4',
  storageBucket:     'dashboard-kimbelly-24fc4.appspot.com',
  messagingSenderId: '1078210332589',
  appId:             '1:1078210332589:web:4029ac33c53b3e061a0324',
};

// Proteção contra múltiplas inicializações (hot-reload, iframes, etc.)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('[firebase.js] App inicializado.');
} else {
  console.log('[firebase.js] App já estava inicializado — reutilizando instância existente.');
}

const db = firebase.firestore();

// ── Logs de diagnóstico ───────────────────────────────────────
console.log('[firebase.js] Firebase carregado:', !!firebase);
console.log('[firebase.js] Firestore (db):', db);
