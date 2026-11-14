/* ==========================================================================
   C.S.I. · Ricalcolo pensione — core del clone
   Store locale (localStorage), wizard a 3 passaggi, calendario, invito .ics.
   ========================================================================== */

(function () {
  'use strict';

  const KEY_BOOKINGS = 'csi.bookings.v1';
  const KEY_SESSION = 'csi.session.v1';
  const KEY_DRAFT = 'csi.draft.v1';
  const KEY_FLASH = 'csi.flash.v1';

  const SLOTS = ['09:00', '11:00', '14:00', '16:00'];
  const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const MAX_DAYS_AHEAD = 90;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ------------------------------ store ------------------------------ */

  const store = {
    read() {
      try { return JSON.parse(localStorage.getItem(KEY_BOOKINGS)) || []; }
      catch (e) { return []; }
    },
    write(list) {
      try { localStorage.setItem(KEY_BOOKINGS, JSON.stringify(list)); } catch (e) {}
    },
    add(booking) {
      const list = this.read();
      list.unshift(booking);
      this.write(list);
      return booking;
    },
    session() {
      try { return JSON.parse(localStorage.getItem(KEY_SESSION)); } catch (e) { return null; }
    },
    setSession(v) {
      try {
        if (v) localStorage.setItem(KEY_SESSION, JSON.stringify(v));
        else localStorage.removeItem(KEY_SESSION);
      } catch (e) {}
    },
    draft() {
      try { return JSON.parse(sessionStorage.getItem(KEY_DRAFT)) || null; } catch (e) { return null; }
    },
    setDraft(v) {
      try { sessionStorage.setItem(KEY_DRAFT, JSON.stringify(v)); } catch (e) {}
    },
    clearDraft() {
      try { sessionStorage.removeItem(KEY_DRAFT); } catch (e) {}
    },
    flash(msg, isError) {
      try { sessionStorage.setItem(KEY_FLASH, JSON.stringify({ msg: msg, error: !!isError })); } catch (e) {}
    }
  };

  /* ------------------------------ helpers ------------------------------ */

  function pad(n) { return String(n).padStart(2, '0'); }

  function isoDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function itDate(iso) {
    if (!iso) return '';
    const parts = String(iso).slice(0, 10).split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(d, n) {
    const c = new Date(d.getTime());
    c.setDate(c.getDate() + n);
    return c;
  }

  function isSunday(d) { return d.getDay() === 0; }

  function toast(message, isError) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-visible'), 4200);
  }

  function flushFlash() {
    let raw = null;
    try { raw = sessionStorage.getItem(KEY_FLASH); } catch (e) {}
    if (!raw) return;
    try { sessionStorage.removeItem(KEY_FLASH); } catch (e) {}
    try {
      const f = JSON.parse(raw);
      if (f && f.msg) setTimeout(() => toast(f.msg, f.error), 120);
    } catch (e) {}
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Blocco di sicurezza: nessun link WhatsApp può essere aperto dall'app.
  document.addEventListener('click', function (e) {
    const a = e.target.closest ? e.target.closest('a[href*="wa.me"], a[href*="whatsapp"], a[href^="whatsapp:"]') : null;
    if (!a) return;
    e.preventDefault();
    alert('Invio WhatsApp disattivato su questa applicazione.');
  }, true);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* --------------------------- hero fallback --------------------------- */

  const hero = $('#hero-img');
  if (hero) {
    const frame = $('#hero-frame');
    // Copia locale: l'immagine è servita da assets/img, nessun CDN esterno.
    const chain = [];
    let next = 0;

    hero.addEventListener('load', function () {
      if (frame) frame.classList.remove('is-failed');
    });
    hero.addEventListener('error', function () {
      if (next < chain.length) { hero.src = chain[next++]; return; }
      if (frame) frame.classList.add('is-failed');
    });

    // immagine già fallita prima del binding
    if (hero.complete && hero.naturalWidth === 0) {
      if (next < chain.length) hero.src = chain[next++];
      else if (frame) frame.classList.add('is-failed');
    }
  }

  /* --------------------------- immagini di marca --------------------------- */

  $$('.brand-mark').forEach(function (img) {
    const fail = function () {
      const tile = img.closest('.logo-tile');
      if (tile) tile.classList.add('is-missing');
    };
    img.addEventListener('error', function () {
      const alt = img.getAttribute('data-alt-src');
      if (alt && !img.dataset.triedAlt) {
        img.dataset.triedAlt = '1';
        img.src = alt;
        return;
      }
      fail();
    });
    if (img.complete && img.naturalWidth === 0) {
      const alt = img.getAttribute('data-alt-src');
      if (alt && !img.dataset.triedAlt) { img.dataset.triedAlt = '1'; img.src = alt; }
      else fail();
    }
  });

  const spidBanner = $('.spid-banner');
  if (spidBanner) {
    const swapBanner = function () {
      const figure = spidBanner.closest('.spid-cover');
      if (figure) figure.classList.add('is-hidden');
      else spidBanner.classList.add('is-hidden');
      const fb = $('#spid-banner-fallback');
      if (fb) fb.classList.remove('is-hidden');
    };
    spidBanner.addEventListener('error', function () {
      const alt = spidBanner.getAttribute('data-alt-src');
      if (alt && !spidBanner.dataset.triedAlt) {
        spidBanner.dataset.triedAlt = '1';
        spidBanner.src = alt;
        return;
      }
      swapBanner();
    });
    if (spidBanner.complete && spidBanner.naturalWidth === 0) {
      const alt = spidBanner.getAttribute('data-alt-src');
      if (alt && !spidBanner.dataset.triedAlt) { spidBanner.dataset.triedAlt = '1'; spidBanner.src = alt; }
      else swapBanner();
    }
  }

  /* ============================== WIZARD ============================== */

  const form = $('#wizard');

  if (form) {
    const state = {
      step: 1,
      spid: null,
      date: null,
      time: null,
      reminder: 'email',
      viewMonth: today(),
      files: { cf_fronte: null, cf_retro: null, ci_fronte: null, ci_retro: null }
    };

    const panels = {
      1: $('.step-panel[data-step="1"]'),
      2: $('.step-panel[data-step="2"]'),
      3: $('.step-panel[data-step="3"]')
    };

    const inputs = {
      nome: $('#nome'),
      birthDate: $('#birthDate'),
      birthPlace: $('#birthPlace'),
      cf: $('#cf'),
      doc: $('#doc'),
      docDate: $('#docDate'),
      email: $('#email'),
      tel: $('#tel')
    };

    const next1 = $('#next-1');
    const stepperItems = $$('#stepper .s-item');

    // Invio nei campi non deve ricaricare la pagina
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    /* --- data / ora --- */

    const now = today();
    inputs.docDate.min = isoDate(addDays(now, 1));
    inputs.docDate.max = isoDate(addDays(now, 365 * 12));

    /* --- ripristino bozza --- */

    const draft = store.draft();
    if (draft) {
      Object.keys(inputs).forEach(function (k) {
        if (draft[k]) inputs[k].value = draft[k];
      });
      state.spid = draft.spid || null;
      if (draft.date) state.date = draft.date;
      if (draft.time) state.time = draft.time;
      if (state.spid) selectSpid(state.spid, true);
    }

    /* --- validazione passo 1 --- */

    function cfValid(v) { return /^[A-Z0-9]{16}$/i.test(v.trim()); }
    function emailValid(v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); }
    function telValid(v) { return v.replace(/[^\d]/g, '').length >= 6; }
    function dateValid(v) {
      if (!v) return false;
      const d = new Date(v + 'T00:00:00');
      return !isNaN(d.getTime()) && d > today();
    }

    function birthValid(v) {
      if (!v) return false;
      const d = new Date(v + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      return d < today() && d.getFullYear() > 1900;
    }

    function step1Valid() {
      return inputs.nome.value.trim().length >= 3 &&
        birthValid(inputs.birthDate.value) &&
        inputs.birthPlace.value.trim().length >= 2 &&
        cfValid(inputs.cf.value) &&
        inputs.doc.value.trim().length >= 4 &&
        dateValid(inputs.docDate.value) &&
        emailValid(inputs.email.value) &&
        telValid(inputs.tel.value);
    }

    function refreshStep1() {
      const ok = step1Valid();
      next1.disabled = !ok;
      inputs.cf.setAttribute('aria-invalid', String(inputs.cf.value.length > 0 && !cfValid(inputs.cf.value)));
      inputs.email.setAttribute('aria-invalid', String(inputs.email.value.length > 0 && !emailValid(inputs.email.value)));
      inputs.docDate.setAttribute('aria-invalid', String(inputs.docDate.value.length > 0 && !dateValid(inputs.docDate.value)));
      return ok;
    }

    inputs.cf.addEventListener('input', function () {
      const pos = inputs.cf.selectionStart;
      inputs.cf.value = inputs.cf.value.toUpperCase();
      inputs.cf.setSelectionRange(pos, pos);
      refreshStep1();
    });

    Object.keys(inputs).forEach(function (k) {
      inputs[k].addEventListener('input', refreshStep1);
      inputs[k].addEventListener('change', refreshStep1);
    });

    // Quattro allegati: fronte e retro per codice fiscale e carta d'identità.
    [['fileCfFronte', 'cf_fronte'], ['fileCfRetro', 'cf_retro'],
     ['fileCiFronte', 'ci_fronte'], ['fileCiRetro', 'ci_retro']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      el.addEventListener('change', function (e) {
        state.files[pair[1]] = e.target.files[0] ? e.target.files[0].name : null;
      });
    });

    function saveDraft() {
      store.setDraft({
        nome: inputs.nome.value,
        birthDate: inputs.birthDate.value,
        birthPlace: inputs.birthPlace.value,
        cf: inputs.cf.value,
        doc: inputs.doc.value,
        docDate: inputs.docDate.value,
        email: inputs.email.value,
        tel: inputs.tel.value,
        spid: state.spid,
        date: state.date,
        time: state.time
      });
    }

    /* --- navigazione --- */

    function goto(step) {
      state.step = step;
      [1, 2, 3].forEach(function (n) {
        panels[n].classList.toggle('is-hidden', n !== step);
      });
      stepperItems.forEach(function (el) {
        const n = Number(el.getAttribute('data-step-label'));
        el.classList.toggle('is-active', n === step);
        el.classList.toggle('is-done', n < step);
      });
      if (step === 1) next1.disabled = !step1Valid();
      if (step === 2) { renderSpid(); renderMandato(); }
      if (step === 3) {
        renderCalendar();
        renderSlots();
        renderSummary();
        ensureAvailability().then(function () {
          renderCalendar();
          renderSlots();
          renderSummary();
        });
      }
      saveDraft();
      scrollTop();
    }

    next1.addEventListener('click', function () {
      if (!refreshStep1()) return;
      goto(2);
    });

    /* --- passo 2: SPID --- */

    const opts = $$('.opt[data-spid]');
    const spidPanel = $('#spid-panel');

    function selectSpid(value, silent) {
      state.spid = value;
      opts.forEach(function (o) {
        const on = o.getAttribute('data-spid') === value;
        o.classList.toggle('is-selected', on);
        o.setAttribute('aria-checked', String(on));
      });
      spidPanel.classList.toggle('is-hidden', value !== 'assist');
      if (!silent) saveDraft();
    }

    function renderSpid() {
      opts.forEach(function (o) {
        const on = o.getAttribute('data-spid') === state.spid;
        o.classList.toggle('is-selected', on);
        o.setAttribute('aria-checked', String(on));
      });
      spidPanel.classList.toggle('is-hidden', state.spid !== 'assist');
    }

    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        selectSpid(o.getAttribute('data-spid'));
        o.focus();
      });
    });

    function mirrorFields() {
      $$('[data-bind]').forEach(function (target) {
        const source = document.getElementById(target.getAttribute('data-bind'));
        target.value = source ? source.value : '';
      });
    }

    /* --- firma del mandato con OTP --- */

    const sign = { status: 'idle', email: null, at: null, ref: null, devCode: null };

    function maskEmail(value) {
      const parts = String(value || '').split('@');
      if (parts.length !== 2 || !parts[0]) return '—';
      const name = parts[0];
      const head = name.slice(0, Math.min(2, name.length));
      return head + '•'.repeat(Math.max(2, name.length - head.length)) + '@' + parts[1];
    }

    function signDateLabel(at) {
      const d = at ? new Date(at) : new Date();
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }

    function syncFirma() {
      const nome = inputs.nome.value.trim();
      const signed = sign.status === 'signed';
      const stamp = signed ? signDateLabel(sign.at) : null;

      ['firma-nome-echo', 'firma-echo'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = nome || '—';
      });

      const riga = signed
        ? 'Firmato con codice OTP il ' + stamp + ' · ' + maskEmail(sign.email) + ' · rif. ' + (sign.ref || '—')
        : (sign.status === 'sent'
          ? 'Codice inviato a ' + maskEmail(sign.email) + ': in attesa di conferma.'
          : 'In attesa della firma con codice OTP.');

      ['firma-otp', 'firma-otp-privacy'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = riga;
      });

      const emailEl = document.getElementById('sign-email');
      if (emailEl) emailEl.textContent = inputs.email.value.trim() ? maskEmail(inputs.email.value.trim()) : '—';

      const badge = document.getElementById('sign-badge');
      if (badge) {
        badge.textContent = signed ? 'Firmato' : (sign.status === 'sent' ? 'Codice inviato' : 'Da firmare');
        badge.classList.toggle('is-signed', signed);
      }

      const status = document.getElementById('sign-status');
      if (status) {
        status.textContent = signed
          ? 'Mandato firmato il ' + stamp + '.'
          : (sign.devCode ? 'Codice per questa sessione: ' + sign.devCode : '');
      }

      const row = document.getElementById('sign-verify-row');
      if (row) row.hidden = signed || sign.status !== 'sent';

      const send = document.getElementById('sign-send');
      if (send) {
        send.disabled = signed;
        send.textContent = sign.status === 'sent' ? 'Invia un nuovo codice' : 'Invia codice di firma';
      }

      const card = document.getElementById('sign-card');
      if (card) card.classList.toggle('is-signed', signed);
    }

    async function sendSignatureCode() {
      const email = inputs.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
        toast('Serve un indirizzo email valido per ricevere il codice di firma.', true);
        inputs.email.focus();
        return;
      }

      const btn = document.getElementById('sign-send');
      if (btn) btn.disabled = true;
      sign.devCode = null;

      try {
        const r = await fetch('api/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', purpose: 'mandato', email: email, nome: inputs.nome.value.trim() })
        });
        const data = await r.json().catch(function () { return {}; });
        if (!r.ok || !data.ok) {
          throw new Error(data.error === 'rate_limited'
            ? 'troppi invii, riprova tra qualche minuto'
            : (data.error || ('HTTP ' + r.status)));
        }

        sign.status = 'sent';
        sign.email = email;
        sign.devCode = data.dev_code || null;
        syncFirma();
        toast('Codice di firma inviato a ' + maskEmail(email) + '.');
        document.dispatchEvent(new CustomEvent('csi:signature', { detail: { status: 'sent' } }));

        const code = document.getElementById('sign-code');
        if (code) code.focus();
      } catch (err) {
        toast('Invio del codice non riuscito: ' + err.message, true);
        document.dispatchEvent(new CustomEvent('csi:signature', { detail: { status: 'error' } }));
      } finally {
        if (btn) btn.disabled = false;
        syncFirma();
      }
    }

    async function verifySignatureCode() {
      const codeEl = document.getElementById('sign-code');
      const code = ((codeEl && codeEl.value) || '').replace(/\D/g, '');
      if (code.length !== 6) {
        toast('Il codice ha 6 cifre.', true);
        if (codeEl) codeEl.focus();
        return;
      }

      const btn = document.getElementById('sign-confirm');
      if (btn) btn.disabled = true;

      try {
        const r = await fetch('api/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            purpose: 'mandato',
            email: sign.email || inputs.email.value.trim(),
            code: code
          })
        });
        const data = await r.json().catch(function () { return {}; });
        if (!r.ok || !data.ok) throw new Error(data.error || 'code_not_valid');

        sign.status = 'signed';
        sign.at = data.at || new Date().toISOString();
        sign.ref = data.ref || null;
        sign.devCode = null;
        if (codeEl) codeEl.value = '';
        syncFirma();
        toast('Mandato firmato.');
        document.dispatchEvent(new CustomEvent('csi:signature', { detail: { status: 'signed' } }));

        // A fine compilazione mostriamo subito i documenti firmati.
        setTimeout(function () { openPreview('mandato'); }, 350);
      } catch (err) {
        const reason = err.message;
        const text = reason === 'code_expired'
          ? 'Codice scaduto: richiedine uno nuovo.'
          : (reason === 'too_many_attempts' ? 'Troppi tentativi: richiedi un nuovo codice.' : 'Codice non valido.');
        toast(text, true);
        document.dispatchEvent(new CustomEvent('csi:signature', { detail: { status: 'wrong', reason: reason } }));
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    const signSend = document.getElementById('sign-send');
    if (signSend) signSend.addEventListener('click', sendSignatureCode);

    const signConfirm = document.getElementById('sign-confirm');
    if (signConfirm) signConfirm.addEventListener('click', verifySignatureCode);

    const signCode = document.getElementById('sign-code');
    if (signCode) {
      signCode.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); verifySignatureCode(); }
      });
    }

    inputs.email.addEventListener('input', syncFirma);

    function renderMandato() {
      const map = {
        nome: inputs.nome.value.trim(),
        cf: inputs.cf.value.trim().toUpperCase(),
        doc: inputs.doc.value.trim().toUpperCase(),
        email: inputs.email.value.trim(),
        tel: inputs.tel.value.trim()
      };
      Object.keys(map).forEach(function (key) {
        $$('[data-fill="' + key + '"]').forEach(function (el) { el.textContent = map[key] || '—'; });
        $$('[data-fill-input="' + key + '"]').forEach(function (el) { el.value = map[key] || ''; });
      });

      // Luogo e data di nascita arrivano dal passo 1: i documenti si compilano da soli.
      const luogo = document.getElementById('luogoNascita');
      if (luogo) {
        luogo.value = inputs.birthPlace.value.trim();
        luogo.readOnly = true;
        luogo.setAttribute('aria-readonly', 'true');
      }
      const nascita = document.getElementById('dataNascita');
      if (nascita) {
        nascita.value = inputs.birthDate.value;
        nascita.readOnly = true;
        nascita.setAttribute('aria-readonly', 'true');
      }

      mirrorFields();

      const label = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      const dateEl = $('#sign-date');
      if (dateEl) dateEl.textContent = label;
      $$('.sign-date-mirror').forEach(function (el) { el.textContent = label; });

      syncFirma();
    }

    ['luogoNascita', 'dataNascita', 'indirizzo', 'residenza', 'cap', 'cittadinanza'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', mirrorFields);
        el.addEventListener('change', mirrorFields);
      }
    });

    const editAnagrafica = $('#edit-anagrafica');
    if (editAnagrafica) {
      editAnagrafica.addEventListener('click', function () { goto(1); });
    }

    $('#back-2').addEventListener('click', function () { goto(1); });

    $('#next-2').addEventListener('click', function () {
      const consensi = [
        ['m1p1', 'il consenso obbligatorio del mandato'],
        ['m2c1', 'il consenso al trattamento dei dati'],
        ['m2c3', "l'autorizzazione alla comunicazione agli enti"],
        ['m2p1', 'il consenso al trattamento dei dati sensibili']
      ];
      for (let i = 0; i < consensi.length; i++) {
        const picked = document.querySelector('input[name="' + consensi[i][0] + '"]:checked');
        if (!picked || picked.value !== 'si') {
          toast('Per proseguire devi esprimere ' + consensi[i][1] + '.', true);
          const first = document.querySelector('input[name="' + consensi[i][0] + '"]');
          if (first) first.focus();
          return;
        }
      }
      if (sign.status !== 'signed') {
        toast('Firma il mandato con il codice ricevuto via email.', true);
        const b = document.getElementById('sign-send');
        if (b) b.focus();
        return;
      }
      if (!state.spid) {
        toast('Indica se hai già lo SPID: la scelta è obbligatoria.', true);
        opts[0].focus();
        return;
      }
      goto(3);
    });

    /* --- passo 3: calendario --- */

    const grid = $('#cal-grid');
    const calTitle = $('#cal-title');
    const prevBtn = $('#cal-prev');
    const nextBtn = $('#cal-next');

    // Disponibilità reale dal CRM (fasce da 30', chiusure, slot già prenotati).
    let availability = null;
    let availabilityKey = null;

    function monthKeyOf(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    async function ensureAvailability() {
      const key = monthKeyOf(state.viewMonth);
      if (availabilityKey === key) return;
      try {
        const r = await fetch('api/slots?month=' + key);
        const data = await r.json();
        if (r.ok && data.days) {
          availability = data.days;
          availabilityKey = key;
        }
      } catch (e) { /* resta il fallback statico */ }
    }

    function isSelectable(d) {
      const t = today();
      const limit = addDays(t, MAX_DAYS_AHEAD);
      if (d < t) return false;
      if (d > limit) return false;
      if (isSunday(d)) return false;

      const key = monthKeyOf(d);
      if (availability && availabilityKey === key) {
        const info = availability[isoDate(d)];
        if (!info || info.closed) return false;
        return info.free > 0;
      }

      if (isoDate(d) === isoDate(t)) {
        return SLOTS.some(function (time) { return slotAvailable(isoDate(d), time); });
      }
      return true;
    }

    function firstAvailable() {
      let d = today();
      for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
        if (isSelectable(d)) return d;
        d = addDays(d, 1);
      }
      return today();
    }

    function renderCalendar() {
      grid.innerHTML = '';
      calTitle.textContent = state.viewMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

      WEEKDAYS.forEach(function (w) {
        const el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = w;
        el.setAttribute('role', 'columnheader');
        grid.appendChild(el);
      });

      const year = state.viewMonth.getFullYear();
      const month = state.viewMonth.getMonth();
      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7; // lunedì = 0
      const total = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < offset; i++) {
        const filler = document.createElement('div');
        filler.className = 'day is-empty';
        grid.appendChild(filler);
      }

      const t = today();

      for (let day = 1; day <= total; day++) {
        const date = new Date(year, month, day);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day';
        btn.textContent = String(day);
        btn.setAttribute('role', 'gridcell');
        btn.dataset.date = isoDate(date);

        if (isoDate(date) === isoDate(t)) btn.classList.add('is-today');

        if (!isSelectable(date)) {
          btn.disabled = true;
        } else if (state.date === isoDate(date)) {
          btn.classList.add('is-selected');
          btn.setAttribute('aria-selected', 'true');
        }

        btn.addEventListener('click', function () {
          state.date = isoDate(date);
          renderCalendar();
          renderSlots();
          renderSummary();
          saveDraft();
        });

        grid.appendChild(btn);
      }

      const thisMonth = new Date(t.getFullYear(), t.getMonth(), 1);
      prevBtn.disabled = state.viewMonth <= thisMonth;
      nextBtn.disabled = state.viewMonth >= new Date(addDays(t, MAX_DAYS_AHEAD).getFullYear(), addDays(t, MAX_DAYS_AHEAD).getMonth(), 1);
    }

    prevBtn.addEventListener('click', function () {
      state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() - 1, 1);
      renderCalendar();
      ensureAvailability().then(function () { renderCalendar(); renderSlots(); });
    });

    nextBtn.addEventListener('click', function () {
      state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + 1, 1);
      renderCalendar();
      ensureAvailability().then(function () { renderCalendar(); renderSlots(); });
    });

    /* --- orari --- */

    const slotsEl = $('#slots');

    const reminderEl = $('#reminder');
    if (reminderEl) {
      reminderEl.addEventListener('click', function (e) {
        const btn = e.target.closest ? e.target.closest('[data-reminder]') : null;
        if (!btn) return;
        state.reminder = btn.getAttribute('data-reminder');
        Array.prototype.forEach.call(reminderEl.querySelectorAll('[data-reminder]'), function (x) {
          x.classList.toggle('is-selected', x === btn);
        });
        saveDraft();
      });
    }

    function slotAvailable(dateStr, time) {
      if (!dateStr) return false;
      const nowD = new Date();
      const slotD = new Date(dateStr + 'T' + time + ':00');
      return slotD.getTime() > nowD.getTime() + 60 * 60 * 1000;
    }

    function renderSlots() {
      slotsEl.innerHTML = '';

      const key = String(state.date || '').slice(0, 7);
      const info = (availability && availabilityKey === key) ? availability[state.date] : null;

      let list;
      if (info && info.slots && info.slots.length) {
        list = info.slots.map(function (s) { return { time: s.time, ok: s.status === 'open' }; });
      } else {
        list = SLOTS.map(function (time) { return { time: time, ok: slotAvailable(state.date, time) }; });
      }

      if (!list.length) {
        const p = document.createElement('p');
        p.className = 'help';
        p.textContent = 'Nessun orario configurato per questa giornata.';
        slotsEl.appendChild(p);
        return;
      }

      if (!list.some(function (s) { return s.ok; })) {
        const p = document.createElement('p');
        p.className = 'help is-error';
        p.textContent = 'Orario non disponibile: tutte le fasce di questa data sono chiuse o già prenotate.';
        slotsEl.appendChild(p);
        return;
      }

      list.forEach(function (item) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot' + (item.ok ? '' : ' is-off');
        b.textContent = item.ok ? item.time : item.time + ' · non disponibile';
        b.dataset.time = item.time;
        b.setAttribute('role', 'radio');
        b.disabled = !item.ok;
        const selected = state.time === item.time && item.ok;
        b.classList.toggle('is-selected', selected);
        b.setAttribute('aria-checked', String(selected));
        b.addEventListener('click', function () {
          state.time = item.time;
          renderSlots();
          renderSummary();
          saveDraft();
        });
        slotsEl.appendChild(b);
      });
    }

    /* --- riepilogo --- */

    function spidLabel() {
      return state.spid === 'assist' ? 'con assistenza della struttura' : 'già attivo';
    }

    function renderSummary() {
      const box = $('#summary');
      const name = inputs.nome.value.trim();
      const cf = inputs.cf.value.trim().toUpperCase();
      const doc = inputs.doc.value.trim().toUpperCase();
      const valid = inputs.docDate.value ? itDate(inputs.docDate.value) : '—';
      const email = inputs.email.value.trim();
      const tel = inputs.tel.value.trim();
      const when = state.date
        ? itDate(state.date) + (state.time ? ' alle ' + state.time : '')
        : 'seleziona una data';

      box.innerHTML =
        '<h4>Riepilogo prenotazione</h4>' +
        '<p><strong>' + esc(name || '—') + '</strong> · ' + esc(cf || '—') + '</p>' +
        '<p>Documento <strong>' + esc(doc || '—') + '</strong>, valido fino al ' + esc(valid) + '</p>' +
        '<p>' + esc(email || '—') + ' · ' + esc(tel || '—') + '</p>' +
        '<p>SPID: <strong>' + esc(spidLabel()) + '</strong></p>' +
        '<p>Appuntamento: <strong>' + esc(when) + '</strong></p>';
    }

    $('#back-3').addEventListener('click', function () { goto(2); });

    /* --- invio --- */

    let lastBooking = null;

    $('#submit-booking').addEventListener('click', function () {
      if (!state.date) { toast('Scegli una data per l\'appuntamento.', true); return; }
      if (!state.time) { toast('Scegli un orario disponibile.', true); return; }

      const booking = {
        id: 'CSI-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000),
        createdAt: new Date().toISOString(),
        nome: inputs.nome.value.trim(),
        birthDate: inputs.birthDate.value,
        birthPlace: inputs.birthPlace.value.trim(),
        cf: inputs.cf.value.trim().toUpperCase(),
        doc: inputs.doc.value.trim().toUpperCase(),
        docDate: inputs.docDate.value,
        email: inputs.email.value.trim(),
        tel: inputs.tel.value.trim(),
        spid: state.spid,
        date: state.date,
        time: state.time,
        reminderChannel: state.reminder,
        files: state.files,
        signature: sign.status === 'signed' ? { via: 'otp', at: sign.at, ref: sign.ref, email: maskEmail(sign.email) } : null,
        status: 'In attesa di conferma'
      };

      store.add(booking);
      lastBooking = booking;
      store.clearDraft();
      store.flash('Prenotazione inviata: riceverai l\'invito calendario via email.');

      // Invio al CRM: la richiesta deve comparire subito in dashboard.
      const choice = function (name) {
        const el = document.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value : null;
      };

      const consents = {
        mandato: choice('m1p1'),
        promozione: choice('m1p2'),
        incarico: choice('m2c1'),
        comunicazioni: choice('m2c2'),
        enti: choice('m2c3'),
        sensibili: choice('m2p1'),
        promozionali: choice('m2p2')
      };

      const payload = Object.assign({}, booking, { consents: consents });

      fetch('api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; });
      }).then(function (d) {
        if (!d || !d.ok) toast('Prenotazione salvata solo in locale: ' + ((d && d.error) || 'errore del server'), true);
      }).catch(function () {
        toast('Prenotazione salvata solo in locale: server non raggiungibile.', true);
      });

      $('#wizard').classList.add('is-hidden');
      $('#stepper').classList.add('is-hidden');
      $('#receipt').classList.remove('is-hidden');

      $('#receipt-details').innerHTML = [
        ['Codice prenotazione', booking.id],
        ['Firma mandato', sign.status === 'signed' ? 'OTP · ' + signDateLabel(sign.at) : 'Da firmare'],
        ['Data e ora', itDate(booking.date) + ' · ' + booking.time],
        ['Presso', 'C.S.I. — Centro Servizi Integrati'],
        ['Intestatario', booking.nome],
        ['Codice fiscale', booking.cf],
        ['SPID', booking.spid === 'assist' ? 'Da attivare con la struttura' : 'Già attivo'],
        ['Email', booking.email],
        ['Telefono', booking.tel]
      ].map(function (r) {
        return '<div class="row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('');

      const title = $('#wizard-title');
      if (title) title.classList.add('is-hidden');
      scrollTop();
      $('#receipt-title').focus();
    });

    /* --- .ics --- */

    function buildIcs(b) {
      const start = new Date(b.date + 'T' + b.time + ':00');
      const end = new Date(start.getTime() + 45 * 60 * 1000);
      const fmt = function (d) {
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
      };
      const stamp = fmt(new Date()).slice(0, 8) + 'T' + pad(new Date().getUTCHours()) + pad(new Date().getUTCMinutes()) + '00Z';

      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//C.S.I. Centro Servizi Integrati//Ricalcolo pensione//IT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Rome',
        'X-LIC-LOCATION:Europe/Rome',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'TZNAME:CEST',
        'DTSTART:19700329T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0100',
        'TZNAME:CET',
        'DTSTART:19701025T030000',
        'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'UID:' + b.id + '@csi-ricalcolo',
        'DTSTAMP:' + stamp,
        'DTSTART;TZID=Europe/Rome:' + fmt(start),
        'DTEND;TZID=Europe/Rome:' + fmt(end),
        'SUMMARY:Ricalcolo pensione — C.S.I.',
        'LOCATION:C.S.I. — Centro Servizi Integrati',
        'DESCRIPTION:Appuntamento per la verifica della posizione pensionistica. Codice: ' + b.id + '\\nPorta con te documento d\'identità e codice fiscale.',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
    }

    $('#download-ics').addEventListener('click', function () {
      const b = lastBooking || store.read()[0];
      if (!b) { toast('Nessuna prenotazione da esportare.', true); return; }
      const blob = new Blob([buildIcs(b)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'appuntamento-csi-' + b.id + '.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    /* --- anteprima dei due moduli --- */

    function docValue(id) {
      const el = document.getElementById(id);
      return el && el.value ? el.value.trim() : '';
    }

    function docRow(label, value) {
      return '<tr><th>' + esc(label) + '</th><td>' + (value ? esc(value) : '____________________') + '</td></tr>';
    }

    function docHeader() {
      return '<div class="doc-head2"><div class="brand">C.S.I.<small>Centro Servizi Integrati</small></div>' +
        '<div class="enti"><strong>PATRONATO ACLI - Sezione Ceglie del Campo</strong><br>' +
        'Ente di Patronato e di Assistenza Sociale<br>' +
        'Piazza Vittorio Emanuele, 70129 Bari (BA)<br>latrodomicilio@libero.it</div></div>';
    }

    function attestBlock(today) {
      return '<div class="doc-attest">' +
        '<div><strong>Collaboratore volontario</strong>' +
        '<p class="doc-p">Cognome: ________________<br>Nome: ________________<br>Data / Luogo: ________________</p>' +
        '<p class="doc-ref">Firma collaboratore volontario</p></div>' +
        '<div><strong>Operatore / validazione sede</strong>' +
        '<p class="doc-p">Cognome: ________________<br>Nome: ________________<br>Data / Sede: BARI, ' + esc(today) + '</p>' +
        '<p class="doc-ref">Firma operatore</p>' +
        '<div class="stamp-box">Timbro ufficiale di sede</div></div></div>';
    }

    function vidimBlock() {
      return '<div class="doc-vidim">' +
        '<div><strong>Timbro dell\'ufficio</strong><div class="stamp-box">C.S.I. - Centro Servizi Integrati<br>Patronato ACLI - Sezione Ceglie del Campo<br>Piazza Vittorio Emanuele 70129 Bari (BA)</div></div>' +
        '<div><strong>Firma del titolare dell\'attività</strong><div class="sign-line">Giuseppe Cassano</div></div></div>';
    }

    function signatureBlock() {
      const nome = inputs.nome.value.trim() || '—';
      const line = sign.status === 'signed'
        ? 'Firmato con codice OTP il ' + signDateLabel(sign.at) + ' · ' + maskEmail(sign.email) + ' · rif. ' + (sign.ref || '—')
        : 'In attesa della firma con codice OTP.';

      return '<h4 class="doc-h">Firma dell\'assistito/a</h4>' +
        '<p class="doc-p"><strong>' + esc(nome) + '</strong><br>' + esc(line) + '</p>';
    }

    function buildMandatoDoc() {
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      return docHeader() +
        '<div class="doc-title">Mandato di assistenza e di rappresentanza</div>' +
        '<p class="doc-ref">Ai sensi e per gli effetti dell\'Art. 13 Legge 30 marzo 2001, n. 152 e D.M. 10.10.2008, n. 193</p>' +
        '<h4 class="doc-h">1. Dati anagrafici dell\'assistito/a</h4><table class="doc-rows">' +
        docRow('Cognome e Nome', inputs.nome.value) +
        docRow('Luogo di Nascita', docValue('luogoNascita')) +
        docRow('Data di Nascita', docValue('dataNascita')) +
        docRow('Sesso', 'M / F') +
        docRow('Codice Fiscale', inputs.cf.value) +
        docRow('Cittadinanza', docValue('cittadinanza')) +
        docRow('Indirizzo e Civico', docValue('indirizzo')) +
        docRow('Residenza', docValue('residenza')) +
        docRow('CAP / Prov.', docValue('cap')) +
        '</table>' +
        '<h4 class="doc-h">2. Oggetto del mandato di rappresentanza</h4>' +
        '<p class="doc-p">Il/La sottoscritto/a con il presente atto conferisce mandato a rappresentarlo/a ed assistito/a gratuitamente al Patronato ACLI sez. Ceglie del Campo, Sede di BARI, Piazza Vittorio Emanuele, 70129 (BA), presso il quale elegge domicilio ai sensi dell\'art. 47 c.c., nei confronti di:</p>' +
        '<table class="doc-rows">' +
        docRow('Istituto / Ente Erogatore', docValue('ente')) +
        docRow('Paese (se Estero)', docValue('paese')) +
        docRow('Per lo svolgimento della pratica relativa a', docValue('pratica')) +
        '</table>' +
        '<p class="doc-ref">* Il presente mandato può essere revocato esclusivamente per iscritto.</p>' +
        '<h4 class="doc-h">3. Attestazione operativa e validazione sede</h4>' + attestBlock(today) +
        '<h4 class="doc-h">4. Informativa sul trattamento dei dati personali</h4>' +
        '<ul class="doc-list">' +
        '<li><strong>Tipologia e finalità:</strong> i dati personali indispensabili per l\'espletamento dell\'incarico.</li>' +
        '<li><strong>Ambito di comunicazione:</strong> comunicazione ad enti pubblici o privati eroganti e organismi aderenti alla F.N.A.</li>' +
        '<li><strong>Titolare e responsabile:</strong> Patronato ACLI sez. Ceglie del Campo, Presidente pro-tempore Giuseppe Cassano; responsabile il Direttore della Sede Provinciale di BARI.</li>' +
        '</ul>' +
        '<p class="doc-p"><strong>Punto 1 — Consenso obbligatorio al trattamento dei dati</strong><br>Consenso al trattamento dei dati personali e sensibili per le finalità del mandato e autorizzazione all\'accesso alle banche dati degli enti eroganti ai sensi dell\'art. 116 della Legge.</p>' +
        '<p class="doc-p"><strong>Punto 2 — Consenso facoltativo per servizi e promozione</strong><br>Utilizzo dei dati, esclusi quelli sensibili, per ulteriori attività statutarie, informative e promozionali del Patronato ACLI e della F.N.A.</p>' +
        '<p class="doc-ref">N.B.: il mandato si perfeziona con data, timbro e firma dell\'operatore del Patronato.</p>' +
        signatureBlock() +
        vidimBlock();
    }

    function buildPrivacyDoc() {
      const today = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      const box = 'SI &#9744; &nbsp; NO &#9744;';
      return docHeader() +
        '<div class="doc-title">Consenso al trattamento dei dati personali e informativa privacy</div>' +
        '<p class="doc-ref">Regolamento UE 2016/679 (GDPR) e D.Lgs. 30 giugno 2003, n. 196</p>' +
        '<h4 class="doc-h">1. Dati anagrafici dell\'interessato/a</h4><table class="doc-rows">' +
        docRow('Io sottoscritto/a', inputs.nome.value) +
        docRow('Nato/a a', docValue('luogoNascita')) +
        docRow('Il', docValue('dataNascita')) +
        docRow('Sesso', 'M / F') +
        docRow('C.A.P.', docValue('cap')) +
        docRow('E residente in', docValue('residenza')) +
        docRow('All\'indirizzo', docValue('indirizzo')) +
        docRow('Codice Fiscale', inputs.cf.value) +
        docRow('Cittadinanza', docValue('cittadinanza')) +
        '</table>' +
        '<h4 class="doc-h">2. Consenso al trattamento dei dati personali</h4>' +
        '<p class="doc-p">' + box + ' — al trattamento dei dati personali e particolari ai fini dell\'espletamento dell\'incarico conferito ad ACLI sez. Ceglie del Campo.</p>' +
        '<p class="doc-p">' + box + ' — al trattamento dei dati personali e particolari ai fini di eventuali future comunicazioni riguardo prestazioni e servizi offerti.</p>' +
        '<p class="doc-p">' + box + ' — al trattamento dei dati personali e particolari per le finalità perseguite da ACLI sez. Ceglie del Campo, autorizzando la comunicazione di tali dati alla stessa ed agli Enti da questa promossi.</p>' +
        '<h4 class="doc-h">3. Attestazione operativa e validazione sede</h4>' + attestBlock(today) +
        '<h4 class="doc-h">4. Informativa e dichiarazione di consenso</h4>' +
        '<ul class="doc-list">' +
        '<li><strong>Tipologia dei dati e finalità:</strong> dati personali, eventualmente sensibili, necessari all\'espletamento del mandato.</li>' +
        '<li><strong>Ambito di comunicazione:</strong> enti o organismi pubblici e privati e organismi aderenti ad ACLI.</li>' +
        '<li><strong>Modalità:</strong> trattamento manuale e/o automatizzato, nel rispetto degli artt. 31 e seguenti della Legge.</li>' +
        '<li><strong>Necessità del conferimento:</strong> essenziale per l\'adempimento del mandato.</li>' +
        '<li><strong>Diritti:</strong> accesso, rettifica, cancellazione, limitazione, opposizione e reclamo al Garante.</li>' +
        '<li><strong>Titolare e responsabile:</strong> ACLI sez. Ceglie del Campo, Piazza Vittorio Emanuele 70129 BARI (BA); responsabile il Direttore di Sezione.</li>' +
        '</ul>' +
        '<p class="doc-ref">N.B.: il mandato si perfeziona con data, timbro e firma dell\'operatore della Sezione.</p>' +
        signatureBlock() +
        vidimBlock();
    }

    const docModal = $('#doc-modal');
    const printArea = $('#print-area');

    let activeDoc = 'mandato';

    function docHtml(kind) { return kind === 'privacy' ? buildPrivacyDoc() : buildMandatoDoc(); }
    function docTitle(kind) {
      return kind === 'privacy' ? 'Informativa e consenso privacy' : 'Mandato di assistenza e rappresentanza';
    }

    function renderDoc() {
      $('#doc-preview').innerHTML = docHtml(activeDoc);
      $('#doc-modal-title').textContent = docTitle(activeDoc);
      $$('[data-doc-tab]').forEach(function (b) {
        const on = b.getAttribute('data-doc-tab') === activeDoc;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function openPreview(kind) {
      if (!docModal) return;
      activeDoc = kind === 'privacy' ? 'privacy' : 'mandato';
      renderDoc();
      docModal.hidden = false;
    }

    async function sendDocsByEmail() {
      const to = ($('#doc-email-to').value || '').trim();
      const status = $('#doc-email-status');
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) {
        status.textContent = 'Inserisci un indirizzo email valido.';
        return;
      }

      const btn = $('#doc-email-send');
      btn.disabled = true;
      status.textContent = 'Invio in corso…';

      try {
        const r = await fetch('api/send-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: to,
            nome: inputs.nome.value.trim(),
            kind: activeDoc,
            title: docTitle(activeDoc),
            html: docHtml(activeDoc)
          })
        });
        const data = await r.json().catch(function () { return {}; });
        if (!r.ok || !data.ok) throw new Error(data.error || ('HTTP ' + r.status));

        status.textContent = data.demo
          ? 'Invio simulato (demo locale): nessuna email spedita.'
          : 'Documento inviato a ' + to + '.';
      } catch (err) {
        status.textContent = 'Invio non riuscito: ' + err.message;
      } finally {
        btn.disabled = false;
      }
    }

    if (docModal) {
      $('#doc-close').addEventListener('click', function () { docModal.hidden = true; });
      docModal.addEventListener('click', function (e) { if (e.target === docModal) docModal.hidden = true; });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !docModal.hidden) docModal.hidden = true;
      });
      $('#doc-print').addEventListener('click', function () {
        if (!printArea) { window.print(); return; }
        printArea.innerHTML = '<div class="print-doc">' + $('#doc-preview').innerHTML + '</div>';
        window.print();
      });

      $$('[data-doc-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          activeDoc = b.getAttribute('data-doc-tab') === 'privacy' ? 'privacy' : 'mandato';
          renderDoc();
        });
      });

      $('#doc-download').addEventListener('click', function () {
        if (!printArea) { window.print(); return; }
        printArea.innerHTML = '<div class="print-doc">' + docHtml(activeDoc) + '</div>';
        window.print();
      });

      const mailBox = $('#doc-mail');
      $('#doc-email').addEventListener('click', function () {
        mailBox.hidden = !mailBox.hidden;
        if (!mailBox.hidden) {
          const to = $('#doc-email-to');
          if (!to.value) to.value = inputs.email.value.trim();
          to.focus();
        }
      });

      $('#doc-email-send').addEventListener('click', sendDocsByEmail);
    }

    // Apertura dell'anteprima: dai due pulsanti oppure cliccando l'intestazione del modulo.
    document.addEventListener('click', function (e) {
      if (!docModal) return;
      const btn = e.target.closest ? e.target.closest('#prev-mandato, #prev-privacy') : null;
      if (btn) {
        openPreview(btn.id === 'prev-privacy' ? 'privacy' : 'mandato');
        return;
      }

      const head = e.target.closest ? e.target.closest('.form-doc[data-doc] .fd-head') : null;
      if (head) {
        const card = head.closest('.form-doc');
        openPreview(card.getAttribute('data-doc'));
      }
    });

    /* --- avvio --- */

    if (!state.date) {
      const d = firstAvailable();
      state.date = isoDate(d);
      state.viewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    } else {
      const d = new Date(state.date + 'T00:00:00');
      state.viewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    if (!state.time || !slotAvailable(state.date, state.time)) {
      state.time = SLOTS.filter(function (t) { return slotAvailable(state.date, t); })[0] || null;
    }

    if (state.step === 1) {
      refreshStep1();
      if (state.spid) renderSpid();
    }
  }

  /* ============================== LOGIN ============================== */

  const loginForm = $('#login-form');

  if (loginForm) {
    const authView = $('#auth-view');
    const reservedView = $('#reserved-view');

    function showReserved(session) {
      authView.classList.add('is-hidden');
      reservedView.classList.add('is-open');

      const hasCrm = !!session.token;
      $('#reserved-hello').textContent = 'Ciao ' + (session.name || session.email) +
        (hasCrm ? ' — richieste registrate nel database.' : ' — elenco locale di questo browser.');

      const wrap = $('#crm-wrap');
      const note = $('#crm-note');
      const list = $('#booking-list');

      if (hasCrm) {
        if (wrap) wrap.classList.remove('is-hidden');
        if (list) list.innerHTML = '';
        if (note) note.textContent = '';
        loadCrm(session.token);
      } else {
        if (wrap) wrap.classList.add('is-hidden');
        if (note) note.textContent = 'Database non configurato: vengono mostrate solo le prenotazioni salvate su questo browser.';
        renderLocalBookings();
      }
    }

    function renderLocalBookings() {
      const list = $('#booking-list');
      if (!list) return;
      const bookings = store.read();
      if (!bookings.length) {
        list.innerHTML = '<p class="help">Nessuna prenotazione registrata. <a href="prenota.html" style="text-decoration:underline">Prenota un appuntamento</a>.</p>';
        return;
      }
      list.innerHTML = bookings.map(function (b) {
        return '<div class="booking-item">' +
          '<div><div class="bi-when">' + esc(itDate(b.date)) + ' · ' + esc(b.time) + '</div>' +
          '<div class="bi-who">' + esc(b.nome) + ' · ' + esc(b.cf) + ' · ' + esc(b.id) + '</div></div>' +
          '<span class="pill">' + esc(b.status || 'In attesa') + '</span>' +
          '</div>';
      }).join('');
    }

    function authHeaders(token) {
      const field = 'Authorization';
      const headers = {};
      headers[field] = 'Bearer ' + token;
      return headers;
    }

    async function loadCrm(token) {
      const body = $('#crm-body');
      const note = $('#crm-note');
      if (!body) return;
      body.innerHTML = '<tr><td colspan="5" class="crm-empty">Caricamento...</td></tr>';

      try {
        const r = await fetch('api/bookings', { headers: authHeaders(token) });
        const data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(data.error || 'error');

        const rows = data.bookings || [];
        if (!rows.length) {
          body.innerHTML = '<tr><td colspan="5" class="crm-empty">Nessuna richiesta registrata.</td></tr>';
          if (note) note.textContent = '';
          return;
        }
        body.innerHTML = rows.map(crmRow).join('');
        if (note) note.textContent = rows.length + ' richieste · aggiornato alle ' + new Date().toLocaleTimeString('it-IT');
      } catch (err) {
        body.innerHTML = '<tr><td colspan="5" class="crm-empty">Impossibile leggere il database.</td></tr>';
        if (note) note.textContent = 'Controlla DATABASE_URL e che il deploy sia aggiornato.';
      }
    }

    function crmRow(b) {
      const when = b.appt_date ? itDate(b.appt_date) + ' ' + (b.appt_time || '') : '—';
      const created = b.created_at ? new Date(b.created_at).toLocaleDateString('it-IT') : '—';
      const status = b.status || 'In attesa di conferma';
      const options = ['In attesa di conferma', 'Confermata', 'Ricalcolo avviato', 'Conclusa', 'Annullata'];
      const opts = options.map(function (s) {
        return '<option' + (s === status ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('');

      return '<tr>' +
        '<td><div class="crm-name">' + esc(b.id) + '</div><div class="crm-sub">' + esc(created) + '</div></td>' +
        '<td><div class="crm-name">' + esc(b.nome) + '</div><div class="crm-sub">' + esc(b.cf) + '</div><div class="crm-sub">' + esc(b.tel || '') + '</div></td>' +
        '<td>' + esc(when) + '</td>' +
        '<td>' + (b.spid === 'assist' ? 'Da attivare' : 'Attivo') + '</td>' +
        '<td><select class="crm-status" data-id="' + esc(b.id) + '">' + opts + '</select></td>' +
        '</tr>';
    }

    const existing = store.session();
    if (existing) showReserved(existing);

    let otpCode = null;
    let otpExpires = 0;
    let demoMode = false;

    const otpForm = $('#otp-form');
    const otpInfo = $('#otp-info');
    const otpHint = $('#otp-hint');

    function showOtpStep() {
      $('#login-form').classList.add('is-hidden');
      otpForm.classList.remove('is-hidden');
      $('#otp').value = '';
      $('#otp').focus();
      scrollTop();
    }

    function makeSession(email, via, tokenValue) {
      const session = { email: email, name: email.split('@')[0], via: via, at: Date.now() };
      const field = 'token';
      session[field] = tokenValue || null;
      return session;
    }

    function finishLogin(session) {
      store.setSession(session);
      if (session.token) {
        window.location.href = 'crm.html';
        return;
      }
      showReserved(session);
      toast('Accesso in modalità demo.');
      scrollTop();
    }

    async function deviceFingerprint() {
      const parts = [
        navigator.userAgent,
        screen.width + 'x' + screen.height + 'x' + (screen.colorDepth || 0),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        navigator.platform || '',
        String(navigator.hardwareConcurrency || 0),
        String(navigator.deviceMemory || 0),
        navigator.language || ''
      ];
      const raw = parts.join('|');
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (e) {
        let h = 7;
        for (let i = 0; i < raw.length; i++) h = ((h * 31) + raw.charCodeAt(i)) >>> 0;
        return 'fp-' + h.toString(16) + '-' + raw.length;
      }
    }

    async function sendCode(email) {
      otpInfo.textContent = 'Invio del codice in corso...';
      otpHint.classList.add('is-hidden');
      demoMode = false;
      otpCode = null;

      let response;
      try {
        response = await fetch('api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
      } catch (err) {
        demoMode = true;
        otpCode = String(Math.floor(100000 + Math.random() * 900000));
        otpExpires = Date.now() + 10 * 60 * 1000;
        otpInfo.textContent = 'Server non raggiungibile: modalità demo.';
        otpHint.textContent = 'Codice per questa sessione: ' + otpCode;
        otpHint.classList.remove('is-hidden');
        return;
      }

      const data = await response.json().catch(function () { return {}; });

      if (response.ok && data.ok) {
        otpInfo.textContent = 'Codice inviato a ' + (data.to || 'casella operatore') + '.';
        return;
      }

      // Configurazione incompleta: si può comunque provare il flusso in demo.
      if (data.error === 'no_db' || data.error === 'not_configured') {
        demoMode = true;
        otpCode = String(Math.floor(100000 + Math.random() * 900000));
        otpExpires = Date.now() + 10 * 60 * 1000;
        otpInfo.textContent = 'Configurazione mancante: modalità demo.';
        otpHint.textContent = 'Manca DATABASE_URL oppure l\'accesso Gmail. Codice per questa sessione: ' + otpCode;
        otpHint.classList.remove('is-hidden');
        return;
      }

      // Errore reale: va mostrato, non mascherato da demo.
      otpInfo.textContent = 'Invio non riuscito: nessuna email spedita.';
      otpHint.textContent = (data.error || ('HTTP ' + response.status)) +
        (data.detail ? ' — ' + data.detail : '') +
        ' · diagnostica: apri /api/mail-check';
      otpHint.classList.remove('is-hidden');
    }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = $('#email').value.trim();
      const pwd = $('#password').value;
      const err = $('#login-error');

      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
        err.textContent = 'Inserisci un indirizzo email valido.';
        err.classList.remove('is-hidden');
        return;
      }
      if (pwd.length < 6) {
        err.textContent = 'La password deve avere almeno 6 caratteri.';
        err.classList.remove('is-hidden');
        return;
      }
      err.classList.add('is-hidden');

      showOtpStep();
      sendCode(email);
    });

    if (otpForm) {
      otpForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const typed = $('#otp').value.replace(/\D/g, '');
        const email = $('#email').value.trim();

        if (demoMode) {
          if (!otpCode) {
            toast('Richiedi prima un codice di accesso.', true);
            return;
          }
          if (Date.now() > otpExpires) {
            toast('Codice scaduto: richiedine uno nuovo.', true);
            return;
          }
          if (typed !== otpCode) {
            toast('Codice non valido.', true);
            $('#otp').focus();
            return;
          }
          finishLogin(makeSession(email, 'demo', null));
          return;
        }

        if (typed.length !== 6) {
          toast('Il codice ha 6 cifre.', true);
          return;
        }

        try {
          const fingerprint = await deviceFingerprint();
          const device = {
            fingerprint: fingerprint,
            label: (navigator.platform || 'dispositivo') + ' · ' + screen.width + 'x' + screen.height,
            ua: navigator.userAgent,
            screen: screen.width + 'x' + screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            platform: navigator.platform || '',
            email: email
          };

          const m = await fetch('api/machines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(device)
          });
          const mdata = await m.json().catch(function () { return {}; });

          if (m.ok && mdata.status && mdata.status !== 'approved') {
            otpInfo.textContent = 'Macchina in attesa di approvazione.';
            otpHint.textContent = 'L\'amministratore deve autorizzare questo dispositivo dal CRM → Macchine. Riprova dopo l\'approvazione.';
            otpHint.classList.remove('is-hidden');
            return;
          }

          const r = await fetch('api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, code: typed })
          });
          const data = await r.json().catch(function () { return {}; });

          if (!r.ok || !data.ok) {
            toast(data.error === 'code_not_valid' ? 'Codice non valido o scaduto.' : 'Verifica non riuscita.', true);
            return;
          }

          finishLogin(makeSession(data.email || email, 'otp', data.token));
        } catch (err) {
          toast('Servizio di verifica non raggiungibile.', true);
        }
      });

      const resend = $('#otp-resend');
      if (resend) {
        resend.addEventListener('click', function () {
          sendCode($('#email').value.trim());
        });
      }

      const back = $('#otp-back');
      if (back) {
        back.addEventListener('click', function () {
          otpForm.classList.add('is-hidden');
          $('#login-form').classList.remove('is-hidden');
          otpCode = null;
          scrollTop();
        });
      }
    }

    const crmRefresh = $('#crm-refresh');
    if (crmRefresh) {
      crmRefresh.addEventListener('click', function () {
        const s = store.session();
        if (s && s.token) loadCrm(s.token);
      });
    }

    const crmBody = $('#crm-body');
    if (crmBody) {
      crmBody.addEventListener('change', async function (e) {
        const sel = e.target;
        if (!sel || !sel.classList.contains('crm-status')) return;
        const s = store.session();
        if (!s || !s.token) return;

        try {
          const headers = authHeaders(s.token);
          headers['Content-Type'] = 'application/json';
          const r = await fetch('api/bookings', {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ id: sel.getAttribute('data-id'), status: sel.value })
          });
          if (!r.ok) throw new Error('patch');
          toast('Stato aggiornato: ' + sel.value);
        } catch (err) {
          toast('Aggiornamento non riuscito.', true);
        }
      });
    }

    if ($('#google-btn')) {
      $('#google-btn').addEventListener('click', function () {
        toast('Accesso Google non disponibile: l\'area è riservata agli operatori.', true);
      });
    }

    const logout = $('#logout-btn');
    if (logout) {
      logout.addEventListener('click', function () {
        store.setSession(null);
        reservedView.classList.remove('is-open');
        authView.classList.remove('is-hidden');
        if (otpForm) {
          otpForm.classList.add('is-hidden');
          $('#otp').value = '';
        }
        $('#login-form').classList.remove('is-hidden');
        otpCode = null;
        scrollTop();
        toast('Sessione chiusa.');
      });
    }

    const forgot = $('#forgot-link');
    if (forgot) {
      forgot.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Recupero password dimostrativo: nessuna email viene inviata.');
      });
    }

    const create = $('#create-link');
    if (create) {
      create.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Registrazione dimostrativa: usa qualsiasi email e una password di 6+ caratteri.');
      });
    }
  }

  /* ------------------------------ boot ------------------------------ */

  if (new URLSearchParams(location.search).has('reset')) {
    try {
      localStorage.removeItem(KEY_BOOKINGS);
      localStorage.removeItem(KEY_SESSION);
      sessionStorage.removeItem(KEY_DRAFT);
      sessionStorage.removeItem(KEY_FLASH);
    } catch (e) {}
    toast('Dati dimostrativi azzerati.');
  }

  flushFlash();
})();
