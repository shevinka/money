/* ====== App state ====== */
const STORAGE_KEY = 'voice_money_recorder_v1';
let entries = []; // {name, amount:number, note}
const container = document.getElementById('container');
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
function showApp(){ home.style.display='none'; app.style.display='flex'; container.classList.add('open'); updateUI(); /* scrollToBottom(); */ }

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
    saveStorage(); updateUI(); //scrollToBottom();
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
let isListening = false;
let isCanceled = false;

function isSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.lang = 'ko-KR';
  r.interimResults = false;
  r.continuous = false;
  return r;
}

voiceBtn.addEventListener('click', () => {
  if (!isSpeechAvailable()) {
    alert('이 브라우저는 음성인식을 지원하지 않습니다. (iOS Safari 권장)');
    return;
  }

  recognition = setupSpeech();
  if (!recognition) {
    alert('음성 인식 초기화 실패');
    return;
  }

  isCanceled = false;
  isListening = true;

  showModal(voiceModal);
  voiceStatus.textContent = '듣는 중... 이름과 금액을 한 번에 말하세요.';

  try {
    recognition.start();
  } catch (e) {
    console.warn(e);
  }

  recognition.onresult = (ev) => {
    if (isCanceled) return; // 취소 시 무시

    const transcript = ev.results[0][0].transcript.trim();
    console.log('🎤 인식 결과:', transcript);

    const parsed = splitNameAndAmount(transcript);
    console.log('🧩 파싱 결과:', parsed);

    // 키워드 검출
    const remarkKeywords = ['계좌이체', '이전전달', '이후전달', '현금', '카드', '영수증'];
    const norm = transcript.replace(/\s+/g, '');
    let foundRemark = '';

    for (const kw of remarkKeywords) {
      if (norm.includes(kw)) {
        foundRemark = kw;
        break;
      }
      // 중간에 띄어쓰기 있는 경우 대응
      const chars = kw.split('');
      let pos = 0, ok = true;
      for (const ch of chars) {
        pos = norm.indexOf(ch, pos);
        if (pos === -1) { ok = false; break; }
        pos++;
      }
      if (ok) {
        foundRemark = kw;
        break;
      }
    }

    // 결과 조합
    let final = {
      name: parsed?.name || '',
      amount: parsed?.amount || 0,
      note: parsed?.note || ''
    };

    if (foundRemark) {
      final.name = final.name.replace(new RegExp(foundRemark, 'g'), '').trim();
      if (!final.amount || final.amount <= 9) {
        final.amount = 0;
        final.note = foundRemark;
      } else {
        final.note = final.note || foundRemark;
      }
    }

    // 이름에 '계좌' 포함 시 자동 정리
    if (/계좌|이체/.test(final.name)) {
      final.name = final.name.replace(/계좌|이체|계좌이체/g, '').trim();
      if (!final.note) final.note = '계좌이체';
    }

    if (final && final.name) {
      entries.push({
        name: final.name,
        amount: Number(final.amount) || 0,
        note: final.note || ''
      });
      saveStorage();
      hideModal(voiceModal);
      showToast(
        final.note
          ? `추가: ${final.name} — [${final.note}]`
          : `추가: ${final.name} — ${final.amount.toLocaleString()}원`
      );
      scrollToBottom();
      recognition = null;
    } else {
      hideModal(voiceModal);
      showModal(voiceFailModal);
    }
  };

  recognition.onerror = (e) => {
    if (isCanceled) return; // 사용자가 취소한 경우 무시
    console.warn('🎤 인식 오류:', e);
    hideModal(voiceModal);
    showModal(voiceFailModal);
    recognition = null;
  };

  recognition.onend = () => {
    isListening = false;
    if (!isCanceled && recognition) {
      // 취소가 아닌 종료일 경우 실패창 표시
      hideModal(voiceModal);
      showModal(voiceFailModal);
    }
    recognition = null;
  };
});

// 🔹 취소 버튼 즉시 닫힘
voiceCancel.addEventListener('click', () => {
  if (isListening && recognition) {
    isCanceled = true;
    recognition.stop();
    hideModal(voiceModal);
    recognition = null;
    console.log('🛑 음성인식 취소');
  }
});

// 🔹 실패창 재시도 / 취소
voiceFailRetry.addEventListener('click', () => {
  hideModal(voiceFailModal);
  voiceBtn.click();
});
voiceFailCancel.addEventListener('click', () => {
  hideModal(voiceFailModal);
});





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
  if (isNaN(amount) || amount < 0) {
    alert('금액을 인식하지 못했습니다. 숫자(예: 5000) 또는 한글(오천원)을 입력하세요.');
    return;
  }
  entries.push({name, amount, note: ''});
  saveStorage();
  hideModal(manualModal);
  showToast('항목 추가됨');
  scrollToBottom();
});

/* ====== Export (xlsx) ====== */

document.getElementById("exportBtn").addEventListener("click", async () => {
  try {
    const table = document.querySelector("table");
    if (!table) {
      alert("저장할 표가 없습니다.");
      return;
    }


     // 표 데이터 수집 (삭제 버튼 칸 제외)
    const rows = Array.from(table.querySelectorAll("tr")).map(tr => {
      const cells = Array.from(tr.querySelectorAll("th, td"));
      // 🔽 마지막 칸(삭제 버튼)이면 제외
      cells.pop();
      return cells.map(td => td.innerText.trim());
    });

    // 엑셀 시트 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "기록표");

    // 파일명 자동 생성
    const filename = "sheet_" + new Date().toISOString().slice(0,10) + ".xlsx";

    // 바이너리 → Blob 변환
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    // 🔗 직접 링크 생성
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // iOS 호환: 사용자 동작 내에서 명시적으로 클릭
    document.body.appendChild(link);
    link.click();

    // 메모리 해제
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 500);

    //alert("📁 다운로드가 시작되었습니다.\n\n'파일' 앱 → '다운로드' 폴더에서 확인하세요.");

  } catch (err) {
    console.error("엑셀 저장 오류:", err);
    alert("엑셀 파일 저장 중 오류가 발생했습니다.");
  }
});


/* ====== Helpers: parsing ====== */
/* Attempt to split '이름+금액' from transcript.
   Strategy:
   - Try to find the amount token: either digits (e.g. '5000', '5,000', '5천') or Korean money words containing 십/백/천/만/억 or number words.
   - If found, extract numeric value via parseKoreanMoney, and name = rest (trim)
*/
function splitNameAndAmount(text) {
  text = text.replace(/\s+/g, ' ').trim(); // 여분 공백 제거

  // 1️⃣ "홍길동 계좌이체" 같은 특수 케이스 먼저
  const specialRemarkRegex = /(계좌이체|이전전달|이후전달)/;
  const specialMatch = text.match(specialRemarkRegex);
  if (specialMatch) {
    const name = text.replace(specialRemarkRegex, '').trim();
    const remark = specialMatch[1];
    return { name, amount: 0, remark };
  }

  // 2️⃣ 금액 인식 패턴 (숫자, 한글, 띄어쓰기 포함)
  const amountRegex = /(\d{1,3}(?:[.,]?\d{3})*|[일이삼사오육칠팔구십백천만억]+)\s*(원|만\s*원|천\s*원|백\s*원)?/;
  const match = text.match(amountRegex);

  if (!match) {
    return { name: text, amount: 0, remark: '' };
  }

  // 금액 부분 정리
  let rawAmount = match[1].replace(/[^\d]/g, '');
  let unit = match[2] ? match[2].replace(/\s+/g, '') : '';

  let amount = 0;

  // 숫자가 포함된 경우
  if (rawAmount) {
    amount = parseInt(rawAmount, 10);
    if (unit.includes('만')) amount *= 10000;
    else if (unit.includes('천')) amount *= 1000;
    else if (unit.includes('백')) amount *= 100;
  } else {
    // 순수 한글 금액 처리 (십오만, 오천 등)
    const numMap = { 일:1, 이:2, 삼:3, 사:4, 오:5, 육:6, 칠:7, 팔:8, 구:9 };
    const unitMap = { 십:10, 백:100, 천:1000, 만:10000, 억:100000000 };
    let temp = 0, total = 0;

    for (const ch of match[1]) {
      if (numMap[ch]) temp = numMap[ch];
      else if (unitMap[ch]) {
        total += (temp || 1) * unitMap[ch];
        temp = 0;
      }
    }
    total += temp;
    amount = total;
  }

  const name = text.replace(match[0], '').trim();
  return { name, amount, remark: '' };
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
function scrollToBottom(){ 
  setTimeout(() => { 
    const wrap = document.getElementById('tableContainer');
    if (wrap) wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
  },120); 
}



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




