/* ==========================================================================
   C.S.I. · Assistente virtuale per la prenotazione

   Accompagna il cliente nei tre passi del widget con messaggi scritti in
   anticipo, attivati da eventi precisi. Nessuna intelligenza artificiale,
   nessun servizio esterno, nessun dato del cliente registrato o inviato:
   il componente legge solo gli eventi del widget (passo, focus, invio, errori).

   Configurazione: blocco CONFIG qui sotto (acceso/spento, telefono, lingua).
   API minima per il sito: window.CSI_ASSISTANT.open() / .close() / .say(key)
   ========================================================================== */

(function () {
  'use strict';

  /* ----------------------------- configurazione ----------------------------- */

  var CONFIG = {
    enabled: true,                       // accende o spegne l'assistente
    phoneLabel: '080 817 8431',          // numero del responsabile, mostrato sul pulsante
    phoneHref: 'tel:+390808178431',      // lo stesso numero in formato chiamabile
    language: 'auto',                    // 'auto' oppure it / en / fr / es / de
    idleHelpAfterMs: 60000,               // dopo quanto offrire l'aiuto telefonico
    invalidAttemptsBeforeHelp: 3          // quante volte un campo può essere sbagliato prima dell'aiuto
  };

  if (!CONFIG.enabled) return;

  /* -------------------------------- testi ---------------------------------- */

  var TEXT = {
    it: {
      name: 'Assistente virtuale C.S.I.',
      welcome: "Ciao, sono l'assistente virtuale C.S.I. Compila i tuoi dati: servono per verificare la posizione pensionistica. Se un campo non ti è chiaro, toccalo e te lo spiego.",
      email: "Inserisci un'email funzionante e che puoi aprire adesso: ti serve per ricevere la conferma dell'appuntamento.",
      step2: 'Qui trovi mandato e privacy già compilati con i tuoi dati. Il mandato si perfeziona in sede con firma e timbro.',
      step3: 'Scegli un giorno e poi un orario libero. Gli orari non disponibili sono già occupati.',
      again1: 'Sono qui se ti serve una mano. I dati che scrivi restano in questa pagina.',
      again2: 'Ricontrolla i dati già compilati: puoi modificarli prima di continuare.',
      again3: 'Scegli la data e l\'orario che preferisci, poi conferma.',
      difficulty: 'Vedo che hai avuto qualche difficoltà. Se preferisci, chiama un responsabile del C.S.I.: ti prenota l\'appuntamento al telefono.',
      slot: 'Questo orario è stato appena prenotato da un altro cliente. Scegline un altro: i tuoi dati sono al sicuro.',
      network: 'Non riesco a contattare il sistema. Controlla la connessione e riprova; se il problema continua, chiama un responsabile del C.S.I.',
      done: "Fatto! La richiesta è registrata. Ti abbiamo inviato l'invito calendario via email.",
      call: 'Chiama ora',
      close: 'Chiudi assistente',
      reopen: 'Assistente virtuale C.S.I.'
    },
    en: {
      name: 'C.S.I. virtual assistant',
      welcome: "Hi, I'm the C.S.I. virtual assistant. Fill in your details so we can check your pension record. If a field is unclear, tap it and I'll explain.",
      email: "Use an email address that works and that you can open right now: you need it to receive the appointment confirmation.",
      step2: 'Mandate and privacy forms are already filled in with your details. The mandate is completed in person with a signature and stamp.',
      step3: "Pick a day, then a free time. Times that aren't available are already taken.",
      again1: 'I am here if you need a hand. What you type stays on this page.',
      again2: 'Check the details already filled in: you can change them before continuing.',
      again3: 'Pick the date and time you prefer, then confirm.',
      difficulty: 'I can see this is taking a while. If you prefer, call a C.S.I. adviser: they will book the appointment for you by phone.',
      slot: 'That time has just been booked by another client. Please choose another one: your details are safe.',
      network: "I can't reach the system. Check your connection and try again; if it keeps failing, call a C.S.I. adviser.",
      done: "Done! Your request is registered. We've sent the calendar invite to your email.",
      call: 'Call now',
      close: 'Close assistant',
      reopen: 'C.S.I. virtual assistant'
    },
    fr: {
      name: 'Assistant virtuel C.S.I.',
      welcome: "Bonjour, je suis l'assistant virtuel C.S.I. Remplissez vos informations : elles servent à vérifier votre situation de retraite. Si un champ n'est pas clair, touchez-le et je vous explique.",
      email: "Indiquez une adresse e-mail qui fonctionne et que vous pouvez ouvrir maintenant : elle sert à recevoir la confirmation du rendez-vous.",
      step2: 'Le mandat et la confidentialité sont déjà remplis avec vos informations. Le mandat est finalisé sur place, avec signature et cachet.',
      step3: 'Choisissez un jour puis un horaire libre. Les horaires non disponibles sont déjà pris.',
      again1: "Je suis là si vous avez besoin d'aide. Ce que vous saisissez reste sur cette page.",
      again2: 'Vérifiez les informations déjà remplies : vous pouvez les modifier avant de continuer.',
      again3: "Choisissez la date et l'heure, puis confirmez.",
      difficulty: 'Je vois que cela prend un peu de temps. Si vous préférez, appelez un conseiller C.S.I. : il prendra le rendez-vous par téléphone.',
      slot: "Cet horaire vient d'être réservé par un autre client. Choisissez-en un autre : vos informations sont en sécurité.",
      network: "Je n'arrive pas à joindre le système. Vérifiez votre connexion et réessayez ; si le problème persiste, appelez un conseiller C.S.I.",
      done: "C'est fait ! Votre demande est enregistrée. L'invitation calendrier a été envoyée à votre adresse e-mail.",
      call: 'Appeler',
      close: "Fermer l'assistant",
      reopen: 'Assistant virtuel C.S.I.'
    },
    es: {
      name: 'Asistente virtual C.S.I.',
      welcome: 'Hola, soy el asistente virtual de C.S.I. Rellena tus datos: sirven para comprobar tu situación de pensión. Si algún campo no está claro, tócalo y te lo explico.',
      email: 'Pon un correo que funcione y que puedas abrir ahora: lo necesitas para recibir la confirmación de la cita.',
      step2: 'El mandato y la privacidad ya están rellenados con tus datos. El mandato se completa en la oficina con firma y sello.',
      step3: 'Elige un día y luego una hora libre. Las horas no disponibles ya están ocupadas.',
      again1: 'Estoy aquí si necesitas ayuda. Lo que escribes se queda en esta página.',
      again2: 'Revisa los datos ya rellenados: puedes cambiarlos antes de continuar.',
      again3: 'Elige la fecha y la hora que prefieras y luego confirma.',
      difficulty: 'Veo que te está costando un poco. Si prefieres, llama a un responsable de C.S.I.: te pide la cita por teléfono.',
      slot: 'Esa hora acaba de ser reservada por otro cliente. Elige otra: tus datos están seguros.',
      network: 'No consigo conectar con el sistema. Comprueba la conexión y vuelve a intentarlo; si sigue fallando, llama a un responsable de C.S.I.',
      done: '¡Hecho! La solicitud está registrada. Hemos enviado la invitación al calendario a tu correo.',
      call: 'Llamar ahora',
      close: 'Cerrar asistente',
      reopen: 'Asistente virtual C.S.I.'
    },
    de: {
      name: 'Virtueller Assistent C.S.I.',
      welcome: 'Hallo, ich bin der virtuelle Assistent von C.S.I. Füllen Sie Ihre Daten aus: Sie helfen uns, Ihren Rentenanspruch zu prüfen. Wenn ein Feld unklar ist, tippen Sie es an – ich erkläre es.',
      email: 'Geben Sie eine E-Mail-Adresse an, die funktioniert und die Sie jetzt öffnen können: Sie erhalten darüber die Terminbestätigung.',
      step2: 'Mandat und Datenschutz sind bereits mit Ihren Daten ausgefüllt. Das Mandat wird vor Ort mit Unterschrift und Stempel abgeschlossen.',
      step3: 'Wählen Sie einen Tag und dann eine freie Uhrzeit. Nicht verfügbare Zeiten sind bereits vergeben.',
      again1: 'Ich helfe Ihnen gern. Was Sie eingeben, bleibt auf dieser Seite.',
      again2: 'Prüfen Sie die bereits ausgefüllten Daten: Sie können sie vor dem Weitergehen ändern.',
      again3: 'Wählen Sie Datum und Uhrzeit und bestätigen Sie dann.',
      difficulty: 'Ich sehe, dass es gerade nicht klappt. Wenn Sie möchten, rufen Sie einen C.S.I.-Mitarbeiter an: Er bucht den Termin telefonisch für Sie.',
      slot: 'Diese Uhrzeit wurde gerade von einem anderen Kunden gebucht. Bitte wählen Sie eine andere: Ihre Daten sind sicher.',
      network: 'Ich erreiche das System nicht. Prüfen Sie die Verbindung und versuchen Sie es erneut; wenn es weiter fehlschlägt, rufen Sie einen C.S.I.-Mitarbeiter an.',
      done: 'Fertig! Ihre Anfrage ist registriert. Die Kalendereinladung wurde an Ihre E-Mail-Adresse gesendet.',
      call: 'Jetzt anrufen',
      close: 'Assistent schließen',
      reopen: 'Virtueller Assistent C.S.I.'
    }
  };

  var SUPPORTED = ['it', 'en', 'fr', 'es', 'de'];

  function pickLanguage() {
    var forced = new URLSearchParams(location.search).get('lang');
    if (forced && SUPPORTED.indexOf(forced) > -1) return forced;
    if (CONFIG.language !== 'auto' && SUPPORTED.indexOf(CONFIG.language) > -1) return CONFIG.language;

    // La landing è in italiano: l'assistente segue la lingua della pagina.
    // Quando la pagina sarà tradotta (lang="en" e così via), seguirà quella.
    var pageLang = String(document.documentElement.lang || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(pageLang) > -1) return pageLang;

    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'it'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).slice(0, 2).toLowerCase();
      if (SUPPORTED.indexOf(code) > -1) return code;
    }
    return 'it';
  }

  var LANG = pickLanguage();
  var DICT = TEXT[LANG] || TEXT.it;

  function t(key) {
    return (DICT && DICT[key]) || TEXT.it[key] || '';
  }

  /* ------------------------------ costruzione ------------------------------ */

  var IMAGE = 'assets/img/assistente-avatar.jpg';
  var root = null;
  var body = null;
  var msgEl = null;
  var nameEl = null;
  var callEl = null;
  var closeEl = null;
  var toggleEl = null;

  function face() {
    var box = document.createElement('span');
    box.className = 'csi-assist-face';
    box.setAttribute('aria-hidden', 'true');

    var img = document.createElement('img');
    img.src = IMAGE;
    img.alt = '';
    img.width = 56;
    img.height = 56;
    img.decoding = 'async';
    img.addEventListener('error', function () { box.classList.add('is-fallback'); });

    box.appendChild(img);
    return box;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'csi-assist';
    root.setAttribute('data-open', 'true');
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', 'Assistente virtuale C.S.I.');

    toggleEl = document.createElement('button');
    toggleEl.type = 'button';
    toggleEl.id = 'csi-assist-toggle';
    toggleEl.className = 'csi-assist-toggle';
    toggleEl.setAttribute('aria-expanded', 'false');
    toggleEl.setAttribute('aria-controls', 'csi-assist-panel');

    var toggleLabel = document.createElement('span');
    toggleLabel.textContent = t('reopen');
    toggleLabel.setAttribute('data-i18n', 'assist.reopen');

    toggleEl.appendChild(face());
    toggleEl.appendChild(toggleLabel);

    body = document.createElement('div');
    body.className = 'csi-assist-body';
    body.id = 'csi-assist-panel';

    var bubble = document.createElement('div');
    bubble.className = 'csi-assist-bubble';

    nameEl = document.createElement('p');
    nameEl.className = 'csi-assist-name';
    nameEl.setAttribute('data-i18n', 'assist.name');
    nameEl.textContent = t('name');

    msgEl = document.createElement('p');
    msgEl.className = 'csi-assist-msg';
    msgEl.id = 'csi-assist-msg';
    msgEl.setAttribute('role', 'status');
    msgEl.setAttribute('aria-live', 'polite');
    msgEl.setAttribute('aria-atomic', 'true');
    msgEl.setAttribute('data-i18n', 'assist.welcome');
    msgEl.textContent = t('welcome');

    callEl = document.createElement('a');
    callEl.className = 'csi-assist-call';
    callEl.href = CONFIG.phoneHref;
    callEl.hidden = true;
    callEl.textContent = t('call') + ' ' + CONFIG.phoneLabel;
    callEl.setAttribute('data-i18n', 'assist.call');

    closeEl = document.createElement('button');
    closeEl.type = 'button';
    closeEl.id = 'csi-assist-close';
    closeEl.className = 'csi-assist-close';
    closeEl.setAttribute('aria-label', t('close'));
    closeEl.setAttribute('data-i18n', 'assist.close');
    closeEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    bubble.appendChild(nameEl);
    bubble.appendChild(msgEl);
    bubble.appendChild(callEl);
    bubble.appendChild(closeEl);

    body.appendChild(face());
    body.appendChild(bubble);

    root.appendChild(toggleEl);
    root.appendChild(body);

    closeEl.addEventListener('click', function () { setOpen(false, true); });
    toggleEl.addEventListener('click', function () { setOpen(true, true); });
  }

  /* -------------------------------- stato ---------------------------------- */

  var userClosed = false;
  var current = { key: 'welcome', call: false };
  var seen = {};
  var currentStep = null;
  var visits = {};
  var invalidAttempts = 0;
  var idleTimer = null;

  function setOpen(open, focusIt) {
    if (!root) return;
    root.setAttribute('data-open', open ? 'true' : 'false');
    toggleEl.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      userClosed = false;
      render();
      if (focusIt) closeEl.focus({ preventScroll: true });
    } else {
      userClosed = true;
      if (focusIt) toggleEl.focus({ preventScroll: true });
    }
  }

  function render() {
    if (!msgEl) return;
    var testo = t(current.key);

    // Se il testo è identico non lo riscrivo: evita che il lettore di schermo
    // ripeta lo stesso annuncio a ogni riapertura.
    if (msgEl.textContent !== testo) msgEl.textContent = testo;
    msgEl.setAttribute('data-i18n', 'assist.' + current.key);

    callEl.hidden = !current.call;
    if (current.call) {
      callEl.href = CONFIG.phoneHref;
      callEl.textContent = t('call') + ' ' + CONFIG.phoneLabel;
    }

    msgEl.classList.remove('is-new');
    void msgEl.offsetWidth;
    msgEl.classList.add('is-new');
  }

  /**
   * Mostra un messaggio.
   * @param {string} key   chiave del testo
   * @param {object} [opts] { force: riapre anche se chiuso, call: mostra il pulsante, repeat: consenti la ripetizione }
   */
  function say(key, opts) {
    opts = opts || {};
    if (!DICT[key]) return;

    var id = key + '@' + (currentStep === null ? '-' : currentStep);
    if (!opts.repeat) {
      if (seen[id]) return;
      seen[id] = true;
    }

    // Il messaggio nuovo resta memorizzato anche a pannello chiuso: se il
    // cliente lo riapre, trova l'ultima indicazione e non una vecchia.
    current = { key: key, call: !!opts.call };

    if (userClosed && !opts.force) return;
    if (opts.force) setOpen(true, false);
    render();
  }

  /* ------------------------------- posizione -------------------------------- */

  function activeStep() {
    var receipt = document.getElementById('receipt');
    if (receipt && !receipt.classList.contains('is-hidden')) return 'done';

    var panels = document.querySelectorAll('.step-panel');
    for (var i = 0; i < panels.length; i++) {
      if (!panels[i].classList.contains('is-hidden')) return Number(panels[i].getAttribute('data-step'));
    }
    return null;
  }

  function place() {
    var host = null;

    if (currentStep !== 'done') {
      var panels = document.querySelectorAll('.step-panel');
      for (var i = 0; i < panels.length; i++) {
        if (!panels[i].classList.contains('is-hidden')) { host = panels[i]; break; }
      }
    }

    var anchor = host
      ? host.querySelector('.wizard-actions')
      : document.querySelector('#receipt .receipt-actions');

    if (!anchor || !root) return;
    if (root.parentNode !== anchor.parentNode || root.nextElementSibling !== anchor) {
      anchor.parentNode.insertBefore(root, anchor);
    }
  }

  /* -------------------------------- eventi --------------------------------- */

  function syncStep() {
    var step = activeStep();
    if (step === currentStep) { place(); return; }

    currentStep = step;
    place();
    restartIdle();
    invalidAttempts = 0;

    if (step === 1 || step === 2 || step === 3) {
      visits[step] = (visits[step] || 0) + 1;
      var primo = { 1: 'welcome', 2: 'step2', 3: 'step3' }[step];
      var ritorno = { 1: 'again1', 2: 'again2', 3: 'again3' }[step];
      say(visits[step] === 1 ? primo : ritorno);
    } else if (step === 'done') {
      say('done');
    }
  }

  var scheduled = false;

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; syncStep(); }, 60);
  }

  function restartIdle() {
    clearTimeout(idleTimer);
    if (currentStep !== 1) return;
    idleTimer = setTimeout(function () {
      if (activeStep() === 1) say('difficulty', { call: true });
    }, CONFIG.idleHelpAfterMs);
  }

  // Cambio passo: il widget mostra/nasconde i pannelli con la classe is-hidden.
  function watch() {
    var wizard = document.getElementById('wizard');
    var receipt = document.getElementById('receipt');

    if (window.MutationObserver) {
      var observer = new MutationObserver(scheduleSync);
      if (wizard) observer.observe(wizard, { attributes: true, attributeFilter: ['class'], subtree: true });
      if (receipt) observer.observe(receipt, { attributes: true, attributeFilter: ['class'] });
    }

    // Le interazioni che cambiano passo o inviano: utile come rete di sicurezza.
    document.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== document) {
        if (el.id && ['next-1', 'next-2', 'back-2', 'back-3', 'submit-booking'].indexOf(el.id) > -1) {
          scheduleSync();
          setTimeout(scheduleSync, 350);
          return;
        }
        el = el.parentNode;
      }
    }, true);

    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.id === 'email' && activeStep() === 1) say('email');
    });

    // Campi lasciati con un valore sbagliato: dopo qualche tentativo offriamo
    // il telefono, come previsto per i tentativi esauriti.
    document.addEventListener('focusout', function (e) {
      if (activeStep() !== 1) return;
      var el = e.target;
      if (!el || !el.value || !String(el.value).trim()) return;
      if (!fieldInvalid(el)) return;

      invalidAttempts += 1;
      if (invalidAttempts >= (CONFIG.invalidAttemptsBeforeHelp || 3)) {
        invalidAttempts = 0;
        say('difficulty', { call: true });
      }
    }, true);

    document.addEventListener('input', restartIdle, true);
    window.addEventListener('resize', place);
  }

  function fieldInvalid(el) {
    var value = String(el.value || '').trim();
    switch (el.id) {
      case 'nome': return value.length < 3;
      case 'cf': return !/^[A-Z0-9]{16}$/i.test(value);
      case 'doc': return value.length < 4;
      case 'docDate': return !value;
      case 'email': return !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
      case 'tel': return value.replace(/\D/g, '').length < 6;
      default: return false;
    }
  }

  // Errori di rete e fascia occupata: unici casi in cui l'assistente si riapre da solo.
  function watchNetwork() {
    if (!window.fetch) return;
    var inner = window.fetch;

    window.fetch = function (input, options) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var isApi = url.indexOf('api/') > -1 || url.indexOf('/api/') > -1;
      var call = inner.apply(this, arguments);

      if (!isApi) return call;

      return call.then(function (response) {
        if (!response || response.ok) return response;
        try {
          response.clone().json().then(function (data) {
            var code = data && data.error;
            if (code === 'slot_taken' || code === 'slot_busy') say('slot', { force: true });
            else say('network', { force: true, call: true });
          }).catch(function () {
            say('network', { force: true, call: true });
          });
        } catch (e) {
          say('network', { force: true, call: true });
        }
        return response;
      }, function (err) {
        say('network', { force: true, call: true });
        throw err;
      });
    };
  }

  /* --------------------------------- avvio --------------------------------- */

  function boot() {
    if (!document.getElementById('wizard')) return;

    build();

    var host = document.querySelector('.step-panel');
    if (host) host.appendChild(root);

    watch();
    watchNetwork();
    place();
    syncStep();

    window.CSI_ASSISTANT = {
      config: CONFIG,
      open: function () { setOpen(true, true); },
      close: function () { setOpen(false, true); },
      say: function (key, opts) { say(key, opts); },
      language: LANG
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
