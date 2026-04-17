/**
 * Общие настройки для опроса и страницы /admin/
 * При смене проекта Firebase правьте только этот файл.
 *
 * --- Firestore Rules ---
 * Консоль: Firestore → Rules → вставьте содержимое файла firestore.rules в корне проекта
 * (нужны блоки match для подколлекций visitors и submissions — иначе будет permission-denied).
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
