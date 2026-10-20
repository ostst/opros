(function () {
/**
 * Общий слой данных анкеты: Firebase (боевой режим) или демо-режим (?demo в адресе).
 * Требует заранее подключённых ../assets/firebase-config.js и ./assets/tl-questions.js
 */
const SURVEY = window.TL_SURVEY;
const FB = window.OPK_FIREBASE || {};
const FB_VER = "10.14.0";

const QUESTIONS = SURVEY.questions.map((q) => ({
  required: true,
  ...q,
  options: q.options || [],
}));

const isDemo = (() => {
  if (location.protocol === "file:") return true;
  try {
    const p = new URLSearchParams(location.search);
    if (p.has("demo")) return true;
  } catch (_) {}
  const c = FB.config;
  return !(c && c.apiKey && c.projectId);
})();

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ------------------------------------------------------------------ */
/*  Валидация ответа                                                    */
/* ------------------------------------------------------------------ */

function isAnswered(q, a) {
  if (a == null) return false;
  if (q.type === "text" || q.type === "long") return String(a).trim().length > 0;
  if (q.type === "single" || q.type === "multi") {
    const sel = Array.isArray(a.sel) ? a.sel : [];
    if (sel.length === 0) return false;
    if (sel.includes(-1) && !String(a.other || "").trim()) return false;
    return true;
  }
  if (q.type === "rank") {
    const need = Math.min(q.minRank || q.options.length, q.options.length);
    return Array.isArray(a) && a.length >= need;
  }
  return false;
}

function cleanAnswers(answers) {
  const out = {};
  QUESTIONS.forEach((q) => {
    const a = answers[q.id];
    if (!isAnswered(q, a)) return;
    if (q.type === "text" || q.type === "long") out[q.id] = String(a).trim().slice(0, 2000);
    else if (q.type === "rank") out[q.id] = a.filter((i) => i >= 0 && i < q.options.length);
    else {
      const sel = a.sel.filter((i) => i === -1 || (i >= 0 && i < q.options.length));
      const v = { sel };
      if (sel.includes(-1)) v.other = String(a.other || "").trim().slice(0, 500);
      out[q.id] = v;
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/*  Агрегация для экрана результатов и админки                          */
/* ------------------------------------------------------------------ */

function aggregate(subs) {
  const total = subs.length;
  return QUESTIONS.map((q) => {
    const res = { q, answered: 0 };
    if (q.type === "text" || q.type === "long") {
      res.texts = [];
      subs.forEach((s) => {
        const v = s.answers && s.answers[q.id];
        if (typeof v === "string" && v.trim()) {
          res.answered++;
          res.texts.push({ text: v.trim(), t: s.t || 0 });
        }
      });
      res.texts.sort((a, b) => b.t - a.t);
    } else if (q.type === "rank") {
      const n = q.options.length;
      const points = new Array(n).fill(0);
      const firsts = new Array(n).fill(0);
      subs.forEach((s) => {
        const v = s.answers && s.answers[q.id];
        if (!Array.isArray(v) || !v.length) return;
        res.answered++;
        v.forEach((oi, pos) => {
          if (oi >= 0 && oi < n) points[oi] += n - pos;
          if (pos === 0 && oi >= 0 && oi < n) firsts[oi]++;
        });
      });
      const max = res.answered * n || 1;
      res.items = q.options
        .map((label, i) => ({ label, i, score: points[i], share: points[i] / max, firsts: firsts[i] }))
        .sort((a, b) => b.score - a.score);
    } else {
      const n = q.options.length;
      const counts = new Array(n).fill(0);
      let otherCount = 0;
      const others = [];
      subs.forEach((s) => {
        const v = s.answers && s.answers[q.id];
        if (!v || !Array.isArray(v.sel) || !v.sel.length) return;
        res.answered++;
        v.sel.forEach((oi) => {
          if (oi === -1) {
            otherCount++;
            if (v.other) others.push({ text: v.other, t: s.t || 0 });
          } else if (oi >= 0 && oi < n) counts[oi]++;
        });
      });
      res.items = q.options.map((label, i) => ({ label, i, count: counts[i] }));
      if (q.other) res.items.push({ label: q.otherLabel || "Другое", i: -1, count: otherCount, isOther: true });
      res.items.forEach((it) => (it.share = res.answered ? it.count / res.answered : 0));
      res.others = others.sort((a, b) => b.t - a.t);
    }
    res.total = total;
    return res;
  });
}

function toCSV(subs) {
  const head = ["№", "Дата и время", ...QUESTIONS.map((q, i) => `${i + 1}. ${q.title}`)];
  const rows = subs
    .slice()
    .sort((a, b) => (a.t || 0) - (b.t || 0))
    .map((s, idx) => {
      const d = s.t ? new Date(s.t) : null;
      const cells = [String(idx + 1), d ? d.toLocaleString("ru-RU") : ""];
      QUESTIONS.forEach((q) => {
        const v = s.answers && s.answers[q.id];
        if (v == null) return cells.push("");
        if (typeof v === "string") return cells.push(v);
        if (q.type === "rank" && Array.isArray(v)) return cells.push(v.map((oi, p) => `${p + 1}. ${q.options[oi]}`).join("; "));
        if (Array.isArray(v.sel))
          return cells.push(
            v.sel.map((oi) => (oi === -1 ? `${q.otherLabel || "Другое"}: ${v.other || ""}` : q.options[oi])).join("; ")
          );
        cells.push("");
      });
      return cells;
    });
  const quote = (c) => `"${String(c).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return "﻿" + [head, ...rows].map((r) => r.map(quote).join(";")).join("\r\n");
}

/* ------------------------------------------------------------------ */
/*  Хранилище                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_POLL = { status: "open", showResults: false, submissionCount: 0, visitorCount: 0 };

function safeLS(fn, fallback) {
  try {
    return fn();
  } catch (_) {
    return fallback;
  }
}

/** Демо: всё хранится в localStorage этого браузера, вкладки синхронизируются. */
function createDemoStore() {
  const KEY = "tl-demo-v1";
  const chan = safeLS(() => new BroadcastChannel("tl-demo"), null);
  const listeners = new Set();
  let mem = null;

  function load() {
    const raw = safeLS(() => localStorage.getItem(KEY), null);
    let s = mem;
    if (raw) s = safeLS(() => JSON.parse(raw), null);
    if (!s) s = { poll: { ...DEFAULT_POLL }, subs: {} };
    mem = s;
    return s;
  }
  function save(s) {
    mem = s;
    safeLS(() => localStorage.setItem(KEY, JSON.stringify(s)));
    if (chan) chan.postMessage(1);
    listeners.forEach((f) => f());
  }
  if (chan) chan.onmessage = () => { mem = null; listeners.forEach((f) => f()); };
  window.addEventListener("storage", (e) => { if (e.key === KEY) { mem = null; listeners.forEach((f) => f()); } });

  let uid = safeLS(() => sessionStorage.getItem("tl-demo-uid"), null);
  if (!uid) {
    uid = "demo-" + Math.random().toString(36).slice(2, 10);
    safeLS(() => sessionStorage.setItem("tl-demo-uid", uid));
  }

  return {
    mode: "demo",
    uid,
    async init() {},
    async getMine() {
      return load().subs[uid] || null;
    },
    async submit(answers) {
      const s = load();
      if (s.subs[uid]) throw new Error("__already__");
      s.subs[uid] = { answers, t: Date.now() };
      s.poll.submissionCount = Object.keys(s.subs).length;
      save(s);
    },
    async trackVisit() {
      const s = load();
      s.poll.visitorCount = (s.poll.visitorCount || 0) + 1;
      save(s);
    },
    onPoll(cb) {
      const f = () => cb({ ...DEFAULT_POLL, ...load().poll });
      listeners.add(f);
      f();
      return () => listeners.delete(f);
    },
    onMine(cb) {
      const f = () => cb(load().subs[uid] || null);
      listeners.add(f);
      f();
      return () => listeners.delete(f);
    },
    onSubmissions(cb) {
      const f = () => cb(Object.entries(load().subs).map(([id, v]) => ({ id, ...v })));
      listeners.add(f);
      f();
      return () => listeners.delete(f);
    },
    async updatePoll(patch) {
      const s = load();
      s.poll = { ...s.poll, ...patch };
      save(s);
    },
    async resetAll() {
      const s = load();
      s.subs = {};
      s.poll = { ...s.poll, submissionCount: 0, visitorCount: 0 };
      save(s);
    },
    async seed(n = 36) {
      const s = load();
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const roles = ["Главный инженер, машиностроение", "Директор по производству", "Руководитель цифровой трансформации", "Начальник цеха", "Технический директор, энергетика", "HR-директор", "Руководитель проектного офиса"];
      const tasks = ["Запуск нового производства", "Внедрение бережливого производства", "Управление командой инженеров", "Импортозамещение оборудования", "Цифровизация процессов"];
      const must = ["Управление изменениями", "Финансы для нефинансистов", "Промышленная автоматизация", "Стратегия и лидерство", "Работа с данными"];
      for (let k = 0; k < n; k++) {
        const a = {};
        QUESTIONS.forEach((q) => {
          if (q.type === "text") a[q.id] = q.id === "role" ? pick(roles) : q.id === "price" ? pick(["200–300 тыс. ₽", "до 150 тыс. ₽", "300–500 тыс. ₽"]) : pick(["Осень 2026", "С января 2027", "Весна 2027"]);
          else if (q.type === "long") { if (Math.random() < 0.7) a[q.id] = pick(q.id === "tasks" ? tasks : must); }
          else if (q.type === "single") a[q.id] = { sel: [Math.floor(Math.random() ** 1.4 * q.options.length)] };
          else if (q.type === "multi") {
            const sel = q.options.map((_, i) => i).filter(() => Math.random() < 0.45);
            if (!sel.length) sel.push(0);
            if (q.other && Math.random() < 0.12) { sel.push(-1); a[q.id] = { sel, other: "Свой вариант участника" }; }
            else a[q.id] = { sel };
          } else if (q.type === "rank") {
            a[q.id] = q.options.map((_, i) => i).sort(() => Math.random() - 0.5 + 0.1);
          }
        });
        s.subs["seed-" + k + "-" + Date.now()] = { answers: a, t: Date.now() - (n - k) * 45000 };
      }
      s.poll.submissionCount = Object.keys(s.subs).length;
      s.poll.visitorCount = Math.max(s.poll.visitorCount || 0, s.poll.submissionCount + 7);
      save(s);
    },
  };
}

/** Боевой режим: Firestore + анонимный вход. */
function createFirebaseStore() {
  let fs, db, auth, pollRef, subsCol;
  const [c0, c1] = SURVEY.pollDoc || ["poll", "tl-2026"];

  const store = {
    mode: "firebase",
    uid: null,
    async init() {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
      ]);
      fs = fsMod;
      const app = initializeApp(FB.config, "tl");
      auth = authMod.getAuth(app);
      await authMod.signInAnonymously(auth);
      store.uid = auth.currentUser.uid;
      db = fs.getFirestore(app);
      pollRef = fs.doc(db, c0, c1);
      subsCol = fs.collection(db, c0, c1, "submissions");
      const snap = await fs.getDoc(pollRef);
      if (!snap.exists()) await fs.setDoc(pollRef, { ...DEFAULT_POLL }, { merge: true });
    },
    async getMine() {
      const s = await fs.getDoc(fs.doc(subsCol, store.uid));
      return s.exists() ? s.data() : null;
    },
    async submit(answers) {
      // Пишем только собственный документ участника: без общего счётчика,
      // чтобы при одновременной отправке многими людьми не было конфликтов.
      const ref = fs.doc(subsCol, store.uid);
      const data = { answers, t: Date.now(), createdAt: fs.serverTimestamp() };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let lastErr = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (attempt > 0) {
            const ex = await fs.getDoc(ref);
            if (ex.exists()) return; // предыдущая попытка всё-таки дошла
          }
          await fs.setDoc(ref, data);
          return;
        } catch (e) {
          lastErr = e;
          console.warn("submit attempt", attempt + 1, e);
          await wait(600 * (attempt + 1) + Math.random() * 600);
        }
      }
      try {
        const ex = await fs.getDoc(ref);
        if (ex.exists()) return;
      } catch (_) {}
      throw lastErr || new Error("submit failed");
    },
    async trackVisit() {
      try {
        await fs.setDoc(fs.doc(db, c0, c1, "visitors", store.uid), { v: 1 });
      } catch (e) {
        // уже есть — это нормально
      }
    },
    onPoll(cb) {
      let pollData = {};
      let visitors = null;
      const emit = () => cb({ ...DEFAULT_POLL, ...pollData, ...(visitors == null ? {} : { visitorCount: visitors }) });
      const u1 = fs.onSnapshot(pollRef, (d) => { pollData = d.exists() ? d.data() : {}; emit(); }, (e) => console.error(e));
      let u2 = () => {};
      if (store.watchVisitors) {
        u2 = fs.onSnapshot(fs.collection(db, c0, c1, "visitors"), (qs) => { visitors = qs.size; emit(); }, (e) => console.error(e));
      }
      return () => { u1(); u2(); };
    },
    onMine(cb) {
      return fs.onSnapshot(fs.doc(subsCol, store.uid), (d) => cb(d.exists() ? d.data() : null), (e) => console.error(e));
    },
    onSubmissions(cb) {
      return fs.onSnapshot(
        subsCol,
        (qs) => cb(qs.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => console.error(e)
      );
    },
    async updatePoll(patch) {
      await fs.setDoc(pollRef, patch, { merge: true });
    },
    async resetAll() {
      for (const name of ["submissions", "visitors"]) {
        const qs = await fs.getDocs(fs.collection(db, c0, c1, name));
        let batch = fs.writeBatch(db);
        let n = 0;
        for (const d of qs.docs) {
          batch.delete(d.ref);
          if (++n % 400 === 0) {
            await batch.commit();
            batch = fs.writeBatch(db);
          }
        }
        await batch.commit();
      }
      await fs.setDoc(pollRef, { submissionCount: 0, visitorCount: 0 }, { merge: true });
    },
  };
  return store;
}

const store = isDemo ? createDemoStore() : createFirebaseStore();
const adminPin = String(FB.adminPin || "1234");

/** Ссылка на анкету для QR-кода (index.html рядом с текущей страницей). */
function surveyUrl() {
  const u = new URL("./", location.href);
  if (isDemo) u.searchParams.set("demo", "");
  return u.href.replace("demo=", "demo");
}

window.TL = { QUESTIONS, isDemo, esc, plural, isAnswered, cleanAnswers, aggregate, toCSV, store, adminPin, surveyUrl,
  isLocalFile: location.protocol === "file:",
  withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("Нет ответа от сервера (таймаут)")), ms))]);
  },
};
})();
