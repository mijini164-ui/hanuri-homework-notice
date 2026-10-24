/* 세 탭이 함께 쓰는 도구 모음. 페이지에서는 const { esc, norm, ... } = Suite; 로 꺼내 써요.
   - 글자 다루기: esc, norm, cleanTime
   - 반 명단 엑셀 읽기: readSheetRows, groupRows, parseDates, matchCourse(달에 맞는 계획안 고르기 포함)
   - 탭끼리 주고받기: tell, onParent  (첫 화면 index.html과 postMessage로만 주고받아요. 파일로 열어도 되게) */
window.Suite = (function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const norm = s => String(s ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();

  /* 수업요일 칸: "수요일 3:00~4:00" 여러 줄이면 " · "로 이어요 */
  function cleanTime(t) {
    return String(t ?? "").normalize("NFKC").replace(/~+/g, "~").split(/\r?\n|,(?=\s*[월화수목금토일])/).map(x => x.trim()).filter(Boolean).join(" · ");
  }

  /* 수업일 칸: "11월 4일, 11일" 또는 "11/4, 11/11" → [{y, m, d}]. 12월→1월처럼 해가 넘어가면 다음 해로 */
  function parseDates(text, baseYear, baseMonth) {
    const out = [];
    let m = null, y = baseYear, prevM = null, t;
    const re = /(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일|(\d{1,2})\s*[\/.]\s*(\d{1,2})/g;
    const s = String(text ?? "").normalize("NFKC");
    while ((t = re.exec(s))) {
      let mm, dd;
      if (t[2]) { mm = t[1] ? +t[1] : m; dd = +t[2]; } else { mm = +t[3]; dd = +t[4]; }
      if (!mm) continue;
      if (prevM === null) { y = (baseMonth >= 11 && mm <= 2) ? baseYear + 1 : (baseMonth <= 2 && mm >= 11 ? baseYear - 1 : baseYear); }
      else if (mm < prevM) y += 1;
      prevM = mm; m = mm;
      out.push({ y, m: mm, d: dd });
    }
    return out;
  }

  /* 엑셀 단계 이름 → 계획안(CATALOG) 과정 번호. 못 찾으면 -1
     매달 바뀌는 과정은 month(수업일의 달)에 맞는 계획안을 골라요(예: 10월 수업이면 10월 독서1). */
  function matchCourse(stage, catalog, month) { return pickMonth(matchCourse0(stage, catalog), catalog, month); }
  function pickMonth(i, catalog, month) {
    if (i < 0) return i;
    const c = catalog.courses[i];
    if (!c || c.kind !== "monthly") return i;
    const want = month || catalog.month;
    const j = catalog.courses.findIndex(x => x.kind === "monthly" && x.name === c.name && (x.month || catalog.month) === want);
    return j >= 0 ? j : i;
  }
  /* 계획안에 들어 있는 달들(예: [10, 11]) */
  function courseMonths(catalog) { return [...new Set(catalog.courses.filter(c => c.kind === "monthly").map(c => c.month || catalog.month))].sort((a, b) => a - b); }
  /* 과정 고르는 목록의 묶음: 11월 과정 · 10월 과정 · 호별 과정 */
  function courseGroups(catalog) {
    return courseMonths(catalog).slice().reverse().map(m => [c => c.kind === "monthly" && (c.month || catalog.month) === m, m + "월 과정"])
      .concat([[c => c.kind === "series", "호별 과정"]]);
  }
  /* 과정 이름 옆에 붙이는 달 표시(두 달 이상 들어 있을 때만): "독서리더1 (10월)" */
  function monthTag(c, catalog) { return c && c.kind === "monthly" && courseMonths(catalog).length > 1 ? " (" + (c.month || catalog.month) + "월)" : ""; }
  /* 수업월호 칸 읽기: "10월" → {month:10}, "2호" → {ho:2} */
  function readHo(t) {
    const x = String(t ?? "").normalize("NFKC"), m = x.match(/(\d{1,2})\s*월/), h = x.match(/(\d{1,2})\s*호/);
    return { month: m ? +m[1] : 0, ho: h ? +h[1] : 0 };
  }
  /* 단계 + 수업월호 → 계획안 과정. 단계에 호수가 없으면 수업월호의 호를 붙이고("몰입P" + "2호"),
     수업월호에 달이 있으면 그 달 계획안, 없으면 수업일의 달 계획안을 골라요. want = 수업월호에 적은 달 */
  function courseFor(stage, ho, catalog, dateMonth) {
    const r = readHo(ho);
    let st = String(stage ?? "");
    if (r.ho && !/\d\s*호?\s*$/.test(st.normalize("NFKC").trim())) st = st.trim() + r.ho + "호";
    return { ci: matchCourse(st, catalog, r.month || dateMonth), want: r.month, stage: st };
  }
  function matchCourse0(stage, catalog) {
    const n = norm(stage);
    if (!n) return -1;
    let i = catalog.courses.findIndex(c => c.aliases.some(a => norm(a) === n) || norm(c.name) === n);
    if (i >= 0) return i;
    const loose = s => norm(s).replace(/단계/g, "").replace(/호$/, "");
    const l = loose(stage);
    i = catalog.courses.findIndex(c => c.aliases.some(a => loose(a) === l) || loose(c.name) === l);
    if (i >= 0) return i;
    /* 띄어쓰기가 다른 정식 이름(세계사 통사 2호 → 세계사통사2호)도 맞춰요 */
    return catalog.courses.findIndex(c => loose(c.full) === l);
  }

  /* 엑셀 첫 시트 → 줄 배열. 합친(병합) 칸은 모든 칸에 같은 값을 채워요 */
  function readSheetRows(buf) {
    const wb = XLSX.read(buf, { type: "array", cellStyles: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    /* 셀 위치를 엑셀의 실제 행·열 번호 그대로 읽어요(병합 위치와 정확히 맞추기 위해) */
    const rg = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const rows = [];
    for (let r = 0; r <= rg.e.r; r++) {
      const row = [];
      for (let c = 0; c <= rg.e.c; c++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; row[c] = cell ? String(cell.w ?? cell.v ?? "") : ""; }
      rows.push(row);
    }
    (ws["!merges"] || []).forEach(mg => {
      const v = (rows[mg.s.r] || [])[mg.s.c];
      for (let r = mg.s.r; r <= mg.e.r; r++) for (let c = mg.s.c; c <= mg.e.c; c++) { rows[r] = rows[r] || []; if (r !== mg.s.r || c !== mg.s.c) rows[r][c] = v; }
    });
    return rows;
  }

  /* 반 명단 줄 → 반 목록 [{no, names, time, memo, segs:[{stage, dates}], count, team}]
     같은 반 = No가 같은 줄. No가 비어 있으면 앞 반에 이어지되, '개인'으로 적힌 새 수업 줄은 따로 나눠요. */
  function groupRows(rows) {
    const hi = rows.findIndex(r => r.some(c => norm(c) === "이름") && r.some(c => norm(c) === "단계"));
    if (hi < 0) throw new Error("반 명단 엑셀 첫 줄에서 '이름'과 '단계' 칸을 찾지 못했어요.");
    const H = rows[hi].map(norm);
    const col = k => H.findIndex(h => h === k || h.startsWith(k));
    const cNo = col("no"), cTeam = col("팀여부"), cName = col("이름"), cTime = col("수업요일"), cStage = col("단계"), cDate = col("수업일");
    /* 수업월호 칸(선택): "10월"이면 수업일이 11월이어도 10월 계획안, "2호"면 그 호 */
    const cHo = ["수업월호", "월호", "수업월", "계획안", "수업호"].map(k => H.indexOf(k)).find(i => i >= 0) ?? -1;
    const cMemo = ["특이사항", "특이", "비고", "인사말", "메모", "전달사항", "참고사항", "기타"].map(col).find(i => i >= 0) ?? -1;
    /* 팀 이름으로 적을 때 쓰는 학생 수 칸(인원·학생수·명수) */
    const cCount = H.findIndex(h => h === "인원" || h.startsWith("인원") || h.startsWith("학생수") || h === "명수");
    const isTeamLabel = s => /팀\d*(\(\d+명\))?$/.test(norm(s));
    const groups = []; let cur = null;
    for (const r of rows.slice(hi + 1)) {
      const name = String(r[cName] ?? "").trim(), stage = String(r[cStage] ?? "").trim(), dates = String(r[cDate] ?? "").trim();
      const no = cNo >= 0 ? String(r[cNo] ?? "").trim() : "";
      const memo = cMemo >= 0 ? String(r[cMemo] ?? "").trim() : "";
      if (!name && !stage && !dates) { if (cur && memo && !cur.memo) cur.memo = memo; continue; }
      const team = cTeam >= 0 ? norm(r[cTeam]) : "";
      let same;
      if (!cur) same = false;
      else if (cNo >= 0 && no) same = no === cur.no;
      else if (!stage && !dates) same = true;
      else same = !team.includes("개인");
      /* 팀 이름(예: 목요일 1팀)이 바뀌거나 수업요일이 다르면 No가 같거나 비어 있어도 다른 반으로 나눠요 */
      if (same && cur) {
        const t = cTime >= 0 ? cleanTime(r[cTime]) : "";
        if (name && isTeamLabel(name) && cur.names.some(isTeamLabel) && !cur.names.includes(name)) same = false;
        else if (stage && t && cur.time && norm(t) !== norm(cur.time)) same = false;
      }
      if (!same) { cur = { no, names: [], time: "", memo: "", segs: [], count: 0, team: false }; groups.push(cur); }
      if (name && !cur.names.includes(name)) cur.names.push(name);
      if (team.includes("팀")) cur.team = true;
      /* 학생 수: 인원 칸 숫자, 없으면 이름 칸의 '(5명)' 같은 숫자 */
      const cnt = cCount >= 0 ? String(r[cCount] ?? "").normalize("NFKC").match(/\d+/) : null;
      const inName = name.normalize("NFKC").match(/(\d+)\s*명/);
      if (cnt) cur.count += +cnt[0]; else if (inName) cur.count += +inName[1];
      if (!cur.time && cTime >= 0 && r[cTime]) cur.time = cleanTime(r[cTime]);
      if (!cur.memo && memo) cur.memo = memo;
      if (stage || dates) {
        const ho = cHo >= 0 ? String(r[cHo] ?? "").trim() : "";
        const key = norm(stage) + "|" + norm(dates) + "|" + norm(ho);
        if (!cur.segs.some(s => s.key === key)) cur.segs.push({ key, stage, dates, ho });
      }
    }
    const out = groups.filter(g => g.segs.length);
    out.noMemoCol = cMemo < 0;
    return out;
  }

  /* 첫 화면(index.html)에 알리기 / 첫 화면이 보낸 메시지 받기 */
  const tell = msg => { if (parent !== window) parent.postMessage(msg, "*"); };
  const onParent = (type, fn) => addEventListener("message", e => {
    if (e.source === parent && e.data && e.data.type === type) fn(e.data);
  });

  return { esc, norm, cleanTime, parseDates, matchCourse, readHo, courseFor, pickMonth, courseMonths, courseGroups, monthTag, readSheetRows, groupRows, tell, onParent };
})();
