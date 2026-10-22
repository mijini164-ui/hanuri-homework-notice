/* 피드백 탭: 반 공통 피드백 + 학생별 개인 피드백 → 학부모님께 보낼 완성본(문장·이미지).
   흐름: 반 고르기(pickClass) → 공통(#common) → 학생 고르기(selectStudent)·체크·직접 쓰기 → 합치기(compose) → 복사·이미지(savePng)
   활동리포트 자료는 data/reports.js, 표지 그림은 covers/ 에 있어요. 적은 내용은 이 기기 브라우저(localStorage 'fb_store_v2')에 남아요. */
const { esc, tell, onParent } = Suite;
const ITEMS=['필독서 이해','협동심','어휘력','토론능력','수업 참여도','발표','글쓰기'];
const LV=['상','중','하'];
/* 미리 만들어 둔 문장: 항목·단계마다 세 가지 표현. 학생마다 다른 표현이 먼저 나오고, '다른 표현으로'를 누르면 바뀌어요. */
const PH={
 '필독서 이해':{
  상:['필독서의 내용을 꼼꼼하게 이해하고, 작품 속 의미를 스스로 찾아내는 모습이 돋보였어요','책을 깊이 있게 읽고 중요한 장면의 의미를 정확하게 짚어 냈어요','필독서를 읽고 인물의 마음과 이야기의 주제를 잘 파악해 수업을 든든하게 이끌었어요'],
  중:['필독서의 흐름을 차근차근 따라가며 내용을 잘 이해해 가고 있어요','책의 중심 내용을 잡아 가며 이해의 폭을 조금씩 넓혀 가고 있어요','필독서를 성실하게 읽어 오며 내용을 정리하는 힘이 자라고 있어요'],
  하:['책을 조금 더 천천히 함께 읽어 가면 작품 속 의미를 스스로 찾아내는 힘이 크게 자랄 거예요','중요한 장면을 함께 짚어 가며 읽으면 책을 이해하는 힘이 금방 단단해질 거예요','필독서를 끝까지 읽는 경험이 쌓이면 책 읽는 재미와 이해력이 함께 자랄 거예요']},
 '협동심':{
  상:['친구들의 생각에 귀 기울이고 함께 활동을 이끌어 주어 수업 분위기가 한결 따뜻했어요','모둠 활동에서 친구들을 배려하며 함께 답을 찾아가는 모습이 멋졌어요','친구의 의견을 존중하며 협력하는 태도로 수업에 좋은 힘을 보태 주었어요'],
  중:['모둠 활동에서 친구들과 생각을 나누며 함께하는 즐거움을 알아 가고 있어요','친구들과 의견을 주고받으며 함께 활동하는 데 점점 익숙해지고 있어요','모둠 안에서 자기 역할을 찾아가며 협력하는 힘을 키워 가고 있어요'],
  하:['친구들과 생각을 주고받는 경험이 쌓이면 함께하는 힘이 더 단단해질 거예요','작은 모둠 활동부터 차근차근 함께하면 협력하는 즐거움을 금방 알게 될 거예요','친구의 이야기를 듣는 연습을 이어 가면 함께하는 힘이 쑥쑥 자랄 거예요']},
 '어휘력':{
  상:['글과 말에서 알맞은 낱말을 골라 쓰는 어휘력이 돋보였어요','새로 배운 낱말을 자기 표현에 자연스럽게 녹여 쓰는 모습이 인상적이었어요','풍부한 어휘로 생각을 정확하게 표현해 주었어요'],
  중:['새로 배운 낱말을 자기 글에 조금씩 넣어 보며 어휘를 넓혀 가고 있어요','낯선 낱말의 뜻을 찾아보며 어휘를 차곡차곡 쌓아 가고 있어요','책 속 낱말을 익히며 표현의 폭을 꾸준히 넓히고 있어요'],
  하:['책 속 새로운 낱말을 하나씩 익혀 가면 표현이 훨씬 풍부해질 거예요','모르는 낱말을 함께 찾아보는 습관이 쌓이면 어휘력이 눈에 띄게 자랄 거예요','하루에 한 낱말씩 익혀 가면 말과 글이 한층 풍성해질 거예요']},
 '토론능력':{
  상:['토론에서 근거를 들어 자기 주장을 또렷하게 펼쳐 주었어요','친구의 의견을 듣고 논리적으로 반론하는 모습이 돋보였어요','토론 주제에 대한 자기 생각을 분명한 이유와 함께 설득력 있게 말했어요'],
  중:['토론에서 자기 생각을 말하고 친구 의견에 답하는 연습을 꾸준히 이어 가고 있어요','주장과 근거를 연결해 말하는 힘이 조금씩 자라고 있어요','토론에 참여하며 자기 의견을 정리하는 데 점점 자신감이 붙고 있어요'],
  하:['토론은 아직 조금 낯설어하지만, 생각을 말로 꺼내는 연습을 이어 가면 가장 크게 자랄 수 있는 부분이에요','짧게라도 자기 생각을 말해 보는 경험이 쌓이면 토론이 훨씬 즐거워질 거예요','이유를 한 가지씩 붙여 말하는 연습을 이어 가면 토론하는 힘이 금방 자랄 거예요']},
 '수업 참여도':{
  상:['수업 내내 적극적으로 참여하며 즐겁게 활동했어요','질문에 먼저 손을 들고 활동에 열심히 참여해 수업에 활기를 더해 주었어요','배우려는 마음이 커서 모든 활동에 집중하며 즐겁게 참여했어요'],
  중:['수업 활동에 성실하게 참여하며 한 걸음씩 자신감을 키우고 있어요','주어진 활동을 차분히 해내며 수업에 꾸준히 참여하고 있어요','수업에 집중하는 시간이 점점 길어지며 참여하는 모습이 좋아지고 있어요'],
  하:['관심 있는 활동부터 조금씩 참여를 늘려 가면 수업이 더 즐거워질 거예요','작은 성공 경험이 쌓이면 수업에 참여하는 자신감도 함께 자랄 거예요','좋아하는 활동을 시작으로 참여를 넓혀 가면 수업 시간이 더 신나질 거예요']},
 '발표':{
  상:['발표할 때 자기 생각을 자신 있고 조리 있게 전해 주었어요','또렷한 목소리로 핵심을 잘 정리해 발표해 주었어요','발표 내용을 차근차근 정리해 친구들이 이해하기 쉽게 전해 주었어요'],
  중:['발표 시간에 자기 생각을 조금씩 더 자신 있게 말하는 모습을 보여 주고 있어요','발표할 내용을 미리 정리하며 말하는 힘을 키워 가고 있어요','발표 경험이 쌓이며 목소리에 점점 자신감이 묻어나고 있어요'],
  하:['짧은 발표부터 차근차근 경험을 쌓으면 자기 생각을 말하는 힘이 쑥쑥 자랄 거예요','한 문장 발표부터 시작해 칭찬을 받다 보면 발표가 금방 편안해질 거예요','발표할 내용을 함께 정리해 보는 연습을 이어 가면 자신감이 크게 자랄 거예요']},
 '글쓰기':{
  상:['생각을 글로 풀어내는 힘이 좋아 글쓰기 활동을 차분하게 완성했어요','자기 생각을 분명한 짜임으로 정리해 완성도 높은 글을 썼어요','글의 흐름이 자연스럽고 생각이 잘 드러나는 글을 써 주었어요'],
  중:['생각을 글로 정리하는 힘이 꾸준히 자라고 있어요','문장을 이어 가며 자기 생각을 글로 표현하는 데 점점 익숙해지고 있어요','글쓰기 활동을 끝까지 해내며 글의 짜임을 익혀 가고 있어요'],
  하:['생각을 한 문장씩 정리하는 연습을 이어 가면 글쓰기 실력이 눈에 띄게 늘 거예요','짧은 글부터 차근차근 써 보는 경험이 쌓이면 글쓰기가 훨씬 편해질 거예요','말로 한 생각을 글로 옮기는 연습을 이어 가면 글쓰기 힘이 크게 자랄 거예요']}
};
function nameSeed(name){let h=0;for(const c of String(name||''))h=(h*31+c.codePointAt(0))>>>0;return h}
const $=id=>document.getElementById(id);
let dl=null, reports={...(window.REPORTS||{})};
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* 저장: 반마다 공통 피드백, 학생마다 개인 피드백(체크·직접 쓴 말·고친 완성본). 이 기기 브라우저에만 남아요. */
const STORE_KEY='fb_store_v2';
const store=(()=>{try{const o=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');return {common:o.common||{},stu:o.stu||{},names:o.names||{}}}catch(e){return {common:{},stu:{},names:{}}}})();
let saveT=0;
function persist(){clearTimeout(saveT);saveT=setTimeout(()=>ls.set(STORE_KEY,JSON.stringify(store)),250)}

/* 지금 고른 반과 학생 */
let classes=[];      /* 반 명단에서 온 반: {label, names, rid, time} */
let cur={key:'',name:''};
const classKey=()=>{const c=classes[+$('cls').value];return ($('report').value||'')+'|'+(c&&$('cls').value!==''?c.label+'·'+c.names.join(','):'직접')};
function stuData(name){const k=cur.key;store.stu[k]=store.stu[k]||{};return store.stu[k][name]=store.stu[k][name]||{checks:{},memo:'',text:'',edited:false,variant:0}}
function hasPersonal(d){return !!(d&&(Object.keys(d.checks||{}).length||String(d.memo||'').trim()))}
const isTeamLabel=s=>/팀\d*(\(\d+명\))?$/.test(String(s).normalize('NFKC').replace(/\s+/g,''));
function namesOf(){const c=classes[+$('cls').value];const base=c&&$('cls').value!==''?c.names.filter(n=>!isTeamLabel(n)):[];return [...new Set(base.concat(store.names[cur.key]||[]))]}

/* 체크 UI */
function buildChecks(){
  $('checks').innerHTML=ITEMS.map((it,i)=>`<div class="ck"><span id="ck${i}">${it}</span><div class="seg" role="group" aria-labelledby="ck${i}">${LV.map(l=>`<button type="button" data-i="${it}" data-l="${l}" aria-pressed="false">${l}</button>`).join('')}</div></div>`).join('');
  $('checks').addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b||!cur.name)return;const d=stuData(cur.name),it=b.dataset.i,l=b.dataset.l;if(d.checks[it]===l)delete d.checks[it];else d.checks[it]=l;paintChecks();changed()});
}
function paintChecks(){const d=cur.name?stuData(cur.name):{checks:{}};document.querySelectorAll('#checks button[data-i]').forEach(b=>b.setAttribute('aria-pressed',d.checks[b.dataset.i]===b.dataset.l?'true':'false'))}

/* 리포트 이미지 HTML */
/* 차시 하나만 고르면 그 차시 카드와 그날 피드백만 들어가요 */
function fillScope(){
  const r=curReport(), prev=$('scope').value;
  const ss=(r&&r.sessions)||[];
  $('scope').innerHTML='<option value="">한 달 전체 (모든 차시)</option>'+ss.map((x,i)=>`<option value="${i}">${esc(x.no)}차시 · ${esc(x.book)}</option>`).join('');
  if(prev!==''&&+prev<ss.length)$('scope').value=prev;
}
function oneNo(){const r=curReport(),v=$('scope').value;return r&&v!==''&&r.sessions[+v]?r.sessions[+v].no:''}
function viewReport(r){const v=$('scope').value;if(!r||v===''||!r.sessions[+v])return r;return {...r,sessions:[r.sessions[+v]],_one:r.sessions[+v].no}}
function reportHTML(r,student,text){
  r=viewReport(r);
  const m=r.month?Number(r.month.split('-')[1]):0;
  const cards=(r.sessions||[]).map(s=>`<div class="card">${coverSrc(s)?`<img src="${esc(coverSrc(s))}" alt="">`:'<div class="noimg"></div>'}<div class="body">
    <span class="tag"><i>${esc(s.no)}차시</i>${esc(s.type)}</span><div class="book">${esc(s.book)}</div><div class="res">${esc(s.result)}</div>
    ${(s.competencies||[]).map(c=>`<span class="chip"># ${esc(c)}</span>`).join('')}
    ${s.curriculum?`<div class="meta">교과 연계 · ${esc(s.curriculum)}</div>`:''}</div></div>`).join('');
  const fb=!String(text||'').trim()?'':`<div class="fb"><h4><span>${esc(student||'○○○')}</span> 학생의 ${m?m+'월':'이번 달'}${r._one?' '+esc(r._one)+'차시':''} 수업 모습</h4><p class="msg">${esc(text)}</p></div>`;
  return `<div class="rp"><div class="top"><div><div class="lv">${esc(r.stageLabel||r.stage)}</div><h3>${r._one?'오늘은 이런 수업을':'이번 달 이런 수업을'}<br>했어요</h3></div><div class="mon"><b>${esc(r.period||(m+'월'))}${r._one?' · '+esc(r._one)+'차시':''}</b>${r.source==='수업계획안'?'수업 이야기':'활동리포트'}</div></div>${cards}${fb}</div>`;
}
function coverSrc(s){return s.coverId?'covers/a_'+s.coverId+'.jpg':(s.cover?'covers/'+s.cover:'')}
const CATS=['정규과정','몰입독서','초등특강','통사 특강','중등특강'];
function curReport(){return reports[$('report').value]}
function fillStages(){
  const prev=$('stage').value||ls.get('fb_stage');
  const by={}; Object.values(reports).forEach(r=>{(by[r.stage]=by[r.stage]||r)});
  const st=Object.values(by).sort((a,b)=>(a.order??99)-(b.order??99));
  if(!st.length){$('stage').innerHTML='<option value="">아직 등록된 반 자료가 없어요</option>';$('report').innerHTML='';return}
  $('stage').innerHTML=CATS.concat([...new Set(st.map(r=>r.category||'기타'))].filter(c=>!CATS.includes(c))).map(c=>{const g=st.filter(r=>(r.category||'기타')===c);return g.length?`<optgroup label="${esc(c)}">${g.map(r=>`<option value="${esc(r.stage)}">${esc(r.stageLabel||r.stage)}</option>`).join('')}</optgroup>`:''}).join('');
  if(prev&&by[prev])$('stage').value=prev;
  fillPeriods();
}
function fillPeriods(){
  const prev=$('report').value||ls.get('fb_report');
  const ids=Object.keys(reports).filter(id=>reports[id].stage===$('stage').value).sort((a,b)=>{const A=reports[a],B=reports[b];return (B.month||'').localeCompare(A.month||'')||(A.ho||0)-(B.ho||0)});
  $('report').innerHTML=ids.map(id=>`<option value="${esc(id)}">${esc(reports[id].period||reports[id].month)}${reports[id].month?' ('+reports[id].month.slice(0,4)+')':''}</option>`).join('');
  if(prev&&ids.includes(prev))$('report').value=prev;
  fillScope();
}
function render(){
  const r=curReport(); const box=$('preview');
  if(!r){box.innerHTML='<div class="empty" style="margin:16px">반이나 과정을 고르면 학부모님께 보낼 이미지가 여기에 보여요.</div>';$('previewBox').style.height='';return}
  box.innerHTML=reportHTML(r,cur.name,$('text').value.trim());
  fit();
}
function fit(){const rp=$('preview').querySelector('.rp');if(!rp)return;const w=$('previewBox').clientWidth;const s=Math.min(1,w/720);rp.style.transform=`scale(${s})`;$('previewBox').style.height=(rp.offsetHeight*s)+'px'}
addEventListener('resize',fit);

/* 인사말 */
const CLOSINGS=['책 읽는 사람이 세상을 이끌어 가요.','책 읽는 아이를 많이 응원해 주세요.','다음 달에도 따뜻한 응원 부탁드려요.','집에서도 오늘 읽은 책 이야기를 함께 나눠 주세요.','아이의 생각이 자라는 모습을 함께 지켜봐 주세요.','한 권 한 권 쌓이는 독서가 아이의 큰 힘이 될 거예요.','늘 믿고 보내 주셔서 감사합니다.','다음 수업에서 더 반짝이는 모습으로 만나요.'];
let myClosings=(()=>{try{return JSON.parse(localStorage.getItem('fb_my_closings')||'[]')}catch(e){return []}})();
let closing=(()=>{try{const v=localStorage.getItem('fb_closing');return v===null?CLOSINGS[0]:v}catch(e){return CLOSINGS[0]}})();
function buildClosings(){
  const all=CLOSINGS.concat(myClosings);
  $('clNow').textContent=closing||'없음';
  $('closings').innerHTML=all.map((c,i)=>`<button type="button" class="cl" data-c="${i}" aria-pressed="${c===closing}">${esc(c)}${i>=CLOSINGS.length?'<span class="x" data-del="'+(i-CLOSINGS.length)+'" title="지우기">✕</span>':''}</button>`).join('')+`<button type="button" class="cl" data-c="none" aria-pressed="${!closing}">인사말 없이</button>`;
}
function setClosing(c){
  closing=c; try{localStorage.setItem('fb_closing',c)}catch(e){}
  buildClosings(); changed();
}

/* 합치기: 공통 피드백 → 개인 피드백 → 인사말. 문단마다 한 줄 띄워 카톡에서도 읽기 편하게 해요. */
const endDot=s=>{s=String(s||'').trim();return !s||/[.!?~^)]$/.test(s)?s:s+'.'};
function commonDraft(detail){
  const r=viewReport(curReport()); if(!r) return '';
  const ss=r.sessions||[];
  if(r._one&&ss[0]) return `${r._one}차시에는 《${ss[0].book}》 책을 읽고 수업했어요. ${String(ss[0].result||'').trim()}`.trim();
  if(detail) return ss.map(x=>`${x.no}차시에는 《${x.book}》를 읽고 ${String(x.result||'').trim()}`).join('\n');
  const books=[...new Set(ss.map(x=>x.book))];
  return books.length?`이번 달에는 ${books.map(b=>'《'+b+'》').join(', ')} 책을 읽고 친구들과 생각을 나누었어요.`:'';
}
function personalText(name,d){
  const seed=nameSeed(name)+(d.variant||0);const parts=[];
  LV.forEach(l=>ITEMS.forEach((it,k)=>{if(d.checks[it]===l){const arr=PH[it][l];parts.push(arr[(seed+k)%arr.length])}}));
  const memo=String(d.memo||'').trim();
  let out='';
  if(parts.length){parts[0]=`${name?name+' 학생은':'우리 아이는'} ${parts[0]}`;out=parts.map(p=>p+'.').join(' ')}
  if(memo) out+=(out?' ':'')+endDot(memo);
  return out;
}
function compose(name){
  const d=name?stuData(name):{checks:{},memo:'',variant:0};
  const common=$('common').value.trim().replace(/\{\s*이름\s*\}/g,name||'우리 아이');
  const paras=[common,personalText(name,d)].map(endDot).filter(Boolean);
  if(!paras.length) return '';
  return paras.join('\n\n')+(closing?'\n\n'+closing:'');
}
function finalText(name){const d=stuData(name);return d.edited&&d.text.trim()?d.text:compose(name)}

/* 화면 다시 그리기 */
function changed(){
  if(cur.name){const d=stuData(cur.name);if(!d.edited){$('text').value=compose(cur.name);autoH()}}
  else {$('text').value=compose('');autoH()}
  $('editedNote').hidden=!(cur.name&&stuData(cur.name).edited);
  persist(); render(); drawChips(); drawAll();
}
function drawChips(){
  const ns=namesOf();
  $('chips').innerHTML=ns.length?ns.map(n=>{const d=(store.stu[cur.key]||{})[n];return `<button type="button" class="chip" data-n="${esc(n)}" aria-pressed="${n===cur.name}"><i class="dot${hasPersonal(d)||(d&&d.edited)?' on':''}"></i>${esc(n)}</button>`}).join(''):'<p class="hint">반 명단에 학생 이름이 없어요. 아래에 이름을 적어 추가해 주세요.</p>';
}
function drawAll(){
  const ns=namesOf();
  $('all').innerHTML=ns.length?ns.map(n=>{const d=(store.stu[cur.key]||{})[n];const t=finalText(n);const per=hasPersonal(d)||(d&&d.edited);
    return `<div class="row"><b>${esc(n)}<span class="tag${per?' ok':''}">${per?'개인 피드백 있음':'공통만'}</span></b><button type="button" class="btn small" data-copy="${esc(n)}">복사</button><p>${esc(t)||'아직 피드백이 없어요.'}</p></div>`}).join(''):'<p class="hint">학생을 추가하면 여기에 모두 모여요.</p>';
  $('copyAll').disabled=!ns.length;
}
function selectStudent(name){
  cur.name=name||'';
  $('stuBox').hidden=!cur.name;
  $('who').textContent=cur.name;
  if(cur.name){const d=stuData(cur.name);$('memo').value=d.memo||'';$('text').value=finalText(cur.name)}
  paintChecks(); autoH(); changed();
}
function loadClass(){
  cur.key=classKey();
  $('common').value=store.common[cur.key]??commonDraft(false);
  store.common[cur.key]=$('common').value;
  const c=classes[+$('cls').value];
  $('clsName').textContent=c&&$('cls').value!==''?c.label:($('stage').value||'');
  const ns=namesOf();
  selectStudent(ns.includes(cur.name)?cur.name:(ns[0]||''));
}

/* 이미지 저장 */
async function savePng(){
  const r=curReport(); if(!r){status('먼저 반이나 과정을 골라 주세요.',true);return}
  if(!window.html2canvas){status('이미지 도구를 불러오지 못했어요. 새로고침 후 다시 눌러 주세요.',true);return}
  status('이미지를 만들고 있어요…');
  const cap=$('capture'); cap.innerHTML=reportHTML(r,cur.name,$('text').value.trim());
  try{ await document.fonts.ready; await Promise.all([...cap.querySelectorAll('img')].map(i=>i.complete?0:new Promise(ok=>{i.onload=i.onerror=ok})));
    const canvas=await html2canvas(cap.firstElementChild,{scale:1.5,useCORS:true,backgroundColor:'#f6f1ea'});
    const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));
    const fn=`${r.stage}_${r.period||r.month}${oneNo()?'_'+oneNo()+'차시':''}_${cur.name||'반공통'}.png`.replace(/\s+/g,'');
    const url=await new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.readAsDataURL(blob)}); /* 카카오톡 등에서도 길게 눌러 저장되게 그림 자체를 넣어요 */
    const showImg=()=>{ $('preview').innerHTML=`<img src="${url}" alt="저장용 이미지" style="width:100%;display:block;-webkit-touch-callout:default">`; $('previewBox').style.height=''; $('previewBox').scrollIntoView({behavior:'smooth',block:'start'}); status('이미지를 길게 눌러(컴퓨터는 오른쪽 클릭) 저장해 주세요. 다시 고치면 미리보기로 돌아가요.'); };
    if(dl){ try{ await dl.save({filename:fn,data:blob}); status('이미지를 저장했어요.'); }catch(err){ if(err&&err.code==='declined'){status('저장을 취소했어요.')}else{showImg()} } }
    else { showImg(); }
  }catch(e){ status(e&&e.code==='declined'?'저장을 취소했어요.':'이미지를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.',true) }
  finally{ cap.innerHTML='' }
}
async function copyOut(t,okMsg){
  if(!String(t||'').trim()){status('복사할 문장이 아직 없어요.',true);return}
  try{await navigator.clipboard.writeText(t);status(okMsg)}catch(e){$('text').select();status('복사하지 못했어요. 완성본 칸을 길게 눌러 복사해 주세요.',true)}
}
function status(m,err){const s=$('status');s.textContent=m;s.classList.toggle('err',!!err)}
function grow(t,min){t.style.height='auto';t.style.height=Math.max(min,t.scrollHeight+4)+'px'}
function autoH(){grow($('text'),180);grow($('common'),96)}

/* 시작 */
buildChecks(); buildClosings();
$('common').addEventListener('input',()=>{store.common[cur.key]=$('common').value;changed()});
$('fillCommon').onclick=()=>{const t=commonDraft(true);if(!t){status('먼저 반이나 과정을 골라 주세요.',true);return}
  const c=$('common').value.trim();$('common').value=c&&!c.includes(t)?c+'\n'+t:t;store.common[cur.key]=$('common').value;changed();status('차시별 수업 내용을 넣었어요. 필요한 부분만 남기고 고쳐 주세요.')};
$('memo').addEventListener('input',()=>{grow($('memo'),96);if(!cur.name)return;stuData(cur.name).memo=$('memo').value;changed()});
$('text').addEventListener('input',()=>{autoH();if(!cur.name){render();return}const d=stuData(cur.name);d.text=$('text').value;d.edited=true;$('editedNote').hidden=false;persist();render();drawAll()});
$('gen').onclick=()=>{if(!cur.name)return;const d=stuData(cur.name);d.edited=false;d.text='';changed();status('공통 + 개인 피드백으로 다시 합쳤어요.')};
$('alt').onclick=()=>{if(!cur.name)return;const d=stuData(cur.name);if(!Object.keys(d.checks).length){status('체크한 항목이 있을 때 다른 표현으로 바꿀 수 있어요.',true);return}d.variant=(d.variant||0)+1;d.edited=false;changed()};
$('chips').addEventListener('click',e=>{const b=e.target.closest('[data-n]');if(b)selectStudent(b.dataset.n)});
function step(dir){const ns=namesOf();if(!ns.length)return;const i=ns.indexOf(cur.name);selectStudent(ns[(i+dir+ns.length)%ns.length]);$('stuBox').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);
function addName(){const n=$('student').value.trim();if(!n)return;const list=store.names[cur.key]=store.names[cur.key]||[];if(!namesOf().includes(n))list.push(n);$('student').value='';persist();selectStudent(n)}
$('addName').onclick=addName;$('student').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addName()}});
$('all').addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(b)copyOut(finalText(b.dataset.copy),b.dataset.copy+' 학생 완성본을 복사했어요. 카톡에 붙여 넣으면 돼요.')});
$('copyAll').onclick=()=>copyOut(namesOf().map(n=>`[${n}]\n${finalText(n)}`).join('\n\n──────────\n\n'),'반 전체 완성본을 복사했어요.');
$('copy').onclick=()=>copyOut($('text').value.trim(),'문장을 복사했어요. 카톡에 붙여 넣으면 돼요.');
$('png').onclick=savePng;
$('report').addEventListener('change',()=>{ls.set('fb_report',$('report').value);$('scope').value='';fillScope();loadClass()});
$('scope').addEventListener('change',()=>{render();status('범위를 바꿨어요. 공통 피드백의 \'수업 내용으로 채우기\'를 누르면 그 차시 내용이 들어가요.')});
$('stage').addEventListener('change',()=>{ls.set('fb_stage',$('stage').value);fillPeriods();loadClass()});
$('closings').addEventListener('click',e=>{
  const del=e.target.closest('[data-del]');
  if(del){const k=+del.dataset.del,c=myClosings[k];myClosings.splice(k,1);try{localStorage.setItem('fb_my_closings',JSON.stringify(myClosings))}catch(_){}if(c===closing)setClosing('');else buildClosings();return}
  const b=e.target.closest('.cl');if(!b)return;
  const all=CLOSINGS.concat(myClosings);setClosing(b.dataset.c==='none'?'':all[+b.dataset.c]);
});
function addMyClosing(){let c=$('myCl').value.trim();if(!c)return;if(!/[.!?~^)]$/.test(c))c+='.';if(!CLOSINGS.concat(myClosings).includes(c)){myClosings.push(c);try{localStorage.setItem('fb_my_closings',JSON.stringify(myClosings))}catch(_){}}$('myCl').value='';setClosing(c);status('내 인사말을 추가했어요. 이 기기에서 다음에도 쓸 수 있어요.')}
$('addCl').onclick=addMyClosing;$('myCl').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addMyClosing()}});
/* 미리보기의 피드백 칸을 누르면 고치는 칸으로 가요 */
$('preview').addEventListener('click',e=>{if(e.target.closest('.fb')){const t=$('text');t.scrollIntoView({behavior:'smooth',block:'center'});t.focus()}});
fillStages();

/* 반 명단: 다른 탭(또는 여기서) 올린 엑셀의 반·학생으로 고르기 */
const PREFIX=[[/^독서리더1$/,'reading1_'],[/^독서리더2$/,'reading2_'],[/^어휘리더1$/,'vocab1_'],[/^어휘리더2$/,'vocab2_'],[/^논리리더1$/,'logic1_'],[/^논리리더2$/,'logic2_'],
 [/^과학탐탐$/,'science_'],[/^세계문화/,'geo_'],[/^꿈꾸는새싹1$/,'saessak1_'],[/^꿈꾸는새싹2$/,'saessak2_'],[/^소크라테스1$/,'socrates1_'],[/^소크라테스2$/,'socrates2_'],[/^소크라테스3$/,'socrates3_']];
const SERIES=[[/^몰입독서([PABCDS])단계(\d+)호$/,(m)=>'md'+m[1]+'_ho'+m[2].padStart(2,'0')],[/^똑똑한국사통사(\d+)호$/,m=>'kor_tongsa_ho'+m[1].padStart(2,'0')],
 [/^세계사통사(\d+)호$/,m=>'world_tongsa_ho'+m[1].padStart(2,'0')],[/^한국사봄(\d+)호$/,m=>'kor_bom_ho'+m[1].padStart(2,'0')],[/^한국사람(\d+)호$/,m=>'kor_ram_ho'+m[1].padStart(2,'0')],
 [/^다다어휘(\d+)호$/,m=>'dada_ho'+m[1].padStart(2,'0')],[/^똑독해(\d+)호$/,m=>'ttokdok_ho'+m[1].padStart(2,'0')],[/^갈래별주제별문학독해(\d+)호$/,m=>'galrae_ho'+m[1].padStart(2,'0')],
 [/^교과문학탐독(\d+)호$/,m=>'tamdok_ho'+m[1].padStart(2,'0')]];
function reportFor(full,ym){
  const k=String(full||'').normalize('NFKC').replace(/\s+/g,'');
  for(const [re,f] of SERIES){const m=k.match(re);if(m&&reports[f(m)])return f(m)}
  for(const [re,p] of PREFIX){if(re.test(k)){if(ym&&reports[p+ym])return p+ym;const ids=Object.keys(reports).filter(id=>id.startsWith(p)).sort();return ids.pop()||''}}
  return '';
}
function pickClass(){
  const c=classes[+$('cls').value];
  if(c&&c.rid&&reports[c.rid]){$('stage').value=reports[c.rid].stage;fillPeriods();$('report').value=c.rid;$('scope').value='';fillScope();ls.set('fb_stage',$('stage').value);ls.set('fb_report',c.rid);$('manual').open=false}
  else if(c){$('manual').open=true;status(`${c.label} 과정의 활동리포트가 아직 없어요. '과정·월 직접 고르기'에서 골라 주세요.`,true)}
  ls.set('fb_cls',c?c.label+'·'+c.names.join(','):'');
  loadClass();
}
$('cls').addEventListener('change',pickClass);
window.__receiveClasses=function(list){
  classes=[];
  (list||[]).forEach(c=>c.courses.forEach((full,i)=>classes.push({label:String(c.stages[i]||full).normalize('NFKC'),names:c.names,time:c.time||'',rid:reportFor(full,(c.months||[])[i])})));
  if(!classes.length){$('clsWrap').hidden=true;$('manual').open=true;loadClass();return}
  $('cls').innerHTML='<option value="">반을 골라 주세요</option>'+classes.map((c,i)=>`<option value="${i}">${esc(c.label)} · ${esc(c.names.filter(n=>!isTeamLabel(n)).join(', ')||c.names.join(', '))}${c.time?' ('+esc(c.time)+')':''}</option>`).join('');
  $('clsWrap').hidden=false;$('drop').hidden=true;
  const prev=ls.get('fb_cls'),pi=classes.findIndex(c=>c.label+'·'+c.names.join(',')===prev);
  $('cls').value=pi>=0?String(pi):'0';
  pickClass();
};
/* 여기서 반 명단을 올리면 수업계획서 탭이 읽어서 반 목록을 돌려줘요 */
/* 첫 화면(index.html)을 거쳐 주고받아요: 올린 명단은 수업계획서 탭이 읽고, 반 목록(classes)을 돌려줘요 */
async function upload(f){if(!f)return;try{if(parent!==window){tell({type:'roster',buf:await f.arrayBuffer(),name:f.name});status('반 명단을 읽는 중이에요…')}else status('반 명단은 한우리 수업도우미 첫 화면에서 올려 주세요.',true)}catch(e){status('반 명단을 읽지 못했어요.',true)}}
onParent('classes',m=>{window.__receiveClasses(m.classes);status('반 명단을 불러왔어요.')});
$('file').addEventListener('change',()=>{upload($('file').files[0]);$('file').value=''});
['dragenter','dragover'].forEach(t=>$('drop').addEventListener(t,e=>{e.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(t=>$('drop').addEventListener(t,()=>$('drop').classList.remove('over')));
$('drop').addEventListener('drop',e=>{e.preventDefault();upload(e.dataTransfer.files[0])});
$('manual').open=true;loadClass();
tell({type:'hello'});

(async()=>{
  const c=window.claude; if(!c||!c.use) return;
  dl=await c.use('downloads');
})();
