// 올리기 전 점검: 각 페이지의 스크립트 문법, 과정 목록(JSON), 꼭 있어야 하는 화면 요소, 외부 라이브러리 주소, 엑셀 양식 파일을 확인해요.
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const PAGES = {
  "index.html": ["tab-plan", "tab-homework", "tab-feedback", "f-plan", "f-homework", "f-feedback", "forms"],
  "plan.html": ["file", "classes", "catalog", "viewer"],
  "homework.html": ["fileRoster", "fileHw", "list", "savePdf", "savePng", "saveStatus", "catalog", "viewer"],
  "feedback.html": ["stage", "report", "student", "pick", "checks", "gen", "alt", "text", "png", "preview"],
};
const FORMS = ["수업계획서 만들기 회원정리.xlsx", "수업계획서 만들기 회원정리 요일팀으로 작성.xlsx", "단계별 숙제.xlsx", "단계별 숙제 만들기 파일.xlsx", "한우리_수업도우미_사용안내.pptx"];
const errors = [];

for (const [file, ids] of Object.entries(PAGES)) {
  if (!existsSync(file)) { errors.push(`${file} 이 없어요.`); continue; }
  const html = readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
  scripts.forEach((m, i) => {
    if (/application\/json/.test(m[1])) {
      try {
        const c = JSON.parse(m[2]);
        if (!Array.isArray(c.courses) || !c.courses.length) errors.push(`${file}: 과정 목록이 비어 있어요.`);
        else console.log(`${file} 과정 목록: ${c.year}년 ${c.month}월, ${c.courses.length}개 과정`);
      } catch (e) { errors.push(`${file}: 과정 목록(JSON)을 읽을 수 없어요: ${e.message}`); }
    } else {
      try { new vm.Script(m[2], { filename: `${file}-script-${i}.js` }); }
      catch (e) { errors.push(`${file}: 스크립트 ${i}번 문법 오류: ${e.message}`); }
    }
  });
  for (const id of ids) if (!html.includes(`id="${id}"`)) errors.push(`${file}: 화면 요소 #${id} 가 없어요.`);
  for (const src of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g))
    if (!/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\//.test(src[1])) errors.push(`${file}: 알 수 없는 외부 스크립트: ${src[1]}`);
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: <title> 이 없어요.`);
}

// 피드백 표지 그림이 모두 있는지
const fb = existsSync("feedback.html") ? readFileSync("feedback.html", "utf8") : "";
const rep = fb.match(/window\.REPORTS=(\{[\s\S]*?\});?<\/script>/);
if (rep) {
  const reports = JSON.parse(rep[1]);
  const missing = new Set();
  for (const r of Object.values(reports)) for (const s of r.sessions || []) {
    const p = s.coverId ? `covers/a_${s.coverId}.jpg` : (s.cover ? `covers/${s.cover}` : "");
    if (p && !existsSync(p)) missing.add(p);
  }
  if (missing.size) errors.push(`표지 그림이 없어요: ${[...missing].slice(0, 5).join(", ")}${missing.size > 5 ? " 외 " + (missing.size - 5) + "개" : ""}`);
  else console.log(`피드백 활동리포트 ${Object.keys(reports).length}개, 표지 그림 모두 있음`);
} else errors.push("feedback.html 에서 활동리포트 자료를 찾지 못했어요.");

for (const f of FORMS) if (!existsSync("forms/" + f)) errors.push(`엑셀 양식이 없어요: forms/${f}`);

if (errors.length) { console.error("점검 실패:\n- " + errors.join("\n- ")); process.exit(1); }
console.log("점검 통과");
