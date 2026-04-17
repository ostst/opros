/**
 * Общие настройки для опроса и страницы /admin/
 * При смене проекта Firebase правьте только этот файл.
 *
 * --- Firestore Rules (консоль Firebase → Firestore → Rules) ---
 * Учёт визитов: документ poll/{pollId}/visitors/{uid} создаётся только своим uid.
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /poll/{pollId} {
 *       allow read: if true;
 *       allow create, update: if request.auth != null;
 *
 *       match /visitors/{visitorId} {
 *         allow read, create: if request.auth != null && request.auth.uid == visitorId;
 *       }
 *
 *       match /submissions/{submissionId} {
 *         allow read, create: if request.auth != null && request.auth.uid == submissionId;
 *       }
 *     }
 *   }
 * }
 */
window.OPK_FIREBASE = {
  config: {
    apiKey: "AIzaSyCzmmtCnhFDoDXUjceaPqTmFef-jgU4w9I",
    authDomain: "opros-e12b8.firebaseapp.com",
    projectId: "opros-e12b8",
    storageBucket: "opros-e12b8.firebasestorage.app",
    messagingSenderId: "668010332685",
    appId: "1:668010332685:web:919016539d61230d664b44",
    measurementId: "G-T4LW4Q0LCF",
  },
  /** PIN для админ-страницы /admin/ */
  adminPin: "1234",
  /** Документ Firestore с данными опроса */
  pollDoc: ["poll", "main"],
};
