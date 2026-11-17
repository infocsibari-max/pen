'use strict';

/**
 * Endpoint /api/data — risposte read-only per monitoraggio.
 *
 * Nota: il backend di scrittura della "CSI SEO Console" non vive in questo
 * progetto (è un'app separata). Questo endpoint risponde a GET con un payload
 * di stato, in modo che eventuali probe di rete non ricevano 404 o timeout.
 * POST viene rifiutato con 405 (nessuna scrittura in questo progetto).
 */

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'method_not_allowed',
      message: 'Questo endpoint è solo di lettura in questo progetto.'
    });
    return;
  }

  res.status(200).json({
    ok: true,
    endpoint: '/api/data',
    landing: 'Ricalcolo Pensione',
    mode: 'static-landing',
    note: 'Nessuna scrittura gestita qui. Per scrittura landing usare CSI SEO Console.',
    timestamp: new Date().toISOString()
  });
};
