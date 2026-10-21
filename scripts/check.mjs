// 올리기 전 점검: 스크립트 문법, 과정 목록(JSON), 꼭 있어야 하는 화면 요소, 외부 라이브러리 주소를 확인해요.
import { readFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync("index.html", "utf8");
const errors = [];
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => {
  if (/application\/json/.test(m[1])) {
    try { const c = JSON.parse(m[2]); if (!Array.isArray(c.courses) || !c.courses.length) errors.push("과정 목록이 비어 있어요."); else console.log(`과정 목록: ${c.year}년 ${c.month}월, ${c.courses.length}개 과정`); }
    catch (e) { errors.push("과정 목록(JSON)을 읽을 수 없어요: " + e.message); }
  } else {
    try { new vm.Script(m[2], { filename: `inline-script-${i}.js` }); }
    catch (e) { errors.push(`스크립트 ${i}번 문법 오류: ${e.message}`); }
  }
});
for (const id of ["fileRoster", "fileHw", "list", "savePdf", "savePng", "saveStatus", "catalog"])
  if (!html.includes(`id="${id}"`)) errors.push(`화면 요소 #${id} 가 없어요.`);
for (const src of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g))
  if (!/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\//.test(src[1]) && !/^[\w./-]+$/.test(src[1])) errors.push("알 수 없는 외부 스크립트: " + src[1]);
if (!/<title>[^<]+<\/title>/.test(html)) errors.push("<title> 이 없어요.");
if (errors.length) { console.error("점검 실패:\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`점검 통과: 스크립트 ${scripts.length}개 확인`);
