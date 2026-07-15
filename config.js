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
  apiKey: "AIzaSyAxo4VkVVd8PqGJdM5ncIC-W8mQvU0z9uI",
  authDomain: "grt4r-7758d.firebaseapp.com",
  projectId: "grt4r-7758d",
  storageBucket: "grt4r-7758d.firebasestorage.app",
  messagingSenderId: "1044260841178",
  appId: "1:1044260841178:web:271150cdbb31a90794e7e3",
  measurementId: "G-5GY6WG5PLT"
};

// Стартовый баланс новых игроков ($)
const STARTING_BALANCE = 5;

// Стоимость листинга своей "акции" на бирже ($)
const LISTING_COST = 2;
