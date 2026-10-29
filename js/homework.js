/* 숙제 안내문 탭: 반 명단 + 숙제(화면에서 적거나 숙제 엑셀) → A4 가로 한 장에 두 개 들어가는 안내문(PDF·사진).
   흐름: 반 명단(rebuild) → 2단계 숙제 적기(hwEditorHTML) → 반마다 미리보기(cardHTML) → 저장(buildPdf / buildPngs)
   과정·필독서 자료는 data/catalog.js, 엑셀 읽기는 js/shared.js 에 있어요. */
const { esc, norm, matchCourse, readHo, sessionOrder, pickMonth, courseMonths, courseGroups, monthTag, readSheetRows, groupRows, tell, onParent } = Suite;
const CATALOG = window.CATALOG;
const WD = "일월화수목금토";
const SEG_COLORS = ["#1f2a4a", "#e07a3f"];  /* 두 과정을 번갈아 하는 반의 과정별 색 */
/* 수업일 칸 → [연, 월, 일] 배열 (이 탭은 배열로 써요) */
const parseDates = (text, y, m) => Suite.parseDates(text, y, m).map(d => [d.y, d.m, d.d]);

/* 숙제 칸 글 → [{t, notes[]}] */
function parseHomework(text) {
  const s = String(text ?? "").replace(/[①-⑳]/g, c => (c.charCodeAt(0) - 0x245F) + ". ").normalize("NFKC");
  const items = [];
  for (let ln of s.split(/\r?\n/)) {
    ln = ln.replace(/\s+/g, " ").trim();
    if (!ln) continue;
    const isSession = /^\d+\s*차시/.test(ln);
    if (isSession && !items.length) continue; /* "1차시 유럽사회의 발전" 같은 머리줄은 빼요 */
    const m = !isSession && ln.match(/^(?:\d+\s*[.)]\s*|\d+\s+)(.+)$/);
    if (m) { items.push({ t: m[1].trim(), notes: [] }); continue; }
    const n = ln.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
    if (!n) continue;
    if (items.length) items[items.length - 1].notes.push(n); else items.push({ t: n, notes: [] });
  }
  return items;
}

/* 숙제 엑셀 → {courseIndex: {차시번호: items}}, 못 맞춘 단계 목록 */
function readHomework(rows, catalog) {
  const hi = rows.findIndex(r => r.some(c => norm(c) === "숙제") && r.some(c => norm(c) === "차시"));
  if (hi < 0) throw new Error("숙제 엑셀 첫 줄에서 '차시'와 '숙제' 칸을 찾지 못했어요.");
  const H = rows[hi].map(norm);
  const cStage = H.findIndex(h => h === "단계" || h.startsWith("단계")), cN = H.indexOf("차시"), cHw = H.indexOf("숙제");
  if (cStage < 0) throw new Error("숙제 엑셀 첫 줄에서 '단계' 칸을 찾지 못했어요.");
  const map = {}, raw = {}, unknown = [], exact = new Set();
  let lastStage = "";
  for (const r of rows.slice(hi + 1)) {
    const stage = String(r[cStage] ?? "").trim() || lastStage;
    lastStage = stage;
    const nm = String(r[cN] ?? "").normalize("NFKC").match(/\d+/);
    if (!stage || !nm) continue;
    /* "독서1 (10월)"처럼 달을 적으면 그 달 계획안에, 달이 없으면 모든 달에 같은 숙제가 들어가요 */
    const mm = stage.normalize("NFKC").match(/^(.*?)\s*\(?\s*(\d{1,2})\s*월\s*\)?\s*$/);
    const ci = mm ? matchCourse(mm[1], catalog, +mm[2]) : matchCourse(stage, catalog);
    if (ci < 0) { if (!unknown.includes(stage)) unknown.push(stage); continue; }
    if (mm) exact.add(ci);
    (map[ci] = map[ci] || {})[+nm[0]] = parseHomework(r[cHw]);
    (raw[ci] = raw[ci] || {})[+nm[0]] = String(r[cHw] ?? "").replace(/\r\n?/g, "\n").trim();
  }
  /* 달을 적지 않은 숙제는 같은 과정의 다른 달(10월·11월) 계획안에도 써요 */
  for (const k of Object.keys(map)) {
    const c = catalog.courses[+k];
    if (!c || c.kind !== "monthly" || exact.has(+k)) continue;
    catalog.courses.forEach((x, j) => { if (j !== +k && x.kind === "monthly" && x.name === c.name && !map[j]) { map[j] = map[k]; raw[j] = raw[k]; } });
  }
  return { map, raw, unknown };
}

/* 반 명단 단계에 호수가 없으면 숙제 엑셀의 과정 중 하나뿐인 것으로 맞춰요 */
function resolveStage(stage, catalog, hwMap, month) {
  const ci = matchCourse(stage, catalog, month);
  if (ci >= 0) return { ci, guessed: false };
  const base = norm(stage).replace(/단계/g, "");
  if (!base) return { ci: -1 };
  const cands = Object.keys(hwMap || {}).map(Number).filter(i => {
    const c = catalog.courses[i];
    return [c.name, c.full, ...c.aliases].some(a => norm(a).startsWith(base));
  });
  const uniq = [...new Set(cands.map(i => pickMonth(i, catalog, month)))];
  return uniq.length === 1 ? { ci: uniq[0], guessed: true } : { ci: -1 };
}

function buildClass(g, catalog, hwMap) {
  const segs = g.segs.map(s => {
    const dates = parseDates(s.dates, catalog.year, catalog.month);
    /* 수업월호: "10월"이면 10월 계획안, "2호"면 단계에 호를 붙여요 */
    const h = readHo(s.ho); let st = String(s.stage ?? "");
    if (h.ho && !/\d\s*호?\s*$/.test(st.normalize("NFKC").trim())) st = st.trim() + h.ho + "호";
    const r = resolveStage(st, catalog, hwMap, h.month || (dates[0] && dates[0][1]));
    return { stage: s.stage, ho: s.ho || "", order: s.order || "", datesText: s.dates, course: r.ci, guessed: !!r.guessed, dates };
  });
  const hasHw = segs.some(s => s.course >= 0 && hwMap[s.course]);
  const guess = !g.count && g.team && g.names.length === 1; /* 팀 이름 한 줄인데 학생 수가 없어요 */
  return { names: g.names, time: g.time, segs, include: hasHw, copies: Math.max(1, g.count || g.names.length), countGuess: guess, k: 1 };
}

/* 한 반의 안내문 내용 */
function classView(c, catalog, hwMap) {
  /* 숙제가 없는 과정(몰입·어휘·새싹 등)은 안내문에 넣지 않아요 */
  const hs = c.segs.filter(s => s.course >= 0 && hwMap[s.course]);
  const multi = hs.length > 1, rows = [];
  hs.forEach((s, si) => {
    const course = catalog.courses[s.course];
    const ord = sessionOrder(s.order, s.dates.length, course ? course.sessions.length : s.dates.length);   /* 차시를 바꿔서 수업할 때 */
    s.dates.slice().sort((a, b) => (a[0] * 1e4 + a[1] * 100 + a[2]) - (b[0] * 1e4 + b[1] * 100 + b[2])).forEach((d, i) => {
      const no = ord[i], se = course && course.sessions[no - 1];
      rows.push({ date: d, seg: si, no, short: course ? course.name : s.stage,
        tag: se ? se.tag : "", book: se ? se.book : "책 정보 없음",
        hw: course && hwMap[s.course] ? (hwMap[s.course][no] || []) : [] });
    });
  });
  rows.sort((a, b) => (a.date[0] * 1e4 + a.date[1] * 100 + a.date[2]) - (b.date[0] * 1e4 + b.date[1] * 100 + b.date[2]));
  const fulls = hs.map(s => catalog.courses[s.course]?.full || s.stage || "과정");
  const months = [...new Set(rows.map(r => r.date[0] * 100 + r.date[1]))];
  const ml = !rows.length ? "" : months.length > 1 ? rows[0].date[1] + "월~" + rows[rows.length - 1].date[1] + "월" : rows[0].date[1] + "월";
  /* 달력: 한 달이면 그 달 전체, 두 달에 걸치면 수업이 있는 주만 */
  const days = [];
  if (rows.length && months.length === 1) {
    const [y, m] = rows[0].date, first = new Date(y, m - 1, 1).getDay(), n = new Date(y, m, 0).getDate();
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= n; d++) days.push(new Date(y, m - 1, d));
    while (days.length % 7) days.push(null);
  } else if (rows.length) {
    const weeks = [...new Set(rows.map(r => { const d = new Date(r.date[0], r.date[1] - 1, r.date[2]); d.setDate(d.getDate() - d.getDay()); return d.getTime(); }))].sort((a, b) => a - b);
    weeks.forEach(w => { for (let i = 0; i < 7; i++) { const d = new Date(w); d.setDate(d.getDate() + i); days.push(d); } });
  }
  const mark = {}; rows.forEach(r => mark[r.date.join("-")] = r);
  const cells = days.map((d, i) => {
    if (!d) return null;
    const key = [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-");
    const lab = months.length > 1 && (d.getDate() === 1 || i === 0) ? (d.getMonth() + 1) + "/" + d.getDate() : String(d.getDate());
    return { lab, wd: i % 7, r: mark[key] || null };
  });
  const missing = c.segs.filter(s => s.course < 0).map(s => s.stage);
  const noDates = c.segs.filter(s => !s.dates.length).map(s => s.stage);
  const extra = c.segs.filter(s => s.course >= 0 && s.dates.length > catalog.courses[s.course].sessions.length).map(s => catalog.courses[s.course].name);
  return { rows, cells, multi, multiMonth: months.length > 1, year: rows.length ? rows[0].date[0] : catalog.year, ml,
    title: fulls.map(f => f.replace(/세계사통사/g, "세계사 통사").replace(/([가-힣])(\d)/g, "$1 $2")).join(" · ") + " 숙제", legend: multi ? hs.map((s, i) => ({ name: catalog.courses[s.course]?.name || s.stage, color: SEG_COLORS[i % 2] })) : [],
    names: c.names, time: c.time, missing, noDates, extra };
}

function titlePt(title) { const n = title.length; return n <= 14 ? 18 : n <= 18 ? 16 : n <= 24 ? 14 : 12; }

const state = { roster: null, hw: null, hwText: {}, hwUnknown: [], classes: [], example: true, hwIsExample: false };

/* ---------- 숙제 바로 적기: 과정·차시마다 적은 글을 이 기기에 기억해요 ---------- */
const HW_MEM = "hw_mem_v1";
const hwMem = (() => { try { return JSON.parse(localStorage.getItem(HW_MEM) || "{}"); } catch (e) { return {}; } })();
const memKey = ci => { const c = CATALOG.courses[ci]; return CATALOG.year + "-" + (c.month || CATALOG.month) + "|" + c.full; };
function saveMem(ci) { hwMem[memKey(ci)] = state.hwText[ci] || {}; try { localStorage.setItem(HW_MEM, JSON.stringify(hwMem)); } catch (e) {} }
function recomputeHw(ci) {
  const t = state.hwText[ci] || {}, m = {};
  Object.keys(t).forEach(no => { const it = parseHomework(t[no]); if (it.length) m[no] = it; });
  state.hw = state.hw || {};
  if (Object.keys(m).length) state.hw[ci] = m; else delete state.hw[ci];
}
const rosterCourses = () => [...new Set(state.classes.flatMap(c => c.segs.map(s => s.course)).filter(ci => ci >= 0))];
const QUICK = ["필독서 끝까지 읽어 오기", "필독서 읽고 독서퀴즈 풀기", "교재 ~쪽 풀어오기", "어휘충전 풀어오기", "토론개요표 써오기", "책은 천천히 읽으세요."];
/* 자주 쓰는 숙제 버튼은 과정마다 위쪽에 붙여서, 아래 과정을 적을 때도 멀리 올라가지 않게 해요 */
const QUICK_HTML = '<div class="quick"><span class="hint">자주 쓰는 숙제 (누르면 이 과정에서 지금 적는 칸에 들어가요)</span><div class="chips">' +
  QUICK.map((q, i) => '<button type="button" data-q="' + i + '">' + esc(q) + "</button>").join("") + "</div></div>";
function hwEditorHTML() {
  const cis = rosterCourses();
  if (!cis.length) return "";
  return cis.map(ci => {
    const c = CATALOG.courses[ci], t = state.hwText[ci] || {};
    const n = c.sessions.length, filled = c.sessions.filter((_, i) => String(t[i + 1] || "").trim()).length;
    return '<details class="hwc" open><summary><b>' + esc(c.full + monthTag(c, CATALOG)) + '</b><span class="pill' + (filled ? " hw" : " nohw") + '" id="hwn-' + ci + '">' + n + "차시 중 " + filled + "개 적음</span></summary>" + QUICK_HTML +
      c.sessions.map((s, i) => '<div class="hwr"><label class="hwl" for="hwt-' + ci + "-" + (i + 1) + '"><b>' + (i + 1) + "차시</b><small>" + esc(s.book || "") + "</small></label>" +
        '<textarea id="hwt-' + ci + "-" + (i + 1) + '" data-ci="' + ci + '" data-no="' + (i + 1) + '" rows="2" placeholder="1. 필독서 읽고 독서퀴즈 풀기">' + esc(t[i + 1] || "") + "</textarea></div>").join("") + "</details>";
  }).join("");
}
function renderHwEditor() {
  const box = document.getElementById("hwEdit");
  box.innerHTML = state.example ? "" : hwEditorHTML();
  document.getElementById("blankBar").hidden = !box.innerHTML;
  document.getElementById("hwHint").textContent = state.example ? "반 명단을 올리면 우리 반들이 듣는 과정만 차시별로 나와요. 여기에 적은 숙제는 이 기기에 남아서 다음에 열어도 그대로예요."
    : box.innerHTML ? "숙제 엑셀이 없어도 여기에 바로 적으면 돼요. 같은 과정을 듣는 반에는 모두 들어가요. 숙제가 없는 과정은 비워 두세요." : "과정을 찾은 반이 없어요. 3단계에서 과정을 골라 주세요.";
}
let lastHwTa = null;
/* 적은 숙제가 생기면 그 과정을 듣는 반을 자동으로 체크해요 (직접 끈 반은 그대로) */
function syncInclude() {
  state.classes.forEach((c, i) => {
    const has = c.segs.some(s => s.course >= 0 && state.hw && state.hw[s.course]);
    if (has && !c.include && !c.userOff) { c.include = true; c._dirty = true; }
    if (!has && c.include) { c.include = false; c._dirty = true; }
  });
}

/* ---------- 미리보기 (저장되는 PDF·사진과 같은 화면) ---------- */
function halfHTML(v, k, ed) {
  const A = key => ed ? ' data-key="' + key + '"' : "";
  const cal = '<table class="cal"><tr>' + [...WD].map((w, i) => '<th class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + w + "</th>").join("") + "</tr>" +
    Array.from({ length: v.cells.length / 7 }, (_, w) => "<tr>" + v.cells.slice(w * 7, w * 7 + 7).map((c, i) => {
      if (!c) return "<td></td>";
      const wc = i === 0 ? "sun" : i === 6 ? "sat" : "";
      return c.r ? '<td class="on" style="background:' + SEG_COLORS[c.r.seg % 2] + '">' + esc(c.lab) + "<small>" + c.r.no + "차시</small></td>" : '<td class="' + wc + '">' + esc(c.lab) + "</td>";
    }).join("") + "</tr>").join("") + "</table>";
  const legend = v.multi ? '<p class="lg">' + v.legend.map(l => '<span><i style="color:' + l.color + '">■</i>' + esc(l.name) + "</span>").join("") + "</p>" : "";
  const hw = '<table class="hw"><colgroup><col style="width:' + (v.multi ? 85 : 61) + 'px"><col></colgroup>' + v.rows.map((r, ri) => {
    const d = new Date(r.date[0], r.date[1] - 1, r.date[2]);
    const ds = r.date[1] + "/" + r.date[2] + "(" + WD[d.getDay()] + ")";
    const left = v.multi ? '<div class="cn">' + esc(r.short) + '</div><div><span class="no" style="font-size:calc(var(--k)*9pt)">' + r.no + '차시 </span><span class="dt" style="font-size:calc(var(--k)*7pt)">' + ds + "</span></div>"
      : '<div class="no">' + r.no + '차시</div><div class="dt">' + ds + "</div>";
    const has = r.hw.length;
    const right = '<div class="bk' + (has || ed ? "" : " solo") + '"><span' + A("book-" + ri) + ">" + esc(r.book) + "</span>" + (r.tag || ed ? "<em" + A("tag-" + ri) + ">" + esc(r.tag || (ed ? "소주제" : "")) + "</em>" : "") + "</div>" +
      (has || ed ? "<div" + A("hw-" + ri) + ">" + (has ? r.hw.map((h, i) => '<div class="it"><b>' + "①②③④⑤⑥⑦⑧⑨⑩"[i] + "</b>" + esc(h.t) + "</div>" + h.notes.map(n => '<div class="nt">' + esc(/^\(.*\)$/.test(n) ? n : "※ " + n) + "</div>").join("")).join("") : '<div class="nt">+ 숙제 넣기</div>') + "</div>" : "");
    return '<tr><td class="l" style="background:' + SEG_COLORS[r.seg % 2] + '">' + left + "</td><td>" + right + "</td></tr>";
  }).join("") + "</table>";
  return '<div class="half" style="--k:' + k + '">' +
    '<p class="c yr"><span' + A("yr") + ">" + esc(v.yrText) + "</span></p>" +
    '<p class="c tt" style="font-size:calc(var(--k)*' + titlePt(v.title) + 'pt)"><span' + A("title") + ">" + esc(v.title) + "</span></p>" +
    '<p class="c tm">수업시간 <b' + A("time") + ">" + esc(v.time || "") + "</b></p>" +
    cal + legend + '<p class="sec' + (v.multi ? " tight" : "") + '">차시별 필독서와 숙제</p>' + hw + "</div>";
}
function pageHTML(v, k, ed) {
  const h = halfHTML(v, k, ed);
  return '<div class="a4"><div class="col">' + h + '</div><div class="gap"><i></i></div><div class="col">' + h + "</div></div>";
}

/* 화면에서 고친 글자(제목·수업시간·책·숙제)를 덮어써요 */
function viewOf(c) {
  const v = classView(c, CATALOG, state.hw || {}), ov = c.ov || {};
  v.yrText = ov.yr ?? (v.year + "년 " + v.ml);
  if (ov.title != null) v.title = ov.title;
  if (ov.time != null) v.time = ov.time;
  v.rows.forEach((r, i) => {
    if (ov["book-" + i] != null) r.book = ov["book-" + i];
    if (ov["tag-" + i] != null) r.tag = ov["tag-" + i];
    if (ov["hw-" + i] != null) r.hw = parseHomework(ov["hw-" + i]);
  });
  return v;
}
function fieldText(v, key) {
  const [kind, n] = key.split("-"), r = v.rows[+n];
  if (kind === "yr") return v.yrText;
  if (kind === "title") return v.title;
  if (kind === "time") return v.time || "";
  if (kind === "book") return r.book;
  if (kind === "tag") return r.tag || "";
  if (kind === "hw") return r.hw.map((h, j) => (j + 1) + ". " + h.t + h.notes.map(x => "\n" + x).join("")).join("\n");
  return "";
}
function fieldLabel(v, key) {
  const [kind, n] = key.split("-"), r = v.rows[+n];
  const pre = r ? (v.multi ? r.short + " " : "") + r.no + "차시 " : "";
  return { yr: "위쪽 날짜", title: "제목", time: "수업시간", book: pre + "필독서", tag: pre + "소주제", hw: pre + "숙제" }[kind] || "글자";
}

const LIMIT_PX = 710; /* 반쪽에 쓸 수 있는 높이 190mm(718px) 안에 들어가게 해요 */
const K_STEPS = [1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];
function fitScale(v) {
  const box = document.getElementById("measure");
  for (const k of K_STEPS) {
    box.innerHTML = halfHTML(v, k);
    if (box.firstElementChild.getBoundingClientRect().height <= LIMIT_PX) return k;
  }
  return K_STEPS[K_STEPS.length - 1];
}

/* ---------- PDF·사진 만들기: 미리보기 화면을 그대로 그림으로 떠요 ---------- */
const PX_SCALE = 2.6; /* A4 가로 한 쪽 = 약 2920×2064 픽셀(약 250dpi) */
async function renderPage(v, k) {
  await loadFonts();
  const stage = document.getElementById("stage");
  stage.innerHTML = pageHTML(v, k);
  const canvas = await html2canvas(stage.firstElementChild, { scale: PX_SCALE, backgroundColor: "#ffffff", logging: false, width: 1123, height: 794, windowWidth: 1123 });
  stage.innerHTML = "";
  return canvas;
}
const pagesOf = c => Math.ceil(c.copies / 2);
function monthLabel(on) {
  const mons = [...new Set(on.flatMap(c => c.segs.flatMap(s => s.dates.map(d => d[1]))))];
  return (mons.includes(CATALOG.month) ? CATALOG.month : (mons[0] || CATALOG.month)) + "월";
}
async function buildPdf(on, progress) {
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  let first = true;
  for (let i = 0; i < on.length; i++) {
    progress(i + 1, on.length);
    const c = on[i], canvas = await renderPage(viewOf(c), c.k);
    const img = canvas.toDataURL("image/jpeg", 0.92);
    for (let p = 0; p < pagesOf(c); p++) {
      if (!first) pdf.addPage("a4", "landscape");
      pdf.addImage(img, "JPEG", 0, 0, 297, 210, "cls" + i, "FAST");
      first = false;
    }
  }
  return pdf.output("blob");
}
async function buildPngs(on, progress) {
  const out = [], label = monthLabel(on), used = new Set();
  for (let i = 0; i < on.length; i++) {
    progress(i + 1, on.length);
    const c = on[i], canvas = await renderPage(viewOf(c), c.k);
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const v = viewOf(c), day = (c.time.match(/[월화수목금토일]요일/) || [""])[0];
    let name = [label, "숙제안내", v.title.replace(/ 숙제$/, "").replace(/ · /g, "+"), day].filter(Boolean).join("_") + "_" + pagesOf(c) + "장인쇄", n = name, k = 2;
    while (used.has(n)) n = name + "(" + (k++) + ")";
    used.add(n); out.push({ name: n + ".png", blob });
  }
  return out;
}

const looksLikeHomework = rows => rows.slice(0, 5).some(r => r.some(c => norm(c) === "숙제") && r.some(c => norm(c) === "차시"));

/* ---------- 화면 ---------- */
let fontsReady = null;
function loadFonts() {
  if (!fontsReady) fontsReady = Promise.all(["400", "700"].map(w => document.fonts.load(w + ' 12px "Noto Sans KR"', "가나다")).concat(document.fonts.ready)).catch(() => {});
  return fontsReady;
}

function courseOptions(sel) {
  return '<option value="-1"' + (sel < 0 ? " selected" : "") + ">과정을 골라 주세요</option>" +
    courseGroups(CATALOG).map(([kind, lab]) => '<optgroup label="' + lab + '">' +
      CATALOG.courses.map((c, i) => kind(c) ? '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + esc(c.name) + (c.full !== c.name ? " (" + esc(c.full) + ")" : "") + "</option>" : "").join("") + "</optgroup>").join("");
}

function cardHTML(c, idx) {
  const v = viewOf(c);
  c.k = fitScale(v);
  const hasHw = c.segs.some(s => s.course >= 0 && state.hw && state.hw[s.course]);
  const warns = [], notes = [];
  if (v.missing.length) warns.push("'" + v.missing.join("', '") + "' 단계와 맞는 과정을 찾지 못했어요. 아래에서 과정을 골라 주세요.");
  if (v.noDates.length) warns.push("'" + v.noDates.join("', '") + "' 줄의 수업일을 읽지 못했어요. '11월 4일, 11일'처럼 적어 주세요.");
  if (v.extra.length) warns.push(v.extra.join(", ") + " 수업일이 계획안 차시보다 많아요. 넘치는 날은 '책 정보 없음'으로 나와요.");
  c.segs.filter(s => s.guessed).forEach(s => notes.push("반 명단의 '" + s.stage + "'을(를) 숙제 엑셀에 있는 " + CATALOG.courses[s.course].full + "(으)로 맞췄어요."));
  const dropped = c.segs.filter(s => s.course >= 0 && !(state.hw && state.hw[s.course])).map(s => CATALOG.courses[s.course].full);
  if (hasHw && dropped.length) notes.push(dropped.join(", ") + "은(는) 숙제가 없어서 안내문에서 뺐어요.");
  if (c.k < 0.8) notes.push("내용이 많아서 글자를 조금 작게 넣었어요.");
  if (c.countGuess) warns.push("팀 이름으로 적혀 있어서 학생 수를 알 수 없어요. 오른쪽 '학생 수'를 바꿔 주세요. (엑셀에 '인원' 칸을 만들어 적으면 자동으로 맞춰요.)");
  const segs = c.segs.map((s, si) => '<div class="seg"><div class="dates"><b>' + esc(s.stage || "단계 없음") + "</b><br>" + (s.dates.map(d => d[1] + "/" + d[2]).join(", ") || "수업일 없음") + "</div>" +
    '<label for="crs-' + idx + "-" + si + '">과정<select id="crs-' + idx + "-" + si + '" data-i="' + idx + '" data-s="' + si + '">' + courseOptions(s.course) + "</select></label>" +
    '<label class="ordl" for="ord-' + idx + "-" + si + '">차시 순서 <small>(바꿔서 수업할 때만)</small><input type="text" inputmode="numeric" id="ord-' + idx + "-" + si + '" data-o="' + idx + '" data-s="' + si + '" value="' + esc(s.order || "") + '" placeholder="' + (s.dates.map((_, k) => k + 1).join(",") || "1,2,3,4") + '"></label></div>').join("");
  const pages = Math.ceil(c.copies / 2);
  if (!hasHw && !state.example) {
    c.include = false;
    const nm = c.segs.map(s => CATALOG.courses[s.course]?.full || s.stage).join(", ");
    return '<article class="cls off" id="cls-' + idx + '"><div class="cls-head"><strong>' + esc(c.names.join(", ") || "이름 없음") + "</strong></div>" +
      '<div class="meta"><span class="pill">' + esc(nm) + '</span><span class="pill nohw">숙제 없음 · 2단계에서 숙제를 적으면 안내문이 만들어져요</span></div>' +
      (v.missing.length ? '<div class="warn">' + esc(v.missing.join(", ")) + " 단계를 찾지 못했어요. 숙제가 있는 과정이면 아래에서 골라 주세요.</div>" + '<div class="segs">' + segs + "</div>" : "") + "</article>";
  }
  return '<article class="cls' + (c.include ? "" : " off") + '" id="cls-' + idx + '">' +
    '<div class="cls-head"><label class="inc" for="inc-' + idx + '"><input type="checkbox" id="inc-' + idx + '" data-inc="' + idx + '"' + (c.include ? " checked" : "") + ">" + esc(c.names.join(", ") || "이름 없음") + "</label>" +
    '<label class="copies" for="cp-' + idx + '">학생 수<input type="number" min="1" max="40" id="cp-' + idx + '" data-cp="' + idx + '" value="' + c.copies + '"></label></div>' +
    '<div class="meta"><span class="pill">' + esc(v.title.replace(/ 숙제$/, "")) + "</span>" + '<span class="pill hw">숙제 있음</span>' +
    '<span class="pill print">인쇄 A4 ' + pages + "장" + (c.copies % 2 ? " (남는 반쪽은 예비용)" : "") + "</span></div>" +
    warns.map(w => '<div class="warn">' + esc(w) + "</div>").join("") + notes.map(n => '<div class="note">' + esc(n) + "</div>").join("") +
    '<div class="segs">' + segs + "</div>" +
    '<p class="hint">미리보기에서 점선 글자(제목·수업시간·필독서·소주제·숙제)를 누르면 바로 고칠 수 있어요.</p>' +
    '<div class="editor" id="ed-' + idx + '" hidden><label for="edt-' + idx + '" id="edl-' + idx + '">고치는 중</label>' +
    '<textarea id="edt-' + idx + '" data-edit="' + idx + '" rows="3"></textarea><p class="hint" id="edh-' + idx + '" hidden>번호(1. 2. …)로 시작하는 줄이 숙제 한 개, 번호 없는 줄은 위 숙제 밑에 작은 글씨로 들어가요.</p>' +
    '<div class="btns"><button type="button" data-done="' + idx + '">다 고쳤어요</button><button type="button" class="ghost" data-reset="' + idx + '">원래대로</button></div></div>' +
    '<div class="pv" id="pv-' + idx + '"><div class="scaler">' + pageHTML(v, c.k, true) + "</div></div></article>";
}

function fit(idx) {
  const pv = document.getElementById("pv-" + idx); if (!pv) return;
  const s = pv.clientWidth / 1123;
  pv.firstElementChild.style.transform = "scale(" + s + ")";
  pv.style.height = Math.ceil(794 * s) + "px";
}
function fitAll() { state.classes.forEach((_, i) => fit(i)); }
window.addEventListener("resize", fitAll);

function updateSummary() {
  const on = state.classes.filter(c => c.include);
  const pages = on.reduce((a, c) => a + Math.ceil(c.copies / 2), 0);
  document.getElementById("sumText").textContent = state.example ? "예시를 보고 있어요. 엑셀 두 개를 올리면 반마다 나와요."
    : on.length ? on.length + "개 반 · 인쇄 A4 " + pages + "장" : "저장할 반을 체크해 주세요";
  document.querySelectorAll("#savePdf,#savePng,#saveXlsx").forEach(b => b.disabled = state.example || !on.length);
}

function renderAll() {
  document.getElementById("list").innerHTML = state.classes.map(cardHTML).join("");
  fitAll(); updateSummary();
}

function rebuild() {
  if (!state.roster) return;
  try {
    const groups = groupRows(state.roster);
    if (!groups.length) throw new Error("수업 정보가 있는 줄을 찾지 못했어요.");
    state.example = false;
    state.classes = groups.map(g => buildClass(g, CATALOG, state.hw || {}));
    loadMemFor(rosterCourses()); syncInclude();
    const nHw = state.classes.filter(c => c.include).length, nNo = state.classes.length - nHw;
    let msg = state.classes.length + "개 반을 찾았어요.";
    if (!nHw) msg += " 2단계에서 숙제를 적거나 숙제 엑셀을 올려 주세요.";
    else msg += " 숙제가 있는 " + nHw + "개 반을 미리 체크해 두었어요." + (nNo ? " 숙제가 없는 " + nNo + "개 반은 숙제를 적으면 안내문이 만들어져요." : "");
    if (state.hwUnknown.length) msg += " 숙제 엑셀의 '" + state.hwUnknown.join("', '") + "' 단계는 이번 달 계획안에서 찾지 못했어요.";
    document.getElementById("status").textContent = msg;
    document.getElementById("resHint").textContent = "체크한 반만 저장돼요. 학생 수는 반 명단으로 맞춰 두었어요. A4 한 장에 안내문이 두 개 들어가서, 학생 2명당 A4 1장만 인쇄돼요(3명이면 2장).";
    renderHwEditor();
    loadFonts().then(renderAll);
  } catch (e) {
    document.getElementById("status").textContent = "반 명단 엑셀을 읽지 못했어요. " + (e.message || "") + " 양식을 확인하고 다시 올려 주세요.";
  }
}

async function handleFile(f, slot) {
  if (!f) return;
  if (state.hwIsExample) { state.hw = null; state.hwText = {}; state.hwIsExample = false; }
  const st = document.getElementById("status");
  st.textContent = "엑셀을 읽는 중이에요…";
  try {
    const rows = readSheetRows(await f.arrayBuffer());
    const isHw = looksLikeHomework(rows);
    if (isHw) {
      const r = readHomework(rows, CATALOG); state.hwUnknown = r.unknown; showGot("gotHw", f.name);
      Object.keys(r.raw).forEach(ci => { state.hwText[ci] = r.raw[ci]; recomputeHw(+ci); saveMem(+ci); });
    }
    else { state.roster = rows; showGot("gotRoster", f.name); }
    if (state.roster) rebuild(); else st.textContent = "숙제 엑셀을 읽었어요. 반 명단 엑셀도 올려 주세요.";
  } catch (e) {
    st.textContent = "엑셀을 읽지 못했어요. " + (e.message || "") + " 양식을 확인하고 다시 올려 주세요.";
  }
}
function showGot(id, name) { const el = document.getElementById(id); el.textContent = name; el.hidden = false; }
[["Roster", "roster"], ["Hw", "hw"]].forEach(([n, slot]) => {
  const input = document.getElementById("file" + n), drop = document.getElementById("drop" + n);
  input.addEventListener("change", () => { handleFile(input.files[0], slot); input.value = ""; });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", e => { e.preventDefault(); [...e.dataTransfer.files].forEach(f => handleFile(f, slot)); });
});

const list = document.getElementById("list");
list.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.inc !== undefined) { const c = state.classes[+t.dataset.inc]; c.include = t.checked; c.userOff = !t.checked; document.getElementById("cls-" + t.dataset.inc).classList.toggle("off", !t.checked); updateSummary(); return; }
  if (t.dataset.cp !== undefined) { const i = +t.dataset.cp; state.classes[i].copies = Math.max(1, Math.min(40, parseInt(t.value, 10) || 1)); state.classes[i].countGuess = false; redrawCard(i); return; }
  if (t.dataset.o !== undefined) { const i = +t.dataset.o, sg = state.classes[i].segs[+t.dataset.s], v = t.value.trim();
    if (!sg || sg.order === v) return; sg.order = v; state.classes[i].ov = {}; setTimeout(() => redrawCard(i), 0); return; }
  if (t.tagName === "SELECT") { const i = +t.dataset.i, s = state.classes[i].segs[+t.dataset.s]; s.course = +t.value; s.guessed = false; state.classes[i].ov = {};
    loadMemFor([s.course]); syncInclude(); redrawCard(i); renderHwEditor(); }
});
function loadMemFor(cis) {
  cis.forEach(ci => { if (ci < 0 || state.hwText[ci]) return; const m = hwMem[memKey(ci)]; if (m) { state.hwText[ci] = { ...m }; recomputeHw(ci); } });
}
/* 2단계에서 숙제를 적으면 그 과정을 듣는 반의 미리보기가 바로 바뀌어요 */
let hwT = 0;
const hwEdit = document.getElementById("hwEdit");
hwEdit.addEventListener("focusin", e => { if (e.target.dataset.ci !== undefined) lastHwTa = e.target; });
hwEdit.addEventListener("input", e => {
  const t = e.target; if (t.dataset.ci === undefined) return;
  const ci = +t.dataset.ci, c = CATALOG.courses[ci];
  (state.hwText[ci] = state.hwText[ci] || {})[+t.dataset.no] = t.value;
  recomputeHw(ci); saveMem(ci);
  const filled = c.sessions.filter((_, i) => String(state.hwText[ci][i + 1] || "").trim()).length, pill = document.getElementById("hwn-" + ci);
  pill.textContent = c.sessions.length + "차시 중 " + filled + "개 적음"; pill.className = "pill" + (filled ? " hw" : " nohw");
  clearTimeout(hwT);
  hwT = setTimeout(() => {
    syncInclude();
    state.classes.forEach((cl, i) => { if (cl._dirty || cl.segs.some(s => s.course === ci)) { cl._dirty = false; redrawCard(i); } });
  }, 350);
});
/* 숙제 시트(1단계 '숙제 엑셀'에 그대로 다시 올릴 수 있는 모양): 단계·차시는 채워 두고, 적은 숙제도 같이 넣어요 */
function homeworkSheet(cis) {
  /* 필독서는 넣지 않아요(계획안에서 자동으로 들어가요) */
  const aoa = [["No", "단계", "차시", "숙제"]];
  cis.forEach((ci, k) => {
    const c = CATALOG.courses[ci], t = state.hwText[ci] || {};
    c.sessions.forEach((s, i) => aoa.push([i ? "" : k + 1, i ? "" : c.name + monthTag(c, CATALOG), (i + 1) + "차시", t[i + 1] || ""]));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 7 }, { wch: 60 }];
  return ws;
}
const xlsxBlob = wb => new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
async function saveFile(filename, data) {
  if (downloads) await downloads.save({ filename, data });
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
}
/* 우리 반 과정만 들어간 숙제 엑셀 양식 */
function blankHomeworkBook() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, homeworkSheet(rosterCourses()), "숙제");
  return xlsxBlob(wb);
}
/* 4단계 엑셀 저장: ① 숙제(다음 달·다른 기기에서 '숙제 엑셀'로 다시 올리는 시트) ② 반별 숙제(날짜순 목록) ③ 쓰는 방법 */
function savedHomeworkBook(on) {
  const cis = [...new Set([...rosterCourses(), ...Object.keys(state.hwText).map(Number)])]
    .filter(ci => CATALOG.courses[ci] && Object.values(state.hwText[ci] || {}).some(x => String(x || "").trim()));
  const rows = [["반", "수업시간", "학생 수", "과정", "차시", "날짜", "요일", "소주제", "숙제"]];
  on.forEach(c => {
    const v = viewOf(c), name = c.names.join(", ");
    v.rows.forEach(r => {
      const d = new Date(r.date[0], r.date[1] - 1, r.date[2]);
      rows.push([name, v.time || "", c.copies, r.short, r.no + "차시", r.date[0] + "-" + String(r.date[1]).padStart(2, "0") + "-" + String(r.date[2]).padStart(2, "0"), WD[d.getDay()],
        r.tag || "", r.hw.map((h, i) => "①②③④⑤⑥⑦⑧⑨⑩"[i] + " " + h.t + h.notes.map(n => " (※ " + n + ")").join("")).join("  ")]);
    });
  });
  const byClass = XLSX.utils.aoa_to_sheet(rows);
  byClass["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 6 }, { wch: 14 }, { wch: 7 }, { wch: 11 }, { wch: 5 }, { wch: 16 }, { wch: 70 }];
  byClass["!autofilter"] = { ref: byClass["!ref"] };
  const help = XLSX.utils.aoa_to_sheet([
    ["숙제 엑셀 쓰는 방법"], [""],
    [CATALOG.year + "년 " + courseMonths(CATALOG).join("·") + "월 계획안 기준으로 저장했어요."], [""],
    ["'숙제' 시트"], ["· 숙제 안내문 1단계 '숙제 엑셀' 칸에 이 파일을 그대로 올리면 적어 둔 숙제가 다시 들어와요."],
    ["· 다른 기기에서 쓰거나, 다음 달 같은 과정 숙제를 고쳐 쓸 때 숙제 칸만 바꿔서 올리세요."],
    ["· 숙제 칸에서 1. 2. 처럼 번호로 시작하는 줄이 숙제 한 개, 번호 없는 줄은 바로 위 숙제의 덧붙임 글이에요."],
    ["· 첫 줄 제목(No·단계·차시·숙제)과 시트 순서는 바꾸지 마세요. 필독서는 계획안에서 자동으로 들어가요."], [""],
    ["'반별 숙제' 시트"], ["· 저장할 때 체크한 반의 수업일마다 숙제를 한 줄씩 적었어요. 화면에서 고친 글자도 들어가 있어요."],
    ["· 제목 줄의 ▼ 단추로 반·과정·날짜별로 골라 보거나, 출석부·학부모 안내에 복사해 쓰세요."],
  ]);
  help["!cols"] = [{ wch: 90 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, homeworkSheet(cis), "숙제");
  XLSX.utils.book_append_sheet(wb, byClass, "반별 숙제");
  XLSX.utils.book_append_sheet(wb, help, "쓰는 방법");
  return xlsxBlob(wb);
}
document.getElementById("blankXlsx").addEventListener("click", async e => {
  const btn = e.currentTarget, st = document.getElementById("status");
  if (!rosterCourses().length) return;
  btn.disabled = true;
  try {
    await saveFile(CATALOG.month + "월_숙제_양식.xlsx", blankHomeworkBook());
    st.textContent = "숙제 엑셀 양식을 받았어요. 숙제 칸만 채워서 위 '숙제 엑셀'에 올리면 돼요.";
  } catch (err) {
    if (!(err && err.code === "declined")) st.textContent = "양식을 받지 못했어요. 아래 2단계에 바로 적어도 돼요.";
  }
  btn.disabled = false;
});
hwEdit.addEventListener("click", e => {
  const b = e.target.closest("[data-q]"); if (!b) return;
  const box = b.closest(".hwc");
  const ta = lastHwTa && box.contains(lastHwTa) ? lastHwTa : box.querySelector("textarea"); if (!ta) return;
  const q = QUICK[+b.dataset.q], note = /요\.$/.test(q);
  const n = ta.value.split("\n").filter(l => /^\s*(\d+\s*[.)]|[①-⑳])/.test(l)).length;
  const add = note ? q : (n + 1) + ". " + q;
  ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, "") + "\n" : "") + add;
  ta.focus();
  const tilde = add.indexOf("~");
  const pos = tilde >= 0 ? ta.value.length - add.length + tilde : ta.value.length;
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
});
function refreshPreview(i) {
  const c = state.classes[i], pv = document.getElementById("pv-" + i); if (!pv) return;
  const v = viewOf(c); c.k = fitScale(v);
  pv.firstElementChild.innerHTML = pageHTML(v, c.k, true);
  if (c._ed) pv.querySelectorAll('[data-key="' + c._ed + '"]').forEach(x => x.classList.add("editing"));
  fit(i);
}
function openEditor(i, key) {
  const c = state.classes[i], v = viewOf(c);
  c._ed = key;
  document.querySelectorAll("#pv-" + i + " .editing").forEach(x => x.classList.remove("editing"));
  document.querySelectorAll("#pv-" + i + ' [data-key="' + key + '"]').forEach(x => x.classList.add("editing"));
  const box = document.getElementById("ed-" + i), ta = document.getElementById("edt-" + i);
  document.getElementById("edl-" + i).textContent = "고치는 중: " + fieldLabel(v, key);
  document.getElementById("edh-" + i).hidden = !key.startsWith("hw");
  ta.rows = key.startsWith("hw") ? 6 : 2;
  ta.value = fieldText(v, key);
  box.hidden = false; ta.focus();
}
function closeEditor(i) {
  const c = state.classes[i]; if (!c) return;
  c._ed = null;
  document.querySelectorAll("#pv-" + i + " .editing").forEach(x => x.classList.remove("editing"));
  const box = document.getElementById("ed-" + i); if (box) box.hidden = true;
}
list.addEventListener("click", e => {
  const el = e.target.closest(".pv [data-key]");
  if (el) { openEditor(+el.closest(".pv").id.slice(3), el.dataset.key); return; }
  const done = e.target.closest("[data-done]");
  if (done) { closeEditor(+done.dataset.done); return; }
  const rs = e.target.closest("[data-reset]");
  if (rs) { const i = +rs.dataset.reset, c = state.classes[i]; if (c.ov && c._ed) delete c.ov[c._ed]; refreshPreview(i); document.getElementById("edt-" + i).value = fieldText(viewOf(c), c._ed); }
});
list.addEventListener("input", e => {
  const t = e.target; if (t.dataset.edit === undefined) return;
  const i = +t.dataset.edit, c = state.classes[i]; if (!c._ed) return;
  (c.ov = c.ov || {})[c._ed] = t.value;
  refreshPreview(i);
});
function redrawCard(i) { document.getElementById("cls-" + i).outerHTML = cardHTML(state.classes[i], i); fit(i); updateSummary(); }

let downloads = null;
(async () => { try { downloads = await window.claude?.use?.("downloads"); } catch (e) { downloads = null; } })();
async function saveAs(kind, btn) {
  const st = document.getElementById("saveStatus");
  const on = state.classes.filter(c => c.include);
  if (!on.length) return;
  if (!window.html2canvas) { st.textContent = "저장 도구를 불러오지 못했어요. 페이지를 새로 고친 뒤 다시 눌러 주세요."; return; }
  document.querySelectorAll("#savePdf,#savePng").forEach(b => b.disabled = true);
  const progress = (i, n) => { st.textContent = (kind === "pdf" ? "PDF" : "사진") + "을 만드는 중이에요… (" + i + "/" + n + "반)"; };
  try {
    const label = monthLabel(on);
    if (!downloads || (kind === "pdf" && !window.jspdf) || (kind === "png" && on.length > 1 && !window.JSZip)) { await showPictures(on, progress, kind); updateSummary(); return; }
    if (kind === "pdf") {
      const blob = await buildPdf(on, progress);
      st.textContent = "저장 창을 열었어요.";
      await downloads.save({ filename: label + "_숙제안내.pdf", data: blob });
      st.textContent = "저장했어요. 인쇄할 때 용지 방향은 가로, 크기는 '실제 크기'로 해 주세요.";
    } else {
      const files = await buildPngs(on, progress);
      st.textContent = "저장 창을 열었어요.";
      if (files.length === 1) await downloads.save({ filename: files[0].name, data: files[0].blob });
      else {
        const zip = new JSZip(); files.forEach(f => zip.file(f.name, f.blob));
        await downloads.save({ filename: label + "_숙제안내_사진.zip", data: await zip.generateAsync({ type: "blob" }) });
      }
      st.textContent = files.length === 1 ? "저장했어요." : "저장했어요. 압축을 풀면 반마다 사진이 한 장씩 있어요.";
    }
  } catch (err) {
    if (err && err.code === "declined") st.textContent = "";
    else if (err && err.code === "rate_limited") st.textContent = "저장 창이 이미 열려 있어요. 잠시 후 다시 눌러 주세요.";
    else { try { await showPictures(on, progress, kind); } catch (e2) { st.textContent = "저장하지 못했어요. 페이지를 새로 고친 뒤 다시 눌러 주세요."; } }
  }
  updateSummary();
}
/* 파일 저장이 안 되는 화면(카톡 링크, 로그인 안 한 화면 등)에서는 사진으로 보여 주고 길게 눌러 저장하게 해요. */
async function showPictures(on, progress, kind) {
  const st = document.getElementById("saveStatus");
  const list = document.getElementById("viewerList");
  list.innerHTML = "";
  for (let i = 0; i < on.length; i++) {
    progress(i + 1, on.length);
    const c = on[i], v = viewOf(c), canvas = await renderPage(v, c.k);
    const fig = document.createElement("figure");
    const cap = document.createElement("figcaption");
    cap.textContent = v.title + " · " + pagesOf(c) + "장 인쇄";
    const img = document.createElement("img");
    img.alt = v.title + " 안내문 사진";
    img.src = canvas.toDataURL("image/jpeg", 0.92);
    fig.append(cap, img); list.append(fig);
  }
  document.getElementById("viewerMsg").innerHTML = (kind === "pdf" ? "이 화면에서는 PDF 파일로 저장할 수 없어서 사진으로 보여 드려요.<br>" : "") +
    "사진을 <b>길게 눌러</b> 저장하세요. 컴퓨터에서는 <b>오른쪽 클릭</b> → '이미지를 다른 이름으로 저장'.";
  const vw = document.getElementById("viewer");
  vw.hidden = false; document.body.style.overflow = "hidden";
  document.getElementById("viewerClose").focus();
  st.textContent = "사진으로 열었어요. 길게 눌러 저장하세요.";
}
function closeViewer() { document.getElementById("viewer").hidden = true; document.body.style.overflow = ""; document.getElementById("viewerList").innerHTML = ""; }
document.getElementById("viewerClose").addEventListener("click", closeViewer);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("viewer").hidden) closeViewer(); });
document.getElementById("savePdf").addEventListener("click", e => saveAs("pdf", e.currentTarget));
document.getElementById("savePng").addEventListener("click", e => saveAs("png", e.currentTarget));
document.getElementById("saveXlsx").addEventListener("click", async e => {
  const btn = e.currentTarget, st = document.getElementById("saveStatus");
  const on = state.classes.filter(c => c.include);
  if (!on.length) return;
  btn.disabled = true;
  try {
    st.textContent = "저장 창을 열었어요.";
    await saveFile(monthLabel(on) + "_숙제.xlsx", savedHomeworkBook(on));
    st.textContent = "엑셀로 저장했어요. 다음에 1단계 '숙제 엑셀'에 이 파일을 올리면 적은 숙제가 그대로 들어와요.";
  } catch (err) {
    if (err && err.code === "declined") st.textContent = "";
    else if (err && err.code === "rate_limited") st.textContent = "저장 창이 이미 열려 있어요. 잠시 후 다시 눌러 주세요.";
    else st.textContent = "엑셀을 저장하지 못했어요. 페이지를 새로 고친 뒤 다시 눌러 주세요.";
  }
  updateSummary();
});

document.getElementById("chip").textContent = CATALOG.year + "년 " + courseMonths(CATALOG).join("·") + "월 계획안 기준";

/* 예시: 세계사 통사 2호 반 */
(function example() {
  const ci = CATALOG.courses.findIndex(c => c.name === "세계사 2호");
  if (ci < 0) { updateSummary(); return; }
  state.hw = {}; state.hw[ci] = {
    1: parseHomework("①한눈에 쏙 세계사 4권 다 읽기\n②독서퀴즈 1풀기\n③교재 2~9쪽 읽고 빈칸 채워오기."),
    2: parseHomework("①한눈에 쏙 세계사 5권 다 읽기\n②독서퀴즈 2풀기\n③교재 12~19쪽 읽고 빈칸 채워오기."),
    3: parseHomework("①한눈에 쏙 세계사 6권 처음~80쪽 읽기\n②독서퀴즈 3풀기\n③교재 22~29쪽 읽고 빈칸 채워오기."),
    4: parseHomework("①한눈에 쏙 세계사 6권 81쪽~끝 읽기\n②독서퀴즈 4풀기\n③교재 32~39쪽 읽고 빈칸 채워오기.") };
  const y = CATALOG.year, m = CATALOG.month, dates = [];
  for (let d = 1; d <= new Date(y, m, 0).getDate() && dates.length < 4; d++) if (new Date(y, m - 1, d).getDay() === 2) dates.push([y, m, d]);
  state.classes = [{ names: ["예시 반"], time: "화요일 7:20~8:40", segs: [{ stage: "세계사 통사 2호", course: ci, guessed: false, dates }], include: true, copies: 2, k: 1 }];
  document.getElementById("resHint").textContent = "아래는 예시예요. 엑셀 두 개를 올리면 반마다 이렇게 A4 한 쪽 미리보기가 나와요.";
  state.hwIsExample = true;
  loadFonts().then(renderAll); renderAll();
})();

/* 점검용: 엑셀 대신 행 배열로 불러오기 */
window.__loadRows = (roster, hw) => { state.hwIsExample = false; const r = readHomework(hw, CATALOG); state.hw = r.map; state.hwUnknown = r.unknown; state.roster = roster; rebuild(); };
window.__state = state; window.__buildPdf = () => buildPdf(state.classes.filter(c => c.include), () => {}); window.__buildPngs = () => buildPngs(state.classes.filter(c => c.include), () => {});



/* ---------- 다른 탭과 반 명단 나누기 (첫 화면 index.html을 거쳐 주고받아요) ---------- */
(function () {
  const orig = handleFile;
  let fromShell = false;
  handleFile = async function (f, slot) {
    const before = state.roster;
    const r = await orig(f, slot);
    try {
      if (f && !fromShell && state.roster && state.roster !== before)
        tell({ type: "roster", buf: await f.arrayBuffer(), name: f.name });
    } catch (e) {}
    return r;
  };
  window.__receiveRoster = async function (buf, name) {
    fromShell = true;
    try { await handleFile(new File([buf], name), "roster"); } finally { fromShell = false; }
  };
  onParent("roster", m => window.__receiveRoster(m.buf, m.name));
  tell({ type: "hello" });
})();
