/**
 * Общая логика структуры опроса (вопросы в Firestore + totals по индексам вариантов).
 * Подключается после assets/firebase-config.js (нужен window.OPK_DEFAULT_QUESTIONS).
 */
(function (w) {
  const LEGACY_KEYS = ["a", "b", "c", "d"];
  const RU_LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";

  function deepCloneQuestions() {
    const src = w.OPK_DEFAULT_QUESTIONS;
    if (!src || !Array.isArray(src)) return [];
    return JSON.parse(JSON.stringify(src));
  }

  function emptyTotalsForQuestions(questions) {
    const totals = {};
    questions.forEach((q, qi) => {
      const row = {};
      (q.options || []).forEach((_, oi) => {
        row[String(oi)] = 0;
      });
      totals["q" + qi] = row;
    });
    return totals;
  }

  /** Перенос счётчиков: старые ключи a–d или "0","1" → новая сетка. */
  function migrateTotals(oldTotals, questions) {
    if (!oldTotals) return emptyTotalsForQuestions(questions);
    const totals = emptyTotalsForQuestions(questions);
    questions.forEach((q, qi) => {
      const src = oldTotals["q" + qi];
      if (!src || typeof src !== "object") return;
      const nOpt = (q.options || []).length;
      for (let oi = 0; oi < nOpt; oi++) {
        let v = src[String(oi)];
        if (v == null && LEGACY_KEYS[oi]) v = src[LEGACY_KEYS[oi]];
        totals["q" + qi][String(oi)] = Number(v) || 0;
      }
    });
    return totals;
  }

  /** Нормализация одного вопроса из редактора / Firestore. */
  function normalizeQuestion(q) {
    if (!q || typeof q !== "object") return null;
    const text = String(q.text || "").trim();
    const options = (Array.isArray(q.options) ? q.options : [])
      .map((o) => {
        if (typeof o === "string") return o.trim();
        if (o && typeof o.text === "string") return o.text.trim();
        return "";
      })
      .filter((s) => s.length > 0);
    if (!text || options.length < 2) return null;
    return { text, options };
  }

  /**
   * Приводит сырой документ poll к рабочему виду: questions[], totals, sessionClosed.
   */
  function normalizePoll(raw) {
    const base = {
      schemaVersion: 2,
      submissionCount: 0,
      visitorCount: 0,
      sessionClosed: false,
      ...(raw && typeof raw === "object" ? raw : {}),
    };

    let questions = Array.isArray(base.questions) ? base.questions.map(normalizeQuestion).filter(Boolean) : [];
    if (questions.length === 0) questions = deepCloneQuestions();

    base.questions = questions;
    base.sessionClosed = raw && raw.sessionClosed === true;
    base.totals = migrateTotals(raw && raw.totals, questions);

    if (typeof base.submissionCount !== "number") base.submissionCount = 0;
    if (typeof base.visitorCount !== "number") base.visitorCount = 0;

    return base;
  }

  function letterForIndex(i) {
    return RU_LETTERS[i] || String(i + 1);
  }

  function truncateLabel(text, maxLen) {
    const s = String(text || "");
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + "…";
  }

  /** Сумма голосов в строке totals для вопроса. */
  function sumRow(row) {
    if (!row || typeof row !== "object") return 0;
    return Object.keys(row).reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
  }

  function getCount(row, oi) {
    if (!row) return 0;
    const n = row[String(oi)];
    if (n != null) return Number(n) || 0;
    if (LEGACY_KEYS[oi] != null && row[LEGACY_KEYS[oi]] != null) return Number(row[LEGACY_KEYS[oi]]) || 0;
    return 0;
  }

  /** При сохранении вопросов: переносим счётчики по индексам вопроса и варианта (если индексов больше — нули). */
  function mergeTotalsOnQuestionSave(oldTotals, oldQuestions, newQuestions) {
    const out = emptyTotalsForQuestions(newQuestions);
    if (!oldTotals) return out;
    newQuestions.forEach((nq, qi) => {
      const src = oldTotals["q" + qi];
      if (!src || typeof src !== "object") return;
      nq.options.forEach((_, oi) => {
        out["q" + qi][String(oi)] = getCount(src, oi);
      });
    });
    return out;
  }

  function validateQuestionsList(draft) {
    if (!Array.isArray(draft) || draft.length === 0) {
      throw new Error("Нужен хотя бы один вопрос");
    }
    const out = [];
    for (let i = 0; i < draft.length; i++) {
      const nq = normalizeQuestion({ text: draft[i].text, options: draft[i].options });
      if (!nq) {
        throw new Error("Вопрос " + (i + 1) + ": укажите текст и не меньше двух вариантов ответа");
      }
      out.push(nq);
    }
    return out;
  }

  w.OPK_poll = {
    deepCloneQuestions,
    emptyTotalsForQuestions,
    normalizePoll,
    letterForIndex,
    truncateLabel,
    sumRow,
    getCount,
    mergeTotalsOnQuestionSave,
    validateQuestionsList,
    LEGACY_KEYS,
  };
})(window);
