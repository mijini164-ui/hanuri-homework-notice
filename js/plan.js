/* 수업계획서 탭: 반 명단 엑셀 → 반마다 달력형 수업계획서 이미지(1200px)를 만들어요.
   흐름: 엑셀 올리기(handleFile) → 반 나누기(Suite.groupRows) → 반마다 화면(panelHTML) → 이미지(capture)
   과정·필독서 자료는 data/catalog.js, 엑셀 읽기는 js/shared.js 에 있어요. */
const { esc, norm, parseDates, matchCourse, courseFor, sessionOrder, courseMonths, courseGroups, readSheetRows, groupRows, tell, onParent } = Suite;
const CATALOG = window.CATALOG;
const COLORS = ["#1f2a4a", "#e07a3f", "#2f8f6b"];  /* 두세 과정을 번갈아 하는 반의 과정별 색 */
const WD = "일월화수목금토";

function defaultMsg(mLabel) {
  return "안녕하세요 한우리입니다.\n" + mLabel + " 수업계획서입니다.\n확인 부탁드립니다. 감사합니다^^";
}

function buildClass(g, catalog) {
  const segs = g.segs.map(s => { const dates = parseDates(s.dates, catalog.year, catalog.month);
    const r = courseFor(s.stage, s.ho, catalog, dates[0] && dates[0].m);
    return { stage: s.stage, ho: s.ho || "", order: s.order || "", want: r.want, datesText: s.dates, course: s.course ?? r.ci, dates }; });
  return { names: g.names, time: g.time, memo: g.memo || "", segs, title: null };
}

function classView(c, catalog) {
  const multi = c.segs.length > 1;
  const rows = [];
  c.segs.forEach((s, si) => {
    const course = catalog.courses[s.course];
    const cname = course ? course.name : (s.stage || "과정");
    const ord = sessionOrder(s.order, s.dates.length, course ? course.sessions.length : s.dates.length);   /* 차시를 바꿔서 수업할 때 */
    s.dates.slice().sort((a, b) => new Date(a.y, a.m - 1, a.d) - new Date(b.y, b.m - 1, b.d)).forEach((dt, i) => {
      const se = course && course.sessions[ord[i] - 1];
      rows.push({ ...dt, color: COLORS[si % COLORS.length], course: cname, no: ord[i] + "차시",
        label: course ? (course.label || "교과연계") : "교과연계",
        tag: se ? se.tag : "", book: se ? se.book : null, desc: se ? se.desc : "", link: se ? se.link : "" });
    });
  });
  rows.sort((a, b) => new Date(a.y, a.m - 1, a.d) - new Date(b.y, b.m - 1, b.d));
  rows.forEach(r => { r.wd = WD[new Date(r.y, r.m - 1, r.d).getDay()]; r.lab = multi ? r.course + " " + r.no : r.no; });
  const months = [...new Map(rows.map(r => [r.y * 100 + r.m, [r.y, r.m]])).values()];
  const mLabel = months.length ? (months.length === 1 ? months[0][1] + "월" : months[0][1] + "월~" + months[months.length - 1][1] + "월") : "";
  const year = months.length ? months[0][0] : catalog.year;
  const courseNames = c.segs.map(s => catalog.courses[s.course]?.name || s.stage);
  const title = c.title ?? (courseNames.join(", ") + " 수업계획서");
  const legend = multi ? c.segs.map((s, si) => ({ name: courseNames[si], color: COLORS[si % COLORS.length] })) : [];
  const missing = c.segs.filter(s => s.course < 0).map(s => s.stage);
  const extra = c.segs.filter(s => s.course >= 0 && s.dates.length > catalog.courses[s.course].sessions.length).map(s => catalog.courses[s.course].name);
  const noDates = c.segs.filter(s => !s.dates.length).map(s => s.stage);
  /* 수업월호에 적은 달의 계획안이 아직 없으면 알려요 */
  const noMonth = c.segs.filter(s => s.want && s.course >= 0 && catalog.courses[s.course].kind === "monthly" && (catalog.courses[s.course].month || catalog.month) !== s.want)
    .map(s => s.want + "월 " + catalog.courses[s.course].name + " → " + (catalog.courses[s.course].month || catalog.month) + "월");
  return { rows, months, mLabel, year, title, legend, missing, extra, noDates, noMonth,
    sub: year + "년 " + mLabel, time: c.time,
    msgText: c.memo || defaultMsg(mLabel),
    msg: (c.memo || defaultMsg(mLabel)).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])).replace(/\r?\n/g, "<br>"),
    file: (mLabel + "_수업계획서_" + (c.names.join("_") || courseNames.join("_"))).normalize("NFKC").replace(/[\\/:*?"<>|\s]+/g, "_") + ".png" };
}

function monthHTML(y, m, rows) {
  const marks = {}; rows.filter(r => r.y === y && r.m === m).forEach(r => marks[r.d] = r);
  const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
  let h = '<div class="mon">' + y + "년 " + m + '월</div><div class="grid">';
  h += [...WD].map((w, i) => '<div class="wd ' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + w + "</div>").join("");
  for (let i = 0; i < first; i++) h += '<div class="cell"></div>';
  for (let d = 1; d <= days; d++) {
    const wi = (first + d - 1) % 7, wc = wi === 0 ? "sun" : wi === 6 ? "sat" : "", r = marks[d];
    h += r ? '<div class="cell on ' + wc + '"><div class="num" style="background:' + r.color + '">' + d + '</div><div class="lab" style="color:' + r.color + '">' + esc(r.lab) + "</div></div>"
           : '<div class="cell ' + wc + '"><div class="num">' + d + "</div></div>";
  }
  return h + "</div>";
}

function sheetHTML(v) {
  const legend = v.legend.length ? '<div class="legend">' + v.legend.map(l => '<span><i style="background:' + l.color + '"></i>' + esc(l.name) + "</span>").join("") + "</div>" : "";
  const cals = v.months.map(([y, m]) => '<div class="box">' + monthHTML(y, m, v.rows) + legend + "</div>").join("");
  const cards = v.rows.map((r, i) => {
    const lnk = r.link ? '<div class="lnk"><b>' + esc(r.label) + '</b><span class="ed" data-ed="교과연계">' + esc(r.link) + "</span></div>" : "";
    const tag = r.tag ? '<b class="ed" data-ed="수업 주제">' + esc(r.tag) + "</b>" : "";
    const book = r.book ? '<div class="book ed" data-ed="필독서">' + esc(r.book) + "</div>" : '<div class="book none ed" data-ed="필독서">책 정보 없음</div>';
    return '<div class="card"><div class="badge" style="background:' + r.color + '">' + (i + 1) + '</div><div>' +
      '<div class="meta">' + r.m + "월 " + r.d + "일(" + r.wd + ") · " + esc(r.lab) + tag + "</div>" + book +
      (r.desc ? '<div class="desc ed" data-ed="한 줄 소개">' + esc(r.desc) + "</div>" : "") + lnk + "</div></div>";
  }).join("");
  const size = v.title.length <= 11 ? 84 : (v.title.length <= 16 ? 70 : 58);
  return '<div class="sheet"><div class="bar1"></div><div class="wrap"><div class="hello ed" data-ed="위쪽 날짜">' + esc(v.sub) + '</div><h1 class="ed" data-ed="제목" style="font-size:' + size + 'px">' + esc(v.title) + "</h1>" +
    '<div class="time"><span>수업시간</span><em class="ed" data-ed="수업시간">' + esc(v.time || " ") + "</em></div>" +
    cals + '<div class="sec">차시별 필독서</div>' + cards + '<div class="msg ed" data-ed="인사말">' + v.msg + "</div></div>" + '<div class="bar2"></div></div>';
}

let fontsReady = null;
function loadFonts() {
  if (!fontsReady) fontsReady = Promise.all(["400", "700", "900"].map(w => document.fonts.load(w + ' 30px "Noto Sans KR"', "가나다")).concat(document.fonts.ready)).catch(() => {});
  return fontsReady;
}

let queue = Promise.resolve();
function capture(idx) {
  queue = queue.then(async () => {
    await loadFonts();
    const stage = document.getElementById("stage");
    const src = document.querySelector("#live-" + idx + " .sheet");
    if (!src) throw new Error("no sheet");
    const el = src.cloneNode(true);
    el.querySelectorAll(".editing").forEach(x => x.classList.remove("editing"));
    stage.innerHTML = ""; stage.appendChild(el);
    const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: "#f4f6fa", logging: false, windowWidth: 1200 });
    stage.innerHTML = "";
    return await new Promise(res => canvas.toBlob(res, "image/png"));
  });
  return queue;
}

let downloads = null;
(async () => { try { downloads = await window.claude?.use?.("downloads"); } catch (e) { downloads = null; } refreshSaveButtons(); })();
function refreshSaveButtons() {
  document.querySelectorAll("[data-save]").forEach(b => { const c = state.classes[+b.dataset.save]; b.hidden = !(c && c.blob); });
  document.getElementById("saveAll").hidden = !downloads || !state.classes.length || state.example;
}
async function saveBlob(filename, blob, btn, idx) {
  if (!downloads) { if (idx !== undefined) openViewer(idx); return; }
  const old = btn.textContent; btn.disabled = true;
  try { await downloads.save({ filename, data: blob }); btn.textContent = "저장했어요"; }
  catch (e) {
    btn.textContent = old;
    if (!(e && e.code === "declined") && idx !== undefined) openViewer(idx);
  }
  setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1800);
}

/* 저장 기능을 쓸 수 없는 화면(로그인 안 함 등)에서는 이미지를 크게 띄워 길게 눌러 저장하게 해요. */
function openViewer(idx) {
  const c = state.classes[idx]; if (!c || !c.dataUrl) return;
  const v = document.getElementById("viewer");
  document.getElementById("viewerImg").src = c.dataUrl;
  v.hidden = false; document.body.style.overflow = "hidden";
  document.getElementById("viewerClose").focus();
}
function closeViewer() { document.getElementById("viewer").hidden = true; document.body.style.overflow = ""; }

const state = { classes: [], example: true };

function courseOptions(sel) {
  return '<option value="-1"' + (sel < 0 ? " selected" : "") + ">과정을 골라 주세요</option>" +
    courseGroups(CATALOG).map(([k, lab]) => '<optgroup label="' + lab + '">' +
      CATALOG.courses.map((c, i) => k(c) ? '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + esc(c.name) + (c.full !== c.name ? " (" + esc(c.full) + ")" : "") + "</option>" : "").join("") + "</optgroup>").join("");
}

function panelHTML(c, idx) {
  const v = classView(c, CATALOG);
  c.file = v.file;
  const warns = [];
  if (v.missing.length) warns.push("'" + v.missing.join("', '") + "' 단계와 맞는 과정을 찾지 못했어요. 아래에서 과정을 골라 주세요.");
  if (v.extra.length) warns.push(v.extra.join(", ") + " 수업일이 계획안 차시보다 많아요. 넘치는 날은 '책 정보 없음'으로 나와요.");
  if (v.noMonth.length) warns.push("수업월호에 적은 달의 계획안이 아직 없어서 다른 달 계획안을 넣었어요: " + v.noMonth.join(", ") + ". 아래에서 과정을 확인해 주세요.");
  if (v.noDates.length) warns.push("'" + v.noDates.join("', '") + "' 줄의 수업일을 읽지 못했어요. '11월 4일, 11일'처럼 적어 주세요.");
  const segs = c.segs.map((s, si) => '<div class="seg"><div class="dates"><b>' + esc(s.stage || "단계 없음") + (s.ho ? " · " + esc(s.ho) : "") + "</b><br>" + (s.dates.map(d => d.m + "/" + d.d).join(", ") || "수업일 없음") + "</div>" +
    '<label for="crs-' + idx + "-" + si + '">과정<select id="crs-' + idx + "-" + si + '" data-i="' + idx + '" data-s="' + si + '">' + courseOptions(s.course) + "</select></label>" +
    '<label class="ordl" for="ord-' + idx + "-" + si + '">차시 순서 <small>(바꿔서 수업할 때만)</small><input type="text" inputmode="numeric" id="ord-' + idx + "-" + si + '" data-o="' + idx + '" data-s="' + si + '" value="' + esc(s.order || "") + '" placeholder="' + (s.dates.map((_, k) => k + 1).join(",") || "1,2,3,4") + '"></label></div>').join("");
  return '<article class="panel" id="cls-' + idx + '" style="padding:16px">' +
    '<div class="cls-head"><h3>' + esc(c.names.join(", ") || "이름 없음") + "</h3>" + (state.example ? '<span class="tag">예시</span>' : '<span class="tag">' + esc(v.mLabel) + "</span>") + "</div>" +
    warns.map(w => '<div class="warn">' + esc(w) + "</div>").join("") +
    '<div class="segs">' + segs + "</div>" +
    '<p class="hint">점선으로 표시된 글자를 누르면 고칠 수 있어요.</p>' +
    '<div class="editor" id="ed-' + idx + '" hidden><label for="edt-' + idx + '"><span id="edl-' + idx + '">고치는 중</span><textarea id="edt-' + idx + '" data-edit="' + idx + '" rows="3"></textarea></label>' +
    '<button type="button" class="ghost" data-done="' + idx + '">다 고쳤어요</button></div>' +
    '<div class="live" id="live-' + idx + '"><div class="scaler">' + sheetHTML(v) + "</div></div>" +
    '<div class="bar"><span class="hint">' + esc(v.file) + '</span><span class="btns"><button type="button" data-make="' + idx + '">이미지로 만들기</button>' +
    '<button type="button" class="ghost" data-save="' + idx + '" hidden>이미지 저장</button></span></div>' +
    '<div class="shot" id="shot-' + idx + '" hidden></div></article>';
}

function fit(idx) {
  const live = document.getElementById("live-" + idx); if (!live) return;
  const sc = live.firstElementChild, s = live.clientWidth / 1200;
  sc.style.transform = "scale(" + s + ")";
  live.style.height = Math.ceil(sc.offsetHeight * s) + "px";
}
function fitAll() { state.classes.forEach((_, i) => fit(i)); }
window.addEventListener("resize", fitAll);

function markStale(idx) {
  const c = state.classes[idx]; if (!c) return;
  c.blob = null;
  c.dataUrl = null;
  const shot = document.getElementById("shot-" + idx);
  if (shot) { shot.hidden = true; shot.innerHTML = ""; }
  refreshSaveButtons();
}

async function makeImage(idx) {
  const c = state.classes[idx];
  const shot = document.getElementById("shot-" + idx);
  shot.hidden = false; shot.innerHTML = '<div class="wait">이미지 만드는 중…</div>';
  try {
    const blob = await capture(idx);
    c.blob = blob;
    c.dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    shot.innerHTML = '<p class="hint">완성된 이미지예요. "이미지 저장"을 누르거나, 이미지를 길게 눌러 저장하세요.</p><img alt="' + esc(c.names.join(", ")) + ' 수업계획서 이미지" src="' + c.dataUrl + '">';
  } catch (e) {
    shot.innerHTML = '<div class="wait">이미지를 만들지 못했어요. 페이지를 새로 고친 뒤 다시 해 주세요.</div>';
  }
  refreshSaveButtons();
  return c.blob;
}

function closeEditor(idx) {
  const c = state.classes[idx]; if (!c) return;
  if (c._edEl) c._edEl.classList.remove("editing");
  c._edEl = null;
  const ed = document.getElementById("ed-" + idx); if (ed) ed.hidden = true;
}

function renderAll() {
  const box = document.getElementById("classes");
  box.innerHTML = state.classes.map(panelHTML).join("");
  refreshSaveButtons();
  loadFonts().then(fitAll); fitAll();
}

document.getElementById("classes").addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.o !== undefined) {   /* 차시 순서를 바꾸면 그 반만 다시 그려요 */
    const i = +t.dataset.o, c = state.classes[i], sg = c.segs[+t.dataset.s], v = t.value.trim();
    if (!sg || sg.order === v) return;
    sg.order = v; c.blob = null;
    setTimeout(() => { document.getElementById("cls-" + i).outerHTML = panelHTML(c, i); refreshSaveButtons(); fit(i); }, 0); return;
  }
  const i = +t.dataset.i; if (Number.isNaN(i) || t.tagName !== "SELECT") return;
  const c = state.classes[i];
  c.segs[+t.dataset.s].course = +t.value; c.title = null; c.blob = null;
  document.getElementById("cls-" + i).outerHTML = panelHTML(c, i);
  refreshSaveButtons(); fit(i);
});
document.getElementById("classes").addEventListener("input", e => {
  const t = e.target; if (!t.dataset || t.dataset.edit === undefined) return;
  const i = +t.dataset.edit, c = state.classes[i];
  if (!c || !c._edEl) return;
  c._edEl.innerText = t.value;
  fit(i); markStale(i);
});
document.getElementById("classes").addEventListener("click", e => {
  const ed = e.target.closest(".live [data-ed]");
  if (ed) {
    const live = ed.closest(".live"), i = +live.id.slice(5), c = state.classes[i];
    if (c._edEl) c._edEl.classList.remove("editing");
    c._edEl = ed; ed.classList.add("editing");
    const box = document.getElementById("ed-" + i), ta = document.getElementById("edt-" + i);
    document.getElementById("edl-" + i).textContent = "고치는 중: " + ed.dataset.ed;
    box.hidden = false; ta.value = ed.innerText.trim();
    ta.focus();
    return;
  }
  const done = e.target.closest("[data-done]");
  if (done) { closeEditor(+done.dataset.done); return; }
  const mk = e.target.closest("[data-make]");
  if (mk) { const i = +mk.dataset.make; closeEditor(i); mk.disabled = true; makeImage(i).finally(() => { mk.disabled = false; }); return; }
  const b = e.target.closest("[data-save]"); if (!b) return;
  const c = state.classes[+b.dataset.save]; if (c && c.blob) saveBlob(c.file, c.blob, b, +b.dataset.save);
});
document.getElementById("viewerClose").addEventListener("click", closeViewer);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeViewer(); });
document.getElementById("saveAll").addEventListener("click", async e => {
  const btn = e.currentTarget; btn.disabled = true;
  const zip = new JSZip();
  for (let i = 0; i < state.classes.length; i++) { closeEditor(i); if (!state.classes[i].blob) await makeImage(i); }
  const used = new Set();
  state.classes.forEach(c => { if (!c.blob) return; let n = c.file, k = 2;
    while (used.has(n)) n = c.file.replace(/\.png$/, "(" + (k++) + ").png");
    used.add(n); zip.file(n, c.blob); });
  const blob = await zip.generateAsync({ type: "blob" });
  btn.disabled = false;
  const ms = [...new Set(state.classes.flatMap(c => c.segs.flatMap(s => s.dates.map(d => d.m))))].sort((x, y) => x - y);
  saveBlob((ms.length ? ms.join("·") : CATALOG.month) + "월_수업계획서_전체.zip", blob, btn);
});

async function handleFile(f) {
  const st = document.getElementById("status");
  if (!f) return;
  st.textContent = "엑셀을 읽는 중이에요…";
  try {
    const rows = readSheetRows(await f.arrayBuffer());
    const groups = groupRows(rows);
    if (!groups.length) throw new Error("수업 정보가 있는 줄을 찾지 못했어요.");
    state.example = false;
    state.classes = groups.map(g => buildClass(g, CATALOG));
    const miss = state.classes.filter(c => c.segs.some(s => s.course < 0)).length;
    const memoN = state.classes.filter(c => c.memo).length;
    st.textContent = state.classes.length + "개 반을 찾았어요." + (miss ? " 과정을 골라야 하는 반이 " + miss + "개 있어요." : "") +
      (groups.noMemoCol ? " 엑셀에 '특이사항' 칸이 없어서 기본 인사말을 넣었어요." : (memoN ? " 특이사항 문구로 인사말을 바꾼 반이 " + memoN + "개예요." : ""));
    document.getElementById("resHint").textContent = "점선 글자를 눌러 고친 뒤 '이미지로 만들기'를 누르세요. 만들어진 이미지는 저장 버튼이나 길게 눌러 저장할 수 있어요.";
    renderAll();
  } catch (e) {
    st.textContent = "엑셀을 읽지 못했어요. " + (e.message || "") + " 양식을 확인하고 다시 올려 주세요.";
  }
}
const fileIn = document.getElementById("file"), drop = document.getElementById("drop");
fileIn.addEventListener("change", () => { handleFile(fileIn.files[0]); fileIn.value = ""; });
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });

const nMonthly = CATALOG.courses.filter(c => c.kind === "monthly").length, nSeries = CATALOG.courses.length - nMonthly;
document.getElementById("monthChip").textContent = CATALOG.year + "년 " + courseMonths(CATALOG).join("·") + "월 과정 " + nMonthly + "개 · 호별 과정 " + nSeries + "개 등록됨";
const catItem = c => "<div><b>" + esc(c.name) + (c.full !== c.name ? " · " + esc(c.full) : "") + "</b><span class=\"hint\">엑셀에 이렇게 적어요: " + esc(c.aliases.slice(0, 3).join(", ")) + "</span><ol>" +
  c.sessions.map(s => "<li>" + esc(s.book) + "</li>").join("") + "</ol></div>";
document.getElementById("catalogList").innerHTML =
  courseMonths(CATALOG).slice().reverse().map(m => "<h3 class=\"step\">" + m + "월 과정 (매달 바뀌어요)</h3>" + CATALOG.courses.filter(c => c.kind === "monthly" && (c.month || CATALOG.month) === m).map(catItem).join("")).join("") +
  "<h3 class=\"step\">호별 과정 (호수까지 적어 주세요)</h3>" + CATALOG.courses.filter(c => c.kind === "series").map(catItem).join("");

/* 예시 */
(function example() {
  const li = CATALOG.courses.findIndex(c => c.name === "논리1");
  state.classes = [{ names: ["예시 반"], time: "수요일 3:00~4:00", title: null,
    segs: [{ stage: "논리1", datesText: "", course: li >= 0 ? li : 0,
      dates: (() => { const out = []; const last = new Date(CATALOG.year, CATALOG.month, 0).getDate();
        for (let d = 1; d <= last && out.length < 4; d++) if (new Date(CATALOG.year, CATALOG.month - 1, d).getDay() === 3) out.push({ y: CATALOG.year, m: CATALOG.month, d });
        return out; })() }] }];
  renderAll();
})();



/* ---------- 다른 탭과 반 명단 나누기 (첫 화면 index.html을 거쳐 주고받아요) ----------
   여기서 올린 명단은 다른 탭으로 보내고(roster), 반 목록(classes)은 피드백 탭이 반을 고를 때 써요. */
(function () {
  const orig = handleFile;
  let fromShell = false;
  function summary() {
    return state.classes.map(c => ({ names: c.names.slice(), time: c.time, stages: c.segs.map(s => s.stage),
      courses: c.segs.map(s => (CATALOG.courses[s.course] || {}).full || s.stage),
      /* 수업일의 달(예: "2026-10"): 피드백 탭이 그 달 활동리포트를 골라요 */
      months: c.segs.map(s => { const cr = CATALOG.courses[s.course], d0 = s.dates && s.dates[0];
        const m = cr && cr.kind === "monthly" ? (cr.month || CATALOG.month) : (d0 ? d0.m : 0);   /* 계획안의 달(수업월호) */
        return m ? (d0 ? d0.y : CATALOG.year) + "-" + String(m).padStart(2, "0") : ""; }) }));
  }
  handleFile = async function (f) {
    const r = await orig(f);
    try {
      if (f && !state.example && state.classes.length) {
        if (!fromShell) tell({ type: "roster", buf: await f.arrayBuffer(), name: f.name });
        tell({ type: "classes", classes: summary() });
      }
    } catch (e) {}
    return r;
  };
  window.__receiveRoster = async function (buf, name) {
    fromShell = true;
    try { await handleFile(new File([buf], name)); } finally { fromShell = false; }
  };
  onParent("roster", m => window.__receiveRoster(m.buf, m.name));
  /* 과정을 직접 고르면 피드백 탭에도 알려요 */
  document.getElementById("classes").addEventListener("change", () => setTimeout(() => {
    try { if (!state.example) tell({ type: "classes", classes: summary() }); } catch (e) {}
  }, 0));
  tell({ type: "hello" });
})();
