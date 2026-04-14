/**
 * @fileoverview Frontend app for EventAI Concierge.
 * Features:
 *   - Streaming chat (SSE) with rich-card rendering
 *   - Voice input (Web Speech API, hold-to-talk)
 *   - Text-to-speech replies
 *   - Image analysis (Gemini Vision)
 *   - Interactive SVG floor map with room highlighting
 *   - Personal agenda with localStorage + .ics export
 *   - PWA service-worker registration
 */

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────────
  const state = {
    event: null,
    isLoading: false,
    ttsEnabled: false,
    currentFloor: 1,
    savedSessions: loadSaved(),
    activeTab: 'chat',
  };

  // ── Elements ────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    chatForm: $('#chat-form'),
    chatInput: $('#chat-input'),
    chatTranscript: $('#chat-transcript'),
    errorBanner: $('#error-banner'),
    sendBtn: $('#send-btn'),
    micBtn: $('#mic-btn'),
    ttsBtn: $('#tts-btn'),
    imageBtn: $('#image-btn'),
    imageInput: $('#image-input'),
    tabs: $$('.tab'),
    panels: {
      chat: $('#panel-chat'),
      map: $('#panel-map'),
      agenda: $('#panel-agenda'),
    },
    mapSurface: $('#map-surface'),
    mapDetail: $('#map-detail'),
    floorBtns: $$('.floor-btn'),
    agendaRecommend: $('#agenda-recommend'),
    agendaExport: $('#agenda-export'),
    trackFilter: $('#track-filter'),
    sessionList: $('#session-list'),
    eventSub: $('#event-sub'),
  };

  // ── Boot ────────────────────────────────────────────────────────
  async function init() {
    wireTabs();
    wireChatForm();
    wireChips();
    wireMic();
    wireTTS();
    wireImage();
    wireFloorSwitch();
    wireAgenda();
    registerSW();

    try {
      const res = await fetch('/api/event');
      state.event = await res.json();
      el.eventSub.textContent = `${state.event.name} · ${state.event.date}`;
      renderMap(1);
      renderAgenda();
      populateTrackFilter();
    } catch {
      // Non-fatal — the chat still works
      console.warn('Event dataset unavailable. Map and agenda disabled until reconnect.');
    }
  }

  // ── Tabs ────────────────────────────────────────────────────────
  function wireTabs() {
    el.tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === state.activeTab) return;
        state.activeTab = tab;
        el.tabs.forEach((t) => {
          const active = t.dataset.tab === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', String(active));
        });
        Object.entries(el.panels).forEach(([k, p]) => {
          const active = k === tab;
          p.classList.toggle('is-active', active);
          p.hidden = !active;
        });
      });
    });
  }

  // ── Chat ────────────────────────────────────────────────────────
  function wireChatForm() {
    el.chatForm.addEventListener('submit', handleSubmit);
    el.chatInput.addEventListener('input', autoResize);
    el.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
  }

  function wireChips() {
    $$('.chip[data-query]').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (state.isLoading) return;
        const query = chip.getAttribute('data-query');
        el.chatInput.value = query;
        handleSubmit(new Event('submit', { cancelable: true }));
      });
    });
  }

  function autoResize() {
    el.chatInput.style.height = 'auto';
    el.chatInput.style.height = Math.min(el.chatInput.scrollHeight, 140) + 'px';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (state.isLoading) return;

    const message = el.chatInput.value.trim();
    if (!message) return;

    el.chatInput.value = '';
    autoResize();
    hideError();
    appendMessage(message, 'user');

    setLoading(true);
    switchTab('chat');
    const aiBubble = appendMessage('', 'ai');
    const caret = document.createElement('span');
    caret.className = 'caret';
    aiBubble.appendChild(caret);
    scrollToBottom();

    try {
      let buffer = '';
      await streamChat(message, (chunk) => {
        buffer += chunk;
        const { visibleText } = stripCardMarker(buffer);
        aiBubble.innerHTML = formatAIResponse(visibleText);
        aiBubble.appendChild(caret);
        scrollToBottom();
      });

      // Finalise — strip CARDS marker, render rich cards
      const { visibleText, cards } = stripCardMarker(buffer);
      aiBubble.innerHTML = formatAIResponse(visibleText);
      if (cards && cards.length) {
        const rail = renderCardRail(cards);
        if (rail) aiBubble.appendChild(rail);
      }
      if (state.ttsEnabled && visibleText.trim()) speak(visibleText);
      highlightRoomsFromCards(cards);
    } catch (err) {
      aiBubble.remove();
      const friendly = err.message || 'Failed to reach the AI. Please try again.';
      appendMessage(friendly, 'error');
      showError(friendly);
    } finally {
      setLoading(false);
      el.chatInput.focus();
    }
  }

  /**
   * Streams a chat response via SSE POST. Falls back to /api/chat on failure.
   */
  async function streamChat(message, onChunk) {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok || !res.body) {
      // Try non-streaming fallback
      const fallback = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await fallback.json().catch(() => ({}));
      if (!fallback.ok) throw new Error(data.error || `Server error (${fallback.status})`);
      onChunk(data.reply || '');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE frames
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = frame.split('\n');
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (event === 'chunk') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) onChunk(parsed.text);
          } catch {
            // ignore
          }
        } else if (event === 'error') {
          try {
            const parsed = JSON.parse(data);
            throw new Error(parsed.error || 'Stream error');
          } catch (e) {
            throw e instanceof Error ? e : new Error('Stream error');
          }
        } else if (event === 'done') {
          return;
        }
      }
    }
  }

  // ── Rendering ───────────────────────────────────────────────────
  function appendMessage(text, sender) {
    const node = document.createElement('div');
    node.classList.add('message', 'message--' + sender);
    if (sender === 'error') {
      node.setAttribute('role', 'alert');
      node.textContent = '⚠️ ' + text;
    } else if (sender === 'ai') {
      node.innerHTML = formatAIResponse(text || '');
    } else {
      node.textContent = text;
    }
    el.chatTranscript.appendChild(node);
    scrollToBottom();
    return node;
  }

  function formatAIResponse(text) {
    let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/^\s*[-*]\s+(.+)$/gm, '• $1');
    safe = safe.replace(/\n/g, '<br/>');
    return safe;
  }

  /**
   * Extracts a <CARDS>{...}</CARDS> marker from an AI response.
   */
  function stripCardMarker(text) {
    const re = /<CARDS>(.*?)<\/CARDS>\s*$/s;
    const match = text.match(re);
    if (!match) return { visibleText: text, cards: [] };
    const visibleText = text.replace(re, '').trim();
    try {
      const parsed = JSON.parse(match[1]);
      return { visibleText, cards: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
      return { visibleText, cards: [] };
    }
  }

  function renderCardRail(cards) {
    if (!state.event || !cards.length) return null;
    const rail = document.createElement('div');
    rail.className = 'card-rail';
    let made = 0;
    cards.forEach((c) => {
      const card = buildRichCard(c);
      if (card) {
        rail.appendChild(card);
        made += 1;
      }
    });
    return made ? rail : null;
  }

  function buildRichCard(item) {
    const node = document.createElement('div');
    node.className = 'rich-card';
    if (item.type === 'session' && item.id) {
      const s = state.event.sessions.find((x) => x.id === item.id);
      if (!s) return null;
      node.innerHTML = `
        <div class="rc-type">Session · ${escapeHTML(s.track)}</div>
        <div class="rc-title">${escapeHTML(s.title)}</div>
        <div class="rc-meta">${escapeHTML(s.time)} · ${escapeHTML(s.room)} (Floor ${s.floor})</div>
        <div class="rc-meta">${escapeHTML(s.speaker)}</div>
        <div class="rc-actions">
          <button class="rc-btn is-primary" data-action="save" data-id="${s.id}">${state.savedSessions.includes(s.id) ? '★ Saved' : '☆ Save'}</button>
          <button class="rc-btn" data-action="locate" data-floor="${s.map.floor}" data-label="${escapeHTML(s.map.label)}">Show on map</button>
        </div>`;
    } else if (item.type === 'booth' && item.id) {
      const b = state.event.booths.find((x) => x.id === item.id);
      if (!b) return null;
      node.innerHTML = `
        <div class="rc-type">Booth · ${escapeHTML(b.category)}</div>
        <div class="rc-title">${escapeHTML(b.name)}</div>
        <div class="rc-meta">${escapeHTML(b.location)}</div>
        <div class="rc-meta">${escapeHTML(b.perks || '')}</div>
        <div class="rc-actions">
          <button class="rc-btn" data-action="locate" data-floor="${b.map.floor}" data-label="${escapeHTML(b.map.label)}">Show on map</button>
        </div>`;
    } else if (item.type === 'room' && item.label) {
      node.innerHTML = `
        <div class="rc-type">Location</div>
        <div class="rc-title">${escapeHTML(item.label)}</div>
        <div class="rc-meta">Floor ${item.floor ?? '—'}</div>
        <div class="rc-actions">
          <button class="rc-btn" data-action="locate" data-floor="${item.floor}" data-label="${escapeHTML(item.label)}">Show on map</button>
        </div>`;
    } else {
      return null;
    }

    node.addEventListener('click', (e) => {
      const btn = e.target.closest('.rc-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'save') {
        toggleSaved(btn.dataset.id);
        btn.textContent = state.savedSessions.includes(btn.dataset.id) ? '★ Saved' : '☆ Save';
      } else if (action === 'locate') {
        const floor = Number(btn.dataset.floor);
        const label = btn.dataset.label;
        switchTab('map');
        switchFloor(floor);
        highlightRoom(label);
      }
    });
    return node;
  }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  // ── Loading / errors ────────────────────────────────────────────
  function setLoading(loading) {
    state.isLoading = loading;
    el.sendBtn.disabled = loading;
    el.chatInput.disabled = loading;
    el.imageBtn.disabled = loading;
    el.micBtn.disabled = loading;
    el.chatTranscript.setAttribute('aria-busy', String(loading));
    $$('.chip[data-query]').forEach((c) => { c.disabled = loading; });
  }
  function showError(msg) {
    el.errorBanner.textContent = msg;
    el.errorBanner.classList.remove('hidden');
    setTimeout(hideError, 8000);
  }
  function hideError() {
    el.errorBanner.classList.add('hidden');
    el.errorBanner.textContent = '';
  }
  function scrollToBottom() {
    requestAnimationFrame(() => {
      el.chatTranscript.scrollTop = el.chatTranscript.scrollHeight;
    });
  }

  // ── Voice input (Web Speech API) ────────────────────────────────
  function wireMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      el.micBtn.hidden = true;
      return;
    }
    let rec;
    let transcript = '';
    const start = () => {
      if (state.isLoading) return;
      transcript = '';
      rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev) => {
        let s = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) s += ev.results[i][0].transcript;
        transcript = s;
        el.chatInput.value = s;
        autoResize();
      };
      rec.onend = () => {
        el.micBtn.classList.remove('is-recording');
        if (transcript.trim()) {
          el.chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      };
      rec.onerror = () => {
        el.micBtn.classList.remove('is-recording');
      };
      el.micBtn.classList.add('is-recording');
      rec.start();
    };
    const stop = () => {
      try { rec && rec.stop(); } catch { /* noop */ }
    };
    el.micBtn.addEventListener('pointerdown', start);
    el.micBtn.addEventListener('pointerup', stop);
    el.micBtn.addEventListener('pointerleave', stop);
    el.micBtn.addEventListener('pointercancel', stop);
  }

  // ── Text-to-speech ──────────────────────────────────────────────
  function wireTTS() {
    if (!('speechSynthesis' in window)) {
      el.ttsBtn.hidden = true;
      return;
    }
    el.ttsBtn.addEventListener('click', () => {
      state.ttsEnabled = !state.ttsEnabled;
      el.ttsBtn.setAttribute('aria-pressed', String(state.ttsEnabled));
      if (!state.ttsEnabled) speechSynthesis.cancel();
    });
  }
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').slice(0, 400));
      utter.rate = 1.02;
      utter.pitch = 1.0;
      speechSynthesis.speak(utter);
    } catch { /* ignored */ }
  }

  // ── Image upload → Gemini Vision ────────────────────────────────
  function wireImage() {
    el.imageBtn.addEventListener('click', () => el.imageInput.click());
    el.imageInput.addEventListener('change', async () => {
      const file = el.imageInput.files?.[0];
      el.imageInput.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showError('Image is too large — please pick something under 5 MB.');
        return;
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const userNode = appendMessage('Analysing this photo…', 'user');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Uploaded photo';
      img.className = 'user-photo';
      userNode.prepend(img);

      setLoading(true);
      const aiBubble = appendMessage('', 'ai');
      const caret = document.createElement('span');
      caret.className = 'caret';
      aiBubble.appendChild(caret);
      try {
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, prompt: el.chatInput.value || '' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Vision failed');
        const { visibleText, cards } = stripCardMarker(data.reply || '');
        aiBubble.innerHTML = formatAIResponse(visibleText);
        if (cards.length) {
          const rail = renderCardRail(cards);
          if (rail) aiBubble.appendChild(rail);
        }
        if (state.ttsEnabled && visibleText.trim()) speak(visibleText);
        highlightRoomsFromCards(cards);
      } catch (err) {
        aiBubble.remove();
        const msg = err.message || 'Vision failed.';
        appendMessage(msg, 'error');
        showError(msg);
      } finally {
        setLoading(false);
      }
    });
  }

  // ── Floor map ───────────────────────────────────────────────────
  function wireFloorSwitch() {
    el.floorBtns.forEach((btn) => {
      btn.addEventListener('click', () => switchFloor(Number(btn.dataset.floor)));
    });
  }
  function switchTab(tab) {
    if (state.activeTab === tab) return;
    const target = Array.from(el.tabs).find((t) => t.dataset.tab === tab);
    target && target.click();
  }
  function switchFloor(floor) {
    state.currentFloor = floor;
    el.floorBtns.forEach((b) => {
      const active = Number(b.dataset.floor) === floor;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    renderMap(floor);
  }

  function renderMap(floor) {
    if (!state.event) return;
    const { width, height } = state.event.venue.mapBox;

    const allItems = [
      ...state.event.sessions.map((s) => ({ kind: 'session', ...s, ...s.map, meta: `${s.time} · ${s.track}` })),
      ...state.event.booths.map((b) => ({ kind: 'booth', ...b, ...b.map, meta: `${b.category} · ${b.location}` })),
      ...state.event.quietZones.map((q) => ({ kind: 'quiet', ...q, ...q.map, meta: q.amenities })),
    ].filter((it) => it.floor === floor);

    // Build SVG
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Floor ${floor} map">
      <rect class="map-floor-outline" x="20" y="20" width="${width - 40}" height="${height - 40}" rx="24"/>`;

    // Grid lines for visual texture
    for (let x = 100; x < width; x += 100) {
      svg += `<line x1="${x}" y1="20" x2="${x}" y2="${height - 20}" stroke="rgba(255,255,255,.03)" stroke-width="1"/>`;
    }
    for (let y = 100; y < height; y += 100) {
      svg += `<line x1="20" y1="${y}" x2="${width - 20}" y2="${y}" stroke="rgba(255,255,255,.03)" stroke-width="1"/>`;
    }

    // Rooms / pins
    allItems.forEach((it) => {
      const rx = 22;
      const w = it.kind === 'session' ? 180 : 100;
      const h = 70;
      const labelLine1 = it.label || it.name || '';
      svg += `<g class="map-item" data-label="${escapeAttr(labelLine1)}">
        <rect class="map-room" data-label="${escapeAttr(labelLine1)}" x="${it.x - w / 2}" y="${it.y - h / 2}" width="${w}" height="${h}" rx="${rx}"/>
        <text class="map-label" x="${it.x}" y="${it.y - 4}" text-anchor="middle">${escapeHTML(labelLine1)}</text>
        <text class="map-label-sub" x="${it.x}" y="${it.y + 14}" text-anchor="middle">${escapeHTML(truncate(it.meta || '', 36))}</text>
      </g>`;
    });

    svg += '</svg>';
    el.mapSurface.innerHTML = svg;

    el.mapSurface.querySelectorAll('.map-room').forEach((rect) => {
      rect.addEventListener('click', () => {
        const label = rect.dataset.label;
        const item = allItems.find((x) => (x.label || x.name) === label);
        showMapDetail(item);
        el.mapSurface.querySelectorAll('.map-room').forEach((r) => r.classList.remove('is-highlight'));
        rect.classList.add('is-highlight');
      });
    });

    el.mapDetail.textContent = `Floor ${floor} · ${allItems.length} locations. Tap any pin for details.`;
    el.mapDetail.classList.remove('is-active');
  }

  function showMapDetail(item) {
    if (!item) return;
    const title = item.label || item.name || 'Location';
    const extra = item.meta || item.description || '';
    el.mapDetail.innerHTML = `<strong>${escapeHTML(title)}</strong> — ${escapeHTML(extra)}`;
    el.mapDetail.classList.add('is-active');
  }

  function highlightRoom(label) {
    if (!label) return;
    requestAnimationFrame(() => {
      const rect = el.mapSurface.querySelector(`.map-room[data-label="${cssEscape(label)}"]`);
      if (!rect) return;
      el.mapSurface.querySelectorAll('.map-room').forEach((r) => r.classList.remove('is-highlight'));
      rect.classList.add('is-highlight');
      rect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function highlightRoomsFromCards(cards) {
    if (!cards || !cards.length || !state.event) return;
    // Pick first referenced location and switch to its floor quietly
    for (const c of cards) {
      let floor, label;
      if (c.type === 'session') {
        const s = state.event.sessions.find((x) => x.id === c.id);
        if (s) { floor = s.map.floor; label = s.map.label; }
      } else if (c.type === 'booth') {
        const b = state.event.booths.find((x) => x.id === c.id);
        if (b) { floor = b.map.floor; label = b.map.label; }
      } else if (c.type === 'room') {
        floor = c.floor; label = c.label;
      }
      if (floor && label) {
        // Pre-render the floor so highlight works when user opens Map tab
        if (state.currentFloor !== floor) {
          state.currentFloor = floor;
          el.floorBtns.forEach((b) => {
            const active = Number(b.dataset.floor) === floor;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', String(active));
          });
          renderMap(floor);
        }
        highlightRoom(label);
        break;
      }
    }
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function cssEscape(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

  // ── Agenda ──────────────────────────────────────────────────────
  function wireAgenda() {
    el.agendaRecommend.addEventListener('click', async () => {
      if (!state.event) return;
      el.agendaRecommend.disabled = true;
      el.agendaRecommend.textContent = 'Thinking…';
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message:
              'Recommend a balanced agenda for a first-time attendee who is curious about AI, security, and design. Call out the session IDs (e.g. S1, S3) you recommend.',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        // Parse session IDs from the response
        const ids = (data.reply.match(/\bS\d+\b/g) || []).filter((id, i, a) => a.indexOf(id) === i);
        ids.forEach((id) => {
          if (!state.savedSessions.includes(id) && state.event.sessions.some((s) => s.id === id)) {
            state.savedSessions.push(id);
          }
        });
        persistSaved();
        renderAgenda();
        switchTab('agenda');
      } catch (err) {
        showError(err.message || 'Could not build a recommended agenda.');
      } finally {
        el.agendaRecommend.disabled = false;
        el.agendaRecommend.textContent = '✨ Recommend for me';
      }
    });

    el.agendaExport.addEventListener('click', exportICS);
    el.trackFilter.addEventListener('change', renderAgenda);
  }

  function populateTrackFilter() {
    if (!state.event) return;
    const tracks = [...new Set(state.event.sessions.map((s) => s.track))].sort();
    tracks.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      el.trackFilter.appendChild(opt);
    });
  }

  function renderAgenda() {
    if (!state.event) return;
    const filter = el.trackFilter.value;
    const list = state.event.sessions
      .filter((s) => (filter ? s.track === filter : true))
      .sort((a, b) => a.time.localeCompare(b.time));
    el.sessionList.innerHTML = '';
    list.forEach((s) => {
      const saved = state.savedSessions.includes(s.id);
      const li = document.createElement('li');
      li.className = 'session-card' + (saved ? ' is-saved' : '');
      li.innerHTML = `
        <div class="session-time">${escapeHTML(s.time)}</div>
        <div>
          <div class="session-title">${escapeHTML(s.title)}</div>
          <div class="session-meta">${escapeHTML(s.speaker)}${s.speakerTitle ? ' · ' + escapeHTML(s.speakerTitle) : ''}</div>
          <div class="session-meta">${escapeHTML(s.room)} (Floor ${s.floor}) · <span class="session-tag">${escapeHTML(s.track)}</span></div>
        </div>
        <button class="session-fav" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Add to'} my agenda" data-id="${s.id}">${saved ? '★' : '☆'}</button>`;
      li.querySelector('.session-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSaved(s.id);
        renderAgenda();
      });
      li.addEventListener('click', () => {
        switchTab('map');
        switchFloor(s.map.floor);
        highlightRoom(s.map.label);
      });
      el.sessionList.appendChild(li);
    });
  }

  function toggleSaved(id) {
    const idx = state.savedSessions.indexOf(id);
    if (idx >= 0) state.savedSessions.splice(idx, 1);
    else state.savedSessions.push(id);
    persistSaved();
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem('eventai.saved');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function persistSaved() {
    try { localStorage.setItem('eventai.saved', JSON.stringify(state.savedSessions)); }
    catch { /* ignore */ }
  }

  // ── .ics export ─────────────────────────────────────────────────
  function exportICS() {
    if (!state.event) return;
    const saved = state.event.sessions.filter((s) => state.savedSessions.includes(s.id));
    if (!saved.length) {
      showError('Star at least one session to export your agenda.');
      return;
    }
    const date = state.event.date.replace(/-/g, '');
    const fmt = (t) => t.split('–')[0].replace(':', '') + '00';
    const fmtEnd = (t) => t.split('–')[1].replace(':', '') + '00';
    const uid = (s) => `${s.id}-${date}@eventai`;
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EventAI//InnovateSphere//EN', 'CALSCALE:GREGORIAN'];
    saved.forEach((s) => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid(s)}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;TZID=Asia/Kolkata:${date}T${fmt(s.time)}`);
      lines.push(`DTEND;TZID=Asia/Kolkata:${date}T${fmtEnd(s.time)}`);
      lines.push(`SUMMARY:${escapeICS(s.title)}`);
      lines.push(`LOCATION:${escapeICS(s.room + ', ' + state.event.venue.name)}`);
      lines.push(`DESCRIPTION:${escapeICS(`${s.speaker} — ${s.description || s.track}`)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'innovatesphere-agenda.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeICS(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  // ── PWA ─────────────────────────────────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { /* silent */ });
      });
    }
  }

  // ── Go ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
