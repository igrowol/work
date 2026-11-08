/* ============================================================
   СКРИПТ (JavaScript) — файл script.js
   Распознавание речи, журнал записей, время, поиск, CSV.
   ============================================================ */

(function () {
  'use strict';

  var LS_KEY = 'golosovoy-zhurnal-v1';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    capture: $('capture'), mic: $('mic'), fab: $('fab'), status: $('status'), live: $('live'),
    log: $('log'), count: $('count'), search: $('search'), exp: $('export'), clear: $('clear'),
    manualForm: $('manualForm'), manualName: $('manualName'), notice: $('notice'),
    toast: $('toast'), toastMsg: $('toastMsg'), toastBtn: $('toastBtn'),
    clockT: $('clockT'), clockD: $('clockD')
  };

  /* ---------- Данные ---------- */
  var entries = [];
  try { entries = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { entries = []; }
  if (!Array.isArray(entries)) entries = [];
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); } catch (e) {} }

  var editingId = null;
  var freshId = null;
  var query = '';

  /* ---------- Время ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function fmtDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }

  function tickClock() {
    var now = new Date();
    els.clockT.textContent = fmtTime(now);
    els.clockD.textContent = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- Имена ---------- */
  function formatName(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').replace(/[.,!?;:]+$/g, '').trim();
    if (!s) return '';
    return s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); });
  }

  function addEntry(raw, src, date) {
    var name = formatName(raw);
    if (!name) return null;
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      ts: (date || new Date()).getTime(),
      src: src
    };
    entries.push(entry);
    freshId = entry.id;
    save();
    render();
    return entry;
  }

  /* ---------- Отрисовка ---------- */
  function svgIcon(path) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    s.appendChild(p);
    return s;
  }
  function iconButton(label, path, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(svgIcon(path));
    b.addEventListener('click', onClick);
    return b;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    els.log.textContent = '';
    var total = entries.length;
    els.count.textContent = String(total);
    els.exp.disabled = total === 0;
    els.clear.disabled = total === 0;

    var q = query.trim().toLowerCase();
    var shown = [];
    for (var i = total - 1; i >= 0; i--) {
      if (!q || entries[i].name.toLowerCase().indexOf(q) !== -1) shown.push({ e: entries[i], n: i + 1 });
    }

    if (!shown.length) {
      var empty = el('li', 'empty');
      empty.appendChild(el('strong', null, total ? 'Ничего не найдено' : 'Пока нет записей'));
      empty.appendChild(document.createTextNode(total ? 'Измените запрос в поиске.' : 'Нажмите на микрофон и скажите, например: «Михаил Казаков».'));
      els.log.appendChild(empty);
      return;
    }

    shown.forEach(function (item) {
      var e = item.e;
      var d = new Date(e.ts);
      var li = el('li', 'entry' + (e.id === freshId ? ' fresh' : ''));

      li.appendChild(el('span', 'num', String(item.n)));

      var who = el('div', 'who');
      if (editingId === e.id) {
        var row = el('div', 'edit-row');
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = e.name;
        inp.maxLength = 80;
        inp.setAttribute('aria-label', 'Изменить фамилию и имя');
        var ok = el('button', 'btn primary', 'Сохранить');
        ok.type = 'button';
        var cancel = el('button', 'btn', 'Отмена');
        cancel.type = 'button';
        var commit = function () {
          var v = formatName(inp.value);
          if (v) { e.name = v; save(); }
          editingId = null; render();
        };
        ok.addEventListener('click', commit);
        cancel.addEventListener('click', function () { editingId = null; render(); });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          if (ev.key === 'Escape') { editingId = null; render(); }
        });
        row.appendChild(inp); row.appendChild(ok); row.appendChild(cancel);
        who.appendChild(row);
        setTimeout(function () { inp.focus(); inp.select(); }, 0);
      } else {
        who.appendChild(el('div', 'name', e.name));
        who.appendChild(el('span', 'src ' + (e.src === 'voice' ? 'voice' : ''), e.src === 'voice' ? 'голосом' : 'вручную'));
      }
      li.appendChild(who);

      var when = el('div', 'when');
      when.appendChild(el('div', 't', fmtTime(d)));
      when.appendChild(el('div', 'd', fmtDate(d)));
      li.appendChild(when);

      var acts = el('div', 'acts');
      acts.appendChild(iconButton('Изменить запись', 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z', function () { editingId = e.id; render(); }));
      acts.appendChild(iconButton('Удалить запись', 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', function () { removeEntry(e.id); }));
      li.appendChild(acts);

      els.log.appendChild(li);
    });
    freshId = null;
  }

  /* ---------- Удаление с отменой ---------- */
  var toastTimer = null;
  var undoFn = null;
  function showToast(msg, onUndo) {
    els.toastMsg.textContent = msg;
    undoFn = onUndo;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; undoFn = null; }, 6000);
  }
  els.toastBtn.addEventListener('click', function () {
    if (undoFn) undoFn();
    undoFn = null;
    els.toast.hidden = true;
  });

  function removeEntry(id) {
    var idx = -1;
    for (var i = 0; i < entries.length; i++) if (entries[i].id === id) { idx = i; break; }
    if (idx < 0) return;
    var removed = entries.splice(idx, 1)[0];
    save(); render();
    showToast('Запись удалена', function () {
      entries.splice(Math.min(idx, entries.length), 0, removed);
      save(); render();
    });
  }

  var armTimer = null;
  els.clear.addEventListener('click', function () {
    if (!els.clear.classList.contains('armed')) {
      els.clear.classList.add('armed');
      els.clear.textContent = 'Точно очистить?';
      clearTimeout(armTimer);
      armTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    var backup = entries.slice();
    entries = [];
    save(); render();
    showToast('Журнал очищен', function () { entries = backup; save(); render(); });
  });
  function disarm() {
    els.clear.classList.remove('armed');
    els.clear.textContent = 'Очистить';
    clearTimeout(armTimer);
  }

  /* ---------- Поиск, ручной ввод, CSV ---------- */
  els.search.addEventListener('input', function () { query = els.search.value; render(); });

  els.manualForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var entry = addEntry(els.manualName.value, 'manual', new Date());
    if (entry) {
      els.manualName.value = '';
      setStatus('Записано: ' + entry.name, false);
    }
  });

  els.exp.addEventListener('click', function () {
    var rows = [['№', 'Фамилия и имя', 'Дата', 'Время', 'Способ']];
    entries.forEach(function (e, i) {
      var d = new Date(e.ts);
      rows.push([i + 1, e.name, fmtDate(d), fmtTime(d), e.src === 'voice' ? 'голосом' : 'вручную']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'zhurnal-' + fmtDate(new Date()).replace(/\./g, '-') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });

  /* ---------- Статус ---------- */
  function setStatus(msg, isErr) {
    els.status.textContent = msg;
    els.status.classList.toggle('err', !!isErr);
  }
  function showNotice(msg) { els.notice.textContent = msg; els.notice.hidden = false; }

  /* ---------- Распознавание речи ---------- */
  var rec = null;
  var wantListening = false;

  function setListeningUI(on) {
    els.capture.classList.toggle('listening', on);
    els.mic.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.mic.setAttribute('aria-label', on ? 'Выключить микрофон' : 'Включить микрофон');
    els.fab.classList.toggle('on', on);
    els.fab.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.fab.setAttribute('aria-label', on ? 'Выключить микрофон' : 'Включить микрофон');
  }

  if (!SR) {
    els.mic.disabled = true;
    els.fab.disabled = true;
    showNotice('Этот браузер не поддерживает распознавание речи. Откройте сайт в Google Chrome, Microsoft Edge или Safari. Вводить фамилии вручную можно и здесь.');
    setStatus('Голосовой ввод недоступен в этом браузере.', true);
  } else if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showNotice('Микрофон работает только на защищённом соединении. Откройте сайт по адресу, который начинается с https://.');
  }

  function buildRecognition() {
    var r = new SR();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = function () {
      setListeningUI(true);
      setStatus('Слушаю. Назовите фамилию и имя.', false);
    };

    r.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var res = ev.results[i];
        var text = res[0].transcript;
        if (res.isFinal) {
          var entry = addEntry(text, 'voice', new Date());
          if (entry) setStatus('Записано: ' + entry.name, false);
          els.live.textContent = '…';
        } else {
          interim += text;
        }
      }
      if (interim) els.live.textContent = interim;
    };

    r.onerror = function (ev) {
      var code = ev.error;
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        wantListening = false;
        setStatus('Нет доступа к микрофону. Разрешите его в настройках сайта (значок замка рядом с адресом) и нажмите снова.', true);
      } else if (code === 'audio-capture') {
        wantListening = false;
        setStatus('Микрофон не найден. Подключите его и попробуйте ещё раз.', true);
      } else if (code === 'network') {
        wantListening = false;
        setStatus('Нет связи с сервисом распознавания. Проверьте интернет.', true);
      } else {
        wantListening = false;
        setStatus('Ошибка распознавания: ' + code, true);
      }
    };

    r.onend = function () {
      if (wantListening) {
        setTimeout(function () {
          if (!wantListening) return;
          try { r.start(); } catch (e) {}
        }, 250);
      } else {
        setListeningUI(false);
        els.live.textContent = '…';
        if (!els.status.classList.contains('err') && els.status.textContent.indexOf('Записано') !== 0) {
          setStatus('Микрофон выключен. Нажмите, чтобы продолжить.', false);
        }
      }
    };
    return r;
  }

  function toggleMic() {
    if (!SR) return;
    if (wantListening) {
      wantListening = false;
      try { rec.stop(); } catch (e) {}
      return;
    }
    rec = buildRecognition();
    wantListening = true;
    setStatus('Запрашиваю доступ к микрофону…', false);
    try { rec.start(); } catch (e) {
      wantListening = false;
      setStatus('Не удалось включить микрофон. Обновите страницу и попробуйте снова.', true);
    }
  }
  els.mic.addEventListener('click', toggleMic);
  els.fab.addEventListener('click', toggleMic);

  /* Плавающая кнопка видна на телефоне, когда основной микрофон прокручен за экран */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (items) {
      els.fab.hidden = items[0].isIntersecting;
    }, { threshold: 0.2 }).observe(els.mic);
  }

  render();
})();