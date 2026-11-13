/* 轻量 SVG 图表：折线 / 柱状 / 环形，无第三方依赖 */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs){
    const e = document.createElementNS(NS, tag);
    for(const k in attrs){
      const v = attrs[k];
      // stroke/fill/stop-color 用 style 赋值，才能解析 var(--x) 与十六进制
      if(k==='stroke' || k==='fill' || k==='stop-color') e.style[k] = v;
      else e.setAttribute(k, v);
    }
    return e;
  }
  function esc(s){ return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

  function niceMax(v){
    if(v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function lineBox(container, opts){
    container.innerHTML = '';
    const W = 320, H = 180, padL = 34, padR = 10, padT = 14, padB = 26;
    const series = opts.series || [];
    const labels = opts.labels || [];
    const allVals = series.flatMap(s => s.points).filter(v => v != null);
    if(!allVals.length){
      container.innerHTML = '<div class="empty"><div class="big">📈</div>暂无数据，先添加一次考试成绩吧</div>';
      return;
    }
    let yMax = opts.yMax || niceMax(Math.max(...allVals) * 1.12);
    let yMin = opts.yMin || 0;
    const svg = el('svg', { viewBox:`0 0 ${W} ${H}`, preserveAspectRatio:'xMidYMid meet' });
    // grid + y labels
    const n = 4;
    for(let i=0;i<=n;i++){
      const v = yMin + (yMax-yMin)*i/n;
      const y = padT + (H-padT-padB)*(1-i/n);
      svg.appendChild(el('line',{x1:padL,y1:y,x2:W-padR,y2:y,stroke:'var(--line)','stroke-width':1}));
      const t = el('text',{x:padL-6,y:y+3,'text-anchor':'end','font-size':9,fill:'var(--ink3)'});
      t.textContent = opts.unit ? Math.round(v)+opts.unit : Math.round(v);
      svg.appendChild(t);
    }
    // x labels
    labels.forEach((lb,i) => {
      const x = padL + (W-padL-padR) * (labels.length>1 ? i/(labels.length-1) : 0.5);
      const t = el('text',{x,y:H-8,'text-anchor':'middle','font-size':8.5,fill:'var(--ink3)'});
      t.textContent = esc(String(lb).length>6 ? String(lb).slice(0,6) : lb);
      svg.appendChild(t);
    });
    const px = i => padL + (W-padL-padR) * (labels.length>1 ? i/(labels.length-1) : 0.5);
    const py = v => padT + (H-padT-padB) * (1 - (v-yMin)/(yMax-yMin));
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    container.appendChild(tip);
    container.style.position = 'relative';

    series.forEach(s => {
      const pts = s.points.map((v,i)=>[px(i), py(v==null?yMin:v), v]).filter(p=>p[2]!=null);
      if(pts.length<2){ 
        if(pts.length===1){ const c=el('circle',{cx:pts[0][0],cy:pts[0][1],r:3.5,fill:s.color}); svg.appendChild(c); }
        return;
      }
      let d = '';
      pts.forEach((p,i)=>{ d += (i? 'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); });
      const path = el('path',{d,fill:'none',stroke:s.color,'stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round'});
      svg.appendChild(path);
      // 面积渐变
      const gid = 'g' + Math.random().toString(36).slice(2);
      const grad = el('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});
      grad.appendChild(el('stop',{offset:'0%','stop-color':s.color,'stop-opacity':0.22}));
      grad.appendChild(el('stop',{offset:'100%','stop-color':s.color,'stop-opacity':0}));
      svg.appendChild(grad);
      const area = el('path',{d: d + 'L'+pts[pts.length-1][0].toFixed(1)+' '+(H-padB)+'L'+pts[0][0].toFixed(1)+' '+(H-padB)+'Z',
        fill:`url(#${gid})`,stroke:'none'});
      svg.appendChild(area);
      // points + touch
      s.points.forEach((v,i) => {
        if(v==null) return;
        const c = el('circle',{cx:px(i),cy:py(v),r:3,fill:'var(--card)',stroke:s.color,'stroke-width':2});
        const h = el('circle',{cx:px(i),cy:py(v),r:11,fill:'transparent',style:'cursor:pointer'});
        h.addEventListener('pointerdown', e => {
          const rect = container.getBoundingClientRect();
          const scale = rect.width / W;
          const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
          tip.innerHTML = `<b>${esc(labels[i]||'')}</b> · ${esc(s.name)}：<b>${v}</b>${opts.unit||''}`;
          tip.style.left = Math.min(rect.width-120, Math.max(6, vx)) + 'px';
          tip.style.top = Math.max(6, vy-44) + 'px';
          tip.style.opacity = 1;
          setTimeout(()=> tip.style.opacity = 0, 1600);
        });
        svg.appendChild(c); svg.appendChild(h);
      });
    });
    container.appendChild(svg);
  }

  function barBox(container, opts){
    container.innerHTML = '';
    const labels = opts.labels || [], values = opts.values || [];
    if(!values.length){ container.innerHTML = '<div class="empty"><div class="big">📊</div>暂无数据</div>'; return; }
    const W=320,H=190,padL=30,padR=8,padT=14,padB=30;
    const yMax = niceMax(Math.max(...values)*1.15);
    const bw = (W-padL-padR)/values.length;
    const svg = el('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'xMidYMid meet'});
    for(let i=0;i<=4;i++){
      const v=yMax*i/4, y=padT+(H-padT-padB)*(1-i/4);
      svg.appendChild(el('line',{x1:padL,y1:y,x2:W-padR,y2:y,stroke:'var(--line)'}));
      const t=el('text',{x:padL-6,y:y+3,'text-anchor':'end','font-size':9,fill:'var(--ink3)'}); t.textContent=Math.round(v); svg.appendChild(t);
    }
    values.forEach((v,i)=>{
      const x = padL + bw*i + bw*0.18, w = bw*0.64;
      const h = (H-padT-padB)*(v/yMax);
      const r = el('rect',{x,y:padT+(H-padT-padB)-h,width:w,height:Math.max(0,h),rx:5,fill:opts.color||'var(--accent)'});
      svg.appendChild(r);
      const t=el('text',{x:x+w/2,y:padT+(H-padT-padB)-h-4,'text-anchor':'middle','font-size':9,fill:'var(--ink2)'});
      t.textContent = opts.unit? v+opts.unit : v; svg.appendChild(t);
      const lb=el('text',{x:x+w/2,y:H-8,'text-anchor':'middle','font-size':8.5,fill:'var(--ink3)'});
      lb.textContent=esc(String(labels[i]).slice(0,6)); svg.appendChild(lb);
    });
    container.appendChild(svg);
  }

  function donutBox(container, opts){
    container.innerHTML = '';
    const items = (opts.items||[]).filter(i=>i.value>0);
    if(!items.length){ container.innerHTML = '<div class="empty"><div class="big">🍩</div>暂无数据</div>'; return; }
    const total = items.reduce((a,b)=>a+b.value,0);
    const W=180,H=180,r=64,cx=90,cy=90;
    const svg = el('svg',{viewBox:`0 0 ${W} ${H}`});
    let a0 = -Math.PI/2;
    items.forEach(it=>{
      const ang = it.value/total*Math.PI*2;
      const a1 = a0+ang;
      const large = ang>Math.PI?1:0;
      const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
      const d=`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
      svg.appendChild(el('path',{d,fill:it.color,stroke:'var(--card)','stroke-width':2}));
      a0=a1;
    });
    const ct=el('text',{x:cx,y:cy+2,'text-anchor':'middle','font-size':22,'font-weight':800,fill:'var(--ink)'});
    ct.textContent=total; svg.appendChild(ct);
    const cs=el('text',{x:cx,y:cy+18,'text-anchor':'middle','font-size':10,fill:'var(--ink3)'});
    cs.textContent='合计'; svg.appendChild(cs);
    // legend
    const wrap = document.createElement('div');
    wrap.className='donut-legend';
    wrap.innerHTML = items.map(it=>`<div class="dl-row"><span class="dl-dot" style="background:${it.color}"></span><span class="dl-name">${esc(it.label)}</span><span class="dl-val">${it.value}</span></div>`).join('');
    const style=document.createElement('style');
    style.textContent='.donut-legend{margin-top:4px}.dl-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0}.dl-dot{width:9px;height:9px;border-radius:3px}.dl-name{color:var(--ink2);flex:1}.dl-val{font-weight:700}';
    container.appendChild(style);
    container.appendChild(wrap);
    container.appendChild(svg);
  }

  return { line: lineBox, bar: barBox, donut: donutBox };
})();
