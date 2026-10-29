const TABS = ["plan", "homework", "feedback"];
function show(name) {
  if (!TABS.includes(name)) name = "plan";
  TABS.forEach(t => {
    document.getElementById("tab-" + t).setAttribute("aria-selected", t === name ? "true" : "false");
    document.getElementById("f-" + t).classList.toggle("off", t !== name);
  });
  try { localStorage.setItem("suite_tab", name); } catch (e) {}
  /* 숨겨져 있던 페이지는 크기를 다시 맞춰요 */
  try { document.getElementById("f-" + name).contentWindow.dispatchEvent(new Event("resize")); } catch (e) {}
}
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
document.querySelector(".tabs").addEventListener("keydown", e => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const cur = TABS.findIndex(t => document.getElementById("tab-" + t).getAttribute("aria-selected") === "true");
  const next = TABS[(cur + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
  show(next); document.getElementById("tab-" + next).focus();
});
let first = location.hash.slice(1);
if (!TABS.includes(first)) { try { first = localStorage.getItem("suite_tab") || "plan"; } catch (e) { first = "plan"; } }
show(first);

/* Claude 밖(GitHub)에서 열면 엑셀 양식 받기 메뉴를 보여 줘요 */
if (!window.claude) document.getElementById("forms").hidden = false;

/* 카카오톡 안 브라우저는 그림 저장이 막혀 있어서, 휴대폰 기본 브라우저로 다시 열어요 */
if (!window.claude && /KAKAOTALK/i.test(navigator.userAgent)) {
  const ext = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
  document.getElementById("kakao").hidden = false;
  document.getElementById("kakaoOpen").href = ext;
  try { if (!sessionStorage.getItem("suite_kakao_open")) { sessionStorage.setItem("suite_kakao_open", "1"); location.href = ext; } } catch (e) {}
}

/* 탭끼리 반 명단 나누기: postMessage로 주고받아요.
   (index.html을 더블클릭해 파일로 열면 탭끼리 서로 직접 부를 수 없어서, 메시지로만 전해져요) */
window.__roster = null;
window.__rosterClasses = null;
const frameOf = src => TABS.find(t => document.getElementById("f-" + t).contentWindow === src);
const post = (t, msg) => { try { document.getElementById("f-" + t).contentWindow.postMessage(msg, "*"); } catch (e) {} };
window.__shareRoster = function (buf, name, from) {
  window.__roster = { buf: buf.slice(0), name };
  document.getElementById("shared").innerHTML = "반 명단: <b></b>";
  document.querySelector("#shared b").textContent = name;
  TABS.forEach(t => { if (t !== from) post(t, { type: "roster", buf: buf.slice(0), name }); });
};
window.__shareClasses = function (classes) {
  window.__rosterClasses = classes;
  post("feedback", { type: "classes", classes });
};
window.addEventListener("message", e => {
  const from = frameOf(e.source), m = e.data;
  if (!from || !m || typeof m !== "object") return;
  if (m.type === "roster" && m.buf) window.__shareRoster(m.buf, m.name, from);
  else if (m.type === "classes") window.__shareClasses(m.classes);
  /* 차시 순서: 수업계획서에서 바꾸면 숙제 안내문에도, 숙제 안내문에서 바꾸면 수업계획서에도 전해요 */
  else if (m.type === "order") { window.__orders = Object.assign(window.__orders || {}, { [m.k]: m.order }); ["plan", "homework"].forEach(t => { if (t !== from) post(t, m); }); }
  /* 늦게 열린 탭이 '이미 올린 명단 있나요?' 하고 물어요 */
  else if (m.type === "hello") {
    if (window.__roster) post(from, { type: "roster", buf: window.__roster.buf.slice(0), name: window.__roster.name });
    if (from === "feedback" && window.__rosterClasses) post(from, { type: "classes", classes: window.__rosterClasses });
    Object.entries(window.__orders || {}).forEach(([k, order]) => post(from, { type: "order", k, order }));
  }
});
