(function() {
  'use strict';

  var LS = function(k, v) {
    if (v !== undefined) { localStorage.setItem('dash_'+k, JSON.stringify(v)); return v; }
    try { return JSON.parse(localStorage.getItem('dash_'+k)); } catch(e) { return null; }
  };

  /* ===== 1. TODO ===== */
  var todos = LS('todos') || [];
  function renderTodos() {
    var list = document.getElementById('todoList');
    if (!list) return;
    var filter = (document.getElementById('todoFilter')||{}).value || 'all';
    var filtered = filter === 'all' ? todos : filter === 'done' ? todos.filter(function(t){return t.done}) : todos.filter(function(t){return !t.done});
    list.innerHTML = '';
    if (!filtered.length) { list.innerHTML = '<div class="todo-empty">// NO_TASKS //</div>'; updateTodoStats(); return; }
    filtered.forEach(function(t, i) {
      var idx = todos.indexOf(t);
      var div = document.createElement('div');
      div.className = 'todo-item' + (t.done ? ' done' : '');
      div.innerHTML =
        '<div class="todo-check' + (t.done ? ' checked' : '') + '" data-idx="' + idx + '"></div>' +
        '<span class="todo-text">' + esc(t.text) + '</span>' +
        '<span class="todo-priority ' + (t.pri||'medium') + '">' + (t.pri||'MEDIUM').toUpperCase() + '</span>' +
        '<div class="todo-del" data-idx="' + idx + '">\u2715</div>';
      list.appendChild(div);
    });
    updateTodoStats();
  }
  function updateTodoStats() {
    var el = document.getElementById('todoStats');
    if (!el) return;
    var total = todos.length, done = todos.filter(function(t){return t.done}).length;
    el.textContent = total + ' TASKS // ' + done + ' DONE';
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('todoForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var inp = document.getElementById('todoInput');
        var pri = document.getElementById('todoPriority');
        if (!inp || !inp.value.trim()) return;
        todos.push({ text: inp.value.trim(), pri: pri ? pri.value : 'medium', done: false });
        LS('todos', todos);
        inp.value = '';
        renderTodos();
      });
    }
    var list = document.getElementById('todoList');
    if (list) {
      list.addEventListener('click', function(e) {
        var check = e.target.closest('.todo-check');
        var del = e.target.closest('.todo-del');
        if (check) {
          var idx = parseInt(check.dataset.idx);
          todos[idx].done = !todos[idx].done;
          LS('todos', todos);
          renderTodos();
        }
        if (del) {
          var idx = parseInt(del.dataset.idx);
          todos.splice(idx, 1);
          LS('todos', todos);
          renderTodos();
        }
      });
    }
    var filter = document.getElementById('todoFilter');
    if (filter) filter.addEventListener('change', renderTodos);
    renderTodos();
  });

  /* ===== 2. HABITS ===== */
  var habits = LS('habits') || [];
  function renderHabits() {
    var list = document.getElementById('habitList');
    if (!list) return;
    list.innerHTML = '';
    if (!habits.length) { list.innerHTML = '<div class="habit-empty">// NO_HABITS //</div>'; return; }
    var now = new Date();
    var todayStr = now.toISOString().slice(0,10);
    habits.forEach(function(h, i) {
      var div = document.createElement('div');
      div.className = 'habit-item';
      var days = h.days || [];
      var streak = calcStreak(days);
      var weekDays = [];
      for (var w = 6; w >= 0; w--) {
        var d = new Date(now);
        d.setDate(d.getDate() - w);
        weekDays.push(d);
      }
      var dayHtml = '';
      weekDays.forEach(function(d) {
        var ds = d.toISOString().slice(0,10);
        var cls = 'habit-day';
        if (days.indexOf(ds) !== -1) cls += ' done';
        if (ds === todayStr) cls += ' today';
        var dn = ['S','M','T','W','T','F','S'][d.getDay()];
        dayHtml += '<div class="' + cls + '" data-habit="' + i + '" data-day="' + ds + '">' + dn + '</div>';
      });
      div.innerHTML =
        '<div class="habit-header"><span class="habit-name">' + esc(h.name) + '</span><span class="habit-streak">STREAK: ' + streak + '</span><div class="habit-del" data-habit="' + i + '">\u2715</div></div>' +
        '<div class="habit-days">' + dayHtml + '</div>';
      list.appendChild(div);
    });
  }
  function calcStreak(days) {
    if (!days.length) return 0;
    var s = 0, d = new Date();
    while (true) {
      var ds = d.toISOString().slice(0,10);
      if (days.indexOf(ds) !== -1) { s++; d.setDate(d.getDate()-1); }
      else break;
    }
    return s;
  }
  document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('habitForm');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var inp = document.getElementById('habitInput');
        if (!inp || !inp.value.trim()) return;
        habits.push({ name: inp.value.trim(), days: [] });
        LS('habits', habits);
        inp.value = '';
        renderHabits();
      });
    }
    var list = document.getElementById('habitList');
    if (list) {
      list.addEventListener('click', function(e) {
        var del = e.target.closest('.habit-del');
        var day = e.target.closest('.habit-day:not(.done)');
        if (del) {
          var idx = parseInt(del.dataset.habit);
          habits.splice(idx, 1);
          LS('habits', habits);
          renderHabits();
        }
        if (day) {
          var hidx = parseInt(day.dataset.habit);
          if (!isNaN(hidx) && habits[hidx]) {
            habits[hidx].days.push(day.dataset.day);
            LS('habits', habits);
            renderHabits();
          }
        }
      });
    }
    renderHabits();
  });

  /* ===== 3. AMBIENT SOUNDS ===== */
  var audioCtx = null;
  var activeSources = {};
  var activeAudios = {};
  var soundGain = null;
  var globalVolume = 0.3;

  var soundDefs = [
    { id: 'rain', icon: '\u2614', label: 'RAIN' },
    { id: 'wind', icon: '\uD83C\uDF2C\uFE0F', label: 'WIND' },
    { id: 'forest', icon: '\uD83C\uDF33', label: 'FOREST' },
    { id: 'ocean', icon: '\uD83C\uDF0A', label: 'OCEAN' },
    { id: 'fire', icon: '\uD83D\uDD25', label: 'FIRE' },
    { id: 'brown', icon: '\uD83C\uDFB5', label: 'BROWN_NOISE' }
  ];

  function toggleSound(id) {
    // If using Audio file, stop it
    if (activeAudios[id]) {
      activeAudios[id].pause();
      activeAudios[id].currentTime = 0;
      delete activeAudios[id];
      document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.remove('active')});
      return;
    }
    // If using procedural, stop it
    if (activeSources[id]) {
      try { activeSources[id].stop(); } catch(e) {}
      delete activeSources[id];
      document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.remove('active')});
      return;
    }

    // Try loading audio file first
    var audio = new Audio('assets/sounds/' + id + '.mp3');
    audio.loop = true;
    audio.volume = globalVolume;

    audio.addEventListener('canplaythrough', function() {
      audio.play().catch(function(){});
      activeAudios[id] = audio;
      document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.add('active')});
    });

    audio.addEventListener('error', function() {
      // File not found — use procedural fallback
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        soundGain = audioCtx.createGain();
        soundGain.gain.value = globalVolume;
        soundGain.connect(audioCtx.destination);
      }
      if (activeSources[id]) return; // already started
      var buf = createNoise(id);
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      applyFilter(id, src);
      src.start();
      activeSources[id] = src;
      document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.add('active')});
    });

    // Initiate loading
    audio.load();
  }

  function createNoise(type) {
    var sr = audioCtx.sampleRate;
    var len = sr * 2;
    var buf = audioCtx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      switch (type) {
        case 'rain':
          data[i] = (Math.random() * 2 - 1) * (0.2 + Math.random() * 0.8);
          break;
        case 'wind':
          data[i] = (Math.random() * 2 - 1) * 0.3;
          break;
        case 'forest':
          data[i] = (Math.random() * 2 - 1) * 0.4;
          break;
        case 'ocean':
          data[i] = Math.sin(i / sr * 0.1) * 0.3 + (Math.random() * 2 - 1) * 0.1;
          break;
        case 'fire':
          data[i] = (Math.random() * 2 - 1) * (0.5 + Math.random() * 0.5);
          break;
        case 'brown':
          data[i] = (Math.random() * 2 - 1) * 0.2;
          break;
      }
    }
    return buf;
  }

  function applyFilter(type, source) {
    var biquad = audioCtx.createBiquadFilter();
    switch (type) {
      case 'rain':
        biquad.type = 'bandpass'; biquad.frequency.value = 2000; biquad.Q.value = 0.5;
        break;
      case 'wind':
        biquad.type = 'lowpass'; biquad.frequency.value = 400; biquad.Q.value = 1;
        break;
      case 'forest':
        biquad.type = 'bandpass'; biquad.frequency.value = 1500; biquad.Q.value = 0.8;
        break;
      case 'ocean':
        biquad.type = 'lowpass'; biquad.frequency.value = 800; biquad.Q.value = 0.5;
        break;
      case 'fire':
        biquad.type = 'highpass'; biquad.frequency.value = 500; biquad.Q.value = 0.8;
        break;
      case 'brown':
        biquad.type = 'lowpass'; biquad.frequency.value = 200; biquad.Q.value = 2;
        break;
    }
    source.connect(biquad);
    biquad.connect(soundGain);
  }

  function setVolume(val) {
    globalVolume = val;
    // Update audio elements
    for (var k in activeAudios) {
      activeAudios[k].volume = val;
    }
    // Update procedural gain
    if (soundGain) soundGain.gain.value = val;
  }

  function stopAllSounds() {
    for (var k in activeAudios) {
      activeAudios[k].pause();
      activeAudios[k].currentTime = 0;
      delete activeAudios[k];
    }
    for (var k in activeSources) {
      try { activeSources[k].stop(); } catch(e) {}
      delete activeSources[k];
    }
    document.querySelectorAll('.sound-btn').forEach(function(b){b.classList.remove('active')});
  }

  document.addEventListener('DOMContentLoaded', function() {
    var grid = document.getElementById('soundsGrid');
    if (!grid) return;
    soundDefs.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'sound-btn';
      btn.dataset.sound = s.id;
      btn.innerHTML = '<span class="icon">' + s.icon + '</span>' + s.label;
      btn.addEventListener('click', function() { toggleSound(s.id); });
      grid.appendChild(btn);
    });
    var volSlider = document.getElementById('soundVolume');
    if (volSlider) {
      volSlider.addEventListener('input', function() {
        setVolume(parseFloat(this.value));
      });
    }
    var stopBtn = document.getElementById('soundStopBtn');
    if (stopBtn) stopBtn.addEventListener('click', stopAllSounds);
  });

  /* ===== 4. PASSWORD GENERATOR ===== */
  function genPassword(len, opts) {
    var sets = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      digits: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    var chars = '', guaranteed = [];
    if (opts.upper) { chars += sets.upper; guaranteed.push(sets.upper[Math.floor(Math.random()*sets.upper.length)]); }
    if (opts.lower) { chars += sets.lower; guaranteed.push(sets.lower[Math.floor(Math.random()*sets.lower.length)]); }
    if (opts.digits) { chars += sets.digits; guaranteed.push(sets.digits[Math.floor(Math.random()*sets.digits.length)]); }
    if (opts.symbols) { chars += sets.symbols; guaranteed.push(sets.symbols[Math.floor(Math.random()*sets.symbols.length)]); }
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
    var pw = '';
    for (var i = 0; i < len - guaranteed.length; i++) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    // Insert guaranteed chars
    var arr = pw.split('');
    guaranteed.forEach(function(c) {
      arr.splice(Math.floor(Math.random() * arr.length), 0, c);
    });
    if (arr.length < len && guaranteed.length) arr.push(guaranteed[0]); // pad if needed
    return arr.join('').slice(0, len);
  }

  function calcPwStrength(pw) {
    var score = 0;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var genBtn = document.getElementById('pwGenBtn');
    var pwOut = document.getElementById('pwOutput');
    var pwLen = document.getElementById('pwLength');
    var pwLenVal = document.getElementById('pwLengthVal');
    var pwStrength = document.getElementById('pwStrength');
    var pwCopy = document.getElementById('pwCopyBtn');
    if (!pwOut) return;

    function generate() {
      var len = pwLen ? parseInt(pwLen.value) : 16;
      var opts = {
        upper: document.getElementById('pwUpper') ? document.getElementById('pwUpper').checked : true,
        lower: document.getElementById('pwLower') ? document.getElementById('pwLower').checked : true,
        digits: document.getElementById('pwDigits') ? document.getElementById('pwDigits').checked : true,
        symbols: document.getElementById('pwSymbols') ? document.getElementById('pwSymbols').checked : true
      };
      var pw = genPassword(len, opts);
      pwOut.value = pw;
      if (pwStrength) {
        var s = calcPwStrength(pw);
        pwStrength.textContent = 'STRENGTH: ' + s.toUpperCase();
        pwStrength.className = 'password-strength ' + s;
      }
    }

    if (genBtn) genBtn.addEventListener('click', generate);
    if (pwLen) pwLen.addEventListener('input', function() {
      if (pwLenVal) pwLenVal.textContent = this.value;
      generate();
    });
    if (pwCopy) {
      pwCopy.addEventListener('click', function() {
        pwOut.select();
        document.execCommand('copy');
      });
    }
    // regenerate on checkbox change
    document.querySelectorAll('.password-opt input[type=checkbox]').forEach(function(cb) {
      cb.addEventListener('change', generate);
    });
    generate();
  });

  /* ===== 5. COLLAPSIBLE PANELS ===== */
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.panel').forEach(function(p) {
      var header = p.querySelector('.panel-header');
      if (!header || p.querySelector('.collapse-btn')) return;
      // insert collapse button at start of .right, or end of .left if no .right
      var right = header.querySelector('.right');
      var btn = document.createElement('span');
      btn.className = 'collapse-btn';
      btn.textContent = '\u25BC';
      btn.title = 'Collapse';
      btn.addEventListener('click', function() {
        p.classList.toggle('collapsed');
        btn.classList.toggle('collapsed');
        btn.title = p.classList.contains('collapsed') ? 'Expand' : 'Collapse';
      });
      if (right) {
        right.insertBefore(btn, right.firstChild);
      } else {
        var left = header.querySelector('.left');
        if (left) {
          var wrap = document.createElement('div');
          wrap.className = 'right';
          wrap.appendChild(btn);
          header.appendChild(wrap);
        }
      }
    });
  });

  /* ===== 6. DRAG REORDER ===== */
  document.addEventListener('DOMContentLoaded', function() {
    var containers = ['.dash-grid', '.command-sidebar', '.chronos-layout', '.tools-layout'];
    containers.forEach(function(sel) {
      var parent = document.querySelector(sel);
      if (!parent) return;
      parent.addEventListener('dragstart', function(e) {
        var panel = e.target.closest('.panel');
        if (panel) { panel.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
      });
      parent.addEventListener('dragend', function(e) {
        var panel = e.target.closest('.panel');
        if (panel) panel.classList.remove('dragging');
        parent.querySelectorAll('.panel.drag-over').forEach(function(p){p.classList.remove('drag-over')});
      });
      parent.addEventListener('dragover', function(e) {
        e.preventDefault();
        var target = e.target.closest('.panel');
        if (!target) return;
        target.classList.add('drag-over');
      });
      parent.addEventListener('dragleave', function(e) {
        var target = e.target.closest('.panel');
        if (target) target.classList.remove('drag-over');
      });
      parent.addEventListener('drop', function(e) {
        e.preventDefault();
        var dragged = parent.querySelector('.dragging');
        var target = e.target.closest('.panel');
        if (!dragged || !target || dragged === target) return;
        var rect = target.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          parent.insertBefore(dragged, target);
        } else {
          parent.insertBefore(dragged, target.nextSibling);
        }
        dragged.classList.remove('dragging');
        target.classList.remove('drag-over');
      });
    });
    // Add drag handles to panels
    document.querySelectorAll('.panel').forEach(function(p) {
      var header = p.querySelector('.panel-header');
      if (!header || p.querySelector('.drag-handle')) return;
      var handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.innerHTML = '\u2551';
      handle.draggable = true;
      handle.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', '');
        p.classList.add('dragging');
      });
      handle.addEventListener('dragend', function() {
        p.classList.remove('dragging');
      });
      var left = header.querySelector('.left');
      if (left) left.insertBefore(handle, left.firstChild);
    });
  });

  /* ===== 7. EXPORT / IMPORT ===== */
  function exportData() {
    var data = {};
    for (var key in localStorage) {
      if (key.indexOf('dash_') === 0) {
        data[key] = localStorage.getItem(key);
      }
    }
    // Include notes too
    var notes = document.getElementById('notesArea');
    if (notes) data.dash_notes = notes.value;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sysdash_backup_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        for (var key in data) {
          localStorage.setItem(key, data[key]);
        }
        // If notes imported
        if (data.dash_notes !== undefined) {
          var notes = document.getElementById('notesArea');
          if (notes) notes.value = data.dash_notes;
        }
        // Reload states
        var st = LS('todos'); if (st !== null) { todos = st; renderTodos(); }
        var sh = LS('habits'); if (sh !== null) { habits = sh; renderHabits(); }
        alert('IMPORT_COMPLETE: ' + Object.keys(data).length + ' keys restored.');
      } catch(err) {
        alert('IMPORT_ERROR: Invalid file.');
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var exportBtn = document.getElementById('exportBtn');
    var importInput = document.getElementById('importInput');
    var importBtn = document.getElementById('importBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function() { importInput.click(); });
      importInput.addEventListener('change', function(e) {
        if (e.target.files.length) importData(e.target.files[0]);
        e.target.value = '';
      });
    }
  });

  /* ===== 8. FULLSCREEN TOGGLE ===== */
  document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('fullscreenBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(){});
      } else {
        document.exitFullscreen().catch(function(){});
      }
    });
    document.addEventListener('fullscreenchange', function() {
      document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
    });
  });

  /* ===== 9. MOOD CHART ===== */
  var moodData = LS('mood') || {};
  var moodLabels = {1:'TERRIBLE',2:'BAD',3:'NEUTRAL',4:'OK',5:'GOOD'};
  var moodColors = {1:'#ef4444',2:'#f97316',3:'#eab308',4:'#22c55e',5:'#16a34a'};
  var moodEmojis = {1:'\uD83D\uDE21',2:'\uD83D\uDE1E',3:'\uD83D\uDE10',4:'\uD83D\uDE42',5:'\uD83D\uDE04'};

  function saveMood(val) {
    var today = new Date().toISOString().slice(0,10);
    moodData[today] = val;
    LS('mood', moodData);
    renderMood();
  }

  function renderMood() {
    var opts = document.getElementById('moodOptions');
    var canvas = document.getElementById('moodChart');
    var avgEl = document.getElementById('moodAvg');
    var bestEl = document.getElementById('moodBest');
    var totalEl = document.getElementById('moodTotal');
    var streakEl = document.getElementById('moodStreak');
    if (!opts) return;

    var today = new Date().toISOString().slice(0,10);
    var current = moodData[today] || 0;

    // highlight today
    opts.querySelectorAll('.mood-btn').forEach(function(b) {
      var v = parseInt(b.dataset.mood);
      b.classList.toggle('active', v === current);
    });

    // stats
    var vals = Object.keys(moodData).map(function(k){return moodData[k]});
    if (vals.length) {
      var sum = vals.reduce(function(a,b){return a+b}, 0);
      var avg = (sum / vals.length);
      if (avgEl) avgEl.textContent = 'AVG: ' + moodLabels[Math.round(avg)] + ' (' + avg.toFixed(1) + ')';
      var best = Math.max.apply(null, vals);
      if (bestEl) bestEl.textContent = 'BEST: ' + moodLabels[best];
    }
    if (totalEl) totalEl.textContent = 'LOGGED: ' + vals.length + ' days';

    // streak
    var streak = 0, d = new Date();
    while (true) {
      var ds = d.toISOString().slice(0,10);
      if (moodData[ds]) { streak++; d.setDate(d.getDate()-1); }
      else break;
    }
    if (streakEl) streakEl.textContent = streak > 1 ? 'STREAK: ' + streak + ' days' : '';

    // chart
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 16;
    canvas.height = 180;
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    var days = 30;
    var entries = [];
    for (var i = days - 1; i >= 0; i--) {
      var date = new Date();
      date.setDate(date.getDate() - i);
      var ds = date.toISOString().slice(0,10);
      var v = moodData[ds] || 0;
      entries.push({ date: ds, val: v, day: date.getDate() });
    }

    var pad = { t: 20, r: 16, b: 24, l: 16 };
    var cw = W - pad.l - pad.r;
    var ch = H - pad.t - pad.b;

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var g = 1; g <= 5; g++) {
      var gy = pad.t + ch - (g / 5) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.l, gy);
      ctx.lineTo(W - pad.r, gy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(moodLabels[g] || '', pad.l - 4, gy + 3);
    }

    // bars
    var barW = Math.max(4, Math.min(14, cw / entries.length - 2));
    var gap = (cw - barW * entries.length) / (entries.length + 1);

    // trend line
    var trendPoints = [];
    entries.forEach(function(e, i) {
      if (e.val === 0) return;
      var tx = pad.l + gap + i * (barW + gap);
      var tbh = (e.val / 5) * ch;
      var ty = pad.t + ch - tbh;
      trendPoints.push({ x: tx + barW/2, y: ty });
    });
    if (trendPoints.length > 1) {
      ctx.strokeStyle = 'var(--accent)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(trendPoints[0].x, trendPoints[0].y);
      for (var ti = 1; ti < trendPoints.length; ti++) {
        ctx.lineTo(trendPoints[ti].x, trendPoints[ti].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    entries.forEach(function(e, i) {
      var x = pad.l + gap + i * (barW + gap);
      if (e.val === 0) return;

      var bh = (e.val / 5) * ch;
      var y = pad.t + ch - bh;

      var c = moodColors[e.val] || '#555';
      var grad = ctx.createLinearGradient(0, y, 0, pad.t + ch);
      grad.addColorStop(0, c);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.55;
      var radius = Math.min(3, barW / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, pad.t + ch);
      ctx.lineTo(x, pad.t + ch);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + barW/2, y, 3, 0, Math.PI*2);
      ctx.fill();

      // tooltip hover
      var wrap = canvas.parentElement;
      if (wrap && !wrap._moodHoverInit) {
        wrap._moodHoverInit = true;
        var tooltip = document.createElement('div');
        tooltip.className = 'mood-tooltip';
        wrap.appendChild(tooltip);
        wrap.addEventListener('mousemove', function(ev) {
          var rect = canvas.getBoundingClientRect();
          var mx = ev.clientX - rect.left;
          var my = ev.clientY - rect.top;
          var found = false;
          entries.forEach(function(ee, ii) {
            if (ee.val === 0) return;
            var bx = pad.l + gap + ii * (barW + gap);
            var bx2 = bx + barW;
            if (mx >= bx && mx <= bx2) {
              var bbh = (ee.val / 5) * ch;
              var by = pad.t + ch - bbh;
              if (my >= by - 6 && my <= by + 6) {
                tooltip.textContent = moodLabels[ee.val] + ' (' + ee.val + ')';
                tooltip.style.left = (bx + barW/2) + 'px';
                tooltip.style.top = (by - 30) + 'px';
                tooltip.style.display = 'block';
                found = true;
              }
            }
          });
          if (!found) tooltip.style.display = 'none';
        });
        wrap.addEventListener('mouseleave', function() { tooltip.style.display = 'none'; });
      }

      if (i % 5 === 0 || i === entries.length - 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.day, x + barW/2, H - pad.b + 14);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    var opts = document.getElementById('moodOptions');
    if (opts) {
      opts.addEventListener('click', function(e) {
        var btn = e.target.closest('.mood-btn');
        if (btn) saveMood(parseInt(btn.dataset.mood));
      });
    }
    renderMood();
  });

  /* ===== 10. RADIO ===== */
  var radioDefs = [
    { id: 'nightride', label: 'NIGHTRIDE', stream: 'https://stream.nightride.fm/nightride.mp3', genre: 'Synthwave', mount: 'nightride.mp3' },
    { id: 'chillsynth', label: 'CHILLSYNTH', stream: 'https://stream.nightride.fm/chillsynth.mp3', genre: 'Chill Synthwave', mount: 'chillsynth.mp3' },
    { id: 'darksynth', label: 'DARKSYNTH', stream: 'https://stream.nightride.fm/darksynth.mp3', genre: 'Dark Synthwave', mount: 'darksynth.mp3' },
    { id: 'spacesynth', label: 'SPACESYNTH', stream: 'https://stream.nightride.fm/spacesynth.mp3', genre: 'Space Synth', mount: 'spacesynth.mp3' },
    { id: 'horrorsynth', label: 'HORRORSYNTH', stream: 'https://stream.nightride.fm/horrorsynth.mp3', genre: 'Horror Synth', mount: 'horrorsynth.mp3' },
    { id: 'datawave', label: 'DATAWAVE', stream: 'https://stream.nightride.fm/datawave.mp3', genre: 'Datawave', mount: 'datawave.mp3' },
    { id: 'ebsm', label: 'EBSM', stream: 'https://stream.nightride.fm/ebsm.mp3', genre: 'Industrial', mount: 'ebsm.mp3' },
    { id: 'synthdragon', label: 'SYNTHDRAGON', stream: 'https://stream.synthdragonradio.com/listen/synthdragon_chill/radio.mp3', genre: 'Chill Synth', mount: null }
  ];

  var radioAudio = null;
  var radioCurrentId = null;
  var radioMetaInterval = null;
  var radioAudioCtx = null;
  var radioAnalyser = null;
  var radioGain = null;
  var radioAnimFrame = null;

  function initRadio() {
    var grid = document.getElementById('radioStations');
    if (!grid) return;

    radioDefs.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'radio-station-btn';
      btn.dataset.radio = s.id;
      btn.innerHTML = '<span style="display:block;font-size:10px;font-weight:700">' + s.label + '</span><span style="font-size:7px;opacity:.6">' + s.genre + '</span>';
      btn.addEventListener('click', function() {
        selectRadioStation(s.id);
      });
      grid.appendChild(btn);
    });

    var playBtn = document.getElementById('radioPlayBtn');
    var stopBtn = document.getElementById('radioStopBtn');
    var volSlider = document.getElementById('radioVolume');

    if (playBtn) playBtn.addEventListener('click', function() {
      if (radioCurrentId) playRadio(radioCurrentId);
    });
    if (stopBtn) stopBtn.addEventListener('click', stopRadio);
    if (volSlider) volSlider.addEventListener('input', function() {
      var v = parseFloat(this.value);
      if (radioGain) radioGain.gain.value = v;
      if (radioAudio) radioAudio.volume = v;
    });
  }

  function selectRadioStation(id) {
    radioCurrentId = id;
    document.querySelectorAll('.radio-station-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.radio === id);
    });
    var nameEl = document.getElementById('radioStationName');
    var def = radioDefs.find(function(s) { return s.id === id; });
    if (nameEl && def) nameEl.textContent = def.label + ' // ' + def.genre;
    playRadio(id);
  }

  function playRadio(id) {
    var def = radioDefs.find(function(s) { return s.id === id; });
    if (!def) return;
    stopRadio();
    radioAudio = new Audio(def.stream);
    radioAudio.crossOrigin = 'anonymous';
    var vol = parseFloat((document.getElementById('radioVolume') || {}).value || 0.5);
    radioAudio.volume = vol;

    var canvas = document.getElementById('radioViz');
    if (canvas) {
      try {
        radioAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        radioAnalyser = radioAudioCtx.createAnalyser();
        radioAnalyser.fftSize = 256;
        radioGain = radioAudioCtx.createGain();
        radioGain.gain.value = vol;
        var src = radioAudioCtx.createMediaElementSource(radioAudio);
        src.connect(radioAnalyser);
        radioAnalyser.connect(radioGain);
        radioGain.connect(radioAudioCtx.destination);
        startViz(canvas);
      } catch(e) {
        // AudioContext not available, play without viz
      }
    }

    radioAudio.play().then(function() {
      var statusEl = document.getElementById('radioStatus');
      if (statusEl) { statusEl.textContent = 'PLAYING'; statusEl.className = 'radio-status playing'; }
      startMetadataPolling();
    }).catch(function(err) {
      var statusEl = document.getElementById('radioStatus');
      if (statusEl) { statusEl.textContent = 'STREAM_ERROR'; statusEl.className = 'radio-status'; }
    });
    radioAudio.addEventListener('error', function() {
      var statusEl = document.getElementById('radioStatus');
      if (statusEl) { statusEl.textContent = 'STREAM_ERROR'; statusEl.className = 'radio-status'; }
    });
  }

  function startViz(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var bins = radioAnalyser.frequencyBinCount;
    var data = new Uint8Array(bins);

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      W = canvas.width = Math.floor(rect.width - 4);
      H = canvas.height = 96;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      radioAnimFrame = requestAnimationFrame(draw);
      radioAnalyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);

      var barCount = Math.min(bins, 64);
      var barW = Math.max(2, Math.floor(W / barCount) - 1);
      var gap = 1;
      var totalW = barCount * (barW + gap) - gap;
      var offsetX = Math.floor((W - totalW) / 2);

      for (var i = 0; i < barCount; i++) {
        var val = data[i] / 255;
        var barH = Math.max(1, val * H * 0.9);
        var x = offsetX + i * (barW + gap);
        var y = H - barH;

        var hue = 200 + (i / barCount) * 160;
        ctx.fillStyle = 'hsl(' + hue + ', 80%, ' + (40 + val * 40) + '%)';
        ctx.fillRect(x, y, barW, barH);
      }
    }
    draw();
  }

  function stopViz() {
    if (radioAnimFrame) { cancelAnimationFrame(radioAnimFrame); radioAnimFrame = null; }
    if (radioAudioCtx) { radioAudioCtx.close(); radioAudioCtx = null; }
    radioAnalyser = null;
    radioGain = null;
    var canvas = document.getElementById('radioViz');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function stopRadio() {
    if (radioAudio) {
      radioAudio.pause();
      radioAudio.src = '';
      radioAudio = null;
    }
    stopViz();
    stopMetadataPolling();
    var statusEl = document.getElementById('radioStatus');
    if (statusEl) { statusEl.textContent = 'STATION_IDLE'; statusEl.className = 'radio-status'; }
    var npEl = document.getElementById('npTrack');
    if (npEl) npEl.textContent = '--';
  }

  function startMetadataPolling() {
    stopMetadataPolling();
    fetchMetadata();
    radioMetaInterval = setInterval(fetchMetadata, 15000);
  }

  function stopMetadataPolling() {
    if (radioMetaInterval) {
      clearInterval(radioMetaInterval);
      radioMetaInterval = null;
    }
  }

  function fetchMetadata() {
    var def = radioDefs.find(function(s) { return s.id === radioCurrentId; });
    if (!def || !def.mount) return;

    fetch('https://stream.nightride.fm/status-json.xsl', { mode: 'cors' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.icestats || !data.icestats.source) return;
        var sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source];
        var match = null;
        for (var i = 0; i < sources.length; i++) {
          if (sources[i].server_name === def.mount) {
            match = sources[i];
            break;
          }
        }
        if (!match) return;
        var track = match.title || match['display-title'] || null;
        var artist = match.artist || null;
        var npEl = document.getElementById('npTrack');
        if (!npEl) return;
        if (track) {
          if (artist && track.indexOf(artist) === -1) {
            npEl.textContent = artist + ' - ' + track;
          } else {
            npEl.textContent = track;
          }
        } else {
          npEl.textContent = 'NO_METADATA';
        }
      })
      .catch(function() {
        // CORS or network error — silently ignore
      });
  }

  document.addEventListener('DOMContentLoaded', initRadio);

  /* ===== 11. XP THEME ===== */
  function applyXPTheme() {
    document.documentElement.className = 'theme-xp';
    localStorage.setItem('sys_theme', 'xp');
    if (window.XP_updateLabels) window.XP_updateLabels();
  }

  function removeXPTheme() {
    document.documentElement.className = 'theme-yellow';
    localStorage.removeItem('sys_theme');
    if (window.XP_resetLabels) window.XP_resetLabels();
  }

  document.addEventListener('DOMContentLoaded', function() {
    var applyBtn = document.querySelector('.apply-xp');
    var previewBtn = document.querySelector('.preview-xp');
    if (applyBtn) {
      applyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        applyXPTheme();
      });
    }
    if (previewBtn) {
      previewBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        applyXPTheme();
      });
    }
    // Migrate old JSON-encoded format if present
    try {
      var old = JSON.parse(localStorage.getItem('sys_theme'));
      if (old === 'xp') { localStorage.setItem('sys_theme', 'xp'); }
    } catch(e) {}
    // Restore XP theme on page load.
    // Use setTimeout(0) to run AFTER the built-in module's DOMContentLoaded
    // handler (Ue/yt/Z) has already run and potentially overwritten the class.
    setTimeout(function() {
      try {
        var saved = localStorage.getItem('sys_theme');
        if (saved === 'xp') applyXPTheme();
      } catch(e) {}
    }, 0);
  });

  /* ===== 12. COMPREHENSIVE EMOJI PICKER ===== */
  var emojiGroups = [
    ['face','😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🥳','🥺','😢','😭','😤','😠','😡','🤬','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    ['gesture','👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦'],
    ['animal','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🪸','🐊'],
    ['food','🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌽','🫑','🥕','🧄','🧅','🥔','🍠','🫘','🌰','🥜','🍞','🥐','🥖','🫓','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉','🍾','🧊'],
    ['travel','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🛳️','⛵','🚤','🛶','✈️','🛩️','🪂','🚁','🚀','🛸','🌠','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','🌄','🌅','🌃','🌆','🌇','🌉','🗾','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏟️','🏛️','🏗️','🛖','🏘️','🏚️','🏠'],
    ['activity','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎯','🛝','🎳','⛸️','🥌','🎿','⛷️','🏂','🏋️','🤼','🤸','🤺','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🕹️'],
    ['object','⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🗑️','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','🔭','🔬','🕳️','🩻','🩹','🩺','💊','💉','🧬','🩸','🩼'],
    ['symbol','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫'],
    ['flag','🏳️','🏴','🏁','🚩','🎌','🏴‍☠️','🇺🇳','🇦🇷','🇧🇴','🇧🇷','🇨🇦','🇨🇱','🇨🇳','🇨🇴','🇩🇪','🇪🇸','🇫🇷','🇬🇧','🇮🇳','🇮🇹','🇯🇵','🇰🇷','🇲🇽','🇵🇾','🇷🇺','🇺🇸','🇺🇾','🇻🇪']
  ];
  var catNames = {face:'😊 Smileys',gesture:'✋ Gestures',animal:'🐶 Animals',food:'🍕 Food',travel:'✈️ Travel',activity:'⚽ Activities',object:'💻 Objects',symbol:'❤️ Symbols',flag:'🏁 Flags'};
  var catOrder = ['face','gesture','animal','food','travel','activity','object','symbol','flag'];

  function initComprehensiveEmoji() {
    var body = document.querySelector('.emoji-panel .panel-body');
    if (!body) return;
    var html = '<div class="emoji-cats" style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">';
    catOrder.forEach(function(k,i){
      html += '<button class="viz-btn emoji-cat-btn'+(i===0?' active':'')+'" data-cat="'+k+'" style="font-size:10px;padding:3px 8px">'+catNames[k]+'</button>';
    });
    html += '</div>';
    html += '<input type="text" id="ceSearch" placeholder="SEARCH..." class="search-btn" style="width:100%;text-align:left;padding-left:10px;margin-bottom:6px;cursor:text;font-size:11px">';
    html += '<div id="ceList" class="emoji-grid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:1px;max-height:340px;overflow-y:auto;font-size:24px;padding:4px;background:var(--surface-low);border:1px solid var(--outline)"></div>';
    body.innerHTML = html;

    var grid = document.getElementById('ceList');
    var search = document.getElementById('ceSearch');
    var activeCat = 'face';

    function renderCat(cat) {
      grid.innerHTML = '';
      var group = null;
      emojiGroups.forEach(function(g){if(g[0]===cat)group=g});
      if (!group) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:16px;color:var(--on-surface-dim);font-size:10px">NO_EMOJI</div>'; return; }
      for (var i=1;i<group.length;i++) {
        (function(emoji){
          var span = document.createElement('span');
          span.textContent = emoji;
          span.style.cssText = 'cursor:pointer;padding:3px;text-align:center;border-radius:3px;transition:background .1s';
          span.onmouseenter = function(){this.style.background='var(--surface-high)'};
          span.onmouseleave = function(){this.style.background='transparent'};
          span.onclick = function(){copyK(emoji)};
          grid.appendChild(span);
        })(group[i]);
      }
    }

    function renderAll(filterText) {
      grid.innerHTML = '';
      var t = filterText.toLowerCase();
      var found = 0;
      emojiGroups.forEach(function(group){
        for (var i=1;i<group.length;i++) {
          if (group[i].indexOf(t)!==-1 || group[0].indexOf(t)!==-1) {
            (function(emoji){
              var span = document.createElement('span');
              span.textContent = emoji;
              span.style.cssText = 'cursor:pointer;padding:3px;text-align:center;border-radius:3px;transition:background .1s';
              span.onmouseenter = function(){this.style.background='var(--surface-high)'};
              span.onmouseleave = function(){this.style.background='transparent'};
              span.onclick = function(){copyK(emoji)};
              grid.appendChild(span);
              found++;
            })(group[i]);
          }
        }
      });
      if (!found) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--on-surface-dim);font-size:10px">NO_EMOJI_FOUND</div>';
    }

    body.querySelectorAll('.emoji-cat-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        body.querySelectorAll('.emoji-cat-btn').forEach(function(b){b.classList.remove('active')});
        btn.classList.add('active');
        activeCat = btn.dataset.cat;
        if (search) search.value = '';
        renderCat(activeCat);
      });
    });

    if (search) {
      search.addEventListener('input', function(){
        var val = this.value.trim();
        if (!val) { renderCat(activeCat); return; }
        renderAll(val);
      });
    }

    renderCat('face');
  }

  document.addEventListener('DOMContentLoaded', initComprehensiveEmoji);

  /* ===== 13. PET VIRTUAL ===== */
  var petAsciiVariants = {
    happy: '  /\\___/\\\n (  o o  )\n (  :^:  )\n  \\   /  ',
    sleepy: '  /\\___/\\\n (  - -  )\n  \\ ___ /\n   \\   /  ',
    angry: '  /\\___/\\\n (  > <  )\n  \\  ^  /\n   \\___/  ',
    default: '  /\\___/\\\n (  o o  )\n /   ^   \\'
  };
  var petState = LS('petState') || { hunger: 80, happiness: 60, energy: 70 };

  function updatePetUI() {
    var asciiEl = document.getElementById('petAscii');
    var hungerEl = document.getElementById('petHunger');
    var happyEl = document.getElementById('petHappy');
    var energyEl = document.getElementById('petEnergy');
    if (asciiEl) {
      var variant = 'default';
      if (petState.hunger < 30) variant = 'sleepy';
      else if (petState.happiness < 30) variant = 'angry';
      else if (petState.happiness > 70 && petState.hunger > 70) variant = 'happy';
      asciiEl.textContent = petAsciiVariants[variant] || petAsciiVariants.default;
    }
    if (hungerEl) hungerEl.style.width = Math.min(100, Math.max(0, petState.hunger)) + '%';
    if (happyEl) happyEl.style.width = Math.min(100, Math.max(0, petState.happiness)) + '%';
    if (energyEl) energyEl.style.width = Math.min(100, Math.max(0, petState.energy)) + '%';
    LS('petState', petState);
  }

  function petFeed() {
    petState.hunger = Math.min(100, petState.hunger + 15);
    updatePetUI();
  }
  function petPlay() {
    petState.happiness = Math.min(100, petState.happiness + 15);
    petState.energy = Math.max(0, petState.energy - 10);
    updatePetUI();
  }
  function petSleep() {
    petState.energy = Math.min(100, petState.energy + 20);
    updatePetUI();
  }
  function petDecay() {
    petState.hunger = Math.max(0, petState.hunger - 2);
    petState.happiness = Math.max(0, petState.happiness - 1);
    petState.energy = Math.max(0, petState.energy - 1);
    updatePetUI();
  }

  document.addEventListener('DOMContentLoaded', function() {
    updatePetUI();
    setInterval(petDecay, 30000);
  });

  /* ===== 14. MARKDOWN SUPPORT ===== */
  function renderMarkdown(text) {
    var html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, function(m, code) {
        return '<pre style="background:var(--surface-high);border:1px solid var(--outline);padding:8px;overflow-x:auto;font-size:12px">' + code.replace(/\n$/, '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
      })
      .replace(/######\s*(.*?)(\n|$)/g, '<h6 style="font-size:11px;margin:12px 0 4px;color:var(--accent)">$1</h6>')
      .replace(/#####\s*(.*?)(\n|$)/g, '<h5 style="font-size:12px;margin:12px 0 4px;color:var(--accent)">$1</h5>')
      .replace(/####\s*(.*?)(\n|$)/g, '<h4 style="font-size:13px;margin:12px 0 4px;color:var(--accent)">$1</h4>')
      .replace(/###\s*(.*?)(\n|$)/g, '<h3 style="font-size:14px;margin:12px 0 4px;color:var(--accent)">$1</h3>')
      .replace(/##\s*(.*?)(\n|$)/g, '<h2 style="font-size:16px;margin:12px 0 4px;color:var(--accent)">$1</h2>')
      .replace(/#\s*(.*?)(\n|$)/g, '<h1 style="font-size:18px;margin:12px 0 4px;color:var(--accent)">$1</h1>')
      .replace(/^- (.+)/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--surface-high);padding:1px 4px;font-size:12px;border:1px solid var(--outline)">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);text-decoration:underline">$1</a>')
      .replace(/\n/g, '<br>');
    return html;
  }

  var notesPreviewVisible = false;

  function toggleNotesPreview() {
    var textarea = document.getElementById('notesArea');
    var preview = document.getElementById('notesPreview');
    if (!textarea || !preview) return;
    notesPreviewVisible = !notesPreviewVisible;
    if (notesPreviewVisible) {
      preview.innerHTML = renderMarkdown(textarea.value);
      preview.style.display = 'block';
      textarea.style.display = 'none';
    } else {
      preview.style.display = 'none';
      textarea.style.display = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var pv = document.getElementById('notesPreview');
    if (pv) pv.style.display = 'none';
  });

  /* ===== 15. INTERNAL SEARCH ===== */
  function doLocalSearch() {
    var query = (document.getElementById('localSearch') || {}).value || '';
    var resultsEl = document.getElementById('localSearchResults');
    if (!resultsEl) return;
    if (!query.trim()) { resultsEl.innerHTML = '<div class="todo-empty">ENTER_QUERY</div>'; return; }
    var q = query.toLowerCase();
    var html = '';

    var notes = localStorage.getItem('dash_notes') || '';
    if (notes.toLowerCase().indexOf(q) !== -1) {
      var idx = notes.toLowerCase().indexOf(q);
      var snippet = notes.substring(Math.max(0, idx - 30), idx + q.length + 30);
      html += '<div class="todo-item"><span class="todo-priority high">[NOTE]</span><span class="todo-text">' + esc(snippet) + '</span></div>';
    }

    var todosLocal = LS('todos') || [];
    todosLocal.forEach(function(t) {
      if (t.text.toLowerCase().indexOf(q) !== -1) {
        html += '<div class="todo-item"><span class="todo-priority medium">[TODO]</span><span class="todo-text">' + esc(t.text) + '</span></div>';
      }
    });

    var habitsLocal = LS('habits') || [];
    habitsLocal.forEach(function(h) {
      if (h.name.toLowerCase().indexOf(q) !== -1) {
        html += '<div class="todo-item"><span class="todo-priority low">[HABIT]</span><span class="todo-text">' + esc(h.name) + '</span></div>';
      }
    });

    if (!html) {
      resultsEl.innerHTML = '<div class="todo-empty">NO_MATCHES</div>';
    } else {
      resultsEl.innerHTML = html;
    }
  }

  /* ===== 16. CUSTOM THEME ===== */
  function openCustomThemeEditor() {
    var el = document.getElementById('customThemeEditor');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    var ct = LS('customTheme');
    if (ct) {
      var m = { accent: 'ct-accent', bg: 'ct-bg', surface: 'ct-surface', text: 'ct-text', success: 'ct-success', error: 'ct-error' };
      for (var k in m) {
        var inp = document.getElementById(m[k]);
        if (inp && ct[k]) inp.value = ct[k];
      }
    }
  }

  function applyCustomTheme(fromCard) {
    var ct;
    if (fromCard) {
      ct = LS('customTheme');
      if (!ct) {
        ct = { accent: '#fce300', bg: '#0a0a0a', surface: '#131313', text: '#e5e2e1', success: '#00ff41', error: '#ff3860' };
      }
    } else {
      ct = {
        accent: (document.getElementById('ct-accent') || {}).value || '#fce300',
        bg: (document.getElementById('ct-bg') || {}).value || '#0a0a0a',
        surface: (document.getElementById('ct-surface') || {}).value || '#131313',
        text: (document.getElementById('ct-text') || {}).value || '#e5e2e1',
        success: (document.getElementById('ct-success') || {}).value || '#00ff41',
        error: (document.getElementById('ct-error') || {}).value || '#ff3860'
      };
    }
    LS('customTheme', ct);
    document.documentElement.className = 'theme-custom';
    localStorage.setItem('sys_theme', 'custom');
    setCustomCSSVars(ct);
  }

  function setCustomCSSVars(ct) {
    var root = document.documentElement;
    root.style.setProperty('--accent', ct.accent || '#fce300');
    root.style.setProperty('--bg', ct.bg || '#0a0a0a');
    root.style.setProperty('--surface', ct.surface || '#131313');
    root.style.setProperty('--on-surface', ct.text || '#e5e2e1');
    root.style.setProperty('--success', ct.success || '#00ff41');
    root.style.setProperty('--error', ct.error || '#ff3860');
  }

  function loadCustomTheme() {
    var root = document.documentElement;
    var ct = LS('customTheme');
    if (root.classList.contains('theme-custom')) {
      if (ct) setCustomCSSVars(ct);
    } else {
      var keys = ['--accent', '--bg', '--surface', '--on-surface', '--success', '--error'];
      keys.forEach(function(k) { root.style.removeProperty(k); });
    }
  }

  var ctObserver = new MutationObserver(loadCustomTheme);
  ctObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('DOMContentLoaded', loadCustomTheme);

  (function() {
    var savedTheme = localStorage.getItem('sys_theme');
    if (savedTheme === 'custom') {
      document.addEventListener('DOMContentLoaded', function() {
        document.documentElement.classList.add('theme-custom');
        var ct = LS('customTheme');
        if (ct) setCustomCSSVars(ct);
      });
    }
  })();

})();
