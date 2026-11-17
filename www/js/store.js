/* 数据层：状态存 localStorage，答题卡图片存 IndexedDB */
const Store = (() => {
  const KEY = 'study-assistant-state-v1';
  const DB_NAME = 'study-assistant-db';
  const FILE_STORE = 'files';

  let dbPromise = null;
  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if(!req.result.objectStoreNames.contains(FILE_STORE)){
          req.result.createObjectStore(FILE_STORE);
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbPromise;
  }

  const SUBJECT_PALETTE = ['#4f6ef7','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6'];

  function defaults(){
    return {
      profile: { name:'', grade:'', examName:'', examDate:'', targetTotal:'' },
      subjects: [
        { id:uid(), name:'语文', color:'#4f6ef7', full:150 },
        { id:uid(), name:'数学', color:'#22c55e', full:150 },
        { id:uid(), name:'英语', color:'#f59e0b', full:150 },
        { id:uid(), name:'物理', color:'#8b5cf6', full:100 },
        { id:uid(), name:'化学', color:'#ef4444', full:100 },
        { id:uid(), name:'生物', color:'#84cc16', full:100 },
        { id:uid(), name:'历史', color:'#f97316', full:100 },
        { id:uid(), name:'地理', color:'#06b6d4', full:100 },
        { id:uid(), name:'政治', color:'#ec4899', full:100 },
      ],
      exams: [],      // {id, name, date, entries:{[subjId]:{score,full,avg,classRank,gradeRank}}, photos:[fileId], note}
      mistakes: [],   // {id, subjectId, examId, type, knowledge, question, photoId, wrong, right, analysis, created, stage, nextDue, done}
      patches: [],    // 卡点急救包 {id, trigger, bug, patch, created, hits}
      targets: {},    // subjectId -> score
      settings: { theme:'light' }
    };
  }

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  let state = null;
  function load(){
    if(state) return state;
    try{
      const raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
      // 合并默认科目/设置
      const d = defaults();
      state.profile = Object.assign({}, d.profile, state.profile||{});
      state.settings = Object.assign({}, d.settings, state.settings||{});
      if(!state.subjects || !state.subjects.length) state.subjects = d.subjects;
      if(!Array.isArray(state.patches)) state.patches = [];
    }catch(e){ state = defaults(); }
    applyTheme(state.settings.theme);
    return state;
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){ toast && toast('保存失败，存储空间可能已满'); }
  }
  function reset(){ state = defaults(); save(); }

  function applyTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    const b = document.getElementById('btn-theme');
    if(b) b.textContent = t === 'dark' ? '☀' : '☾';
  }

  // ---- 图片 ----
  async function putImage(blob, id){
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).put(blob, id);
      tx.oncomplete = () => res(id);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function getImage(id){
    const db = await openDB();
    return new Promise((res, rej) => {
      const req = db.transaction(FILE_STORE).objectStore(FILE_STORE).get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function imageUrl(id){
    const blob = await getImage(id);
    if(!blob) return null;
    return URL.createObjectURL(blob);
  }
  async function deleteImage(id){
    const db = await openDB();
    return new Promise((res, rej) => {
      const req = db.transaction(FILE_STORE,'readwrite').objectStore(FILE_STORE).delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  // ---- 导入导出 ----
  function exportJSON(){
    const out = JSON.parse(JSON.stringify(state));
    delete out.settings;
    return new Blob([JSON.stringify(out, null, 1)], {type:'application/json'});
  }
  function importJSON(obj){
    if(!obj || !Array.isArray(obj.subjects) || !Array.isArray(obj.exams) || !Array.isArray(obj.mistakes)){
      throw new Error('文件格式不正确');
    }
    const d = defaults();
    state = Object.assign(d, obj);
    state.settings = d.settings;
    state.profile = Object.assign({}, d.profile, obj.profile||{});
    save();
  }

  return {
    get: () => load(), save, reset, uid,
    putImage, getImage, imageUrl, deleteImage,
    exportJSON, importJSON, applyTheme,
    palette: SUBJECT_PALETTE,
  };
})();
