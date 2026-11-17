'use strict';

/**
 * Endpoint di salute per monitoraggio deploy e "Test Connessione".
 * Non richiede autenticazione, non tocca dati utente.
 * Risponde in JSON con timestamp, versione runtime e stato dei componenti.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const started = Date.now();
  const mailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

  const payload = {
    ok: true,
    app: 'csi-pensioni-clone',
    landing: 'Ricalcolo Pensione',
    module: 'health',
    env: process.env.VERCEL_ENV || 'local',
    region: process.env.VERCEL_REGION || 'local',
    deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    runtime: 'node-' + (process.version || 'unknown'),
    mail_configured: mailConfigured,
    timestamp: new Date().toISOString(),
    latency_ms: 0
  };

  payload.latency_ms = Date.now() - started;

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.status(200).json(payload);
};
