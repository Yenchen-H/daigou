(function () {
'use strict';
// 後台：讀寫 GitHub 上的 data/items.json 與 data/img/，存檔後 GitHub Pages 約 1 分鐘更新到妹妹的 app
var CFG_KEY = 'daigou-admin';
var cfg = read(CFG_KEY) || guessRepo();
var data = null, sha = null, busy = 0, previews = {};
var $app = document.getElementById('app');

function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function num(n) { return Math.round(n).toLocaleString('en-US'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function guessRepo() {
  var m = location.hostname.match(/^([^.]+)\.github\.io$/i), seg = location.pathname.split('/').filter(Boolean)[0];
  return {owner: m ? m[1] : '', repo: m && seg && !/\.html$/.test(seg) ? seg : '', branch: 'main', token: ''};
}
function appUrl() { return location.href.replace(/admin\.html.*$/, ''); }
function twdOf(it) { return (it.twd !== '' && it.twd != null) ? Number(it.twd) : Math.round(Number(it.jpy || 0) * Number(data.rate || 0)); }
function imgSrc(it) { return previews[it.img] || it.img; }
function stores() { var o = []; data.items.forEach(function (it) { if (it.store && o.indexOf(it.store) < 0) o.push(it.store); }); return o; }
function find(id) { for (var i = 0; i < data.items.length; i++) if (data.items[i].id === id) return data.items[i]; }

// ---- GitHub API ----
function api(path, opts) {
  opts = opts || {};
  return fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path + (opts.method ? '' : '?ref=' + cfg.branch + '&t=' + Date.now()), {
    method: opts.method || 'GET',
    headers: {'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json'},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store'
  }).then(function (r) {
    if (r.status === 404 && !opts.method) return null;
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; });
    return r.json();
  });
}
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
function unb64(s) { return decodeURIComponent(escape(atob(s.replace(/\s/g, '')))); }

function load() {
  return api('data/items.json').then(function (f) {
    if (f) { sha = f.sha; data = JSON.parse(unb64(f.content)); }
    else { sha = null; data = {title: '日本代購清單', rate: 0.21, updatedAt: '', items: []}; }
  });
}
// 每次修改都會成為一次「發布」：寫回 items.json
var queue = Promise.resolve();
function publish(msg) {
  data.updatedAt = new Date().toISOString();
  var body = JSON.stringify(data, null, 2) + '\n';
  setBusy(1);
  queue = queue.then(function () {
    return api('data/items.json', {method: 'PUT', body: {message: msg, content: b64(body), sha: sha || undefined, branch: cfg.branch}});
  }).then(function (r) {
    sha = r.content.sha; setBusy(-1); toast('已發布，約 1 分鐘後妹妹的 app 會更新');
  }, function (e) {
    setBusy(-1); fail(e);
    return load().then(render);
  });
  return queue;
}
function uploadImage(dataUrl, id) {
  var path = 'data/img/' + id + '-' + Date.now().toString(36) + '.jpg';
  setBusy(1);
  return api(path, {method: 'PUT', body: {message: '上傳圖片', content: dataUrl.split(',')[1], branch: cfg.branch}})
    .then(function () { setBusy(-1); previews[path] = dataUrl; return path; }, function (e) { setBusy(-1); throw e; });
}
function removeFile(path) {
  if (!path || path.indexOf('data/img/') !== 0) return;
  api(path).then(function (f) {
    if (f) return api(path, {method: 'DELETE', body: {message: '刪除圖片', sha: f.sha, branch: cfg.branch}});
  }).catch(function () {});
}
function fail(e) {
  var msg = e.status === 401 ? '金鑰無效或已過期，請重新設定' : e.status === 403 ? '金鑰沒有寫入權限，請確認有勾 Contents: Read and write' : e.status === 409 || e.status === 422 ? '別處同時有修改，已重新載入，請再試一次' : '儲存失敗：' + e.message;
  toast(msg);
}
function setBusy(d) {
  busy += d;
  var s = document.getElementById('saving'); if (s) s.classList.toggle('show', busy > 0);
}

// ---- 畫面 ----
function loginView(err) {
  $app.innerHTML = '<header><div class="wrap"><div class="top"><h1>代購清單・後台</h1></div></div></header><div class="wrap"><div class="login">' +
    '<p style="margin:0 0 8px"><b>第一次使用請設定 GitHub 金鑰</b>（只需一次，存在這支手機上）</p>' +
    '<ol><li>打開 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">建立 GitHub 金鑰</a></li>' +
    '<li>Token name 隨便填，Expiration 選 90 天以上</li><li>Repository access 選「Only select repositories」，選 <b>' + esc(cfg.repo || 'daigou') + '</b></li>' +
    '<li>Permissions → Repository permissions → <b>Contents</b> 改成「Read and write」</li><li>按 Generate token，複製貼到下面</li></ol>' +
    (err ? '<p style="color:var(--red);font-size:14px">' + esc(err) + '</p>' : '') +
    '<form id="login"><div class="field"><label>GitHub 金鑰</label><input name="token" type="password" autocomplete="off" required placeholder="github_pat_..." value="' + esc(cfg.token) + '"></div>' +
    '<div class="row2"><div class="field"><label>GitHub 帳號</label><input name="owner" required value="' + esc(cfg.owner) + '"></div>' +
    '<div class="field"><label>專案名稱</label><input name="repo" required value="' + esc(cfg.repo || 'daigou') + '"></div></div>' +
    '<button class="primary" type="submit">登入後台</button></form></div></div><div class="toast" id="toast"></div>';
}

function render() {
  var items = data.items, st = stores(), totJ = 0, totT = 0;
  items.forEach(function (i) { var q = Number(i.qty || 1); totJ += Number(i.jpy || 0) * q; totT += twdOf(i) * q; });
  var h = '<header><div class="wrap"><div class="top"><h1>' + esc(data.title) + '<br><small style="font-size:13px;font-weight:400;opacity:.85">後台管理・' + items.length + ' 項商品</small></h1><button class="iconbtn" data-act="settings">⚙️ 設定</button></div>';
  h += '<div class="totals"><div class="tot"><small>全部預算</small><span>¥' + num(totJ) + '</span><em>≈ NT$' + num(totT) + '</em></div><div class="tot"><small>匯率</small><span>' + esc(data.rate) + '</span><em>1 日圓換台幣</em></div></div>';
  h += '<div class="adminbar"><a href="' + esc(appUrl()) + '" target="_blank" rel="noopener">👀 看妹妹的畫面</a><button data-act="copylink">🔗 複製 app 網址</button></div>';
  h += '</div></header><div class="wrap"><div class="list" style="margin-top:14px">';
  if (!items.length) h += '<div class="empty">還沒有商品，點下方「＋ 新增商品」開始</div>';
  items.forEach(function (it, idx) {
    h += '<div class="card" data-id="' + esc(it.id) + '" style="grid-template-columns:84px 1fr">';
    h += it.img ? '<button class="thumb" data-act="zoom" style="background-image:url(\'' + esc(imgSrc(it)) + '\')"></button>' : '<div class="noimg">無圖片</div>';
    h += '<div class="info"><p class="name">' + esc(it.name) + '</p>';
    if (it.store) h += '<span class="store">📍 ' + esc(it.store) + '</span>';
    h += '<div class="price"><span class="jpy">¥' + num(it.jpy || 0) + '</span><span class="twd">≈ NT$' + num(twdOf(it)) + '</span><span class="qty">×' + esc(it.qty || 1) + '</span></div>';
    if (it.note) h += '<div class="note">' + esc(it.note) + '</div>';
    h += '</div><div class="edit-row"><button data-act="edit">✏️ 修改</button><button data-act="up"' + (idx ? '' : ' disabled style="opacity:.4"') + '>↑ 上移</button><button class="del" data-act="del">🗑 刪除</button></div></div>';
  });
  h += '</div></div><button class="fab" data-act="add">＋ 新增商品</button>';
  h += '<div class="mask" id="mask" data-act="close"></div><div class="sheet" id="sheet"><div class="inner" id="sheetIn"></div></div>';
  h += '<div class="lightbox" id="lb" data-act="close"><img id="lbimg" alt=""></div><div class="toast" id="toast"></div><div class="saving" id="saving">儲存中⋯⋯</div>';
  $app.innerHTML = h;
  setBusy(0);
}
function formHtml(it) {
  var isNew = !it;
  it = it || {name: '', jpy: '', twd: '', qty: 1, store: '', note: '', img: ''};
  return '<h2>' + (isNew ? '新增商品' : '修改商品') + '<button data-act="close">✕</button></h2>' +
    '<form id="f" data-id="' + (isNew ? '' : esc(it.id)) + '">' +
    '<div class="field"><label>商品圖片</label><div class="imgpick"><div class="prevbox" id="prev" style="background-image:url(\'' + esc(it.img ? imgSrc(it) : '') + '\')">' + (it.img ? '' : '尚無圖片') + '</div>' +
    '<div><label class="btn">📷 拍照／選圖片<input type="file" accept="image/*" id="imgin" hidden></label> ' + (it.img ? '<button type="button" class="chip" data-act="rmimg">移除</button>' : '') + '<div class="hint" style="margin:6px 0 0">會自動壓縮</div></div></div>' +
    '<input type="hidden" name="newimg" value=""><input type="hidden" name="img" value="' + esc(it.img) + '"></div>' +
    '<div class="field"><label>商品名稱 *</label><input name="name" required value="' + esc(it.name) + '" placeholder="例：合利他命 EX Plus 270錠"></div>' +
    '<div class="row2"><div class="field"><label>日幣價格 ¥</label><input name="jpy" type="number" inputmode="numeric" min="0" value="' + esc(it.jpy) + '"></div>' +
    '<div class="field"><label>台幣價格 NT$</label><input name="twd" type="number" inputmode="numeric" min="0" value="' + esc(it.twd) + '" placeholder="留空自動換算"></div></div>' +
    '<div class="row2"><div class="field"><label>購買數量</label><input name="qty" type="number" inputmode="numeric" min="1" value="' + esc(it.qty || 1) + '"></div>' +
    '<div class="field"><label>購買地點</label><input name="store" list="storelist" value="' + esc(it.store) + '" placeholder="例：唐吉訶德"><datalist id="storelist">' + stores().map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></div></div>' +
    '<div class="field"><label>備註</label><textarea name="note" placeholder="例：要藍色款、找不到可以買替代品">' + esc(it.note) + '</textarea></div>' +
    '<button class="primary" type="submit">' + (isNew ? '加入並發布' : '儲存並發布') + '</button></form>';
}
function settingsHtml() {
  return '<h2>設定<button data-act="close">✕</button></h2><form id="sf"><div class="field"><label>清單名稱</label><input name="title" value="' + esc(data.title) + '"></div>' +
    '<div class="field"><label>匯率（1 日圓 = ? 台幣）</label><input name="rate" type="number" step="0.0001" inputmode="decimal" value="' + esc(data.rate) + '"></div>' +
    '<p class="hint">台幣價格留空的商品，會用這個匯率自動換算。</p><button class="primary" type="submit">儲存並發布</button></form>' +
    '<div class="menu" style="margin-top:14px"><button data-act="logout"><span>🚪</span><div>登出後台<small>從這支手機移除 GitHub 金鑰</small></div></button></div>';
}

function openSheet(html) { document.getElementById('sheetIn').innerHTML = html; document.getElementById('mask').classList.add('show'); document.getElementById('sheet').classList.add('show'); }
function closeSheet() { ['mask', 'sheet', 'lb'].forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('show'); }); }
var tt;
function toast(msg) {
  var t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(tt);
  tt = setTimeout(function () { t.classList.remove('show'); }, 2600);
}
function compress(file, cb) {
  var r = new FileReader();
  r.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 800, s = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.78));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

$app.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var card = b.closest('.card'), it = card && find(card.dataset.id);
  switch (b.dataset.act) {
    case 'close': closeSheet(); break;
    case 'add': openSheet(formHtml(null)); break;
    case 'edit': openSheet(formHtml(it)); break;
    case 'settings': openSheet(settingsHtml()); break;
    case 'zoom': document.getElementById('lbimg').src = imgSrc(it); document.getElementById('lb').classList.add('show'); break;
    case 'up':
      var i = data.items.indexOf(it);
      if (i > 0) { data.items.splice(i, 1); data.items.splice(i - 1, 0, it); render(); publish('調整順序'); }
      break;
    case 'del':
      if (b.dataset.sure) { data.items.splice(data.items.indexOf(it), 1); render(); publish('刪除：' + it.name).then(function () { removeFile(it.img); }); }
      else { b.dataset.sure = '1'; b.textContent = '再按一次確認'; }
      break;
    case 'rmimg':
      document.querySelector('#f [name=img]').value = ''; document.querySelector('#f [name=newimg]').value = '';
      var pv = document.getElementById('prev'); pv.style.backgroundImage = 'none'; pv.textContent = '尚無圖片';
      break;
    case 'copylink':
      var u = appUrl();
      if (navigator.share) navigator.share({title: data.title, url: u}).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('已複製 app 網址，傳給妹妹吧'); });
      else prompt('app 網址', u);
      break;
    case 'logout': cfg.token = ''; write(CFG_KEY, cfg); location.reload(); break;
  }
});
$app.addEventListener('change', function (e) {
  if (e.target.id === 'imgin' && e.target.files[0]) {
    compress(e.target.files[0], function (d) {
      document.querySelector('#f [name=newimg]').value = d;
      var pv = document.getElementById('prev'); pv.style.backgroundImage = "url('" + d + "')"; pv.textContent = '';
    });
  }
});
$app.addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, fd = new FormData(f);
  if (f.id === 'login') {
    cfg = {owner: fd.get('owner').trim(), repo: fd.get('repo').trim(), branch: 'main', token: fd.get('token').trim()};
    start(); return;
  }
  if (f.id === 'sf') {
    data.title = fd.get('title').trim() || '日本代購清單'; data.rate = Number(fd.get('rate')) || data.rate;
    closeSheet(); render(); publish('更新設定'); return;
  }
  if (f.id === 'f') {
    var btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = '儲存中⋯⋯';
    var id = f.dataset.id || uid(), oldImg = f.dataset.id ? find(id).img : '';
    var fields = {name: fd.get('name').trim(), jpy: fd.get('jpy') === '' ? '' : Number(fd.get('jpy')), twd: fd.get('twd') === '' ? '' : Number(fd.get('twd')), qty: Number(fd.get('qty')) || 1, store: fd.get('store').trim(), note: fd.get('note').trim(), img: fd.get('img')};
    var newimg = fd.get('newimg');
    (newimg ? uploadImage(newimg, id) : Promise.resolve(fields.img)).then(function (img) {
      fields.img = img;
      if (f.dataset.id) Object.assign(find(id), fields);
      else { fields.id = id; data.items.push(fields); }
      closeSheet(); render();
      return publish((f.dataset.id ? '修改：' : '新增：') + fields.name).then(function () { if (oldImg && oldImg !== img) removeFile(oldImg); });
    }).catch(function (err) { fail(err); btn.disabled = false; btn.textContent = '再試一次'; });
  }
});

function start() {
  if (!cfg.token || !cfg.owner || !cfg.repo) { loginView(); return; }
  $app.innerHTML = '<div class="wrap"><div class="empty">載入中⋯⋯</div></div>';
  load().then(function () { write(CFG_KEY, cfg); render(); }).catch(function (e) {
    loginView(e.status === 401 ? '金鑰無效，請重新貼上' : e.status === 404 || e.status === 403 ? '找不到專案或金鑰沒有權限，請確認帳號、專案名稱和金鑰權限' : '連線失敗：' + e.message);
  });
}
start();
})();
