'use strict';

/**
 * Codice di firma del mandato — invio via Gmail SMTP.
 *
 * Le credenziali NON stanno nel codice: si leggono da
 *   GMAIL_USER           → gianniburdi@gmail.com
 *   GMAIL_APP_PASSWORD   → app password Google (16 caratteri, senza spazi)
 * Vanno impostate come Environment Variables del progetto Vercel.
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;

const store = globalThis.__csiOtpStore || (globalThis.__csiOtpStore = new Map());
const sends = globalThis.__csiOtpSends || (globalThis.__csiOtpSends = new Map());

function digest(code, salt) {
  return crypto.createHash('sha256').update(String(code) + ':' + salt).digest('hex');
}

function mask(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '—';
  return name.slice(0, 2) + '•'.repeat(Math.max(2, name.length - 2)) + '@' + domain;
}

function mailBody(code, nome) {
  const text = [
    'C.S.I. — Centro Servizi Integrati',
    '',
    (nome ? 'Gentile ' + nome + ',' : 'Gentile cliente,'),
    '',
    'il tuo codice di firma per il mandato è:',
    '',
    '    ' + code,
    '',
    'Il codice vale 10 minuti e può essere usato una sola volta.',
    'Se non hai richiesto tu la firma, ignora questa email: nessun dato è stato modificato.',
    '',
    'Sezione di Ceglie del Campo · 70129 Bari (BA) · 080 817 8431'
  ].join('\n');

  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f7f4ed;font-family:Inter,Arial,sans-serif;color:#001c3a">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="font:600 11px/1 'Courier New',monospace;letter-spacing:.18em;text-transform:uppercase;color:#39546b;margin:0 0 6px">C.S.I. · Centro Servizi Integrati</p>
    <h1 style="font-size:22px;line-height:1.25;margin:0 0 16px">Codice di firma del mandato</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#39546b">${nome ? 'Gentile ' + nome + ',' : 'Gentile cliente,'}<br>usa questo codice per firmare il mandato. Vale 10 minuti e può essere usato una sola volta.</p>
    <p style="margin:0 0 18px;padding:18px 20px;background:#001c3a;color:#fff;border-radius:8px;font:600 30px/1 'Courier New',monospace;letter-spacing:.32em;text-align:center">${code}</p>
    <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#5e7386">Se non hai richiesto tu la firma, ignora questa email: nessun dato è stato modificato.</p>
    <hr style="border:0;border-top:1px solid rgba(0,28,58,.16);margin:24px 0">
    <p style="margin:0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#99a7b3">Sezione di Ceglie del Campo · 70129 Bari (BA) · 080 817 8431</p>
  </div></body></html>`;

  return { text, html };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  if (body.action === 'send') {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }

    const now = Date.now();
    const window = sends.get(email) || { count: 0, first: now };
    if (now - window.first > WINDOW_MS) {
      window.count = 0;
      window.first = now;
    }
    window.count += 1;
    sends.set(email, window);

    if (window.count > MAX_SENDS_PER_WINDOW) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(8).toString('hex');
    store.set(email, { hash: digest(code, salt), salt: salt, exp: now + TTL_MS, attempts: 0 });

    const nome = String(body.nome || '').trim().slice(0, 60);
    const { text, html } = mailBody(code, nome);

    try {
      const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: user, pass: pass }
      });

      await transport.sendMail({
        from: '"C.S.I. — Centro Servizi Integrati" <' + user + '>',
        to: email,
        replyTo: user,
        subject: 'Codice di firma del mandato — C.S.I.',
        text: text,
        html: html
      });
    } catch (err) {
      store.delete(email);
      console.error('otp_mail_failed', mask(email), err && err.code ? err.code : 'error');
      res.status(502).json({ error: 'mail_failed' });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  if (body.action === 'verify') {
    const record = store.get(email);
    if (!record) {
      res.status(400).json({ error: 'code_not_valid' });
      return;
    }

    if (Date.now() > record.exp) {
      store.delete(email);
      res.status(400).json({ error: 'code_expired' });
      return;
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      store.delete(email);
      res.status(400).json({ error: 'too_many_attempts' });
      return;
    }

    const typed = String(body.code || '').replace(/\D/g, '');
    if (typed.length !== 6 || digest(typed, record.salt) !== record.hash) {
      res.status(400).json({ error: 'code_not_valid' });
      return;
    }

    store.delete(email);
    res.status(200).json({
      ok: true,
      at: new Date().toISOString(),
      ref: 'OTP-' + crypto.randomBytes(3).toString('hex').toUpperCase()
    });
    return;
  }

  res.status(400).json({ error: 'bad_action' });
};
