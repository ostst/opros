(function () {
/** Отрисовка результатов: общий код для экрана мероприятия и админки. */
const { esc, plural } = window.TL;

const pct = (x) => `${Math.round(x * 100)}%`;

function barRow({ label, value, share, top, sub }) {
  return `<div class="bar-row${top ? " is-top" : ""}">
    <div class="bar-label">${esc(label)}</div>
    <div class="bar-val">${value}${sub ? `<small>${sub}</small>` : ""}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(share * 100, share > 0 ? 1.5 : 0)}%"></div></div>
  </div>`;
}

function quotes(list, limit) {
  if (!list.length) return `<p class="r-empty">Ответов пока нет</p>`;
  const shown = list.slice(0, limit);
  const rest = list.length - shown.length;
  return `<ul class="r-quotes">${shown.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>${
    rest > 0 ? `<p class="r-more">и ещё ${rest} ${plural(rest, "ответ", "ответа", "ответов")}</p>` : ""
  }`;
}

/**
 * @param agg результат aggregate()
 * @param opts { quoteLimit, allTexts }
 */
function resultsHtml(agg, opts = {}) {
  const quoteLimit = opts.quoteLimit ?? 5;
  return agg
    .map((r, idx) => {
      const q = r.q;
      let body = "";
      let meta = `${r.answered} ${plural(r.answered, "ответ", "ответа", "ответов")}`;
      if (q.type === "text" || q.type === "long") {
        body = quotes(r.texts, opts.allTexts ? Infinity : quoteLimit);
      } else if (q.type === "rank") {
        const best = r.items[0] ? r.items[0].score : 0;
        body =
          `<div class="r-bars">` +
          r.items
            .map((it, k) =>
              barRow({
                label: `${k + 1}. ${it.label}`,
                value: r.answered ? it.score : 0,
                sub: "баллов",
                share: best ? it.score / best : 0,
                top: k === 0 && it.score > 0,
              })
            )
            .join("") +
          `</div><p class="r-note">Чем выше позиция в ответе, тем больше баллов</p>`;
      } else {
        const max = Math.max(0, ...r.items.map((i) => i.count));
        const items = q.type === "single" ? r.items : [...r.items].sort((a, b) => (a.isOther ? 1 : 0) - (b.isOther ? 1 : 0) || b.count - a.count);
        body =
          `<div class="r-bars">` +
          items
            .map((it) =>
              barRow({
                label: it.label,
                value: pct(it.share),
                sub: String(it.count),
                share: max ? it.count / max : 0,
                top: it.count > 0 && it.count === max,
              })
            )
            .join("") +
          `</div>`;
        if (r.others && r.others.length) {
          body += `<div class="r-others"><p class="r-sub">Свои варианты</p>${quotes(r.others, opts.allTexts ? Infinity : 3)}</div>`;
        }
        if (q.type === "multi") meta += " · можно было выбрать несколько";
      }
      return `<article class="r-card r-${q.type}">
        <header><span class="r-num">${String(idx + 1).padStart(2, "0")}</span><h3>${esc(q.title)}</h3></header>
        <p class="r-meta">${meta}</p>
        ${body}
      </article>`;
    })
    .join("");
}

const RESULTS_CSS = `
.r-grid{columns:var(--r-cols,1) var(--r-colw,380px);column-gap:var(--r-gap,20px)}
.r-card{break-inside:avoid;display:inline-block;width:100%;margin:0 0 var(--r-gap,20px);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:clamp(18px,1.6vw,30px);box-shadow:0 4px 24px rgba(28,31,38,.06)}
.r-card header{display:flex;gap:12px;align-items:flex-start;margin-bottom:6px}
.r-num{flex-shrink:0;font-size:.78em;font-weight:800;color:var(--orange);font-variant-numeric:tabular-nums;padding-top:.22em;letter-spacing:.02em}
.r-card h3{margin:0;font-size:1.05em;line-height:1.35;color:var(--navy);font-weight:700}
.r-meta{margin:0 0 16px;font-size:.78em;color:var(--muted);padding-left:calc(12px + 1.6em)}
.r-bars{display:grid;gap:12px;font-size:.9em}
.r-note{margin:12px 0 0;font-size:.75em;color:var(--muted)}
.r-quotes{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.r-quotes li{background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--navy);border-radius:10px;padding:10px 14px;font-size:.88em;line-height:1.45;color:var(--text-2);overflow-wrap:anywhere}
.r-quotes li:first-child{animation:r-in .5s ease}
@keyframes r-in{from{opacity:0;transform:translateY(-6px)}}
.r-more,.r-empty{margin:10px 0 0;font-size:.78em;color:var(--muted)}
.r-empty{margin:0}
.r-others{margin-top:16px;padding-top:14px;border-top:1px dashed var(--border)}
.r-sub{margin:0 0 8px;font-size:.75em;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}
`;

window.TLRender = { resultsHtml, RESULTS_CSS };
})();
