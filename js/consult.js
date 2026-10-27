/* 신규 상담 안내문 만들기
   - 왼쪽 입력칸(data-f) → 안내문의 data-b 자리에 들어가요.
   - 안내문의 고정 글(data-k)은 '글 직접 고치기'를 켜면 눌러서 고칠 수 있어요.
   - 입력한 내용과 고친 글은 이 기기(localStorage, 'consult_v1')에만 저장돼요. 서버로 가지 않아요. */
(function () {
  "use strict";
  var KEY = "consult_v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PHIL = [
    "아이가 책 속에서 스스로 답을 찾을 때까지 기다리고 질문해 주는 선생님이 되고 싶어요.\n한 권을 읽어도 제대로 읽고, 내 생각을 말할 수 있는 아이로 키울게요.",
    "정답을 알려 주기보다 생각하는 방법을 가르쳐요.\n아이 한 명 한 명의 속도를 존중하며, 매주 조금씩 자라는 모습을 학부모님과 함께 나눌게요.",
    "책을 좋아하는 아이가 공부도 즐거워한다고 믿어요.\n읽는 즐거움을 먼저 찾아 주고, 그 즐거움이 생각하는 힘으로 이어지도록 이끌게요."
  ];
  var POINTS = [
    ["매달 수업 피드백", "수업계획서와 아이별 수업 피드백을 학부모님께 보내 드려요."],
    ["한 명 한 명 맞춤 지도", "소그룹이라 아이 수준에 맞춰 읽기 전략과 질문을 달리해요."],
    ["글쓰기 첨삭", "아이가 쓴 글을 선생님이 직접 첨삭하고, 고쳐 쓰며 실력을 키워요."],
    ["숙제 안내문", "차시별 숙제를 정리해 교재에 붙여 드려 집에서도 챙기기 쉬워요."],
    ["토론이 있는 교실", "매달 토의·토론으로 내 생각을 말하는 힘을 길러요."],
    ["몰입독서 함께 운영", "읽기가 아직 어려운 아이는 선생님과 같이 읽는 몰입독서로 시작해요."],
    ["빠진 수업은 보강", "공휴일이나 사정으로 빠진 수업은 보강 일정을 잡아 드려요."],
    ["가까운 우리 동네 교실", "아이가 혼자 오가기 편한 가까운 곳에서 수업해요."]
  ];
  var DEF = {
    room: "", teacher: "", phone: "", place: "",
    branch: "한우리 안산단원지부", branchTel: "031-413-1919",
    phil: PHIL[0],
    points: [POINTS[0].slice(), POINTS[1].slice(), POINTS[2].slice()],
    slots: [["", "", ""], ["", "", ""], ["", "", ""]],
    rule: "· 주 1회(한 달 4회) 수업해요\n· 2명 70분 · 3명 80분 · 4명 이상 90분\n· 6~7세는 40분 수업이에요\n· 한 반은 2~6명이에요 (6~7세는 4명까지)\n· 매달 필독서와 워크북으로 수업해요",
    closing: "아이의 생각이 자라는 시간,\n한우리가 함께할게요.",
    text: {}
  };
  var PH = { room: "○○교실", teacher: "○○○", phone: "010-0000-0000", phil: "선생님의 교육 철학을 적어 주세요." };

  var state = load();
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    var o = JSON.parse(JSON.stringify(DEF));
    if (s && typeof s === "object") for (var k in o) if (k in s) o[k] = s[k];
    if (!Array.isArray(o.points)) o.points = DEF.points;
    if (!Array.isArray(o.slots)) o.slots = DEF.slots;
    if (!o.text || typeof o.text !== "object") o.text = {};
    return o;
  }
  var saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }, 250);
  }

  /* ── 안내문 고정 글 ── */
  var ORIG = {};
  $$("[data-k]").forEach(function (el) {
    ORIG[el.dataset.k] = el.innerHTML;
    if (state.text[el.dataset.k] != null) el.innerHTML = state.text[el.dataset.k];
    el.addEventListener("input", function () { state.text[el.dataset.k] = el.innerHTML; save(); });
  });
  $("#editMode").addEventListener("change", function () {
    var on = this.checked;
    $("#pages").classList.toggle("editing", on);
    $$("[data-k]").forEach(function (el) { if (on) el.setAttribute("contenteditable", "true"); else el.removeAttribute("contenteditable"); });
  });
  $("#resetText").addEventListener("click", function () {
    if (!confirm("안내문에서 직접 고친 글을 모두 처음 글로 되돌릴까요? (왼쪽에 적은 교실 정보는 그대로예요)")) return;
    state.text = {};
    $$("[data-k]").forEach(function (el) { el.innerHTML = ORIG[el.dataset.k]; });
    save(); say("안내문 글을 처음으로 되돌렸어요.");
  });

  /* ── 입력칸 ── */
  $$("[data-f]").forEach(function (el) {
    el.value = state[el.dataset.f] || "";
    el.addEventListener("input", function () { state[el.dataset.f] = el.value; render(); save(); });
  });

  PHIL.forEach(function (t, i) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "예시 " + (i + 1) + ": " + t.split("\n")[0].slice(0, 18) + "…";
    b.title = t;
    b.addEventListener("click", function () { state.phil = t; $("#f-phil").value = t; render(); save(); });
    $("#philChips").appendChild(b);
  });
  POINTS.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "+ " + p[0]; b.title = p[1];
    b.addEventListener("click", function () {
      var i = state.points.findIndex(function (q) { return !q[0] && !q[1]; });
      if (i < 0) { if (state.points.length >= 3) { say("세 칸이 모두 찼어요. 바꿀 칸의 ✕를 먼저 눌러 비워 주세요.", true); return; } state.points.push(["", ""]); i = state.points.length - 1; }
      state.points[i] = p.slice(); drawPoints(); render(); save();
    });
    $("#pointChips").appendChild(b);
  });

  function drawPoints() {
    while (state.points.length < 3) state.points.push(["", ""]);
    state.points = state.points.slice(0, 3);
    var box = $("#points"); box.innerHTML = "";
    state.points.forEach(function (p, i) {
      var d = document.createElement("div"); d.className = "pt";
      d.innerHTML = '<span class="n">특별한 점 ' + (i + 1) + '</span><button type="button" class="x" aria-label="비우기">✕</button>' +
        '<input aria-label="제목" placeholder="제목 (짧게)"><textarea rows="2" aria-label="설명" placeholder="한두 줄 설명"></textarea>';
      var t = d.querySelector("input"), s = d.querySelector("textarea");
      t.value = p[0]; s.value = p[1];
      t.addEventListener("input", function () { state.points[i][0] = t.value; render(); save(); });
      s.addEventListener("input", function () { state.points[i][1] = s.value; render(); save(); });
      d.querySelector(".x").addEventListener("click", function () { state.points[i] = ["", ""]; drawPoints(); render(); save(); });
      box.appendChild(d);
    });
  }
  function drawSlots() {
    var box = $("#slots"); box.innerHTML = "";
    state.slots.forEach(function (r, i) {
      var d = document.createElement("div"); d.className = "slot";
      var ph = ["예: 초3 독서리더", "예: 화", "예: 오후 4:00~5:30"];
      d.innerHTML = '<input><input><input><button type="button" aria-label="줄 지우기">✕</button>';
      $$("input", d).forEach(function (inp, j) {
        inp.value = r[j] || ""; inp.placeholder = ph[j];
        inp.setAttribute("aria-label", ["대상·과정", "요일", "시간"][j] + " " + (i + 1));
        inp.addEventListener("input", function () { state.slots[i][j] = inp.value; render(); save(); });
      });
      d.querySelector("button").addEventListener("click", function () { state.slots.splice(i, 1); if (!state.slots.length) state.slots.push(["", "", ""]); drawSlots(); render(); save(); });
      box.appendChild(d);
    });
  }
  $("#addSlot").addEventListener("click", function () { state.slots.push(["", "", ""]); drawSlots(); save(); var ins = $$("#slots input"); ins[ins.length - 3].focus(); });

  /* ── 안내문에 반영 ── */
  function put(el, v, ph) {
    if (v) { el.textContent = v; el.classList.remove("ph"); }
    else if (ph) { el.textContent = ph; el.classList.add("ph"); }
    else { el.textContent = ""; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render() {
    $$("[data-b]").forEach(function (el) { var f = el.dataset.b; put(el, (state[f] || "").trim(), PH[f]); });
    $$("[data-b-wrap]").forEach(function (el) { el.hidden = !(state[el.dataset.bWrap] || "").trim(); });
    var pts = state.points.filter(function (p) { return (p[0] || "").trim() || (p[1] || "").trim(); });
    $("#ptsOut").innerHTML = pts.length ? pts.map(function (p, i) {
      return "<div><small>POINT " + (i + 1) + "</small><b>" + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></div>";
    }).join("") : '<div class="ph" style="grid-column:1/-1">왼쪽에서 우리 교실만의 특별한 점을 골라 주세요.</div>';
    $("#ptsOut").style.gridTemplateColumns = "repeat(" + Math.max(1, Math.min(3, pts.length)) + ",1fr)";
    var rows = state.slots.filter(function (r) { return r.some(function (c) { return (c || "").trim(); }); });
    $("#slotsOut").innerHTML = rows.length ? rows.map(function (r) {
      return "<tr><td>" + esc(r[0] || "") + "</td><td>" + esc(r[1] || "") + "</td><td>" + esc(r[2] || "") + "</td></tr>";
    }).join("") : '<tr class="empty"><td colspan="3">수업 시간은 상담 후 아이에게 맞춰 정해요.</td></tr>';
  }

  /* ── 미리보기 크기 맞추기 ── */
  function fit() {
    var pv = $("#preview"), pg = $("#pages");
    var w = pv.clientWidth, s = Math.min(1, w / 794);
    pg.style.transform = s < 1 ? "scale(" + s + ")" : "";
    pv.style.height = s < 1 ? Math.ceil(pg.scrollHeight * s) + "px" : "";
  }
  window.addEventListener("resize", fit);

  /* ── 저장 ── */
  var MOB = /Android|iPhone|iPad|iPod|KAKAOTALK|NAVER|Line\//i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  function say(t, err) { var s = $("#status"); s.textContent = t; s.classList.toggle("err", !!err); }
  function busy(on) { $$(".actions button").forEach(function (b) { b.disabled = on; }); }
  function fname(ext) {
    var r = (state.room || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");
    return "신규상담안내문" + (r ? "_" + r : "") + "." + ext;
  }
  async function shots() {
    if (!window.html2canvas) throw new Error("그림 만드는 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    var pg = $("#pages"), keep = pg.style.transform, wasEdit = pg.classList.contains("editing");
    pg.style.transform = ""; pg.classList.remove("editing"); document.body.classList.add("capturing");
    if (document.activeElement) document.activeElement.blur();
    try {
      var out = [];
      for (var i = 1; i <= 3; i++) {
        out.push(await html2canvas($("#page" + i), { scale: 2, backgroundColor: "#fffdf9", useCORS: true, logging: false, windowWidth: 1400 }));
      }
      return out;
    } finally {
      pg.style.transform = keep; if (wasEdit) pg.classList.add("editing"); document.body.classList.remove("capturing");
    }
  }
  function toBlob(c, type, q) { return new Promise(function (res) { c.toBlob(res, type, q); }); }
  async function store(name, blob, canvases) {
    var dl = await window.claude.use("downloads");
    try { await dl.save({ filename: name, data: blob }); say("저장했어요: " + name); }
    catch (e) {
      if (e && e.code === "declined") { say("저장을 취소했어요."); return; }
      if (e && e.code === "unavailable" && canvases) { showImgs(canvases); say("그림을 길게 눌러 저장해 주세요."); return; }
      throw e;
    }
  }
  function showImgs(cs) {
    var box = $("#viewerImgs"); box.innerHTML = "";
    cs.forEach(function (c, i) { var im = new Image(); im.alt = (i + 1) + "장"; im.src = c.toDataURL("image/jpeg", 0.92); box.appendChild(im); });
    $("#viewer").hidden = false;
  }
  $("#viewerClose").addEventListener("click", function () { $("#viewer").hidden = true; });

  $("#savePdf").addEventListener("click", async function () {
    busy(true); say("PDF를 만들고 있어요…");
    try {
      var cs = await shots();
      var J = window.jspdf && window.jspdf.jsPDF;
      if (!J) throw new Error("PDF 도구를 불러오지 못했어요. 새로고침해 주세요.");
      var pdf = new J({ orientation: "p", unit: "mm", format: "a4" });
      cs.forEach(function (c, i) { if (i) pdf.addPage(); pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297); });
      await store(fname("pdf"), pdf.output("blob"), cs);
    } catch (e) { say((e && e.message) || "저장하지 못했어요.", true); }
    busy(false);
  });
  $("#savePng").addEventListener("click", async function () {
    busy(true); say("그림을 만들고 있어요…");
    try {
      var cs = await shots();
      if (MOB) { showImgs(cs); say("그림을 길게 눌러 저장해 주세요."); }
      else {
        var zip = new JSZip(), base = fname("png").replace(/\.png$/, "");
        for (var i = 0; i < cs.length; i++) zip.file(base + "_" + (i + 1) + ".png", await toBlob(cs[i], "image/png"));
        await store(base + ".zip", await zip.generateAsync({ type: "blob" }), cs);
      }
    } catch (e) { say((e && e.message) || "저장하지 못했어요.", true); }
    busy(false);
  });
  $("#print").addEventListener("click", function () { window.print(); });

  drawPoints(); drawSlots(); render(); fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
