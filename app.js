
const SKEY = 'mt_light_runs_v1';
const $ = sel => document.querySelector(sel);
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

function parseISO(d){ return new Date(d + 'T00:00:00'); }
function fmtDate(dateStr){
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const wd = WEEKDAYS[(d.getDay()+6)%7];
  return `${wd}, ${dd}.${mm}`;
}
function pace(mins, km){
  if (!km || !mins) return '—';
  const v = mins/km;
  const m = Math.floor(v);
  const s = String(Math.round((v-m)*60)).padStart(2,'0');
  return `${m}:${s}/км`;
}

function findCurrentWeek(){
  const today = new Date();
  for (const w of PLAN.weeks){
    const start = parseISO(w.start);
    const end = new Date(start); end.setDate(start.getDate()+6);
    if (today >= start && today <= end) return w;
  }
  if (today < parseISO(PLAN.weeks[0].start)) return PLAN.weeks[0];
  return PLAN.weeks[PLAN.weeks.length-1];
}

function renderThisWeek(){
  const w = findCurrentWeek();
  const wrap = document.getElementById('thisWeekList');
  wrap.innerHTML = '';
  const sessions = [...w.sessions].sort((a,b)=> new Date(a.date) - new Date(b.date));
  const todayStr = new Date().toISOString().slice(0,10);
  sessions.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'thisweek-item' + (s.date===todayStr ? ' today' : '');
    const left = document.createElement('div');
    left.innerHTML = `<div class="thisweek-date">${fmtDate(s.date)}</div>
                      <div><span class="type ${s.type}">${s.type}</span> ${s.name}</div>`;
    const right = document.createElement('div');
    right.className = 'thisweek-right';
    right.innerHTML = `<div>${s.distance_km} км</div><div>${s.target_pace||'—'}</div>`;
    div.appendChild(left); div.appendChild(right);
    wrap.appendChild(div);
  });
}

function renderPlan(){
  document.getElementById('raceLbl').textContent = PLAN.race_date.split('-').reverse().join('.');
  const days = Math.max(0, Math.ceil((new Date(PLAN.race_date) - new Date())/86400000));
  document.getElementById('countdown').textContent = `${days} дней до старта`;

  let html = '<table><thead><tr><th>Неделя</th><th>Дата</th><th>Название</th><th>Тип</th><th>Км</th><th>Целевой темп</th><th>Описание</th></tr></thead><tbody>';
  PLAN.weeks.forEach(w=>{
    const sessions = [...w.sessions].sort((a,b)=> new Date(a.date) - new Date(b.date));
    sessions.forEach(s=>{
      const isToday = s.date === new Date().toISOString().slice(0,10);
      html += `<tr style="${isToday?'background:#e9f5ff':''}">
        <td>${w.week}</td>
        <td>${fmtDate(s.date)}</td>
        <td>${s.name}</td>
        <td><span class="type ${s.type}">${s.type}</span></td>
        <td>${s.distance_km}</td>
        <td>${s.target_pace||'—'}</td>
        <td>${s.notes||''}</td>
      </tr>`;
    });
  });
  html += '</tbody></table>';
  document.getElementById('planTableWrap').innerHTML = html;
}

function load(){ return JSON.parse(localStorage.getItem(SKEY) || '[]'); }
function save(arr){ localStorage.setItem(SKEY, JSON.stringify(arr)); renderLog(); }

function addRun(){
  const date = $('#runDate').value;
  const km = parseFloat($('#runDist').value);
  const mins = parseFloat($('#runMins').value);
  const hr = parseInt($('#runHR').value||'0',10)||null;
  if (!date || !isFinite(km) || !isFinite(mins) || km<=0 || mins<=0){
    alert('Проверь дату, километры и минуты.'); return;
  }
  const arr = load(); arr.push({date, km, mins, hr}); save(arr);
  $('#runDist').value=''; $('#runMins').value=''; $('#runHR').value='';
}

function renderLog(){
  const arr = load();
  const tbody = $('#runsTable tbody'); tbody.innerHTML='';
  arr.sort((a,b)=> new Date(b.date) - new Date(a.date));
  arr.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(r.date)}</td><td>${r.km}</td><td>${pace(r.mins,r.km)}</td><td>${r.hr||'—'}</td>
    <td><button data-i="${i}">Удалить</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-i]').forEach(btn=>{
    btn.onclick = ()=>{ const i = +btn.dataset.i; const arr = load(); arr.splice(i,1); save(arr); };
  });
}

function importCsv(){
  const txt = $('#csvText').value.trim(); if (!txt) return;
  const lines = txt.split(/\r?\n/);
  const head = lines.shift().split(',');
  const idxDate = head.findIndex(h=>/date/i.test(h));
  const idxDist = head.findIndex(h=>/distance/i.test(h));
  const idxElapsed = head.findIndex(h=>/elapsed/i.test(h));
  const idxHR = head.findIndex(h=>/heart/i.test(h));
  const idxType = head.findIndex(h=>/type/i.test(h));
  if (idxDate<0 || idxDist<0 || idxElapsed<0){ alert('Не найдены нужные колонки.'); return; }
  const arr = load();
  const toMin = s => {
    if (/\d+:\d+:\d+/.test(s)){ const [h,m,ss] = s.split(':').map(Number); return h*60 + m + ss/60; }
    if (/^\d+:\d+$/.test(s)){ const [m,ss] = s.split(':').map(Number); return m + ss/60; }
    const f = parseFloat(s); return isNaN(f)?NaN:f/60;
  };
  lines.forEach(line=>{
    if (!line.trim()) return;
    const cols = line.split(',');
    const type = (cols[idxType]||'').toLowerCase();
    if (type && !/run/.test(type)) return;
    const date = cols[idxDate];
    const km = parseFloat(cols[idxDist]);
    const mins = toMin(cols[idxElapsed]);
    const hr = parseInt(cols[idxHR]||'0',10)||null;
    if (isFinite(km) && isFinite(mins)) arr.push({date, km, mins, hr});
  });
  save(arr); $('#csvText').value='';
}

function exportJson(){
  const blob = new Blob([JSON.stringify({plan:PLAN, runs:load()}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'marathon_data.json'; a.click();
}

function tabs(){
  $('#tabPlan').onclick = ()=>{
    $('#tabPlan').classList.add('active'); $('#tabLog').classList.remove('active'); $('#tabImport').classList.remove('active');
    $('#viewPlan').style.display='block'; $('#viewLog').style.display='none'; $('#viewImport').style.display='none';
  };
  $('#tabLog').onclick = ()=>{
    $('#tabLog').classList.add('active'); $('#tabPlan').classList.remove('active'); $('#tabImport').classList.remove('active');
    $('#viewPlan').style.display='none'; $('#viewLog').style.display='block'; $('#viewImport').style.display='none';
  };
  $('#tabImport').onclick = ()=>{
    $('#tabImport').classList.add('active'); $('#tabPlan').classList.remove('active'); $('#tabLog').classList.remove('active');
    $('#viewPlan').style.display='none'; $('#viewLog').style.display='none'; $('#viewImport').style.display='block';
  };
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderThisWeek();
  renderPlan();
  renderLog();
  tabs();
  $('#addRun').onclick = addRun;
  $('#importCsv').onclick = importCsv;
  $('#exportJson').onclick = exportJson;
});
