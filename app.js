(function () {
'use strict';
// 妹妹用的清單 app：資料來自 data/items.json（後台更新），勾選記錄只存在這支手機
var DATA_KEY = 'daigou-data', MARK_KEY = 'daigou-marks';
var data = read(DATA_KEY) || null;
var marks = read(MARK_KEY) || {};
var ui = {filter: 'all', store: '', offline: false, loading: !data};

function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function num(n) { return Math.round(n).toLocaleString('en-US'); }
function twdOf(it) { return (it.twd !== '' && it.twd != null) ? Number(it.twd) : Math.round(Number(it.jpy || 0) * Number(data.rate || 0)); }
function mark(id) { return marks[id] || {}; }
function status(id) { return mark(id).status || ''; }
function setMark(id, patch) { marks[id] = Object.assign({}, mark(id), patch); write(MARK_KEY, marks); render(); }
function fmtTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function stores() { var o = []; data.items.forEach(function (it) { if (it.store && o.indexOf(it.store) < 0) o.push(it.store); }); return o; }

var $app = document.getElementById('app');

function render() {
  if (!data) {
    $app.innerHTML = '<div class="wrap"><div class="empty">' + (ui.loading ? '正在下載清單⋯⋯' : '第一次開啟需要網路，請連上網路後重新開啟。') + '</div></div>' + overlays();
    return;
  }
  document.title = data.title || '代購清單';
  var items = data.items;
  var done = items.filter(function (i) { return status(i.id) === 'done'; });
  var pct = items.length ? Math.round(done.length / items.length * 100) : 0;
  var totJ = 0, totT = 0, doneJ = 0, doneT = 0;
  items.forEach(function (i) {
    var q = Number(i.qty || 1), j = Number(i.jpy || 0) * q, t = twdOf(i) * q;
    totJ += j; totT += t;
    if (status(i.id) === 'done') { doneJ += j; doneT += t; }
  });
  var st = stores();
  if (ui.store && st.indexOf(ui.store) < 0) ui.store = '';
  var shown = items.filter(function (i) {
    var s = status(i.id);
    if (ui.filter === 'todo' && s) return false;
    if (ui.filter === 'done' && s !== 'done') return false;
    if (ui.filter === 'oos' && s !== 'oos') return false;
    if (ui.store && i.store !== ui.store) return false;
    return true;
  });
  var oosN = items.filter(function (i) { return status(i.id) === 'oos'; }).length;

  var h = '<header><div class="wrap">';
  h += '<div class="top"><h1>' + esc(data.title) + '</h1><button class="iconbtn" data-act="menu">☰ 選單</button></div>';
  h += '<div class="progress"><div class="bar"><i style="width:' + pct + '%"></i></div><b>已買 ' + done.length + ' / ' + items.length + '</b></div>';
  h += '<div class="totals">';
  h += '<div class="tot"><small>全部預算</small><span>¥' + num(totJ) + '</span><em>≈ NT$' + num(totT) + '</em></div>';
  h += '<div class="tot"><small>已花費</small><span>¥' + num(doneJ) + '</span><em>≈ NT$' + num(doneT) + '</em></div>';
  h += '</div>';
  if (data.updatedAt) h += '<div class="updated">清單更新於 ' + fmtTime(data.updatedAt) + '</div>';
  h += '</div></header><div class="wrap">';
  if (ui.offline) h += '<div class="offline">📴 目前離線，顯示上次下載的清單。勾選照常會記錄。</div>';
  h += '<div class="filters"><div class="seg">';
  [['all', '全部'], ['todo', '還沒買'], ['done', '已買到'], ['oos', '沒買到' + (oosN ? ' ' + oosN : '')]].forEach(function (f) {
    h += '<button data-act="filter" data-v="' + f[0] + '" class="' + (ui.filter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
  });
  h += '</div>';
  if (st.length > 1) {
    h += '<div class="chips"><button class="chip ' + (!ui.store ? 'on' : '') + '" data-act="store" data-v="">📍 全部地點</button>';
    st.forEach(function (s) { h += '<button class="chip ' + (ui.store === s ? 'on' : '') + '" data-act="store" data-v="' + esc(s) + '">' + esc(s) + '</button>'; });
    h += '</div>';
  }
  h += '</div><div class="list">';
  if (!shown.length) h += '<div class="empty">' + (items.length ? '這個分類沒有商品' : '清單還是空的') + '</div>';
  shown.forEach(function (it) {
    var s = status(it.id), m = mark(it.id);
    h += '<div class="card' + (s === 'done' ? ' done' : s === 'oos' ? ' oos' : '') + '" data-id="' + esc(it.id) + '">';
    h += it.img ? '<button class="thumb" data-act="zoom" style="background-image:url(\'' + esc(it.img) + '\')" aria-label="放大圖片"></button>' : '<div class="noimg">無圖片</div>';
    h += '<div class="info"><p class="name">' + esc(it.name) + '</p>';
    if (it.store) h += '<span class="store">📍 ' + esc(it.store) + '</span>';
    h += '<div class="price"><span class="jpy">¥' + num(it.jpy || 0) + '</span><span class="twd">≈ NT$' + num(twdOf(it)) + '</span><span class="qty">×' + esc(it.qty || 1) + '</span></div>';
    if (it.note) h += '<div class="note">' + esc(it.note) + '</div>';
    if (m.report) h += '<div class="report">💬 ' + esc(m.report) + '</div>';
    h += '</div><div class="side">';
    h += '<button class="check" data-act="toggle" aria-label="已買到"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>';
    if (s === 'done') h += '<span class="status">買到了</span>';
    else if (s === 'oos') h += '<span class="status">沒買到</span>';
    h += '<button class="mini oosbtn" data-act="oos">' + (s === 'oos' ? '↺ 取消' : '缺貨/<br>沒買到') + '</button>';
    h += '<button class="mini" data-act="report">💬 回報</button>';
    h += '</div></div>';
  });
  h += '</div></div>' + overlays();
  $app.innerHTML = h;
}
function overlays() {
  return '<div class="mask" id="mask" data-act="close"></div><div class="sheet" id="sheet"><div class="inner" id="sheetIn"></div></div>' +
    '<div class="lightbox" id="lb" data-act="close"><img id="lbimg" alt=""></div><div class="toast" id="toast"></div>';
}
function openSheet(html) {
  document.getElementById('sheetIn').innerHTML = html;
  document.getElementById('mask').classList.add('show');
  document.getElementById('sheet').classList.add('show');
}
function closeSheet() { ['mask', 'sheet', 'lb'].forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('show'); }); }
var tt;
function toast(msg) {
  var t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(tt);
  tt = setTimeout(function () { t.classList.remove('show'); }, 2200);
}
function find(id) { for (var i = 0; i < data.items.length; i++) if (data.items[i].id === id) return data.items[i]; }

function shareText() {
  var L = ['【' + data.title + '】購買結果'], g = {done: [], oos: [], todo: []};
  data.items.forEach(function (i) { g[status(i.id) || 'todo'].push(i); });
  var line = function (i) { var r = mark(i.id).report; return '・' + i.name + ' ×' + (i.qty || 1) + (r ? '（' + r + '）' : ''); };
  if (g.done.length) { L.push('', '✅ 買到了 ' + g.done.length + ' 項'); g.done.forEach(function (i) { L.push(line(i)); }); }
  if (g.oos.length) { L.push('', '⚠️ 沒買到 ' + g.oos.length + ' 項'); g.oos.forEach(function (i) { L.push(line(i)); }); }
  if (g.todo.length) { L.push('', '⬜ 還沒買 ' + g.todo.length + ' 項'); g.todo.forEach(function (i) { L.push(line(i)); }); }
  return L.join('\n');
}
function shareResult() {
  var text = shareText();
  if (navigator.share) { navigator.share({text: text}).catch(function () {}); return; }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () { toast('已複製，可以貼到 LINE'); }, fallback);
  } else fallback();
  function fallback() {
    openSheet('<h2>購買結果<button data-act="close">✕</button></h2><p class="hint">長按下方文字全選後複製</p><div class="field"><textarea style="min-height:260px" readonly>' + esc(text) + '</textarea></div>');
  }
}
function menuHtml() {
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return '<h2>選單<button data-act="close">✕</button></h2><div class="menu">' +
    '<button data-act="share"><span>📋</span><div>回報購買結果<small>整理成文字，傳到 LINE 給姊姊</small></div></button>' +
    '<button data-act="refresh"><span>🔄</span><div>重新抓取清單<small>有網路時取得最新內容</small></div></button>' +
    (standalone ? '' : '<button data-act="install"><span>📲</span><div>加到主畫面<small>變成 app，沒網路也能開</small></div></button>') +
    '<button data-act="resetchecks"><span>↺</span><div>清除所有勾選<small>商品保留，勾選與回報歸零</small></div></button>' +
    '</div>';
}
var installEvt = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
function installHelp() {
  if (installEvt) { installEvt.prompt(); installEvt = null; closeSheet(); return; }
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet('<h2>加到主畫面<button data-act="close">✕</button></h2>' + (ios
    ? '<ol style="padding-left:20px;line-height:1.9"><li>用 <b>Safari</b> 開這個網址（LINE 裡請點右下「⋯」→「用 Safari 開啟」）</li><li>按下方的分享按鈕 <b>⬆︎</b></li><li>往下找「<b>加入主畫面</b>」→ 新增</li><li>之後從主畫面的「代購清單」圖示打開</li></ol>'
    : '<ol style="padding-left:20px;line-height:1.9"><li>用 <b>Chrome</b> 開這個網址</li><li>按右上角 <b>⋮</b></li><li>選「<b>加到主畫面</b>」或「安裝應用程式」</li><li>之後從主畫面的「代購清單」圖示打開</li></ol>') +
    '<p class="hint">加好後先開一次讓它下載清單，之後在日本沒網路也能看、能勾選。</p>');
}

$app.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var act = b.dataset.act, card = b.closest('.card'), id = card && card.dataset.id;
  switch (act) {
    case 'toggle': setMark(id, {status: status(id) === 'done' ? '' : 'done'}); break;
    case 'oos': setMark(id, {status: status(id) === 'oos' ? '' : 'oos'}); break;
    case 'report':
      openSheet('<h2>回報：' + esc(find(id).name) + '<button data-act="close">✕</button></h2><p class="hint">例如實際價格、買了幾個、換成別款⋯⋯</p><form id="rf" data-id="' + esc(id) + '"><div class="field"><textarea name="report" placeholder="寫點什麼給姊姊">' + esc(mark(id).report || '') + '</textarea></div><button class="primary" type="submit">儲存回報</button></form>');
      break;
    case 'filter': ui.filter = b.dataset.v; render(); break;
    case 'store': ui.store = b.dataset.v; render(); break;
    case 'zoom': document.getElementById('lbimg').src = find(id).img; document.getElementById('lb').classList.add('show'); break;
    case 'close': closeSheet(); break;
    case 'menu': openSheet(menuHtml()); break;
    case 'share': closeSheet(); shareResult(); break;
    case 'refresh': closeSheet(); sync(true); break;
    case 'install': installHelp(); break;
    case 'resetchecks':
      if (b.dataset.sure) { marks = {}; write(MARK_KEY, marks); closeSheet(); render(); toast('已清除勾選'); }
      else { b.dataset.sure = '1'; b.querySelector('small').textContent = '確定嗎？再按一次清除'; }
      break;
  }
});
$app.addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target;
  if (f.id === 'rf') { closeSheet(); setMark(f.dataset.id, {report: new FormData(f).get('report').trim()}); }
});

// 下載最新清單；失敗就用上次存的
function sync(manual) {
  return fetch('data/items.json?t=' + Date.now(), {cache: 'no-store'}).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    var changed = !data || d.updatedAt !== data.updatedAt;
    data = d; ui.offline = false; ui.loading = false;
    write(DATA_KEY, data);
    render();
    if (changed && manual !== 'first') toast('清單已更新');
    else if (manual === true) toast('已經是最新的清單');
    precacheImages();
  }).catch(function () {
    ui.offline = true; ui.loading = false; render();
    if (manual === true) toast('目前沒有網路，先用上次的清單');
  });
}
// 有網路時把所有商品圖片先存起來，離線才看得到
function precacheImages() {
  if (!('caches' in window) || !data) return;
  caches.open('daigou-img').then(function (c) {
    data.items.forEach(function (it) {
      if (!it.img) return;
      c.match(it.img).then(function (hit) { if (!hit) c.add(it.img).catch(function () {}); });
    });
  });
}

render();
sync(data ? false : 'first');
document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(false); });
window.addEventListener('online', function () { sync(false); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
