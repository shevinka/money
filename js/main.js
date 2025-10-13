/* ====== App state ====== */
const STORAGE_KEY = 'voice_money_recorder_v1';
let entries = []; // {name, amount:number, note}
const home = document.getElementById('home');
const app = document.getElementById('app');
const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const startConfirmModal = document.getElementById('startConfirmModal');
const startOk = document.getElementById('startOk');
const startCancel = document.getElementById('startCancel');

const tbody = document.getElementById('tbody');
const statusHint = document.getElementById('statusHint');
const sumBox = document.getElementById('sumBox');
const voiceBtn = document.getElementById('voiceBtn');
const manualBtn = document.getElementById('manualBtn');
const exportBtn = document.getElementById('exportBtn');

const voiceModal = document.getElementById('voiceModal');
const voiceStatus = document.getElementById('voiceStatus');
const voiceCancel = document.getElementById('voiceCancel');

const voiceFailModal = document.getElementById('voiceFailModal');
const voiceFailRetry = document.getElementById('voiceFailRetry');
const voiceFailCancel = document.getElementById('voiceFailCancel');

const manualModal = document.getElementById('manualModal');
const manualName = document.getElementById('manualName');
const manualAmount = document.getElementById('manualAmount');
const manualOk = document.getElementById('manualOk');
const manualCancel = document.getElementById('manualCancel');

const toast = document.getElementById('toast');

function saveStorage(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); updateUI(); }
function loadStorage(){ try{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):[] }catch(e){return []} }
function clearStorage(){ localStorage.removeItem(STORAGE_KEY); entries=[]; updateUI(); showToast('데이터 초기화됨'); }

function showHome(){ home.style.display='flex'; app.style.display='none'; }
function showApp(){ home.style.display='none'; app.style.display='flex'; updateUI(); scrollToBottom(); }

function showModal(el){ el.classList.add('show'); el.setAttribute('aria-hidden','false'); }
function hideModal(el){ el.classList.remove('show'); el.setAttribute('aria-hidden','true'); }
function showToast(msg, t=1800){ toast.textContent=msg; toast.style.display='block'; setTimeout(()=>{ toast.style.display='none'; }, t); }

/* ====== Start / Continue logic ====== */
startBtn.addEventListener('click', ()=>{
  const stored = loadStorage();
  if(stored && stored.length>0){
    showModal(startConfirmModal);
  }else{
    entries = []; saveStorage(); openApp();
  }
});

startOk.addEventListener('click', ()=>{
  hideModal(startConfirmModal);
  entries = []; saveStorage();
  openApp();
});
startCancel.addEventListener('click', ()=>{ hideModal(startConfirmModal); });

continueBtn.addEventListener('click', ()=>{
  entries = loadStorage();
  openApp();
});

function openApp(){
  showApp();
  entries = loadStorage();
  updateUI();
}

/* ====== UI rendering ====== */
function formatAmount(n){
  if(!n && n !== 0) return '';
  return Number(n).toLocaleString() + ' 원';
}
function calcSum(){
  return entries.reduce((s,e)=>s + (Number(e.amount)||0), 0);
}
function updateUI(){
  tbody.innerHTML = '';
  entries.forEach((e, idx)=>{
    const tr = document.createElement('tr');
    const noTd = document.createElement('td'); noTd.textContent = idx+1;
    const nameTd = document.createElement('td');nameTd.className='name'; nameTd.innerHTML = `<div class="nameText">${escapeHtml(e.name||'')}</div>`;
    const amtTd = document.createElement('td'); amtTd.className='amount'; amtTd.innerHTML = `<div class="amountText">${formatAmount(e.amount)}</div>`;
    const noteTd = document.createElement('td'); noteTd.innerHTML = `<div class="noteText">${escapeHtml(e.note||'')}</div>`;
    const actionTd = document.createElement('td'); actionTd.className='actions';
    const delBtn = document.createElement('button'); delBtn.className='btn ghost'; delBtn.textContent='삭제';
    delBtn.addEventListener('click', ()=>{ if(confirm('항목을 삭제하시겠습니까?')){ entries.splice(idx,1); saveStorage(); }});
    actionTd.appendChild(delBtn);

    // make editable on tap: name / amount / note
    nameTd.addEventListener('click', ()=>{ openInlineEdit(idx,'name'); });
    amtTd.addEventListener('click', ()=>{ openInlineEdit(idx,'amount'); });
    noteTd.addEventListener('click', ()=>{ openInlineEdit(idx,'note'); });

    tr.appendChild(noTd); tr.appendChild(nameTd); tr.appendChild(amtTd); tr.appendChild(noteTd); tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });

  statusHint.textContent = `저장된 항목: ${entries.length}`;
  sumBox.textContent = `합계: ${calcSum().toLocaleString()} 원`;
}

/* inline edit */
function openInlineEdit(idx, field){
  const row = tbody.children[idx];
  if(!row) return;
  const current = entries[idx];
  // determine which cell index: name=1, amount=2, note=3
  const cellIndex = (field==='name')?1:(field==='amount')?2:3;
  const td = row.children[cellIndex];
  const originalHtml = td.innerHTML;
  // clear and create input
  td.innerHTML = '';
  const input = document.createElement('input');
  input.className = 'edit-input';
  if (field === 'amount') input.setAttribute('inputmode', 'numeric');
  input.value = field === 'amount' ? (current.amount || '') : (current[field] || '');
  td.appendChild(input);
  input.focus();

  // commit on blur or Enter, cancel on Escape
  let committed = false;
  function commit(){
    if(committed) return; committed = true;
    const v = input.value.trim();
    if(field === 'amount'){
      const parsed = parseKoreanMoney(v);
      if(isNaN(parsed)){
        showToast('금액을 인식할 수 없습니다');
        td.innerHTML = originalHtml; return;
      }
      entries[idx].amount = parsed;
    } else {
      entries[idx][field] = v;
    }
    saveStorage(); updateUI(); scrollToBottom();
  }
  function cancel(){
    if(committed) return; td.innerHTML = originalHtml;
  }

  input.addEventListener('blur', ()=>{ commit(); });
  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if(e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}


/* ====== Voice input ====== */
let recognition = null;
function isSpeechAvailable(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function setupSpeech(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.lang = 'ko-KR';
  r.interimResults = false;
  r.continuous = false;
  return r;
}

voiceBtn.addEventListener('click', ()=>{
  if(!isSpeechAvailable()){
    alert('이 브라우저는 음성인식을 지원하지 않습니다. (iOS Safari의 경우 제한적일 수 있음)');
    return;
  }
  recognition = setupSpeech();
  if(!recognition){ alert('음성 인식 준비 실패'); return; }
  showModal(voiceModal);
  voiceStatus.textContent = '듣는 중... 이름과 금액을 한 번에 말하세요.';
  try{
    recognition.start();
  }catch(e){ console.warn(e); }

  recognition.onresult = (ev)=>{
    const transcript = ev.results[0][0].transcript.trim();
    // parse into name + amount
    const parsed = splitNameAndAmount(transcript);
    if(parsed && parsed.amount>0 && parsed.name){
      // add entry
      entries.push({name: parsed.name, amount: parsed.amount, note: ''});
      saveStorage();
      hideModal(voiceModal);
      showToast(`추가: ${parsed.name} — ${parsed.amount.toLocaleString()}원`);
      scrollToBottom();
      recognition = null;
    } else {
      // failure
      hideModal(voiceModal);
      showModal(voiceFailModal);
    }
  };

  recognition.onerror = (e)=>{
    hideModal(voiceModal);
    showModal(voiceFailModal);
    recognition = null;
  };

  recognition.onend = ()=>{
    // if recognition ended without result, show fail modal
    // (we avoid double-show when onresult handled)
  };
});

voiceCancel.addEventListener('click', ()=>{
  try{ if(recognition) recognition.stop(); }catch(e){}
  hideModal(voiceModal);
  recognition = null;
});

voiceFailRetry.addEventListener('click', ()=>{
  hideModal(voiceFailModal);
  voiceBtn.click(); // reopen
});
voiceFailCancel.addEventListener('click', ()=>{ hideModal(voiceFailModal); });

/* ====== Manual input ====== */
manualBtn.addEventListener('click', ()=>{
  manualName.value=''; manualAmount.value='';
  showModal(manualModal);
  setTimeout(()=>manualName.focus(),150);
});
manualCancel.addEventListener('click', ()=>{ hideModal(manualModal); });
manualOk.addEventListener('click', ()=>{
  const name = manualName.value.trim();
  const amountText = manualAmount.value.trim();
  if(!name){ alert('이름을 입력하세요.'); return; }
  const amount = parseKoreanMoney(amountText);
  if(isNaN(amount) || amount<=0){ alert('금액을 인식하지 못했습니다. 숫자(예: 5000) 또는 한글(오천원)을 입력하세요.'); return; }
  entries.push({name, amount, note: ''});
  saveStorage();
  hideModal(manualModal);
  showToast('항목 추가됨');
  scrollToBottom();
});

/* ====== Export (xlsx) ====== */
/* exportBtn.addEventListener('click', ()=>{
  if(entries.length===0){ alert('저장된 항목이 없습니다.'); return; }
  const aoa = [['#','이름','금액','비고']];
  entries.forEach((e,i)=> aoa.push([i+1, e.name, e.amount, e.note||'']));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '기록');
  const fname = `records_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;
  XLSX.writeFile(wb, fname);
});
 */
document.getElementById("saveExcelBtn").addEventListener("click", downloadExcel);
function downloadExcel() {
  // 현재 테이블 데이터를 가져옵니다.
  const table = document.querySelector("table");
  const rows = Array.from(table.querySelectorAll("tr"));
  
  // 데이터를 배열로 변환
  const data = rows.map(row => 
    Array.from(row.querySelectorAll("th, td")).map(cell => cell.innerText.trim())
  );

  // workbook 생성
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "기록표");

  // workbook을 ArrayBuffer로 변환
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Blob 생성 (MIME 타입: binary/octet-stream)
  const blob = new Blob([wbout], { type: 'application/octet-stream' });

  // 🔗 직접 다운로드 링크 생성
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // 파일명에 날짜 자동 포함
  const filename = '기록표_' + new Date().toISOString().slice(0,10) + '.xlsx';
  a.download = filename;

  // 링크를 문서에 추가 후 강제 클릭 → 다운로드 실행
  document.body.appendChild(a);
  a.click();

  // 메모리 정리
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  // 안내 메시지 (iOS용)
  //alert("다운로드가 완료되었습니다.\n\n'파일' 앱 → '다운로드' 폴더에서 확인하세요.");
}


/* ====== Helpers: parsing ====== */
/* Attempt to split '이름+금액' from transcript.
   Strategy:
   - Try to find the amount token: either digits (e.g. '5000', '5,000', '5천') or Korean money words containing 십/백/천/만/억 or number words.
   - If found, extract numeric value via parseKoreanMoney, and name = rest (trim)
*/
function splitNameAndAmount(text){
  if(!text) return null;
  // remove filler particles
  let t = text.replace(/\s+/g,' ').trim();
  // common patterns: '홍길동 5천원', '홍길동 오천원', '회사명 만원', '홍길동 5,000원'
  // find last occurrence of money-like substring
  // regex: numeric with optional commas + optional '원', or korean number words + optional '원'
  const numericRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*원?|\d+\s*원?)/g;
  const koreanNumRegex = /([일이삼사오육칠팔구영공십백천만억兆兆]+)\s*원?/g; // expanded for common han-kor digits
  let match, idx=-1, matchedStr='';
  // prefer numeric (digits)
  const numMatches = [...t.matchAll(numericRegex)];
  if(numMatches.length>0){
    match = numMatches[numMatches.length-1];
    matchedStr = match[0];
    idx = match.index;
  } else {
    const korMatches = [...t.matchAll(koreanNumRegex)];
    if(korMatches.length>0){
      match = korMatches[korMatches.length-1];
      matchedStr = match[0];
      idx = match.index;
    }
  }
  // Also support phrases like "오천 원", "삼만오천원" without space matched above
  if(matchedStr){
    const before = t.slice(0, idx).trim();
    const amount = parseKoreanMoney(matchedStr);
    const name = before || t.replace(matchedStr,'').trim();
    return {name: cleanName(name), amount};
  } else {
    // attempt a fallback: if last token contains a number word at the end
    const parts = t.split(' ');
    if(parts.length>=2){
      const last = parts[parts.length-1];
      const amount = parseKoreanMoney(last);
      if(!isNaN(amount) && amount>0){
        const name = parts.slice(0, parts.length-1).join(' ');
        return {name: cleanName(name), amount};
      }
    }
  }

  return null;
}

function cleanName(s){
  if(!s) return '';
  return s.replace(/^(이름|회사명|성함)\s*/i,'').trim();
}

/* parseKoreanMoney: accepts
   - digits (with commas) optionally with '원'
   - Korean text numbers like '오천오백', '삼만오천', '일억이천삼백만원' and with '원'
*/
function parseKoreanMoney(input){
  if(input === null || input === undefined) return NaN;
  let s = String(input).trim();
  if(!s) return NaN;
  // remove spaces and '원' and commas
  s = s.replace(/\s+/g,'').replace(/원/g,'').replace(/,/g,'');
  // if purely digits
  if(/^[0-9]+$/.test(s)) return Number(s);

  // map for single digits
  const numMap = {'영':0,'공':0,'영':0,'일':1,'이':2,'삼':3,'사':4,'오':5,'육':6,'칠':7,'팔':8,'구':9};
  const unitMap = {'십':10,'백':100,'천':1000,'만':10000,'억':100000000};
  // handle mixed like '3천5백' (contains ascii digits)
  if(/[0-9]/.test(s) && /[가-힣]/.test(s)){
    // replace ascii digits with Korean equivalents? simpler: try to extract groups of digits and multiply by unit chars
    // fallback: extract digits
    const digits = (s.match(/\d+/g)||[]).join('');
    if(digits) return Number(digits);
  }

  // parse algorithm for pure Hangul numeric expressions
  let total = 0;
  let section = 0; // within 만/억 sections
  let number = 0;
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(ch in numMap){
      number = numMap[ch];
    } else if(ch in unitMap){
      const unit = unitMap[ch];
      if(unit >= 10000){
        // 만, 억 : roll section
        section = (section + (number || 1));
        total += section * unit;
        section = 0;
        number = 0;
      } else {
        section += (number || 1) * unit;
        number = 0;
      }
    } else {
      // unknown char, skip
      number = 0;
    }
  }
  return total + section + (number || 0);
}

/* Utility */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function scrollToBottom(){ setTimeout(()=>{ const wrap=document.getElementById('tableWrap'); if(wrap) wrap.scrollTop = wrap.scrollHeight; },120); }

/* init */
(function init(){
  // load storage to detect existing data
  const stored = loadStorage();
  if(stored && stored.length>0){
    // show home with option
    showHome();
  } else {
    showHome();
  }
})();

/* autosave on any change already handled via saveStorage() calls */

/* If user navigates away, save (safety) */
window.addEventListener('beforeunload', ()=>{ saveStorage(); });