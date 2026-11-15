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
  let cd;
  if(d){
    const days = Math.ceil((new Date(d+'T00:00') - new Date())/86400000);
    const name = s.profile.examName||'考试';
    if(days>0) cd = `<div class="cd-num">${days}<span>天</span></div><div class="cd-sub">距${esc(name)}</div>`;
    else if(days===0) cd = `<div class="cd-num">今天</div><div class="cd-sub">${esc(name)}，加油</div>`;
    else cd = `<div class="cd-num">已结束</div><div class="cd-sub">${esc(name)}</div>`;
  } else {
    cd = `<div class="cd-num dim">还没有考试</div><div class="cd-sub">填上日期，这里就变成倒计时</div>
      <button class="btn primary sm hero-cta" id="hero-set-exam">设置考试日期</button>`;
  }
  $('#home-countdown').innerHTML = cd;
  const he = $('#hero-set-exam'); if(he) he.onclick = ()=>go('me');
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
  try{ if(Plan.renderHome()) return document.getElementById('home-today-body').innerHTML; }catch(e){}

  const due = s.mistakes.filter(Gen.dueToday);
  if(!s.mistakes.length) return `<div class="today-empty"><img src="assets/fish_proud.png" alt=""><div>还没有错题<br><span>记一道，这里就会告诉你今天该看什么</span></div></div>`;
  if(!due.length) return `<div class="today-empty"><img src="assets/fatfish.png" alt=""><div>今天没有到期的错题<br><span>新订正的会按遗忘曲线排期</span></div></div>`;
  return `<div style="font-size:14px">有 <b style="color:var(--accent)">${due.length}</b> 道错题到了复习时间点，巩固记忆效果最好。</div>
    <button class="btn primary block" style="margin-top:10px" onclick="go('mistakes');switchSeg('mistakes','review')">开始复习 ›</button>`;
}


/* ---- 提示音（不用音频文件，现场合成） ---- */
function beep(times){
  try{
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const ctx = beep.ctx || (beep.ctx = new AC());
    for(let i=0;i<(times||1);i++){
      const t0 = ctx.currentTime + i*0.55;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type='sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+0.42);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0+0.45);
    }
  }catch(e){}
}

/* ---- 计时：静态面板 + 事件委托 + 定时刷新 ---- */
const Timer = (()=>{
  const PRESETS = [
    { id:'cn', name:'语文', min:150 },
    { id:'math', name:'数学', min:120 },
    { id:'en', name:'英语', min:120 },
    { id:'other', name:'小科', min:75 },
    { id:'free', name:'25′', min:25 },
  ];
  const S0 = { preset:'cn', total:150*60, left:150*60, running:false, timer:null, msg:'' };

  function dayKey(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function mins(){
    const s=S(); s.focus=s.focus||{day:dayKey(),mins:0};
    if(s.focus.day!==dayKey()){ s.focus={day:dayKey(),mins:0}; Store.save(); }
    return s.focus.mins||0;
  }
  function addMin(n){
    const s=S(); s.focus=s.focus||{day:dayKey(),mins:0};
    s.focus.mins=(s.focus.mins||0)+n; s.focus.day=dayKey(); Store.save();
  }
  function fmt(sec){ sec=Math.max(0,sec); return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0'); }

  function paint(){
    const clock=document.getElementById('timer-clock');
    if(!clock) return;
    clock.textContent = fmt(S0.left);
    clock.classList.toggle('running', S0.running);
    clock.classList.toggle('low', S0.left<=60);
    const btn=document.getElementById('timer-toggle');
    if(btn) btn.textContent = S0.running ? '暂停' : (S0.left===S0.total ? '开始' : '继续');
    const m=document.getElementById('timer-mins');
    if(m) m.textContent = `今天 ${mins()} 分钟`;
    const nm=document.getElementById('timer-pick-name');
    if(nm){ const p=PRESETS.find(x=>x.id===S0.preset)||PRESETS[0]; nm.textContent = `${p.name} · ${p.min} 分钟`; }
    const msg=document.getElementById('timer-msg');
    if(msg) msg.textContent = S0.msg;
  }
  function openPresetSheet(){
    const rows = PRESETS.map(p=>`<button class="pick-row ${p.id===S0.preset?'on':''}" data-t="preset" data-id="${p.id}">
        <span class="pick-name">${p.name}</span>
        <span class="pick-min">${p.min} 分钟</span>
      </button>`).join('');
    openModal('选择科目', `<div class="pick-list">${rows}</div>`);
  }
  function setPreset(id){
    const p=PRESETS.find(x=>x.id===id); if(!p) return;
    if(S0.timer){ clearInterval(S0.timer); S0.timer=null; }
    S0.preset=id; S0.total=p.min*60; S0.left=S0.total; S0.running=false; S0.msg='';
    paint();
  }
  function toggle(){
    if(S0.running){
      clearInterval(S0.timer); S0.timer=null; S0.running=false; S0.msg='已暂停';
      paint(); return;
    }
    S0.running=true; S0.msg='';
    S0.timer=setInterval(()=>{
      S0.left--;
      if(S0.left<=0){
        clearInterval(S0.timer); S0.timer=null; S0.running=false; S0.left=S0.total;
        addMin(Math.round(S0.total/60));
        S0.msg='时间到，站起来活动一下';
        try{ navigator.vibrate && navigator.vibrate([220,120,220]); }catch(e){}
        beep(3);
      }
      paint();
    },1000);
    paint();
  }
  function reset(){
    if(S0.timer){ clearInterval(S0.timer); S0.timer=null; }
    S0.running=false; S0.left=S0.total; S0.msg=''; paint();
  }
  document.addEventListener('click', function(e){
    const b = e.target && e.target.closest ? e.target.closest('[data-t]') : null;
    if(!b) return;
    const act=b.dataset.t;
    if(act==='pick') openPresetSheet();
    else if(act==='preset'){ setPreset(b.dataset.id); try{ closeModal(); }catch(e){} }
    else if(act==='toggle') toggle();
    else if(act==='reset') reset();
  }, true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', paint); else paint();
  setInterval(paint, 1000);
  return { render: paint };
})();

/* ---- 头像 ---- */
function renderAvatar(){
  const s=S();
  const img=document.getElementById('avatar-img');
  const nm=document.getElementById('avatar-name');
  if(nm) nm.textContent = s.profile.name || '同学';
  if(img){
    if(s.profile.avatar) img.src = s.profile.avatar;
    else img.src = 'assets/fatfish.png';
  }
}
function pickAvatar(){
  const input=document.getElementById('avatar-file');
  if(!input) return;
  input.value='';
  input.onchange = e=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      const i = new Image();
      i.onload = ()=>{
        const size=256;
        const cv=document.createElement('canvas'); cv.width=size; cv.height=size;
        const ctx=cv.getContext('2d');
        const scale=Math.max(size/i.width, size/i.height);
        const w=i.width*scale, h=i.height*scale;
        ctx.drawImage(i,(size-w)/2,(size-h)/2,w,h);
        const data=cv.toDataURL('image/jpeg',0.82);
        const st=S(); st.profile.avatar=data; Store.save(); renderAvatar(); toast('头像已更新');
      };
      i.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  input.click();
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
  // 目标对比
  const goal = $('#scores-goal');
  if(goal){
    const target = Number(s.profile.targetTotal)||0;
    const last = exs.length ? examTotal(exs[exs.length-1]) : null;
    if(target>0 && last && last.total>0){
      const gap = target - last.total;
      const pct = Math.max(0, Math.min(100, Math.round(last.total/target*100)));
      goal.innerHTML = `<div class="card goal-card">
        <div class="goal-row"><div><div class="goal-label">目标总分</div><div class="goal-num">${target}</div></div>
        <div class="goal-right"><div class="goal-label">最近一次</div><div class="goal-last">${last.total}</div></div></div>
        <div class="goal-bar"><span style="width:${pct}%"></span></div>
        <div class="goal-gap">${gap>0?`还差 <b>${gap}</b> 分`:`已超出目标 <b>${-gap}</b> 分`}</div>
      </div>`;
    } else {
      goal.innerHTML = `<div class="card goal-card goal-empty">
        <div class="goal-label">目标总分</div>
        <div class="goal-gap">在「我的」里填目标总分，这里会显示还差多少</div>
      </div>`;
    }
  }
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
  if(!exs.length){ $('#exam-list').innerHTML = '<div class="empty"><img class="empty-whale" src="assets/fish_face.png" alt="">还没有考试记录<br>点上方按钮，导入一次成绩或答题卡</div>'; return; }
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
  if(!list.length){ $('#mistake-list').innerHTML = '<div class="empty"><img class="empty-whale" src="assets/fish_think.png" alt="">还没有错题<br>点右下角 ＋，拍下题目或手动录入</div>'; return; }
  $('#mistake-list').innerHTML = list.map(m=>mistakeHTML(m)).join('');
  $('#mistake-list').querySelectorAll('[data-act]').forEach(el=>{
    el.onclick = ()=>{ const id=el.dataset.id, act=el.dataset.act;
      const m=s.mistakes.find(x=>x.id===id);
      if(act==='edit') openMistakeModal(m);
      if(act==='del'){ s.mistakes=s.mistakes.filter(x=>x.id!==id); Store.save(); renderMistakes(); }
      if(act==='view') previewPhoto(m.photoId);
      if(act==='practice'){
        const t = QBank.match(m.knowledge, subjectName(m.subjectId))[0];
        if(t) openType(t.id); else { toast('这类题暂时没有匹配的题型'); switchSeg('mistakes','practice'); }
      }
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
      ${m.knowledge && QBank.match(m.knowledge, subjectName(m.subjectId)).length ? `<button class="btn sm" data-act="practice" data-id="${m.id}">练同类题</button>` : ''}
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
let curTypeId = null, curIdx = -1, practiceFilter = '全部', showSteps = false, showAns = false;

function renderPractice(){
  const s = S();
  const rec = new Map();
  (s.mistakes||[]).forEach(m=>{
    if(!m.knowledge) return;
    QBank.match(m.knowledge, subjectName(m.subjectId)).slice(0,2).forEach(t=>{
      if(!rec.has(t.id)) rec.set(t.id, { t, items: [] });
      rec.get(t.id).items.push(m);
    });
  });
  const recArr = [...rec.values()].sort((a,b)=>b.items.length-a.items.length);
  const hero = $('#practice-hero');
  hero.innerHTML = recArr.length ? `<div class="rec-card">
      <div class="rec-tag">根据你的错题推荐</div>
      <div class="rec-title">${esc(recArr[0].t.title)}</div>
      <div class="rec-sub">「${esc(recArr[0].items[0].knowledge)}」这类题你错过 ${recArr[0].items.length} 次</div>
      <button class="btn primary sm" data-open="${recArr[0].t.id}">开始这一类 ›</button>
    </div>` : `<div class="rec-card">
      <div class="rec-tag">举一反三</div>
      <div class="rec-title">还没有错题可以参照</div>
      <div class="rec-sub">先在错题本录一道，这里会自动匹配同类题型</div>
    </div>`;

  const subs = ['全部', ...new Set(QBank.all().map(t=>t.subject))];
  if(!subs.includes(practiceFilter)) practiceFilter = '全部';
  const f = $('#practice-filter');
  f.innerHTML = subs.map(v=>`<button class="chip ${v===practiceFilter?'active':''}" data-f="${v}">${v}</button>`).join('');
  f.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ practiceFilter=b.dataset.f; renderPractice(); });
  const se = $('#practice-search');
  if(se && !se.dataset.bound){ se.dataset.bound='1'; se.addEventListener('input', ()=>renderPractice()); }

  const list = $('#practice-type-list');
  const q = ($('#practice-search')?.value || '').trim();
  const hitQ = t => !q || [t.title,t.topic,t.why,...(t.keys||[])].join(' ').includes(q);
  const groups = {};
  QBank.all().filter(t=>(practiceFilter==='全部'||t.subject===practiceFilter) && hitQ(t))
    .forEach(t=>{ (groups[t.subject]=groups[t.subject]||[]).push(t); });
  if(q && !Object.keys(groups).length){
    list.innerHTML = `<div class="empty"><div class="big">🔍</div>没有找到「${esc(q)}」相关的题型<br>换个关键词试试</div>`;
    return;
  }
  list.innerHTML = Object.entries(groups).map(([sub,arr])=>`
    <div class="type-group">
      <div class="type-group-title">${esc(sub)}</div>
      ${arr.map((t,i)=>{
        const hit = rec.get(t.id);
        return `<button class="type-card" data-open="${t.id}">
          <div class="type-idx">${String(i+1).padStart(2,'0')}</div>
          <div class="type-main">
            <div class="type-card-top"><span class="type-name">${esc(t.title)}</span><span class="level">${'★'.repeat(t.level)}</span></div>
            <div class="type-topic">${esc(t.topic)}</div>
            <div class="type-why">${esc(t.why)}</div>
            <div class="type-hit ${hit?'':'dim'}">${hit?`你的错题命中 ${hit.items.length} 道`:'含 2 道变式'}${rateText(t.id)}</div>
          </div>
        </button>`;
      }).join('')}
    </div>`).join('');
  list.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openType(b.dataset.open));
  hero.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openType(b.dataset.open));
}

function renderBackupHint(){
  const el = document.getElementById('backup-hint'); if(!el) return;
  let ts = 0; try{ ts = Number(localStorage.getItem('jj-last-backup')||0); }catch(e){}
  if(!ts){ el.textContent = '还没备份过。重装或换手机，数据会没。'; el.className='backup-hint warn'; return; }
  const days = Math.floor((Date.now()-ts)/86400000);
  el.textContent = days<=0 ? '今天已备份' : `上次备份：${days} 天前`;
  el.className = 'backup-hint' + (days>=7?' warn':'');
}
function rateText(id){
  const st = statsOf(id); if(!st || (!st.ok && !st.bad)) return '';
  const total = (st.ok||0)+(st.bad||0);
  const pct = Math.round((st.ok||0)/total*100);
  return ` · 做过 ${total} 次，对 ${pct}%`;
}
function practicedOf(id){ const s=S(); return (s.practice && s.practice[id]) || 0; }
function statsOf(id){ const s=S(); return (s.pstats && s.pstats[id]) || null; }
function markPractice(id, ok){
  const s=S(); s.pstats = s.pstats || {};
  const r = s.pstats[id] || { ok:0, bad:0, last:0 };
  ok ? (r.ok = (r.ok||0)+1) : (r.bad = (r.bad||0)+1);
  r.last = Date.now();
  s.pstats[id] = r; Store.save();
}
function bumpPractice(id){
  const s = S(); s.practice = s.practice || {};
  s.practice[id] = (s.practice[id]||0) + 1; Store.save();
}
function openType(id){
  curTypeId = id; curIdx = -1; showSteps = false; showAns = false;
  bumpPractice(id);
  switchSeg('mistakes','practice');
  renderSheet();
  const area = $('#practice-area');
  if(area) area.scrollIntoView({behavior:'smooth', block:'start'});
}

function renderSheet(){
  const t = QBank.byId(curTypeId); if(!t) return;
  const isV = curIdx >= 0;
  const q = isV ? t.variants[curIdx].q : t.q;
  const ans = isV ? t.variants[curIdx].ans : t.ans;
  const area = $('#practice-area');
  area.hidden = false;
  const wrap = document.getElementById('mistakes-practice');
  if(wrap) wrap.classList.add('sheet-mode');
  area.innerHTML = `
    <div class="sheet-head">
      <div>
        <div class="sheet-topic">${esc(t.subject)} · ${esc(t.topic)}</div>
        <div class="sheet-title">${esc(t.title)}</div>
      </div>
      <button class="icon-btn" id="sheet-close">✕</button>
    </div>
    <div class="sheet-badge ${isV?'':'main'}">${isV?`变式 ${curIdx+1} / ${t.variants.length}`:'原题'}</div>
    <div class="sheet-q">${q}</div>
    ${showSteps?`<div class="sheet-block"><div class="block-label">解题思路</div><ol>${t.steps.map(x=>`<li>${x}</li>`).join('')}</ol></div>`:''}
    ${showAns?`<div class="sheet-block ans"><div class="block-label">答案</div><div class="ans-text">${ans}</div></div>`:''}
    <div class="sheet-actions">
      <button class="btn sm" id="sheet-steps">${showSteps?'收起思路':'看思路'}</button>
      <button class="btn sm" id="sheet-ans">${showAns?'收起答案':'看答案'}</button>
      <button class="btn sm primary" id="sheet-next">${isV?(curIdx+1<t.variants.length?'下一道变式':'回到原题'):'做变式'}</button>
    </div>
    <div class="variant-row">
      <button class="chip ${curIdx===-1?'active':''}" data-v="-1">原题</button>
      ${t.variants.map((v,i)=>`<button class="chip ${curIdx===i?'active':''}" data-v="${i}">变式${i+1}</button>`).join('')}
    </div>
    <div class="sheet-judge">
      <div class="judge-label">做完了，对一下</div>
      <div class="judge-row">
        <button class="btn sm ok" id="judge-ok">做对了</button>
        <button class="btn sm bad" id="judge-bad">没做对</button>
      </div>
    </div>`;
  $('#sheet-close').onclick = closeSheet;
  $('#sheet-steps').onclick = ()=>{ showSteps=!showSteps; renderSheet(); };
  $('#sheet-ans').onclick = ()=>{ showAns=!showAns; renderSheet(); };
  $('#sheet-next').onclick = ()=>{
    if(curIdx===-1) curIdx=0;
    else if(curIdx+1<t.variants.length) curIdx++;
    else curIdx=-1;
    showSteps=false; showAns=false; renderSheet();
  };
  area.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ curIdx=Number(b.dataset.v); showSteps=false; showAns=false; renderSheet(); });
  $('#judge-ok').onclick = ()=>{ markPractice(t.id, true); toast('记下了，这类题保持手感'); closeSheet(); renderPractice(); };
  $('#judge-bad').onclick = ()=>{ markPractice(t.id, false); toast('记下了，回头重点练这一类'); closeSheet(); renderPractice(); };
}

function closeSheet(){
  const area = document.getElementById('practice-area');
  if(area){ area.hidden = true; area.innerHTML = ''; }
  const wrap = document.getElementById('mistakes-practice');
  if(wrap) wrap.classList.remove('sheet-mode');
}

/* ---- 待复习 ---- */
function renderReview(){
  const s = S();
  const due = s.mistakes.filter(Gen.dueToday).sort((a,b)=>(a.nextDue||0)-(b.nextDue||0));
  if(!due.length){ $('#review-queue').innerHTML='<div class="empty"><img class="empty-whale" src="assets/fatfish.png" alt="">今天没有到期的错题<br>订正后会按遗忘曲线自动排期</div>'; return; }
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
  try{ Plan.renderKnowMap(); Plan.renderWeekly(); }catch(e){}
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
  const ba=document.getElementById('btn-avatar');
  if(ba) ba.onclick=pickAvatar;
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
    exportBackup();
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
function renderAll(){
  renderBackupHint();
  try{ Timer.render(); }catch(e){ const r=document.getElementById('timer-root'); if(r) r.innerHTML='<div class="timer-msg bad">ERR: '+e.message+'</div>'; console.error(e); } try{ renderAvatar(); }catch(e){} render('home'); render('scores'); render('mistakes'); render('analysis'); render('me'); }

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
  try{ Timer.render(); }catch(e){ const r=document.getElementById('timer-root'); if(r) r.innerHTML='<div class="timer-msg bad">ERR: '+e.message+'</div>'; }
  try{ renderAvatar(); }catch(e){}
  try{ Plan.renderKnowMap && Plan.renderKnowMap(); }catch(e){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
