// 每天自動抓日圓→台幣匯率；抓不到（離線）就沿用上次的值，再不行就用後台設定的匯率
var Rate = (function () {
  var KEY = 'daigou-rate', MAX_AGE = 12 * 3600 * 1000;
  var SOURCES = [
    {url: 'https://open.er-api.com/v6/latest/JPY', pick: function (j) { return j.result === 'success' && j.rates && j.rates.TWD; }},
    {url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json', pick: function (j) { return j.jpy && j.jpy.twd; }},
    {url: 'https://latest.currency-api.pages.dev/v1/currencies/jpy.json', pick: function (j) { return j.jpy && j.jpy.twd; }}
  ];
  function cached() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function auto(data) { return data && data.autoRate !== false; }
  // 目前要用的匯率與來源說明
  function current(data) {
    var c = cached();
    if (auto(data) && c && c.rate) return {rate: c.rate, live: true, at: c.at};
    return {rate: Number(data && data.rate) || 0.21, live: false, at: null};
  }
  function tryFetch(i) {
    if (i >= SOURCES.length) return Promise.reject(new Error('no source'));
    var s = SOURCES[i];
    return fetch(s.url, {cache: 'no-store'}).then(function (r) { return r.json(); }).then(function (j) {
      var v = Number(s.pick(j));
      if (!(v > 0.05 && v < 1)) throw new Error('bad rate');
      return v;
    }).catch(function () { return tryFetch(i + 1); });
  }
  // 超過 12 小時才重新抓；有更新時回傳 true
  function refresh(data, force) {
    if (!auto(data)) return Promise.resolve(false);
    var c = cached();
    if (!force && c && Date.now() - c.at < MAX_AGE) return Promise.resolve(false);
    return tryFetch(0).then(function (v) {
      try { localStorage.setItem(KEY, JSON.stringify({rate: Math.round(v * 10000) / 10000, at: Date.now()})); } catch (e) {}
      return true;
    }, function () { return false; });
  }
  function label(data) {
    var r = current(data), d = r.at ? new Date(r.at) : null;
    return '1 日圓 ≈ ' + r.rate + ' 台幣' + (r.live ? '・' + (d.getMonth() + 1) + '/' + d.getDate() + ' 自動更新' : (auto(data) ? '・等待連網更新' : '・固定匯率'));
  }
  return {current: current, refresh: refresh, label: label, auto: auto};
})();
