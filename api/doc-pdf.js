'use strict';

const { build } = require('../lib/pdf-docs');

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

  const kind = body.kind === 'privacy' ? 'privacy' : 'mandato';
  const data = body.data || {};

  if (!String(data.nome || '').trim() || !String(data.cf || '').trim()) {
    res.status(400).json({ error: 'missing_data' });
    return;
  }

  try {
    const pdf = await build(kind, data);
    const name = kind === 'privacy' ? 'informativa-privacy.pdf' : 'mandato.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.setHeader('Content-Length', String(pdf.length));
    res.status(200).send(pdf);
  } catch (err) {
    console.error('pdf_build_failed', kind, err && err.message);
    res.status(500).json({ error: 'pdf_failed' });
  }
};
