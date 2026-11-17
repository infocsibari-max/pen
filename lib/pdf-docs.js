'use strict';

/**
 * Renderer PDF dei due moduli (mandato e informativa privacy).
 * Usa PDFKit: nessun browser, nessun servizio esterno.
 * Il documento viene costruito dai dati strutturati, non dall'HTML della pagina.
 */

const PDFDocument = require('pdfkit');

const NAVY = '#001c3a';
const SERVICE = '#39546b';
const COOL = '#99a7b3';
const LINE = '#ded8ca';

function itDate(value) {
  const s = String(value || '').slice(0, 10);
  const parts = s.split('-');
  return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '—';
}

function stamp(at) {
  if (!at) return null;
  const d = new Date(at);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT') + ' alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function createDoc(title) {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    info: { Title: title, Author: 'C.S.I. — Centro Servizi Integrati' }
  });
  return doc;
}

function header(doc, title, ref) {
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text('C.S.I. — CENTRO SERVIZI INTEGRATI', 54, doc.y, { characterSpacing: 0.4 });
  doc.fillColor(SERVICE).font('Helvetica').fontSize(8).text('Sezione di Ceglie del Campo · 70129 Bari (BA) · 080 817 8431', 54, doc.y);
  doc.moveDown(0.6);
  doc.strokeColor(LINE).lineWidth(1).moveTo(54, doc.y).lineTo(541, doc.y).stroke();
  doc.moveDown(1);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(17).text(title, 54, doc.y, { width: 487, lineGap: 2 });
  if (ref) {
    doc.moveDown(0.25);
    doc.fillColor(SERVICE).font('Helvetica-Oblique').fontSize(8.5).text(ref, 54, doc.y, { width: 487 });
  }
  doc.moveDown(0.9);
  doc.x = 54;
}

function section(doc, text) {
  doc.moveDown(0.7);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9.5).text(text.toUpperCase(), 54, doc.y, { width: 487, characterSpacing: 0.6 });
  doc.moveDown(0.3);
  doc.x = 54;
}

function paragraph(doc, text, opts) {
  doc.fillColor(SERVICE).font('Helvetica').fontSize(9)
    .text(text, 54, doc.y, Object.assign({ width: 487, align: 'justify', lineGap: 2.5 }, opts || {}));
  doc.moveDown(0.35);
  doc.x = 54;
}

function rows(doc, pairs) {
  const left = 54;
  const right = 541;
  const labelW = 190;
  doc.fontSize(9);
  pairs.forEach(function (pair) {
    const label = String(pair[0] || '');
    const value = String(pair[1] || '—');
    doc.font('Helvetica').fillColor(COOL);
    const labelHeight = doc.heightOfString(label, { width: labelW });
    doc.fillColor(NAVY).font('Helvetica-Bold');
    const valueHeight = doc.heightOfString(value, { width: right - left - labelW });
    const height = Math.max(labelHeight, valueHeight) + 5;
    const top = doc.y;

    if (top + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    doc.font('Helvetica').fillColor(COOL).fontSize(9).text(label, left, top, { width: labelW });
    doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(9).text(value, left + labelW, top, { width: right - left - labelW });
    doc.strokeColor(LINE).lineWidth(0.6).moveTo(left, top + height - 2).lineTo(right, top + height - 2).stroke();
    doc.y = top + height + 2;
  });
  doc.moveDown(0.4);
  doc.x = 54;
}

function bullets(doc, items) {
  items.forEach(function (item) {
    const top = doc.y;
    doc.fillColor(SERVICE).font('Helvetica').fontSize(9).text('•  ', 54, top, { width: 14, continued: false });
    doc.fillColor(SERVICE).font('Helvetica').fontSize(9).text(item, 68, top, { width: 473, align: 'justify', lineGap: 2.5 });
    doc.moveDown(0.25);
  });
  doc.x = 54;
}

function signature(doc, data) {
  doc.moveDown(0.6);
  doc.strokeColor(LINE).lineWidth(0.8).moveTo(54, doc.y).lineTo(541, doc.y).stroke();
  doc.moveDown(0.6);
  doc.fillColor(COOL).font('Helvetica').fontSize(7.5).text("FIRMA DELL'ASSISTITO/A", 54, doc.y, { characterSpacing: 0.8 });
  doc.moveDown(0.2);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text(data.nome || '—', 54, doc.y, { width: 487 });

  const when = data.firma && data.firma.at ? stamp(data.firma.at) : null;
  if (when) {
    doc.moveDown(0.15);
    doc.fillColor(SERVICE).font('Helvetica').fontSize(8)
      .text('Firmato con codice OTP il ' + when + ' · ' + (data.firma.email || '') + ' · rif. ' + (data.firma.ref || '—'), 54, doc.y, { width: 487 });
  } else {
    doc.moveDown(0.15);
    doc.fillColor(SERVICE).font('Helvetica-Oblique').fontSize(8).text('In attesa della firma con codice OTP.', 54, doc.y, { width: 487 });
  }
  doc.x = 54;
}

function footer(doc, label) {
  const range = doc.bufferedPageRange ? doc.bufferedPageRange() : null;
  if (!range || !range.count) return;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 40;
    doc.strokeColor(LINE).lineWidth(0.6).moveTo(54, y - 8).lineTo(541, y - 8).stroke();
    doc.fillColor(COOL).font('Helvetica').fontSize(7)
      .text(label, 54, y, { width: 380, lineBreak: false })
      .text('pag. ' + (i + 1) + ' / ' + range.count, 441, y, { width: 100, align: 'right', lineBreak: false });

    doc.page.margins.bottom = bottom;
  }
}

function mandato(data) {
  const doc = createDoc('Mandato di assistenza e rappresentanza');
  header(doc, 'Mandato di assistenza e rappresentanza',
    "Ai sensi e per gli effetti dell'art. 13 L. 30 marzo 2001, n. 152 e D.M. 10.10.2008, n. 193");

  section(doc, "1. Dati anagrafici dell'assistito/a");
  rows(doc, [
    ['Cognome e nome', data.nome],
    ['Luogo di nascita', data.luogoNascita || data.birthPlace],
    ['Data di nascita', itDate(data.dataNascita || data.birthDate)],
    ['Sesso', data.sesso || '—'],
    ['Codice fiscale', String(data.cf || '').toUpperCase()],
    ['Cittadinanza', data.cittadinanza || 'Italiana'],
    ['Indirizzo e civico', data.indirizzo],
    ['Residenza', data.residenza],
    ['CAP / Prov.', data.cap]
  ]);

  section(doc, '2. Oggetto del mandato di rappresentanza');
  paragraph(doc, "Il/La sottoscritto/a con il presente atto conferisce mandato a rappresentarlo/a ed assistito/a gratuitamente al Patronato ACLI sez. Ceglie del Campo, Sede di BARI, Piazza Vittorio Emanuele, 70129 (BA), presso il quale elegge domicilio ai sensi dell'art. 47 c.c., nei confronti di:");
  rows(doc, [
    ['Istituto / ente erogatore', data.ente || 'INPS'],
    ['Paese (se estero)', data.paese],
    ['Per lo svolgimento della pratica relativa a', data.pratica || 'Ricalcolo della pensione e ricorso per gli importi retroattivi']
  ]);
  paragraph(doc, '* Il presente mandato può essere revocato esclusivamente per iscritto.', { font: 'Helvetica-Oblique' });

  section(doc, '3. Attestazione operativa e validazione sede');
  rows(doc, [
    ['Collaboratore volontario', '—'],
    ['Operatore / validazione sede', 'Data e sede: BARI']
  ]);
  paragraph(doc, 'Il mandato si perfeziona con data, timbro e firma dell\'operatore del Patronato.', { font: 'Helvetica-Oblique' });

  section(doc, '4. Informativa sul trattamento dei dati personali');
  paragraph(doc, 'In conformità del D.Lgs. 30 giugno 2003, n. 196 e del Regolamento UE 2016/679 (GDPR), si informa che:');
  bullets(doc, [
    'Tipologia e finalità: i dati personali indispensabili per l\'espletamento dell\'incarico.',
    'Ambito di comunicazione: enti pubblici o privati eroganti e organismi aderenti alla F.N.A.',
    'Titolare e responsabile: Patronato ACLI sez. Ceglie del Campo, Presidente pro-tempore Giuseppe Cassano; responsabile il Direttore della Sede Provinciale di BARI.'
  ]);

  section(doc, 'Punto 1 — Consenso obbligatorio al trattamento dei dati');
  paragraph(doc, 'Consenso al trattamento dei dati personali e sensibili per le finalità del mandato e autorizzazione all\'accesso alle banche dati degli enti eroganti ai sensi dell\'art. 116 della Legge.  SI  ☐    NO  ☐');
  section(doc, 'Punto 2 — Consenso facoltativo per servizi e promozione');
  paragraph(doc, 'Utilizzo dei dati, esclusi quelli sensibili, per ulteriori attività statutarie, informative e promozionali del Patronato ACLI e della F.N.A.  SI  ☐    NO  ☐');

  signature(doc, data);
  footer(doc, 'C.S.I. · Mandato di assistenza e rappresentanza');
  doc.end();
  return doc;
}

function privacy(data) {
  const doc = createDoc('Informativa e consenso privacy');
  header(doc, 'Consenso al trattamento dei dati personali e informativa privacy',
    'Regolamento UE 2016/679 (GDPR) e D.Lgs. 30 giugno 2003, n. 196');

  section(doc, "1. Dati anagrafici dell'interessato/a");
  rows(doc, [
    ['Io sottoscritto/a', data.nome],
    ['Nato/a a', data.luogoNascita || data.birthPlace],
    ['Il', itDate(data.dataNascita || data.birthDate)],
    ['Sesso', data.sesso || '—'],
    ['C.A.P.', data.cap],
    ['E residente in', data.residenza],
    ["All'indirizzo", data.indirizzo],
    ['Codice fiscale', String(data.cf || '').toUpperCase()],
    ['Cittadinanza', data.cittadinanza || 'Italiana']
  ]);

  section(doc, '2. Consenso al trattamento dei dati personali');
  paragraph(doc, 'Avendo preso visione dell\'Informativa riferita all\'identità del Titolare del trattamento, del Responsabile della protezione dei dati (DPO), delle modalità e finalità del trattamento, nonché dei diritti dell\'Interessato, ai sensi e per gli effetti dell\'art. 7 e ss. del Regolamento UE 2016/679:');
  paragraph(doc, 'SI ☐  NO ☐ — al trattamento dei dati personali e particolari ai fini dell\'espletamento dell\'incarico conferito ad ACLI sez. Ceglie del Campo.');
  paragraph(doc, 'SI ☐  NO ☐ — al trattamento per eventuali future comunicazioni riguardo prestazioni e servizi offerti.');
  paragraph(doc, 'SI ☐  NO ☐ — alla comunicazione dei dati alla stessa ACLI e agli Enti da questa promossi.');

  section(doc, '3. Attestazione operativa e validazione sede');
  rows(doc, [
    ['Collaboratore volontario', '—'],
    ['Operatore / validazione sede', 'Data e sede: BARI']
  ]);

  section(doc, '4. Informativa e dichiarazione di consenso');
  bullets(doc, [
    'Tipologia dei dati e finalità: dati personali, eventualmente sensibili, necessari all\'espletamento del mandato.',
    'Ambito di comunicazione: enti o organismi pubblici e privati e organismi aderenti ad ACLI.',
    'Modalità: trattamento manuale e/o automatizzato, nel rispetto degli artt. 31 e seguenti della Legge.',
    'Necessità del conferimento: essenziale per l\'adempimento del mandato.',
    'Diritti: accesso, rettifica, cancellazione, limitazione, opposizione e reclamo al Garante.',
    'Titolare e responsabile: ACLI sez. Ceglie del Campo, Piazza Vittorio Emanuele 70129 BARI (BA); responsabile il Direttore di Sezione.'
  ]);

  signature(doc, data);
  footer(doc, 'C.S.I. · Informativa e consenso privacy');
  doc.end();
  return doc;
}

function toBuffer(doc) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    doc.on('data', function (c) { chunks.push(c); });
    doc.on('end', function () { resolve(Buffer.concat(chunks)); });
    doc.on('error', reject);
  });
}

function build(kind, data) {
  const doc = kind === 'privacy' ? privacy(data || {}) : mandato(data || {});
  return toBuffer(doc);
}

module.exports = { build };
