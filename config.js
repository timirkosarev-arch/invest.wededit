// ============================================================
//  config.js — вставь сюда свои ключи из Firebase Console
// ============================================================
// 1. Зайди на https://console.firebase.google.com
// 2. Создай проект (или открой существующий)
// 3. Project settings → General → Your apps → Web app (</>) → скопируй объект firebaseConfig
// 4. Authentication → Sign-in method → включи "Google"
// 5. Firestore Database → Create database → Start in production mode
// 6. Вставь правила безопасности из FIRESTORE_RULES.txt (в этой же папке)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAnrXmovXmBIGocOsbJxSIQ_7dwlHpccdU",
  authDomain: "edit-web.firebaseapp.com",
  databaseURL: "https://edit-web-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "edit-web",
  storageBucket: "edit-web.firebasestorage.app",
  messagingSenderId: "235371037065",
  appId: "1:235371037065:web:a44cc11617acb19276e158",
  measurementId: "G-7VJJSECTXX"
};

// Стартовый баланс новых игроков ($)
const STARTING_BALANCE = 5;

// Стоимость листинга своей "акции" на бирже ($)
const LISTING_COST = 2;
