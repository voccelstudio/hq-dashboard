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
  var soundGain = null;

  var soundDefs = [
    { id: 'rain', icon: '\u2614', label: 'RAIN' },
    { id: 'wind', icon: '\uD83C\uDF2C\uFE0F', label: 'WIND' },
    { id: 'forest', icon: '\uD83C\uDF33', label: 'FOREST' },
    { id: 'ocean', icon: '\uD83C\uDF0A', label: 'OCEAN' },
    { id: 'fire', icon: '\uD83D\uDD25', label: 'FIRE' },
    { id: 'brown', icon: '\uD83C\uDFB5', label: 'BROWN_NOISE' }
  ];

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

  function toggleSound(id) {
    if (!audioCtx) initAudio();
    if (activeSources[id]) {
      try { activeSources[id].stop(); } catch(e) {}
      delete activeSources[id];
      document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.remove('active')});
      return;
    }
    var buf = createNoise(id);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    applyFilter(id, src);
    src.start();
    activeSources[id] = src;
    document.querySelectorAll('[data-sound="'+id+'"]').forEach(function(b){b.classList.add('active')});
  }

  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    soundGain = audioCtx.createGain();
    soundGain.gain.value = 0.3;
    soundGain.connect(audioCtx.destination);
  }

  function stopAllSounds() {
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
        if (soundGain) soundGain.gain.value = parseFloat(this.value);
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

})();
