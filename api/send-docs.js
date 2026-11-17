'use strict';

/**
 * Invio dei documenti (mandato / informativa privacy) via Gmail SMTP,
 * con PDF generato lato funzione.
 * Credenziali da environment variables: GMAIL_USER, GMAIL_APP_PASSWORD.
 */

const nodemailer = require('nodemailer');
const { build } = require('../lib/pdf-docs');

const MAX_PER_HOUR = 5;
const sends = globalThis.__csiDocSends || (globalThis.__csiDocSends = new Map());

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

  const to = String(body.to || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  const kind = body.kind === 'privacy' ? 'privacy' : 'mandato';
  const data = body.data || {};
  if (!String(data.nome || '').trim() || !String(data.cf || '').trim()) {
    res.status(400).json({ error: 'missing_data' });
    return;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'local');
  const now = Date.now();
  const window = sends.get(ip) || { count: 0, first: now };
  if (now - window.first > 60 * 60 * 1000) {
    window.count = 0;
    window.first = now;
  }
  window.count += 1;
  sends.set(ip, window);

  if (window.count > MAX_PER_HOUR) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const title = kind === 'privacy' ? 'Informativa e consenso privacy' : 'Mandato di assistenza e rappresentanza';
  const nome = String(data.nome || '').trim().slice(0, 80);
  const filename = kind === 'privacy' ? 'informativa-privacy.pdf' : 'mandato.pdf';

  let pdf;
  try {
    pdf = await build(kind, data);
  } catch (err) {
    console.error('pdf_build_failed', kind, err && err.message);
    res.status(500).json({ error: 'pdf_failed' });
    return;
  }

  const cover = `<!doctype html><html lang="it"><body style="margin:0;background:#f7f4ed;font-family:Inter,Arial,sans-serif;color:#001c3a">
  <div style="max-width:560px;margin:0 auto;padding:30px 24px">
    <p style="font:600 10px/1 'Courier New',monospace;letter-spacing:.18em;text-transform:uppercase;color:#39546b;margin:0 0 8px">C.S.I. · Centro Servizi Integrati</p>
    <h1 style="font-size:21px;line-height:1.3;margin:0 0 12px">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:#39546b;margin:0 0 14px">
      ${nome ? 'Gentile ' + nome + ',' : 'Gentile cliente,'}<br>
      in allegato trova il documento in PDF, pronto da stampare o conservare.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#5e7386;margin:0 0 18px">
      Se non ha richiesto lei questo invio, ignori questa email.
    </p>
    <hr style="border:0;border-top:1px solid rgba(0,28,58,.16);margin:22px 0">
    <p style="margin:0;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#99a7b3">Sezione di Ceglie del Campo · 70129 Bari (BA) · 080 817 8431</p>
  </div></body></html>`;

  try {
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: user, pass: pass } });
    await transport.sendMail({
      from: '"C.S.I. — Centro Servizi Integrati" <' + user + '>',
      to: to,
      replyTo: user,
      subject: title + ' — C.S.I.',
      html: cover,
      attachments: [{ filename: filename, content: pdf, contentType: 'application/pdf' }]
    });
  } catch (err) {
    console.error('doc_mail_failed', kind, err && err.code ? err.code : 'error');
    res.status(502).json({ error: 'mail_failed' });
    return;
  }

  res.status(200).json({ ok: true });
};
