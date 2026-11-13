/* 举一反三题型生成器 + 遗忘曲线复习调度 */
const Gen = (() => {
  function ri(n){ return Math.floor(Math.random()*n); }
  function pick(a){ return a[ri(a.length)]; }
  function nz(){ let v=0; while(v===0) v = ri(9)-4; return v; } // 非零 -4..4

  const frac = (n,d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;

  const TYPES = [
    {
      id:'exp', name:'指数运算', subject:'数学',
      gen(){
        const a=pick([2,3,4,5]), m=ri(4)+2, n=ri(4)+2;
        const A=Math.pow(a,m+n);
        return { q:`计算：${a}^${m} × ${a}^${n}`, a:String(A), hint:'同底数幂相乘，指数相加：a^m · a^n = a^(m+n)。', num:A };
      }
    },
    {
      id:'log', name:'对数运算', subject:'数学',
      gen(){
        const a=pick([2,3,5]), k=ri(5)+1;
        const A=Math.pow(a,k);
        return { q:`计算：log<sub>${a}</sub> ${A}`, a:String(k), hint:'log_a(b) 表示 a 的几次方等于 b，即求指数。', num:k };
      }
    },
    {
      id:'ap', name:'等差数列', subject:'数学',
      gen(){
        const a1=ri(10)+1, d=ri(6)+1, n=ri(5)+3;
        const A=a1+(n-1)*d;
        return { q:`等差数列中 a₁=${a1}，公差 d=${d}，求 a<sub>${n}</sub>`, a:String(A), hint:'通项公式 aₙ = a₁ + (n-1)·d。', num:A };
      }
    },
    {
      id:'gp', name:'等比数列', subject:'数学',
      gen(){
        const a1=ri(3)+1, q=pick([2,3]), n=ri(4)+2;
        const A=a1*Math.pow(q,n-1);
        return { q:`等比数列中 a₁=${a1}，公比 q=${q}，求 a<sub>${n}</sub>`, a:String(A), hint:'通项公式 aₙ = a₁·q^(n-1)。', num:A };
      }
    },
    {
      id:'quadineq', name:'一元二次不等式', subject:'数学',
      gen(){
        let p=nz(), q2=nz();
        const lo=Math.min(p,q2), hi=Math.max(p,q2);
        const b=-(lo+hi), c=lo*hi;
        const S=(n)=> n>=0?'+ '+n:'- '+Math.abs(n);
        const A=`x<${lo} 或 x>${hi}`;
        return { q:`解不等式：x² ${S(b)} x ${S(c)} > 0`, a:A, hint:'先因式分解成 (x-a)(x-b)>0，再“大于取两边”。', num:A };
      }
    },
    {
      id:'domain', name:'函数定义域', subject:'数学',
      gen(){
        const a=ri(10)+1;
        const A=`x≥${a}`;
        return { q:`求函数 f(x) = √(x − ${a}) 的定义域`, a:A, hint:'被开方数 ≥ 0，即 x−'+a+' ≥ 0。', num:A };
      }
    },
    {
      id:'trig', name:'三角求值', subject:'数学',
      gen(){
        const rows=[['sin30° + cos60°','1'],['tan45° + cos0°','2'],['sin90° − tan0°','1'],['tan45° × sin90°','1']];
        const r=pick(rows);
        return { q:`计算：${r[0]}`, a:r[1], hint:'记牢特殊角三角函数值：sin30°=1/2、cos60°=1/2、tan45°=1、sin90°=1。', num:r[1] };
      }
    },
    {
      id:'setop', name:'集合运算', subject:'数学',
      gen(){
        const op = ri(2) ? {sym:'∩', name:'交集', vals:[3,4,5]} : {sym:'∪', name:'并集', vals:[1,2,3,4,5,6,7]};
        return { q:`已知 A={1,2,3,4,5}，B={3,4,5,6,7}，求 A ${op.sym} B`, a:`{${op.vals.join(',')}}`, hint:`${op.name}：${op.sym==='∩'?'取两个集合的公共元素':'合并所有元素（重复的只算一次）'}。`, num:op.vals.join(',') };
      }
    },
    {
      id:'linear', name:'解一元一次方程', subject:'数学',
      gen(){
        const k = nz();                 // 解
        const a = pick([2,3,4,5,-3,-2]); while(a===0)a=2;
        const c = pick([1,2,3]); let b = k*(a-c); b = Math.round(b);
        // ax + b = cx  ->  (a-c)x = -b -> x = -b/(a-c) = k
        const q = `${a}x ${b>=0?'+':'-'} ${Math.abs(b)} = ${c}x`;
        const A = k;
        return { q, a: `x=${k}`, hint:'移项合并同类项，把含 x 的项移到一边。', num:k };
      }
    },
    {
      id:'quad', name:'解一元二次方程', subject:'数学',
      gen(){
        let p=nz(), q=nz();
        const b = -(p+q), c = p*q;
        const signs = (n)=> n>=0 ? '+ '+n : '- '+Math.abs(n);
        const qstr = `x² ${signs(b)} x ${signs(c)} = 0`;
        const roots = [p,q].sort((a,b)=>a-b);
        return { q:qstr, a:`x₁=${roots[0]}, x₂=${roots[1]}`, hint:'用因式分解：找两个数，和为 b 的相反数、积为 c。', num: roots.join(',') };
      }
    },
    {
      id:'system', name:'解二元一次方程组', subject:'数学',
      gen(){
        const x=nz(), y=nz();
        const a=pick([1,1,2,3]), b=pick([1,2,-1,1]), c=pick([1,1,2]), d=pick([-2,-1,1,2,3]);
        const e1 = a*x+b*y, e2 = c*x+d*y;
        while(a*d===b*c){ b = pick([1,2,-1,3]); if(b===a&&d===c) d=d+1; }
        const S=(n)=> n>=0?'+'+n:''+n;
        const q=`{ ${a}x ${S(b)}y = ${e1} ；${c}x ${S(d)}y = ${e2}`;
        return { q, a:`x=${x}, y=${y}`, hint:'用加减消元法：把两个方程相加或相减，消去一个未知数。', num:`${x},${y}` };
      }
    },
    {
      id:'calc', name:'有理数混合运算', subject:'数学',
      gen(){
        // 设计成整数结果：a*b + c*d 等
        const a=pick([-3,-2,2,3,4]), b=pick([2,3,4,5]);
        const c=pick([-2,-1,1,2,3]), d=pick([2,3,4]);
        const op = pick(['+','-']);
        const r = op==='+' ? a*b+c*d : a*b-c*d;
        const P=(n)=> n<0 ? `(${n})` : n;
        const q=`${P(a)} × ${b} ${op} ${P(c)} × ${d}`;
        return { q, a:String(r), hint:'先算乘法（注意负负得正），再算加减。', num:r };
      }
    },
    {
      id:'ineq', name:'解一元一次不等式', subject:'数学',
      gen(){
        const k=nz();
        let a=pick([2,3,4]); if(ri(2)) a=-a;
        let b = -a*k + pick([1,2,3]);
        const dir = a>0? '>' : '<';
        const mid = a>0? '>':'<';
        // a x + b > 0 -> a x > -b -> x > k (if a>0)
        const q=`${a}x ${b>=0?'+':'-'} ${Math.abs(b)} ${mid} 0`;
        return { q, a:`x${dir}${k}`, hint:'移项后，两边同除以 a；a 为负时不等号要反向。', num:`${dir}${k}` };
      }
    },
    {
      id:'square', name:'完全平方公式', subject:'数学',
      gen(){
        const a=ri(8)+2, b=ri(8)+1;
        const q=`计算：(${a}x + ${b})²`;
        const A = `x² 的系数 ${a*a}，x 的系数 ${2*a*b}，常数 ${b*b}`;
        return { q, a:`${a*a}x² ${2*a*b>0?'+':''}${2*a*b}x + ${b*b}`, hint:'(a+b)² = a² + 2ab + b²。', reveal:true };
      }
    }
  ];

  function all(){ return TYPES.map(t=>({id:t.id,name:t.name,subject:t.subject})); }
  function byId(id){ return TYPES.find(t=>t.id===id); }

  // 知识点关键词 -> 生成器
  function matchByKnowledge(text){
    if(!text) return null;
    if(/不等式/.test(text)) return 'ineq';
    if(/一元二次|二次方程/.test(text)) return 'quad';
    if(/方程组|二元/.test(text)) return 'system';
    if(/运算|计算|有理数/.test(text)) return 'calc';
    if(/方程/.test(text)) return 'linear';
    if(/完全平方|平方/.test(text)) return 'square';
    return null;
  }

  // 遗忘曲线
  const INTERVALS = [1,2,4,7,15];
  function schedule(stage){
    stage = Math.max(0, Math.min(stage, INTERVALS.length-1));
    const days = INTERVALS[stage];
    const d = new Date(); d.setHours(23,59,59,999);
    d.setDate(d.getDate()+days);
    return { stage, nextDue: d.getTime(), done: stage >= INTERVALS.length };
  }
  function onReview(m, ok){
    const stage = ok ? m.stage+1 : 0;
    const s = schedule(stage);
    return Object.assign({}, m, { stage: s.stage, nextDue: s.nextDue, done: s.done, lastReview: Date.now() });
  }
  function dueToday(m){
    if(m.done) return false;
    const end = new Date(); end.setHours(23,59,59,999);
    return (m.nextDue || 0) <= end.getTime();
  }

  return { all, byId, matchByKnowledge, INTERVALS, schedule, onReview, dueToday, frac };
})();
