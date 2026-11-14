/* ==========================================================================
   C.S.I. · Ricalcolo pensione — backend locale (solo per questa copia)

   L'applicazione originale parla con un backend Node (api/bookings,
   api/clients, api/slots, api/overview, ...). Questa copia è statica: qui
   intercettiamo le stesse rotte con un finto server che tiene i dati nel
   browser (localStorage), così prenotazione, area operatori e CRM funzionano
   senza installare nulla.

   Per ricollegare un backend vero: togli il tag <script mock-api.js> dalle
   pagine HTML, senza toccare app.js / crm.js.
   ========================================================================== */

(function () {
  'use strict';

  var DB_KEY = 'csi.mock.db.v1';
  var BOOKINGS_KEY = 'csi.bookings.v1';
  var SESSION_KEY = 'csi.session.v1';

  var OTP = '123456';
  var TOKEN = 'demo-local-token';
  var OPERATOR = 'operatore@csi.it';
  var OTP_STORE = {};

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

  /* ----------------------------- utilità ----------------------------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function today() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(d, n) {
    var c = new Date(d.getTime());
    c.setDate(c.getDate() + n);
    return c;
  }

  function monthKeyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  function toMin(hhmm) {
    var p = String(hhmm || '0:0').split(':');
    return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
  }

  function fromMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

  function nowIso() { return new Date().toISOString(); }

  function reply(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: JSON_HEADERS
    });
  }

  function readJson(options) {
    try { return JSON.parse((options && options.body) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function headerOf(input, options, name) {
    try { return new Headers((options && options.headers) || (input && input.headers) || {}).get(name); }
    catch (e) { return null; }
  }

  function authed(input, options) {
    var auth = headerOf(input, options, 'Authorization') || '';
    return /^Bearer\s+\S+/.test(auth);
  }

  /* ------------------------------ store ------------------------------ */

  function seed() {
    var base = today();
    var y = base.getFullYear();

    function at(offsetDays, time) {
      return { date: iso(addDays(base, offsetDays)), time: time };
    }

    function client(i, data) {
      return Object.assign({
        id: i,
        code: 'CSI-' + y + '-' + pad(i),
        created_at: addDays(base, -60 + i * 4).toISOString(),
        spid_status: 'da_valutare',
        spid_ente: null,
        reminder_channel: 'email',
        mandate_signed: false,
        mandate_signed_at: null,
        studio_sent: false,
        studio_sent_at: null,
        studio_due: null,
        outcome: null,
        retro_from: null,
        retro_to: null,
        retro_amount: 0,
        extra_monthly: 0,
        extra_months: 13,
        extra_years: 10,
        fee_legal_pct: 15,
        fee_csi_pct: 10,
        extra_costs: 0,
        note: ''
      }, data);
    }

    var people = [
      ['Maria Rossi', 'RSSMRA48C45A662X', 'attivo', 'Namirial'],
      ['Giuseppe Loizzo', 'LZZGPP51A12A662K', 'in_lavorazione', 'SpidItalia'],
      ['Anna Maria Laterza', 'LTRNMR47E55A662Q', 'da_attivare', null],
      ['Francesco Divella', 'DVLFNC43B21A662R', 'attivo', 'InfoCert'],
      ['Teresa Mastrangelo', 'MSTTRS50H62A662L', 'da_valutare', null],
      ['Nicola Ranieri', 'RNRNCL46D18A662S', 'non_richiesto', null],
      ['Lucia Picardi', 'PCRLCU52F44A662T', 'attivo', 'Namirial'],
      ['Paolo Bianco', 'BNCPLA49L09A662V', 'da_attivare', null]
    ];

    var clients = people.map(function (p, idx) {
      var i = idx + 1;
      var nome = p[0];
      var slug = nome.toLowerCase().replace(/[^a-z]+/g, '.');
      var c = client(i, {
        nome: nome,
        cf: p[1],
        email: slug + '@example.com',
        tel: '080 000 00' + pad(i),
        spid_status: p[2],
        spid_ente: p[3],
        mandate_signed: i % 4 !== 0,
        mandate_signed_at: i % 4 !== 0 ? addDays(base, -30 + i).toISOString() : null
      });

      if (i <= 3) {
        c.studio_sent = true;
        c.studio_sent_at = addDays(base, -12 + i).toISOString();
        c.studio_due = iso(addDays(base, -2 + i));
      }
      if (i === 1 || i === 4 || i === 7) {
        c.outcome = 'positivo';
        c.retro_from = '2021-01-01';
        c.retro_to = '2025-12-31';
        c.retro_amount = [4820.5, 7310.25, 2965.4][[1, 4, 7].indexOf(i)];
        c.extra_monthly = [118.4, 204.6, 76.2][[1, 4, 7].indexOf(i)];
        c.extra_costs = 120;
      } else if (i === 2) {
        c.outcome = 'negativo_ricorso';
        c.retro_amount = 0;
      } else if (i === 5) {
        c.outcome = 'negativo';
      }
      return c;
    });

    var docs = {};
    clients.forEach(function (c) {
      docs[c.id] = [
        { kind: 'lettera_inps', present: c.id % 2 === 0, filename: '', description: '' },
        { kind: 'estratto_conto', present: c.id <= 4, filename: '', description: '' },
        { kind: 'cedolino', present: c.id <= 6, filename: '', description: '' },
        { kind: 'modello_730', present: c.id === 1 || c.id === 7, filename: '', description: '' },
        { kind: 'carta_identita', present: c.id !== 6, filename: '', description: '' },
        { kind: 'codice_fiscale', present: c.id !== 6, filename: '', description: '' }
      ];
    });

    var appts = [
      { client: 1, when: at(2, '09:00'), status: 'Confermata', note: 'Portare cedolino aggiornato.' },
      { client: 2, when: at(4, '11:00'), status: 'In attesa di conferma', note: '' },
      { client: 3, when: at(9, '16:30'), status: 'Confermata', note: 'SPID da attivare in sede.' },
      { client: 4, when: at(-6, '09:30'), status: 'Conclusa', note: 'Pratica inviata allo studio.' },
      { client: 7, when: at(-2, '10:00'), status: 'Conclusa', note: '' },
      { client: 6, when: at(-9, '16:00'), status: 'Annullata', note: 'Rinviato dal cliente.' },
      { client: 5, when: at(14, '09:00'), status: 'In attesa di conferma', note: '' },
      { client: 8, when: at(-34, '11:30'), status: 'Conclusa', note: '' },
      { client: 3, when: at(-38, '09:00'), status: 'Conclusa', note: 'Documenti completati.' },
      { client: 2, when: at(-63, '16:30'), status: 'Conclusa', note: '' },
      { client: 5, when: at(-67, '10:30'), status: 'Conclusa', note: '' },
      { client: 1, when: at(-95, '09:30'), status: 'Conclusa', note: 'Ricorso depositato.' },
      { client: 4, when: at(-126, '17:00'), status: 'Conclusa', note: '' },
      { client: 6, when: at(-131, '11:00'), status: 'Annullata', note: 'Cliente assente.' }
    ];

    var appointments = appts.map(function (a, i) {
      var c = clients[a.client - 1];
      return {
        id: i + 1,
        client_id: c.id,
        booking_id: null,
        appt_date: a.when.date,
        appt_time: a.when.time,
        nome: c.nome,
        cf: c.cf,
        operator: OPERATOR,
        status: a.status,
        note: a.note
      };
    });

    var bookings = appointments.slice(0, 4).map(function (a, i) {
      return {
        id: 'CSI-' + y + '-' + String(1000 + i),
        created_at: addDays(base, -3 - i).toISOString(),
        nome: a.nome,
        cf: a.cf,
        email: clients[a.client_id - 1].email,
        tel: clients[a.client_id - 1].tel,
        spid: clients[a.client_id - 1].spid_status === 'attivo' ? 'yes' : 'assist',
        appt_date: a.appt_date,
        appt_time: a.appt_time,
        status: a.status
      };
    });

    var templates = [
      {
        id: 1, name: 'Prima informazione', category: 'Prima informazione', channel: 'email',
        subject: 'Ricalcolo pensione — prima informazione per [Nome Cliente]',
        body: 'Gentile [Nome Cliente],\n\ngrazie per averci contattato. Abbiamo ricevuto la sua richiesta di verifica della pensione ([Codice Pratica]).\n\nLe confermiamo l\'appuntamento del [Data] alle [Ora] presso [Sede].\n\nDocumenti da portare: ultimo cedolino, lettera INPS di pensionamento, documento d\'identità e codice fiscale.\n\nPer qualsiasi necessità ci trovi al [Telefono].\n\nC.S.I. — Centro Servizi Integrati'
      },
      {
        id: 2, name: 'Conferma appuntamento', category: 'Appuntamenti', channel: 'email',
        subject: 'Conferma appuntamento [Data] alle [Ora]',
        body: 'Gentile [Nome Cliente],\n\nconfermiamo il suo appuntamento del [Data] alle [Ora] presso [Sede].\n\nLa riceverà l\'operatore [Operatore]. La pratica è [Codice Pratica].\n\nA presto.\nC.S.I. — Centro Servizi Integrati'
      },
      {
        id: 3, name: 'Promemoria appuntamento', category: 'Appuntamenti', channel: 'email',
        subject: 'Promemoria: appuntamento [Data] alle [Ora]',
        body: 'Gentile [Nome Cliente],\n\nle ricordiamo l\'appuntamento del [Data] alle [Ora] presso [Sede].\n\nPorti con sé i documenti richiesti. Se non può venire, ci avvisi al [Telefono].\n\nC.S.I. — Centro Servizi Integrati'
      },
      {
        id: 4, name: 'Documenti mancanti', category: 'Pratica', channel: 'email',
        subject: 'Documenti mancanti per la pratica [Codice Pratica]',
        body: 'Gentile [Nome Cliente],\n\nper completare la pratica [Codice Pratica] ci mancano alcuni documenti.\n\nPuò consegnarli in sede oppure rispondere a questa email.\n\nGrazie.\nC.S.I. — Centro Servizi Integrati'
      },
      {
        id: 5, name: 'Esito pratica', category: 'Esito', channel: 'email',
        subject: 'Esito della pratica [Codice Pratica]',
        body: 'Gentile [Nome Cliente],\n\nla informiamo che la pratica [Codice Pratica] ha avuto esito: [Stato].\n\nImporto riconosciuto: [Importo].\nCausale: [Causale].\n\nRestiamo a disposizione al [Telefono].\n\nC.S.I. — Centro Servizi Integrati'
      },
      {
        id: 6, name: 'Invio allo Studio Legale', category: 'Studio legale', channel: 'email',
        subject: 'Pratica [Codice Pratica] inviata allo Studio Legale Solimando',
        body: 'Gentile [Nome Cliente],\n\nla sua pratica ([Codice Pratica]) è stata inviata allo Studio Legale Solimando per la valutazione del ricorso.\n\nLa ricontatteremo con l\'esito della valutazione.\n\nC.S.I. — Centro Servizi Integrati'
      }
    ];

    return {
      version: 1,
      settings: {
        morningStart: '09:00',
        morningEnd: '12:30',
        afternoonStart: '16:30',
        afternoonEnd: '19:30',
        step: 30,
        closedWeekdays: [0, 6],
        minLeadHours: 1,
        maxDaysAhead: 60
      },
      days: {},
      seq: { client: clients.length, appt: appointments.length, file: 0, machine: 1 },
      clients: clients,
      documents: docs,
      appointments: appointments,
      bookings: bookings,
      files: [],
      machines: [
        {
          id: 1,
          fingerprint: 'demo-tablet',
          label: 'Tablet sede · 1280x800',
          platform: 'iPad',
          screen: '1280x800',
          requested_at: addDays(base, -2).toISOString(),
          requested_by: 'reception@csi.it',
          status: 'pending'
        }
      ],
      communications: [],
      templates: templates,
      audit: [
        { at: addDays(base, -1).toISOString(), actor: OPERATOR, action: 'login', entity: 'session', entity_id: null },
        { at: addDays(base, -2).toISOString(), actor: OPERATOR, action: 'client.update', entity: 'client', entity_id: 1 },
        { at: addDays(base, -4).toISOString(), actor: OPERATOR, action: 'doc.upload', entity: 'client', entity_id: 4 }
      ]
    };
  }

  var memory = null;

  function load() {
    if (memory) return memory;
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.clients) { memory = parsed; return memory; }
      }
    } catch (e) { /* storage non disponibile */ }
    memory = seed();
    save(memory);
    return memory;
  }

  function save(db) {
    memory = db;
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* quota */ }
  }

  function audit(db, action, entity, entityId) {
    db.audit.unshift({ at: nowIso(), actor: OPERATOR, action: action, entity: entity, entity_id: entityId || null });
    db.audit = db.audit.slice(0, 200);
  }

  /* ---------------------------- disponibilità ---------------------------- */

  function slotTimes(settings) {
    var out = [];
    [['morningStart', 'morningEnd'], ['afternoonStart', 'afternoonEnd']].forEach(function (pair) {
      var start = toMin(settings[pair[0]]);
      var end = toMin(settings[pair[1]]);
      var step = Math.max(5, Number(settings.step) || 30);
      for (var t = start; t < end; t += step) out.push(fromMin(t));
    });
    return out;
  }

  function isBooked(db, dateIso, time) {
    return db.appointments.some(function (a) {
      return String(a.appt_date).slice(0, 10) === dateIso && a.appt_time === time && a.status !== 'Annullata';
    });
  }

  function buildMonth(db, key) {
    var parts = String(key).split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var total = new Date(y, m, 0).getDate();
    var start = today();
    var limit = addDays(start, Number(db.settings.maxDaysAhead) || 60);
    var times = slotTimes(db.settings);
    var days = {};

    for (var d = 1; d <= total; d++) {
      var date = new Date(y, m - 1, d);
      var key2 = iso(date);
      var override = db.days[key2] || {};
      var closed = (db.settings.closedWeekdays || []).indexOf(date.getDay()) > -1;

      if (override.closed === true) closed = true;
      if (override.closed === false) closed = false;
      if (date < start) closed = true;
      if (date > limit) closed = true;

      var slots = times.map(function (time) {
        if (isBooked(db, key2, time)) return { time: time, status: 'booked' };
        if (closed) return { time: time, status: 'closed' };
        if (override.slots && override.slots[time] === 'closed') return { time: time, status: 'closed' };
        return { time: time, status: 'open' };
      });

      days[key2] = {
        closed: closed,
        free: slots.filter(function (s) { return s.status === 'open'; }).length,
        slots: slots
      };
    }
    return days;
  }

  /* ------------------------------ clienti ------------------------------ */

  var DOC_KINDS = [
    'lettera_inps', 'estratto_conto', 'cedolino', 'modello_730',
    'carta_identita', 'codice_fiscale', 'fattura_finale', 'documento_finale'
  ];

  function documentsOf(db, clientId) {
    var list = db.documents[clientId] || [];
    DOC_KINDS.forEach(function (kind) {
      if (!list.some(function (d) { return d.kind === kind; })) {
        list.push({ kind: kind, present: false, filename: '', description: '' });
      }
    });
    db.documents[clientId] = list;
    return list;
  }

  function detailOf(db, clientId) {
    var client = db.clients.filter(function (c) { return c.id === Number(clientId); })[0];
    if (!client) return null;
    return {
      ok: true,
      client: client,
      documents: documentsOf(db, client.id),
      appointments: db.appointments
        .filter(function (a) { return a.client_id === client.id; })
        .sort(function (a, b) { return String(a.appt_date).localeCompare(String(b.appt_date)); }),
      communications: db.communications
        .filter(function (m) { return m.client_id === client.id; })
        .sort(function (a, b) { return String(b.sent_at).localeCompare(String(a.sent_at)); })
    };
  }

  function markDocument(db, clientId, kind, fronte, retro) {
    var list = documentsOf(db, clientId);
    var doc = list.filter(function (d) { return d.kind === kind; })[0];
    if (!doc) { doc = { kind: kind, present: false, filename: '', description: '' }; list.push(doc); }
    doc.present = true;
    doc.filename = fronte || retro || doc.filename;

    // Il modello del CRM ha una riga per tipo di documento: qui teniamo traccia
    // di entrambe le facciate, così l'operatore sa cosa è arrivato.
    var lati = [];
    if (fronte) lati.push('fronte: ' + fronte);
    if (retro) lati.push('retro: ' + retro);
    if (lati.length) doc.description = lati.join(' · ');
    return doc;
  }

  function importFromBookings(db) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; } catch (e) { list = []; }
    list = list.concat(db.bookings || []);
    var created = 0;

    var seen = {};
    list.forEach(function (b) {
      if (!b || !b.cf) return;
      var cf = String(b.cf).toUpperCase();
      if (seen[cf]) return;
      seen[cf] = true;

      var existing = db.clients.filter(function (c) { return String(c.cf).toUpperCase() === cf; })[0];
      if (existing) return;

      db.seq.client += 1;
      var c = {
        id: db.seq.client,
        code: 'CSI-' + new Date().getFullYear() + '-' + pad(db.seq.client),
        nome: b.nome || 'Senza nome',
        cf: cf,
        email: b.email || '',
        tel: b.tel || '',
        created_at: b.createdAt || b.created_at || nowIso(),
        spid_status: b.spid === 'assist' ? 'da_attivare' : 'da_valutare',
        spid_ente: null,
        reminder_channel: b.reminderChannel || 'email',
        mandate_signed: false,
        mandate_signed_at: null,
        studio_sent: false,
        studio_sent_at: null,
        studio_due: null,
        outcome: null,
        retro_from: null,
        retro_to: null,
        retro_amount: 0,
        extra_monthly: 0,
        extra_months: 13,
        extra_years: 10,
        fee_legal_pct: 15,
        fee_csi_pct: 10,
        extra_costs: 0,
        note: ''
      };
      db.clients.push(c);
      db.documents[c.id] = [];
      created += 1;

      // Gli allegati caricati in prenotazione diventano documenti presenti
      // nella scheda cliente (fronte/retro per CF e carta d'identità).
      var uploaded = b.files || {};
      if (uploaded.cf_fronte || uploaded.cf_retro) {
        markDocument(db, c.id, 'codice_fiscale', uploaded.cf_fronte, uploaded.cf_retro);
      }
      if (uploaded.ci_fronte || uploaded.ci_retro) {
        markDocument(db, c.id, 'carta_identita', uploaded.ci_fronte, uploaded.ci_retro);
      }

      if (b.date || b.appt_date) {
        db.seq.appt += 1;
        db.appointments.push({
          id: db.seq.appt,
          client_id: c.id,
          booking_id: b.id || null,
          appt_date: b.date || b.appt_date,
          appt_time: b.time || b.appt_time || '09:00',
          nome: c.nome,
          cf: c.cf,
          operator: OPERATOR,
          status: b.status || 'In attesa di conferma',
          note: ''
        });
      }
    });

    if (created) audit(db, 'clients.import', 'client', null);
    save(db);
    return { ok: true, created: created };
  }

  /* ----------------------------- overview ----------------------------- */

  function overviewOf(db) {
    var counts = {
      clients: db.clients.length,
      appointments: db.appointments.length,
      studio: db.clients.filter(function (c) { return c.studio_sent; }).length,
      spid_active: db.clients.filter(function (c) { return c.spid_status === 'attivo'; }).length,
      docs_present: 0,
      machines_pending: db.machines.filter(function (m) { return m.status === 'pending'; }).length
    };

    var docs = [];
    var money = { retro: 0, legal: 0, csi: 0, extra: 0, net: 0 };
    var outcomes = {};
    var spid = {};

    db.clients.forEach(function (c) {
      (db.documents[c.id] || []).forEach(function (d) {
        if (d.present) counts.docs_present += 1;
        docs.push({
          nome: c.nome, kind: d.kind, present: !!d.present,
          filename: d.filename || '', description: d.description || ''
        });
      });

      var retro = Number(c.retro_amount) || 0;
      money.retro += retro;
      money.legal += retro * (Number(c.fee_legal_pct) || 0) / 100;
      money.csi += retro * (Number(c.fee_csi_pct) || 0) / 100;
      money.extra += Number(c.extra_costs) || 0;

      var key = c.outcome || 'nd';
      outcomes[key] = (outcomes[key] || 0) + 1;
      var s = c.spid_status || 'da_valutare';
      spid[s] = (spid[s] || 0) + 1;
    });

    money.net = money.retro - money.legal - money.csi - money.extra;

    return {
      ok: true,
      counts: counts,
      money: money,
      mandates: db.clients
        .filter(function (c) { return c.mandate_signed; })
        .sort(function (a, b) { return String(b.mandate_signed_at).localeCompare(String(a.mandate_signed_at)); })
        .slice(0, 8)
        .map(function (c) {
          return {
            client_id: c.id, nome: c.nome, cf: c.cf, code: c.code,
            signed_at: c.mandate_signed_at || c.created_at
          };
        }),
      documents: docs,
      communications: db.templates.map(function (t) {
        return { name: t.name, subject: t.subject, updated_at: addDays(today(), -5).toISOString() };
      }),
      outcomes: Object.keys(outcomes).map(function (k) { return { outcome: k, n: outcomes[k] }; }),
      spid: Object.keys(spid).map(function (k) { return { status: k, n: spid[k] }; })
    };
  }

  /* ------------------------------ router ------------------------------ */

  function handle(url, options) {
    var segs = url.pathname.split('/').filter(Boolean);
    var name = segs[segs.indexOf('api') + 1] || '';
    var q = url.searchParams;
    var method = String((options && options.method) || 'GET').toUpperCase();
    var body = readJson(options);
    var db = load();

    if (name === 'send-docs') {
      if (!body.html || String(body.html).length < 40) return reply({ error: 'empty_document' }, 400);
      return reply({ ok: true, demo: true });
    }

    /* --- codice di firma del mandato --- */

    if (name === 'otp') {
      var otpEmail = String(body.email || '').toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(otpEmail)) return reply({ error: 'invalid_email' }, 400);

      if (body.action === 'send') {
        var code = String(Math.floor(100000 + Math.random() * 900000));
        OTP_STORE[otpEmail] = { code: code, exp: Date.now() + 10 * 60 * 1000, attempts: 0 };
        return reply({ ok: true, demo: true, dev_code: code });
      }

      if (body.action === 'verify') {
        var record = OTP_STORE[otpEmail];
        if (!record) return reply({ error: 'code_not_valid' }, 400);
        if (Date.now() > record.exp) {
          delete OTP_STORE[otpEmail];
          return reply({ error: 'code_expired' }, 400);
        }
        record.attempts += 1;
        if (record.attempts > 5) {
          delete OTP_STORE[otpEmail];
          return reply({ error: 'too_many_attempts' }, 400);
        }
        if (String(body.code || '').replace(/\D/g, '') !== record.code) return reply({ error: 'code_not_valid' }, 400);
        delete OTP_STORE[otpEmail];
        return reply({
          ok: true,
          at: new Date().toISOString(),
          ref: 'OTP-' + Math.random().toString(36).slice(2, 8).toUpperCase()
        });
      }

      return reply({ error: 'bad_action' }, 400);
    }

    /* --- prenotazione pubblica --- */

    if (name === 'bookings') {
      if (method === 'POST') {
        var booking = {
          id: body.id || 'CSI-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
          created_at: body.createdAt || nowIso(),
          nome: body.nome || '',
          cf: String(body.cf || '').toUpperCase(),
          email: body.email || '',
          tel: body.tel || '',
          spid: body.spid || null,
          appt_date: body.date || body.appt_date || null,
          appt_time: body.time || body.appt_time || null,
          status: body.status || 'In attesa di conferma',
          consents: body.consents || null,
          files: body.files || null
        };
        db.bookings.unshift(booking);

        var client = db.clients.filter(function (c) { return String(c.cf).toUpperCase() === booking.cf; })[0];
        db.seq.appt += 1;
        db.appointments.unshift({
          id: db.seq.appt,
          client_id: client ? client.id : null,
          booking_id: booking.id,
          appt_date: booking.appt_date,
          appt_time: booking.appt_time,
          nome: booking.nome,
          cf: booking.cf,
          operator: OPERATOR,
          status: booking.status,
          note: ''
        });
        audit(db, 'booking.create', 'booking', booking.id);
        save(db);
        return reply({ ok: true, id: booking.id });
      }

      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);

      if (method === 'PATCH') {
        var target = db.bookings.filter(function (b) { return String(b.id) === String(body.id); })[0];
        if (target) target.status = body.status || target.status;
        db.appointments.forEach(function (a) {
          if (String(a.booking_id) === String(body.id)) a.status = body.status || a.status;
        });
        save(db);
        return reply({ ok: true });
      }

      return reply({ ok: true, bookings: db.bookings });
    }

    /* --- slot e disponibilità --- */

    if (name === 'slots') {
      if (method === 'PATCH') {
        if (q.get('day')) {
          var day = String(body.day || '');
          db.days[day] = db.days[day] || {};
          db.days[day].closed = body.is_open ? false : true;
          db.days[day].slots = {};
          audit(db, body.is_open ? 'day.open' : 'day.close', 'day', day);
        } else if (q.get('slot')) {
          var day2 = String(body.day || '');
          var slot = String(body.slot || '');
          db.days[day2] = db.days[day2] || {};
          db.days[day2].slots = db.days[day2].slots || {};
          db.days[day2].slots[slot] = body.is_open ? 'open' : 'closed';
          if (body.is_open) db.days[day2].closed = false;
          audit(db, body.is_open ? 'slot.open' : 'slot.close', 'slot', day2 + ' ' + slot);
        } else if (body.settings) {
          Object.assign(db.settings, body.settings);
          audit(db, 'settings.update', 'settings', null);
        }
        save(db);
        return reply({ ok: true, settings: db.settings });
      }

      var month = q.get('month') || monthKeyOf(today());
      return reply({
        ok: true,
        month: month,
        settings: db.settings,
        days: buildMonth(db, month)
      });
    }

    /* --- appuntamenti --- */

    if (name === 'appointments') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);

      if (method === 'PATCH') {
        var appt = db.appointments.filter(function (a) { return a.id === Number(body.id); })[0];
        if (!appt) return reply({ error: 'not_found' }, 404);

        if (body.status) appt.status = body.status;
        if (typeof body.note === 'string') appt.note = body.note;

        if (body.appt_date || body.appt_time) {
          var newDate = body.appt_date || appt.appt_date;
          var newTime = body.appt_time || appt.appt_time;
          var taken = db.appointments.some(function (a) {
            return a.id !== appt.id && a.status !== 'Annullata' &&
              String(a.appt_date).slice(0, 10) === String(newDate).slice(0, 10) && a.appt_time === newTime;
          });
          if (taken) return reply({ error: 'slot_taken' }, 409);
          appt.appt_date = newDate;
          appt.appt_time = newTime;
        }

        audit(db, 'appointment.update', 'appointment', appt.id);
        save(db);
        return reply({ ok: true });
      }

      if (method === 'PUT' && q.get('day')) {
        var d3 = String(body.day || '');
        db.days[d3] = db.days[d3] || {};
        db.days[d3].closed = body.is_open ? false : true;
        db.days[d3].slots = {};
        save(db);
        return reply({ ok: true });
      }

      return reply({ ok: true, appointments: db.appointments });
    }

    /* --- clienti --- */

    if (name === 'clients') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);

      var action = q.get('action');
      if (action === 'import' && method === 'POST') return reply(importFromBookings(db));

      if (action === 'comm' && method === 'POST') {
        db.communications.unshift({
          id: db.communications.length + 1,
          client_id: Number(body.client_id),
          subject: body.subject || '',
          body: body.body || '',
          channel: body.channel || 'email',
          sent_at: nowIso()
        });
        audit(db, 'comm.send', 'client', body.client_id);
        save(db);
        return reply({ ok: true });
      }

      if (action === 'doc' && method === 'POST') {
        var list = documentsOf(db, Number(body.client_id));
        var doc = list.filter(function (d) { return d.kind === body.kind; })[0];
        if (!doc) { doc = { kind: body.kind, present: false, filename: '', description: '' }; list.push(doc); }
        doc.present = !!body.present;
        if (body.filename) doc.filename = body.filename;
        if (typeof body.description === 'string') doc.description = body.description;
        audit(db, 'doc.update', 'client', body.client_id);
        save(db);
        return reply({ ok: true });
      }

      if (method === 'PATCH') {
        var c2 = db.clients.filter(function (c) { return c.id === Number(body.id); })[0];
        if (!c2) return reply({ error: 'not_found' }, 404);

        Object.keys(body).forEach(function (k) {
          if (k === 'id') return;
          c2[k] = body[k];
        });

        if (body.studio_sent === true && !c2.studio_sent_at) {
          c2.studio_sent_at = nowIso();
          c2.studio_due = iso(addDays(today(), 10));
        }
        if (body.studio_sent === false) {
          c2.studio_sent_at = null;
          c2.studio_due = null;
        }
        if (body.mandate_signed === true) c2.mandate_signed_at = nowIso();

        audit(db, 'client.update', 'client', c2.id);
        save(db);
        return reply({ ok: true, client: c2 });
      }

      if (q.get('id')) {
        var detail = detailOf(db, q.get('id'));
        return detail ? reply(detail) : reply({ error: 'not_found' }, 404);
      }

      var rows = db.clients.slice().sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      });
      return reply({ ok: true, clients: rows });
    }

    /* --- file --- */

    if (name === 'files') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);

      if (method === 'POST') {
        db.seq.file += 1;
        var file = {
          id: db.seq.file,
          client_id: Number(body.client_id),
          kind: body.kind || 'documento_finale',
          filename: body.filename || 'documento',
          mime: body.mime || 'application/octet-stream',
          size: Math.round(String(body.data || '').length * 0.75),
          data: body.data || '',
          created_at: nowIso()
        };
        db.files.push(file);
        audit(db, 'file.upload', 'client', file.client_id);
        save(db);
        return reply({ ok: true, id: file.id });
      }

      if (q.get('id')) {
        var f = db.files.filter(function (x) { return x.id === Number(q.get('id')); })[0];
        if (!f) return reply({ error: 'not_found' }, 404);
        return new Response(toBytes(f.data), {
          status: 200,
          headers: { 'Content-Type': f.mime || 'application/octet-stream' }
        });
      }

      return reply({
        ok: true,
        files: db.files
          .filter(function (x) { return x.client_id === Number(q.get('client_id')); })
          .map(function (x) {
            return { id: x.id, filename: x.filename, mime: x.mime, size: x.size, kind: x.kind };
          })
      });
    }

    /* --- macchine --- */

    if (name === 'machines') {
      if (method === 'POST') {
        var fp = body.fingerprint || 'sconosciuta';
        var known = db.machines.filter(function (m) { return m.fingerprint === fp; })[0];
        if (known) return reply({ ok: true, status: known.status });

        // Primo dispositivo della postazione: entra subito. I successivi
        // restano in attesa e si approvano da CRM → Macchine.
        var hasApproved = db.machines.some(function (m) { return m.status === 'approved'; });
        db.seq.machine += 1;
        var machine = {
          id: db.seq.machine,
          fingerprint: fp,
          label: body.label || 'dispositivo',
          platform: body.platform || '',
          screen: body.screen || '',
          ua: body.ua || '',
          timezone: body.timezone || '',
          requested_at: nowIso(),
          requested_by: body.email || OPERATOR,
          status: hasApproved ? 'pending' : 'approved'
        };
        db.machines.unshift(machine);
        audit(db, 'machine.register', 'machine', machine.id);
        save(db);
        return reply({ ok: true, status: machine.status });
      }

      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);

      if (method === 'PATCH') {
        var m2 = db.machines.filter(function (m) { return m.id === Number(body.id); })[0];
        if (!m2) return reply({ error: 'not_found' }, 404);
        m2.status = body.status || m2.status;
        audit(db, 'machine.' + m2.status, 'machine', m2.id);
        save(db);
        return reply({ ok: true });
      }

      return reply({ ok: true, machines: db.machines });
    }

    /* --- panoramica, registro, template --- */

    if (name === 'overview') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);
      return reply(overviewOf(db));
    }

    if (name === 'audit') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);
      return reply({ ok: true, entries: db.audit });
    }

    if (name === 'communications') {
      if (!authed(url, options)) return reply({ error: 'unauthorized' }, 401);
      return reply({ ok: true, templates: db.templates });
    }

    /* --- accesso operatore --- */

    if (name === 'send-otp') {
      setTimeout(function () {
        var hint = document.getElementById('otp-hint');
        if (hint) {
          hint.textContent = 'Ambiente locale: il codice di accesso è ' + OTP + '.';
          hint.classList.remove('is-hidden');
        }
      }, 40);
      return reply({ ok: true, to: body.email || OPERATOR });
    }

    if (name === 'verify-otp') {
      if (String(body.code || '').replace(/\D/g, '') !== OTP) {
        return reply({ error: 'code_not_valid' }, 400);
      }
      audit(db, 'login', 'session', null);
      save(db);
      return reply({ ok: true, email: body.email || OPERATOR, token: TOKEN });
    }

    return reply({ error: 'not_found' }, 404);
  }

  /* ---------------------------- bootstrap ---------------------------- */

  function toBytes(base64) {
    try {
      var bin = atob(base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      return new Uint8Array(0);
    }
  }

  window.fetch = function (input, options) {
    var url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); }
    catch (e) { return nativeFetch ? nativeFetch(input, options) : Promise.reject(e); }

    var segs = url.pathname.split('/').filter(Boolean);
    if (segs.indexOf('api') === -1) {
      return nativeFetch ? nativeFetch(input, options) : Promise.reject(new Error('fetch non disponibile'));
    }

    // Se la posta reale è attiva, i codici passano dal backend (Gmail SMTP).
    // Se la funzione non è raggiungibile, si torna al codice locale di demo.
    var endpoint = segs[segs.indexOf('api') + 1];
    if (endpoint === 'otp' && window.CSI_REAL_MAIL && nativeFetch) {
      return nativeFetch(input, options).then(function (res) {
        if (res.status === 404 || res.status === 405 || res.status === 501) return handle(url, options);
        return res;
      }, function () {
        return handle(url, options);
      });
    }

    try {
      return Promise.resolve(handle(url, options));
    } catch (err) {
      return Promise.resolve(reply({ error: 'mock_error', detail: String(err && err.message || err) }, 500));
    }
  };

  /* Le miniature dei file usano <img src="api/files?id=...">: il browser non
     passa da fetch, quindi riscriviamo quei riferimenti con il data URL. */
  function hydrateFileSources() {
    var db = load();

    document.querySelectorAll('img[src*="api/files?id="], a[href*="api/files?id="]').forEach(function (el) {
      var attr = el.tagName === 'A' ? 'href' : 'src';
      var raw = el.getAttribute(attr) || '';
      var match = raw.match(/id=(\d+)/);
      if (!match) return;
      var file = db.files.filter(function (f) { return f.id === Number(match[1]); })[0];
      if (!file || !file.data) return;
      var dataUrl = 'data:' + (file.mime || 'application/octet-stream') + ';base64,' + file.data;
      if (el.getAttribute(attr) !== dataUrl) el.setAttribute(attr, dataUrl);
    });
  }

  function markDemo() {
    var head = document.querySelector('.crm-head-in');
    if (!head || head.querySelector('.mock-badge')) return;
    var chip = document.createElement('span');
    chip.className = 'mock-badge';
    chip.textContent = 'Dati demo nel browser';
    chip.style.cssText = 'margin-left:auto;font:500 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#39546b;background:#f1ecdf;border:1px solid rgba(0,28,58,.18);' +
      'padding:8px 11px;border-radius:4px;white-space:nowrap';
    head.appendChild(chip);
  }

  function boot() {
    if (new URLSearchParams(location.search).has('reset')) {
      memory = null;
      try { localStorage.removeItem(DB_KEY); } catch (e) {}
    }
    load();
    markDemo();

    var observer = new MutationObserver(function () { hydrateFileSources(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    hydrateFileSources();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
