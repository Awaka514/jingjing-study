/* 应用主逻辑 */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const S = () => Store.get();
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const todayStr = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const fmtDate = d => d ? String(d).slice(0,10) : '';

let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ---------- 导航 ---------- */
const TITLES = { home:'鲸鲸学习', scores:'成绩', mistakes:'错题本', analysis:'分析', me:'我的' };
function go(page){
  $$('.page').forEach(p=>p.classList.remove('active'));
  $('#page-'+page).classList.add('active');
  $$('#tabbar .tab').forEach(t=>t.classList.toggle('active', t.dataset.page===page));
  $('#tb-title').textContent = TITLES[page];
  const act = $('#tb-actions'); act.innerHTML='';
  if(page==='home'){ act.innerHTML = '<button class="icon-btn" id="btn-theme2">☾</button>'; $('#btn-theme2').onclick=toggleTheme; }
  if(page==='scores'){ act.innerHTML = '<button class="icon-btn" id="btn-add-exam-top">＋</button>'; $('#btn-add-exam-top').onclick=()=>openExamModal(); }
  if(page==='mistakes'){ act.innerHTML = '<button class="icon-btn" id="btn-add-mistake-top">＋</button>'; $('#btn-add-mistake-top').onclick=()=>openMistakeModal(); }
  render(page);
  window.scrollTo(0,0);
}
function toggleTheme(){
  const s = S(); s.settings.theme = s.settings.theme==='dark'?'light':'dark';
  Store.applyTheme(s.settings.theme); Store.save(); render('home');
}

/* ---------- 工具 ---------- */
function fileToBlob(file, maxDim=1280, q=0.72){
  return new Promise((res,rej)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      let w=img.width,h=img.height; const sc=Math.min(1,maxDim/Math.max(w,h));
      w=Math.round(w*sc);h=Math.round(h*sc);
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>{URL.revokeObjectURL(url);res(b);},'image/jpeg',q);
    };
    img.onerror=rej; img.src=url;
  });
}
function pickPhoto(){
  return new Promise(res=>{
    const inp = $('#photo-input');
    inp.value='';
    inp.onchange = async ()=>{
      const f = inp.files[0]; if(!f){ res(null); return; }
      const blob = await fileToBlob(f);
      const id = Store.uid();
      await Store.putImage(blob, id);
      res(id);
    };
    inp.click();
  });
}
async function photoUrl(id){ return Store.imageUrl(id); }

/* ---------- 模态 ---------- */
function openModal(title, bodyHtml){
  $('#modal-box').innerHTML = `<div class="modal-title"><span>${esc(title)}</span><button class="modal-close" onclick="closeModal()">✕</button></div>` + bodyHtml;
  $('#modal-root').hidden = false;
}
function closeModal(){ $('#modal-root').hidden = true; $('#modal-box').innerHTML=''; }
$('#modal-root .modal-mask')?.addEventListener('click', closeModal);

/* ================= 渲染总入口 ================= */
function render(page){
  if(page==='home'||!page) renderHome();
  if(page==='scores') renderScores();
  if(page==='mistakes') renderMistakes();
  if(page==='analysis') renderAnalysis();
  if(page==='me') renderMe();
}

/* ================= 首页 ================= */
function renderHome(){
  const s = S();
  const h = new Date().getHours();
  const greet = h<6?'夜深了':h<12?'早上好':h<18?'下午好':'晚上好';
  $('#home-greet').textContent = `${greet}，${s.profile.name||'同学'}`;
  // 倒计时
  const d = s.profile.examDate;
  let cd = '设置下次考试后显示倒计时';
  if(d){
    const days = Math.ceil((new Date(d+'T00:00') - new Date())/86400000);
    if(days>0) cd = `${s.profile.examName||'考试'} · 还有 <b>${days}</b> 天`;
    else if(days===0) cd = `今天是${s.profile.examName||'考试'}，加油！`;
    else cd = `${s.profile.examName||'考试'}已结束`;
  }
  $('#home-countdown').innerHTML = cd;
  // chips
  const dueCount = s.mistakes.filter(Gen.dueToday).length;
  const chips = [
    `考试 ${s.exams.length} 次`, `错题 ${s.mistakes.length} 道`,
    dueCount?`待复习 ${dueCount} 道`:`今日复习 ✅`
  ];
  $('#home-chips').innerHTML = chips.map(c=>`<span class="hero-chip">${esc(c)}</span>`).join('');
  // 今日任务
  $('#home-today-body').innerHTML = todayBody(s);
  // 最近考试
  const exs = [...s.exams].sort((a,b)=>b.date.localeCompare(a.date));
  if(exs[0]){ 
    $('#home-last-exam').textContent = exs[0].name||'考试';
    const total = examTotal(exs[0]);
    $('#home-last-sub').textContent = `${fmtDate(exs[0].date)} · 总分 ${total.total}` + (exs[0].entries && total.rank ? ` · 班级第${total.rank}`:'');
  } else { $('#home-last-exam').textContent='暂无'; $('#home-last-sub').textContent='点击添加一次成绩'; }
  // 本周复习
  const wk = new Date(); wk.setDate(wk.getDate()-7);
  const weekly = s.mistakes.filter(m=>m.lastReview && m.lastReview>=wk.getTime()).length;
  $('#home-review-count').textContent = weekly;
  // 成绩走势
  const totalSeries = exs.slice().reverse().map(e=>{ const t=examTotal(e); return t.total>0?t.total:null; });
  const labels = exs.slice().reverse().map(e=>fmtDate(e.date).slice(5));
  Charts.line($('#home-chart'), { series:[{name:'总分', color:'var(--accent)', points:totalSeries}], labels, unit:'' });
  // 快捷操作
  $('#home-quick').innerHTML = [
    ['📸','录错题', ()=>openMistakeModal()],
    ['📝','记成绩', ()=>openExamModal()],
    ['🧠','举一反三', ()=>{go('mistakes');switchSeg('mistakes','practice');}],
    ['📊','数据分析', ()=>go('analysis')],
  ].map(a=>`<div class="quick-item" data-i="${a[0]}"><div class="quick-ic">${a[0]}</div>${a[1]}</div>`).join('');
  $$('#home-quick .quick-item').forEach((el,i)=>{
    el.onclick = [ ()=>openMistakeModal(), ()=>openExamModal(), ()=>{go('mistakes');switchSeg('mistakes','practice');}, ()=>go('analysis') ][i];
  });
  // 主题按钮同步
  $('#btn-theme').textContent = s.settings.theme==='dark'?'☀':'☾';
}
function todayBody(s){
  const due = s.mistakes.filter(Gen.dueToday);
  if(!s.mistakes.length) return '<div class="empty" style="padding:20px"><div class="big">🎯</div>还没有错题，记录第一道错题开始进步吧</div>';
  if(!due.length) return '<div class="empty" style="padding:16px"><div class="big">🎉</div>今天没有待复习的错题，太棒了</div>';
  return `<div style="font-size:14px">有 <b style="color:var(--accent)">${due.length}</b> 道错题到了复习时间点，巩固记忆效果最好。</div>
    <button class="btn primary block" style="margin-top:10px" onclick="go('mistakes');switchSeg('mistakes','review')">开始复习 ›</button>`;
}

/* ================= 成绩 ================= */
function examTotal(e){
  const s = S();
  let total=0, full=0, rank=null, fullTotal=0;
  for(const sub of s.subjects){
    const en = e.entries && e.entries[sub.id];
    if(en && en.score){ total += Number(en.score); full += Number(en.full||0); if(en.classRank) rank=en.classRank; }
  }
  if(s.profile.targetTotal) fullTotal = Number(s.profile.targetTotal);
  return { total, full, rank, fullTotal };
}
function subjectSeries(subId){
  const s = S();
  const exs = [...s.exams].sort((a,b)=>a.date.localeCompare(b.date));
  return exs.map(e=>{ const en=e.entries&&e.entries[subId]; return en&&en.score?Number(en.score):null; });
}
function subjectAvg(subId){
  const v = subjectSeries(subId).filter(x=>x!=null);
  if(!v.length) return null;
  return v.reduce((a,b)=>a+b,0)/v.length;
}
function subjectTrend(subId){
  const v = subjectSeries(subId).filter(x=>x!=null);
  if(v.length<2) return 'flat';
  const a=v[v.length-1], b=v[v.length-2];
  return a>b?'up':a<b?'down':'flat';
}

function renderScores(){
  const s = S();
  const seg = $('#scores-seg'); if(!seg.dataset.bound){
    seg.dataset.bound=1; seg.onclick=e=>{ const b=e.target.closest('.seg-btn'); if(b) switchSeg('scores', b.dataset.v); };
  }
  renderScoresOverview();
  renderScoresList();
}
function switchSeg(page, v){
  $(`#${page}-seg`)?.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active', b.dataset.v===v));
  $(`#${page}-seg`)?.parentElement && $$(`#page-${page} .subpage`).forEach(p=>p.classList.toggle('active', p.id===`${page}-${v}`));
  if(page==='mistakes') renderMistakes();
  if(page==='scores'){ renderScoresOverview(); renderScoresList(); }
}

function renderScoresOverview(){
  const s = S();
  const exs = [...s.exams].sort((a,b)=>a.date.localeCompare(b.date));
  const labels = exs.map(e=>fmtDate(e.date).slice(5));
  const totalPts = exs.map(e=>{const t=examTotal(e);return t.total>0?t.total:null;});
  const rankPts = exs.map(e=>{const t=examTotal(e);return t.rank||null;});
  Charts.line($('#scores-total-chart'), { series:[
    {name:'总分', color:'var(--accent)', points:totalPts},
    {name:'班级排名', color:'var(--warn)', points:rankPts.length?rankPts:[]},
  ], labels, unit:'' });
  // 科目选择
  const pick = $('#scores-subject-pick');
  const cur = pick.dataset.cur || s.subjects[0]?.id;
  pick.dataset.cur = cur;
  pick.innerHTML = s.subjects.map(sub=>`<button class="chip ${sub.id===cur?'active':''}" data-id="${sub.id}">${esc(sub.name)}</button>`).join('');
  pick.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ pick.dataset.cur=c.dataset.id; renderScoresOverview(); });
  const sub = s.subjects.find(x=>x.id===cur) || s.subjects[0];
  if(sub){ Charts.line($('#scores-subject-chart'), { series:[{name:sub.name, color:sub.color, points:subjectSeries(sub.id)}], labels, unit:'分' }); }
  // 各科现状
  $('#scores-subject-cards').innerHTML = s.subjects.map(sub=>{
    const avg = subjectAvg(sub.id), tr = subjectTrend(sub.id);
    const tgt = s.targets[sub.id];
    return `<div class="subj-card"><span class="subj-dot" style="background:${sub.color}"></span>
      <span class="subj-name">${esc(sub.name)}</span>
      <span class="subj-metrics"><div class="subj-score">${avg!=null?avg.toFixed(1):'—'}</div>
      <div class="subj-trend ${tr}">${tr==='up'?'↗ 进步':tr==='down'?'↘ 下滑':'— 稳定'}${tgt?` · 目标${tgt}`:''}</div></span></div>`;
  }).join('') || '<div class="empty"><div class="big">📚</div>先添加成绩，这里会出现各科分析</div>';
}

function renderScoresList(){
  const s = S();
  const exs = [...s.exams].sort((a,b)=>b.date.localeCompare(a.date));
  if(!exs.length){ $('#exam-list').innerHTML = '<div class="empty"><div class="big">📝</div>还没有考试记录<br>点上方按钮，导入一次成绩或答题卡</div>'; return; }
  $('#exam-list').innerHTML = exs.map(e=>examItemHTML(e)).join('');
  $('#exam-list').querySelectorAll('[data-act]').forEach(el=>{
    el.onclick = ()=>{ const id=el.dataset.id, act=el.dataset.act; if(act==='edit') openExamModal(s.exams.find(x=>x.id===id)); if(act==='del') delExam(id); };
  });
  $('#exam-list').querySelectorAll('[data-thumb]').forEach(el=>{ el.onclick=()=>previewPhoto(el.dataset.thumb); });
  $('#exam-list').querySelectorAll('img[data-thumb]').forEach(el=>{ photoUrl(el.dataset.thumb).then(u=>{ if(u) el.src=u; }); });
}
function examItemHTML(e){
  const t = examTotal(e);
  const rows = S().subjects.map(sub=>{ const en=e.entries&&e.entries[sub.id]; return en&&en.score!=null?`<div class="exam-row"><span class="k">${esc(sub.name)}</span><span class="v">${en.score}${en.full?'/'+en.full:''}</span></div>`:''; }).join('');
  const ph = e.photos && e.photos.length? `<div class="thumb-grid">${e.photos.map(p=>`<img src="#" data-thumb="${p}">`).join('')}</div>`:'';
  return `<div class="exam-item">
    <div class="exam-top"><div class="exam-name">${esc(e.name||'考试')}</div><div class="exam-date">${fmtDate(e.date)}</div></div>
    <div class="exam-total">${t.total>0?t.total+' 分':'—'}</div>
    <div class="exam-sub">${t.rank?`班级第 ${t.rank} 名 · `:''}共 ${rows?S().subjects.length:'0'} 科${e.note?' · '+esc(e.note):''}</div>
    ${rows?`<div style="margin-top:8px">${rows}</div>`:''}
    ${ph}
    <div class="exam-actions">
      <button class="btn sm" data-act="edit" data-id="${e.id}">编辑</button>
      <button class="btn sm danger" data-act="del" data-id="${e.id}">删除</button>
    </div></div>`;
}
function delExam(id){
  const s = S(); s.exams = s.exams.filter(e=>e.id!==id); Store.save(); renderScores();
}
async function previewPhoto(id){
  const url = await photoUrl(id);
  if(!url){ toast('图片读取失败'); return; }
  openModal('答题卡', `<img src="${url}" class="thumb">`);
}

/* ---- 考试/成绩 表单 ---- */
function openExamModal(exam){
  const s = S();
  exam = exam || { name:s.profile.examName||'', date:todayStr(), entries:{}, photos:[], note:'' };
  let tmpPhotos = [...(exam.photos||[])];
  const rows = s.subjects.map(sub=>{
    const en = exam.entries[sub.id]||{};
    return `<div class="field-row">
      <label class="field"><span>${esc(sub.name)} 得分</span><input data-subj="${sub.id}" data-k="score" type="number" inputmode="decimal" value="${en.score??''}" placeholder="得分"></label>
      <label class="field"><span>满分</span><input data-subj="${sub.id}" data-k="full" type="number" inputmode="decimal" value="${en.full??''}" placeholder="满分"></label>
    </div>`;
  }).join('');
  openModal(exam.id?'编辑成绩':'添加成绩 / 导入', `
    <label class="field"><span>考试名称</span><input id="f-name" value="${esc(exam.name)}" placeholder="如：期中考试 / 数学周测"></label>
    <label class="field"><span>日期</span><input id="f-date" type="date" value="${fmtDate(exam.date)}"></label>
    ${rows}
    <div class="field-row">
      <label class="field"><span>班级排名</span><input id="f-crank" type="number" inputmode="numeric" value="${exam.classRank??''}" placeholder="选填"></label>
      <label class="field"><span>年级排名</span><input id="f-grank" type="number" inputmode="numeric" value="${exam.gradeRank??''}" placeholder="选填"></label>
    </div>
    <label class="field"><span>备注</span><input id="f-note" value="${esc(exam.note||'')}" placeholder="选填"></label>
    <div class="field"><span>答题卡 / 卷子照片</span>
      <div class="thumb-grid" id="f-thumbs">${tmpPhotos.map(p=>`<img data-p="${p}" src="">`).join('')}</div>
      <button class="btn ghost sm" id="f-add-photo">＋ 拍照 / 相册添加</button>
    </div>
    <button class="btn primary block" id="f-save">保存</button>`);
  tmpPhotos.forEach(p=>photoUrl(p).then(u=>{ const im=$(`#f-thumbs img[data-p="${p}"]`); if(im&&u)im.src=u; }));
  $('#f-add-photo').onclick = async ()=>{ const id=await pickPhoto(); if(id){ tmpPhotos.push(id); const g=document.createElement('img'); g.dataset.p=id; const u=await photoUrl(id); g.src=u; $('#f-thumbs').appendChild(g);} };
  $('#f-save').onclick = ()=>{
    const name = $('#f-name').value.trim() || '考试';
    const date = $('#f-date').value || todayStr();
    const entries = {};
    s.subjects.forEach(sub=>{
      const score = $(`input[data-subj="${sub.id}"][data-k="score"]`).value;
      const full = $(`input[data-subj="${sub.id}"][data-k="full"]`).value;
      if(score!=='') entries[sub.id] = { score:Number(score), full:full?Number(full):'', avg:'', classRank:'', gradeRank:'' };
    });
    const crank = $('#f-crank').value, grank = $('#f-grank').value;
    // 排名写入每科（简化）
    if(crank) Object.values(entries).forEach(e=>e.classRank=Number(crank));
    if(grank) Object.values(entries).forEach(e=>e.gradeRank=Number(grank));
    const data = { name, date, entries, photos:tmpPhotos, note:$('#f-note').value.trim() };
    if(exam.id){ Object.assign(exam, data); } else { exam.id=Store.uid(); data.id=exam.id; s.exams.push(data); }
    Store.save(); closeModal(); render('scores'); toast('已保存');
  };
}

/* ================= 错题 ================= */
function renderMistakes(){
  const s = S();
  const seg = $('#mistakes-seg'); if(!seg.dataset.bound){
    seg.dataset.bound=1; seg.onclick=e=>{ const b=e.target.closest('.seg-btn'); if(b) switchSeg('mistakes', b.dataset.v); };
  }
  renderMistakeBook(); renderPractice(); renderReview();
  const due = s.mistakes.filter(Gen.dueToday).length;
  $('#review-dot').hidden = due===0;
}
function renderMistakeBook(){
  const s = S();
  const f = $('#mistake-filters');
  const cur = f.dataset.cur || 'all';
  f.dataset.cur = cur;
  const chips = [{id:'all',name:'全部'}].concat(s.subjects.map(x=>({id:x.id,name:x.name})));
  f.innerHTML = chips.map(c=>`<button class="chip ${c.id===cur?'active':''}" data-id="${c.id}">${esc(c.name)}</button>`).join('');
  f.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ f.dataset.cur=c.dataset.id; renderMistakeBook(); });
  let list = [...s.mistakes].sort((a,b)=>(b.created||0)-(a.created||0));
  if(cur!=='all') list = list.filter(m=>m.subjectId===cur);
  if(!list.length){ $('#mistake-list').innerHTML = '<div class="empty"><div class="big">✏️</div>还没有错题<br>点右下角 ＋，拍下题目或手动录入</div>'; return; }
  $('#mistake-list').innerHTML = list.map(m=>mistakeHTML(m)).join('');
  $('#mistake-list').querySelectorAll('[data-act]').forEach(el=>{
    el.onclick = ()=>{ const id=el.dataset.id, act=el.dataset.act;
      const m=s.mistakes.find(x=>x.id===id);
      if(act==='edit') openMistakeModal(m);
      if(act==='del'){ s.mistakes=s.mistakes.filter(x=>x.id!==id); Store.save(); renderMistakes(); }
      if(act==='view') previewPhoto(m.photoId);
    };
  });
  $('#mistake-list').querySelectorAll('img[data-act="view"]').forEach(el=>{ const m=s.mistakes.find(x=>x.id===el.dataset.id); if(m&&m.photoId) photoUrl(m.photoId).then(u=>{ if(u) el.src=u; }); });
}
function subjectName(id){ const x=S().subjects.find(s=>s.id===id); return x?x.name:'未分科'; }
function mistakeHTML(m){
  const ph = m.photoId?`<img src="#" class="thumb" data-act="view" data-id="${m.id}" style="cursor:pointer;max-height:160px;object-fit:cover">`:'';
  return `<div class="mistake-item">
    <div><span class="mistake-tag">${esc(subjectName(m.subjectId))}</span>${m.type?`<span class="mistake-tag type">${esc(m.type)}</span>`:''}${m.done?'<span class="mistake-tag" style="background:color-mix(in srgb,var(--good) 14%,transparent);color:var(--good)">已掌握</span>':''}</div>
    ${m.knowledge?`<div style="font-size:12.5px;color:var(--ink3);margin-top:6px">知识点：${esc(m.knowledge)}</div>`:''}
    ${m.question?`<div class="mistake-q">${esc(m.question)}</div>`:''}
    ${m.wrong?`<div class="mistake-ans">我的答案：<span style="color:var(--bad)">${esc(m.wrong)}</span></div>`:''}
    ${m.right?`<div class="mistake-ans">正确答案：<b>${esc(m.right)}</b></div>`:''}
    ${m.analysis?`<div class="mistake-ans" style="margin-top:4px">解析：${esc(m.analysis)}</div>`:''}
    ${ph}
    <div class="mistake-actions">
      <button class="btn sm" data-act="edit" data-id="${m.id}">订正/编辑</button>
      <button class="btn sm danger" data-act="del" data-id="${m.id}">删除</button>
    </div></div>`;
}
function openMistakeModal(mistake){
  const s = S();
  mistake = mistake || { subjectId:s.subjects[0]?.id, examId:'', type:'', knowledge:'', question:'', photoId:'', wrong:'', right:'', analysis:'' };
  let tmpPhoto = mistake.photoId||'';
  const subjOpts = s.subjects.map(x=>`<option value="${x.id}" ${x.id===mistake.subjectId?'selected':''}>${esc(x.name)}</option>`).join('');
  const examOpts = `<option value="">不关联</option>` + [...s.exams].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<option value="${e.id}" ${e.id===mistake.examId?'selected':''}>${esc(e.name)} (${fmtDate(e.date)})</option>`).join('');
  openModal(mistake.id?'订正错题':'记录错题', `
    <div class="field-row">
      <label class="field"><span>科目</span><select id="m-subject">${subjOpts}</select></label>
      <label class="field"><span>关联考试</span><select id="m-exam">${examOpts}</select></label>
    </div>
    <div class="field-row">
      <label class="field"><span>题型</span><input id="m-type" value="${esc(mistake.type||'')}" placeholder="选择/填空/大题"></label>
      <label class="field"><span>知识点</span><input id="m-knowledge" value="${esc(mistake.knowledge||'')}" placeholder="如：一元二次方程"></label>
    </div>
    <label class="field"><span>题目（可简述）</span><textarea id="m-q" placeholder="抄题或简述题目">${esc(mistake.question||'')}</textarea></label>
    <div class="field-row">
      <label class="field"><span>我的（错误）答案</span><input id="m-wrong" value="${esc(mistake.wrong||'')}"></label>
      <label class="field"><span>正确答案</span><input id="m-right" value="${esc(mistake.right||'')}"></label>
    </div>
    <label class="field"><span>错因 / 解析</span><textarea id="m-analysis" placeholder="为什么错？正确思路是什么？">${esc(mistake.analysis||'')}</textarea></label>
    <div class="field"><span>题目照片</span>
      <div id="m-thumb">${tmpPhoto?'<img src="" id="m-thumb-img" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover">':''}</div>
      <button class="btn ghost sm" id="m-add-photo">＋ 拍照添加题目</button>
    </div>
    <button class="btn primary block" id="m-save">保存并排入复习</button>`);
  if(tmpPhoto) photoUrl(tmpPhoto).then(u=>{ const im=$('#m-thumb-img'); if(im)im.src=u; });
  $('#m-add-photo').onclick = async ()=>{ const id=await pickPhoto(); if(id){ tmpPhoto=id; $('#m-thumb').innerHTML='<img src="" id="m-thumb-img" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover">'; photoUrl(id).then(u=>$('#m-thumb-img').src=u);} };
  $('#m-save').onclick = ()=>{
    const data = {
      subjectId:$('#m-subject').value, examId:$('#m-exam').value,
      type:$('#m-type').value.trim(), knowledge:$('#m-knowledge').value.trim(),
      question:$('#m-q').value.trim(), photoId:tmpPhoto,
      wrong:$('#m-wrong').value.trim(), right:$('#m-right').value.trim(),
      analysis:$('#m-analysis').value.trim()
    };
    if(!data.right && !data.question){ toast('至少填写题目或正确答案'); return; }
    if(mistake.id){ Object.assign(mistake, data); }
    else { data.id=Store.uid(); data.created=Date.now(); data.stage=0; const sc=Gen.schedule(0); data.nextDue=sc.nextDue; data.done=false; s.mistakes.push(data); }
    Store.save(); closeModal(); renderMistakes(); toast('已保存，已排入复习计划');
  };
}

/* ---- 举一反三 ---- */
function renderPractice(){
  const s = S();
  const tip = $('#practice-tip'); if(tip) tip.textContent = '';
  $('#practice-gen-list').innerHTML = Gen.all().map(t=>`<button class="btn sm" style="margin:4px" data-gen="${t.id}">${esc(t.name)}</button>`).join('');
  $('#practice-gen-list').querySelectorAll('[data-gen]').forEach(b=>b.onclick=()=>startPractice(b.dataset.gen));
  // 按错题知识点推荐
  const kws = s.mistakes.filter(m=>m.knowledge).map(m=>m.knowledge);
  if(kws.length){
    const map = {};
    kws.forEach(k=>{ const gid=Gen.matchByKnowledge(k); if(gid) map[gid]=(map[gid]||0)+1; });
    const top = Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
    if(top){ const t=Gen.byId(top[0]); const tip=$('#practice-tip'); if(tip) tip.textContent = `根据你的错题，建议先练「${t.name}」`; }
  }
}
let curPractice = null;
function startPractice(typeId){
  const t = Gen.byId(typeId);
  if(!t) return;
  newPractice(typeId);
  $('#practice-area').hidden = false;
  $('#practice-area').scrollIntoView({behavior:'smooth'});
}
function newPractice(typeId){
  const t = Gen.byId(typeId);
  const p = t.gen();
  curPractice = { typeId, p, t };
  $('#practice-area').innerHTML = `
    <div class="pq" style="white-space:nowrap;overflow-x:auto">${p.q}</div>
    ${p.reveal?'':'<input class="panswer" id="pa-input" type="text" inputmode="text" placeholder="输入答案">'}
    <div class="presult" id="pa-result"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${p.reveal?'':`<button class="btn primary sm" id="pa-check">检查</button>`}
      <button class="btn sm" id="pa-hint">提示</button>
      <button class="btn sm" id="pa-answer">看答案</button>
      <button class="btn sm" id="pa-next">换一题</button>
    </div>`;
  if(!p.reveal){ $('#pa-check').onclick=checkPractice; $('#pa-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkPractice();}); }
  $('#pa-hint').onclick=()=>{$('#pa-result').innerHTML=`💡 ${esc(p.hint)}`; $('#pa-result').style.color='var(--ink2)';};
  $('#pa-answer').onclick=()=>{$('#pa-result').innerHTML=`答案：<b>${esc(p.a)}</b>`; $('#pa-result').style.color='var(--good)';};
  $('#pa-next').onclick=()=>newPractice(typeId);
}
function checkPractice(){
  const { p } = curPractice;
  const input = $('#pa-input').value.trim();
  if(!input){ toast('先输入答案'); return; }
  const ok = normAns(input)===normAns(String(p.num!==undefined?p.num:p.a));
  $('#pa-result').innerHTML = ok? '✅ 答对了，真棒！' : '❌ 再看看，可点「提示」或「看答案」';
  $('#pa-result').style.color = ok?'var(--good)':'var(--bad)';
}
function normAns(s){
  return String(s).toLowerCase()
    .replace(/[xXｘ＝=，,；;、\s]/g,'')
    .replace(/[{}（）()]/g,'')
    .replace(/≥|＞|≧/g,'>')
    .replace(/≤|＜|≦/g,'<')
    .replace(/或|或者|∪/g,'或')
    .replace(/且|∩/g,'且');
}
$('#btn-practice-random').addEventListener('click', ()=>startPractice(pickOne(Gen.all().map(t=>t.id))));
function pickOne(a){ return a[Math.floor(Math.random()*a.length)]; }

/* ---- 待复习 ---- */
function renderReview(){
  const s = S();
  const due = s.mistakes.filter(Gen.dueToday).sort((a,b)=>(a.nextDue||0)-(b.nextDue||0));
  if(!due.length){ $('#review-queue').innerHTML='<div class="empty"><div class="big">🌙</div>当前没有到期的错题<br>新订正的错题会按遗忘曲线自动排期</div>'; return; }
  $('#review-queue').innerHTML = due.map(m=>`
    <div class="mistake-item" id="rv-${m.id}">
      <div><span class="mistake-tag">${esc(subjectName(m.subjectId))}</span>${m.type?`<span class="mistake-tag type">${esc(m.type)}</span>`:''}<span class="mistake-tag" style="background:color-mix(in srgb,var(--ink3) 12%,transparent);color:var(--ink3)">第${m.stage+1}轮</span></div>
      ${m.question?`<div class="mistake-q">${esc(m.question)}</div>`:''}
      <div class="presult" id="rv-res-${m.id}" hidden></div>
      <div class="mistake-actions">
        <button class="btn sm" data-rv="answer" data-id="${m.id}">显示答案</button>
        <button class="btn sm" data-rv="ok" data-id="${m.id}" style="color:var(--good)">答对了</button>
        <button class="btn sm" data-rv="no" data-id="${m.id}" style="color:var(--bad)">答错了</button>
      </div>
    </div>`).join('');
  $('#review-queue').querySelectorAll('[data-rv]').forEach(el=>{
    el.onclick=()=>{
      const id=el.dataset.id, act=el.dataset.rv;
      const m=s.mistakes.find(x=>x.id===id);
      const res=$('#rv-res-'+id);
      if(act==='answer'){ res.hidden=false; res.style.color='var(--good)'; res.innerHTML=`答案：<b>${esc(m.right||'（未填写）')}</b>${m.analysis?'<br><span style="font-size:13px;color:var(--ink2)">解析：'+esc(m.analysis)+'</span>':''}`; }
      else { const ok = act==='ok'; const nm=Gen.onReview(m,ok); Object.assign(m,nm); Store.save(); renderReview(); toast(ok?'已进阶':'已重排，下次再练'); }
    };
  });
}

/* ================= 分析 ================= */
function renderAnalysis(){
  const s = S();
  // 提分点
  const points = buildGainPoints(s);
  $('#gain-points').innerHTML = points.length? points.map((p,i)=>`
    <div class="gain-item">
      <div class="gain-rank ${i===0?'r':i<3?'g':''}">${i+1}</div>
      <div class="gain-body"><div class="gain-title">${esc(p.title)}</div><div class="gain-desc">${esc(p.desc)}</div></div>
    </div>`).join('') : '<div class="empty"><div class="big">✨</div>录入几次成绩和错题后，这里会自动给出提分建议</div>';
  // 常错题型
  const pick = $('#analysis-type-pick');
  const cur = pick.dataset.cur || (s.subjects.find(x=>s.mistakes.some(m=>m.subjectId===x.id))?.id || s.subjects[0]?.id);
  pick.dataset.cur = cur;
  pick.innerHTML = s.subjects.map(x=>`<button class="chip ${x.id===cur?'active':''}" data-id="${x.id}">${esc(x.name)}</button>`).join('');
  pick.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ pick.dataset.cur=c.dataset.id; renderAnalysis(); });
  const types = {};
  s.mistakes.filter(m=>m.subjectId===cur).forEach(m=>{
    const k = m.type || m.knowledge || '未分类';
    types[k] = (types[k]||0)+1;
  });
  const items = Object.entries(types).map(([k,v],i)=>({label:k, value:v, color:['#4f6ef7','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'][i%8]}));
  Charts.donut($('#analysis-type-chart'), { items });
  // 学科健康度
  $('#subject-health').innerHTML = s.subjects.map(sub=>{
    const avg = subjectAvg(sub.id);
    const full = sub.full || 150;
    const pct = avg!=null? Math.max(0,Math.min(100, avg/full*100)) : null;
    const tr = subjectTrend(sub.id);
    const tag = tr==='down'?'<span class="health-tag" style="color:var(--bad)">下滑</span>': tr==='up'?'<span class="health-tag" style="color:var(--good)">进步</span>':'<span class="health-tag" style="color:var(--ink3)">稳定</span>';
    const color = pct!=null ? (pct>=80?'var(--good)':pct>=60?'var(--accent)':'var(--bad)') : 'var(--line)';
    return `<div class="health-item"><span class="subj-dot" style="background:${sub.color}"></span><span style="font-weight:600;width:44px">${esc(sub.name)}</span>
      <div class="health-bar"><div class="health-fill" style="width:${pct??0}%;background:${color}"></div></div>${tag}</div>`;
  }).join('') || '<div class="empty">暂无数据</div>';
}
function buildGainPoints(s){
  const pts = [];
  // 1. 科目级：失分最多的科目
  const subLoss = s.subjects.map(sub=>{
    const v = subjectSeries(sub.id).filter(x=>x!=null);
    if(!v.length) return null;
    const full = sub.full||150;
    const losses = v.map(x=>full-x);
    const avgLoss = losses.reduce((a,b)=>a+b,0)/losses.length;
    const tr = subjectTrend(sub.id);
    return { sub, avgLoss, tr, avg: v.reduce((a,b)=>a+b,0)/v.length };
  }).filter(Boolean);
  subLoss.sort((a,b)=>b.avgLoss-a.avgLoss);
  subLoss.slice(0,3).forEach(x=>{
    pts.push({ title:`${x.sub.name}：平均失分 ${x.avgLoss.toFixed(1)} 分`, desc:`${x.tr==='down'?'⚠️ 最近还在下滑，建议优先攻这个科目。':'当前均分 '+x.avg.toFixed(1)+'，把失分最高的题型补上收益最大。'}${s.targets[x.sub.id]?` 目标 ${s.targets[x.sub.id]} 分，还差 ${(s.targets[x.sub.id]-x.avg).toFixed(1)} 分。`:''}` });
  });
  // 2. 题型级：错题集中的知识点
  const typeMap = {};
  s.mistakes.forEach(m=>{
    const k = `${subjectName(m.subjectId)} · ${m.knowledge||m.type||'未分类'}`;
    typeMap[k] = (typeMap[k]||0)+1;
  });
  Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([k,c])=>{
    pts.push({ title:`${k}：错 ${c} 次`, desc:`这个知识点反复出错，是常错题型。去「错题 → 举一反三」针对性地练同类题。` });
  });
  return pts;
}

/* ================= 我的 ================= */
function renderMe(){
  const s = S();
  $('#set-name').value = s.profile.name||'';
  $('#set-grade').value = s.profile.grade||'';
  $('#set-exam-name').value = s.profile.examName||'';
  $('#set-exam-date').value = s.profile.examDate||'';
  $('#set-target-total').value = s.profile.targetTotal||'';
  renderSubjectManage();
}
function renderSubjectManage(){
  const s = S();
  $('#subject-manage').innerHTML = s.subjects.map(sub=>`
    <div class="sm-row">
      <span class="subj-dot" style="background:${sub.color}"></span>
      <input class="sm-input" data-subj="${sub.id}" value="${esc(sub.name)}">
      <button class="sm-x" data-del="${sub.id}">✕</button>
    </div>`).join('');
  $$('#subject-manage [data-subj]').forEach(inp=>inp.onchange=()=>{ const sub=s.subjects.find(x=>x.id===inp.dataset.subj); if(sub){sub.name=inp.value.trim()||sub.name; Store.save(); renderMe();} });
  $$('#subject-manage [data-del]').forEach(b=>b.onclick=()=>{ const sub=s.subjects.find(x=>x.id===b.dataset.del); if(sub && confirm(`删除科目「${sub.name}」？其成绩和错题会保留但不再显示。`)){ s.subjects=s.subjects.filter(x=>x.id!==sub.id); Store.save(); renderMe(); } });
}

/* ================= 事件绑定（一次性） ================= */
function bind(){
  // 底部导航
  $$('#tabbar .tab').forEach(t=>t.onclick=()=>go(t.dataset.page));
  // 首页卡片跳转
  document.addEventListener('click', e=>{
    const nav = e.target.closest('[data-nav]');
    if(nav && !e.target.closest('button')){ go(nav.dataset.nav); }
  });
  // 主题按钮
  $('#btn-theme').onclick = toggleTheme;
  // 成绩
  $('#btn-add-exam').onclick = ()=>openExamModal();
  // 错题
  $('#btn-add-mistake').onclick = ()=>openMistakeModal();
  // 我的：设置保存
  ['set-name','set-grade','set-exam-name','set-exam-date','set-target-total'].forEach(id=>{
    $('#'+id).addEventListener('change', e=>{
      const s=S(); const map={ 'set-name':'name','set-grade':'grade','set-exam-name':'examName','set-exam-date':'examDate','set-target-total':'targetTotal' };
      s.profile[map[id]] = e.target.value;
      Store.save(); render('home');
    });
  });
  $('#btn-add-subject').onclick = ()=>{
    const name = prompt('新科目名称（如：物理、化学、生物）');
    if(!name||!name.trim()) return;
    const s=S(); s.subjects.push({id:Store.uid(), name:name.trim(), color:Store.palette[s.subjects.length%Store.palette.length]});
    Store.save(); renderMe(); toast('已添加 '+name.trim());
  };
  $('#btn-export').onclick = ()=>{
    const blob = Store.exportJSON(); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='学习数据备份.json'; a.click(); URL.revokeObjectURL(url);
  };
  $('#btn-import').onclick = ()=>$('#import-file').click();
  $('#import-file').onchange = e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=()=>{ try{ Store.importJSON(JSON.parse(r.result)); renderAll(); toast('导入成功'); }catch(err){ toast('导入失败：'+err.message); } };
    r.readAsText(f); e.target.value='';
  };
  $('#btn-demo').onclick = ()=>{ loadDemo(); renderAll(); toast('已填入示例数据'); };
  $('#btn-reset').onclick = ()=>{
    if(confirm('确定清空全部数据？此操作不可恢复。建议先导出备份。')){ Store.reset(); renderAll(); toast('已清空'); }
  };
}
function renderAll(){ render('home'); render('scores'); render('mistakes'); render('analysis'); render('me'); }

/* ---- 示例数据 ---- */
function loadDemo(){
  const s = S();
  const subj = s.subjects;
  const names = ['开学摸底','第一次月考','期中考试','第二次月考','期末复习'];
  const dates = ['2026-09-05','2026-09-25','2026-10-20','2026-11-12','2026-11-28'];
  s.exams = [];
  for(let i=0;i<5;i++){
    const entries={};
    subj.forEach((sub,si)=>{
      const full = sub.full||100;
      const base = full*(0.70 + i*0.055) + (si%3)*full*0.03;
      const score = Math.max(Math.round(full*0.4), Math.round(base + (Math.random()*full*0.05 - full*0.025)));
      entries[sub.id]={ score, full, avg:0, classRank:3+Math.floor(Math.random()*15), gradeRank:40+Math.floor(Math.random()*200) };
    });
    s.exams.push({ id:Store.uid(), name:names[i], date:dates[i], entries, photos:[], note:'' });
  }
  s.profile.examName='期末考试'; s.profile.examDate='2026-12-20'; s.profile.targetTotal='750'; s.profile.grade='高一'; s.profile.name='同学';
  s.targets = {};
  s.subjects.forEach(sub=>{ s.targets[sub.id] = Math.round((sub.full||100)*0.88); });
  const mk = [
    { subjectId: subj[1].id, type:'选择题', knowledge:'集合运算', question:'已知 A={1,2,3}，B={2,3,4}，则 A∩B = ?', wrong:'{1,2,3,4}', right:'{2,3}', analysis:'交集取两个集合的公共元素' },
    { subjectId: subj[1].id, type:'填空题', knowledge:'指数运算', question:'计算 2^3 × 2^2', wrong:'2^6', right:'32', analysis:'同底数幂相乘，指数相加：2^5=32' },
    { subjectId: subj[1].id, type:'解答题', knowledge:'函数定义域', question:'求 f(x)=√(x-2) 的定义域', wrong:'x>2', right:'x≥2', analysis:'被开方数需 ≥0' },
    { subjectId: subj[0].id, type:'文言文', knowledge:'文言实词', question:'解释“师者，所以传道受业解惑也”的“所以”', wrong:'因此', right:'用来……的', analysis:'固定结构' },
    { subjectId: subj[2].id, type:'单选', knowledge:'时态', question:'By the time he arrived, I ___ the work.', wrong:'finish', right:'had finished', analysis:'by the time + 过去完成时' },
  ];
  mk.forEach(m=>{ m.id=Store.uid(); m.created=Date.now()-Math.random()*86400000*5; const sc=Gen.schedule(0); m.stage=0; m.nextDue=sc.nextDue; m.done=false; m.examId=''; m.photoId=''; });
  s.mistakes = mk;
  Store.save();
}

/* ================= 启动 ================= */
function init(){
  Store.get();
  bind();
  go('home');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
