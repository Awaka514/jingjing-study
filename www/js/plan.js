/* 复习计划 / 知识点地图 / 周报 */
const Plan = (() => {
  function key(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function daysLeft(){
    const s=S(); const ds=s.profile.examDate; if(!ds) return 0;
    const t=new Date(); t.setHours(0,0,0,0);
    const e=new Date(ds+'T00:00');
    return Math.ceil((e-t)/86400000);
  }
  function ensure(){
    const s=S(); const dl=daysLeft(); if(dl<=0) return null;
    const sig = (s.profile.examDate||'')+'|'+s.mistakes.length+'|'+(s.plan&&s.plan.perDay);
    if(s.plan && s.plan.sig===sig && s.plan.days) return s.plan;
    const pool=[...s.mistakes].sort((a,b)=>(a.nextDue||0)-(b.nextDue||0));
    const perDay = Math.max(1, Math.ceil(pool.length/Math.max(1,dl)));
    const days={}; let idx=0;
    for(let i=0;i<dl;i++){
      const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
      const k=key(d);
      const ms=pool.slice(idx, idx+perDay); idx+=perDay;
      const mids=ms.map(m=>m.id);
      const tids=[...new Set(ms.map(m=>{
        if(!m.knowledge) return null;
        const t=QBank.match(m.knowledge, subjectName(m.subjectId))[0];
        return t?t.id:null;
      }).filter(Boolean))];
      days[k]={mids, tids, done:false};
    }
    s.plan={sig, days, perDay}; Store.save();
    return s.plan;
  }
  function today(){
    const p=ensure(); if(!p) return null;
    const k=key(new Date());
    return p.days[k] ? { key:k, ...p.days[k] } : null;
  }
  function markDone(k, on){
    const s=S(); if(!s.plan||!s.plan.days[k]) return;
    s.plan.days[k].done = !!on; Store.save();
  }

  function renderHome(){
    const el=document.getElementById('home-today-body'); if(!el) return false;
    const dl=daysLeft();
    if(dl<=0) return false;                 // 没设考试日期，沿用原有逻辑
    const t=today();
    const s=S();
    if(!t){
      el.innerHTML = `<div class="today-empty"><img src="assets/fish_proud.png" alt=""><div>考试今天或已过<br><span>去「我的」改一下日期</span></div></div>`;
      return true;
    }
    const ms = t.mids.map(id=>s.mistakes.find(m=>m.id===id)).filter(Boolean);
    if(!ms.length && !t.tids.length){
      el.innerHTML = `<div class="today-empty"><img src="assets/fish_proud.png" alt=""><div>今天没有排到任务<br><span>先把错题记进来吧</span></div></div>`;
      return true;
    }
    el.innerHTML = `
      <div class="plan-head">
        <span>距考试 <b>${dl}</b> 天 · 今天 ${ms.length} 道</span>
        <button class="link-btn" id="plan-done">${t.done?'已完成 ✓':'标记完成'}</button>
      </div>
      <div class="plan-list">
        ${ms.map(m=>`<div class="plan-row"><span class="plan-dot"></span><span class="plan-txt">${esc(m.knowledge||m.question||'错题')}</span></div>`).join('')}
        ${t.tids.map(id=>{ const ty=QBank.byId(id); return ty?`<div class="plan-row type"><span class="plan-dot"></span><span class="plan-txt">练一类：${esc(ty.title)}</span></div>`:''; }).join('')}
      </div>
      <button class="btn primary block" id="plan-start" style="margin-top:10px">开始今天的复习 ›</button>`;
    const b=document.getElementById('plan-start');
    if(b) b.onclick=()=>{ go('mistakes'); switchSeg('mistakes','review'); };
    const d=document.getElementById('plan-done');
    if(d) d.onclick=()=>{ markDone(t.key, !t.done); renderHome(); toast(t.done?'已取消完成':'今天完成了，不错'); };
    return true;
  }

  function renderKnowMap(){
    const el=document.getElementById('know-map'); if(!el) return;
    const s=S();
    const map=new Map();
    s.mistakes.forEach(m=>{
      const k=(m.knowledge||'未标注知识点').trim();
      if(!map.has(k)) map.set(k,{ n:0, ok:0, bad:0, type:null });
      const row=map.get(k); row.n++;
      const t=m.knowledge?QBank.match(m.knowledge, subjectName(m.subjectId))[0]:null;
      if(t){ row.type=t.id; const st=(s.pstats||{})[t.id]; if(st){ row.ok+=(st.ok||0); row.bad+=(st.bad||0); } }
    });
    const rows=[...map.entries()].sort((a,b)=>b[1].n-a[1].n).slice(0,8);
    if(!rows.length){ el.innerHTML=`<div class="empty" style="padding:20px">还没有错题，这里会出现你的薄弱知识点</div>`; return; }
    el.innerHTML = rows.map(([k,v])=>{
      const total=v.ok+v.bad;
      const rate = total? Math.round(v.ok/total*100) : null;
      const level = v.n>=3 ? 'bad' : v.n===2 ? 'warn' : 'ok';
      return `<div class="know-row" ${v.type?`data-type="${v.type}"`:''}>
        <span class="know-dot ${level}"></span>
        <span class="know-name">${esc(k)}</span>
        <span class="know-meta">错 ${v.n} 道${rate!==null?` · 对 ${rate}%`:''}</span>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-type]').forEach(r=>r.onclick=()=>openType(r.dataset.type));
  }

  function renderWeekly(){
    const el=document.getElementById('weekly-report'); if(!el) return;
    const s=S(); const since=Date.now()-7*86400000;
    const newM = s.mistakes.filter(m=>(m.created||0)>=since).length;
    const reviewed = s.mistakes.filter(m=>(m.lastReview||0)>=since).length;
    let ok=0,bad=0; Object.values(s.pstats||{}).forEach(st=>{ ok+=(st.ok||0); bad+=(st.bad||0); });
    const total=ok+bad; const rate = total?Math.round(ok/total*100):null;
    const exs=[...s.exams].sort((a,b)=>a.date.localeCompare(b.date));
    let trend='';
    if(exs.length>=2){
      const a=examTotal(exs[exs.length-2]).total, b=examTotal(exs[exs.length-1]).total;
      if(a&&b) trend = `${b>=a?'↑':'↓'} ${Math.abs(b-a)} 分`;
    }
    el.innerHTML = `<div class="weekly-grid">
      <div><span class="w-num">${newM}</span><span class="w-label">新增错题</span></div>
      <div><span class="w-num">${reviewed}</span><span class="w-label">复习过</span></div>
      <div><span class="w-num">${total}</span><span class="w-label">练习次数</span></div>
      <div><span class="w-num">${rate===null?'—':rate+'%'}</span><span class="w-label">练习正确率</span></div>
    </div>
    ${trend?`<div class="weekly-trend">最近两次考试：${trend}</div>`:''}`;
  }

  return { renderHome, renderKnowMap, renderWeekly, today, daysLeft };
})();
