const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeColor(color) {
  if (!color || typeof color !== 'string') return '#14b8a6';
  const normalized = color.trim().toLowerCase();

  // Friendly named palette (user-visible names -> hex)
  const PALETTE = {
    teal: '#14b8a6',
    emerald: '#10b981',
    sky: '#0ea5e9',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    rose: '#fb7185',
    amber: '#f59e0b',
    lime: '#84cc16',
    slate: '#64748b',
    slategray: '#64748b',
    blue: '#2563eb',
    green: '#10b981',
    pink: '#ec4899',
    red: '#ef4444',
    orange: '#fb923c',
    charcoal: '#0f172a',
    black: '#000000',
    white: '#ffffff',
  };

  // direct palette lookup
  if (PALETTE[normalized]) return PALETTE[normalized];

  // hex like formats
  const match = normalized.match(/^#?([0-9a-f]{6})$/i);
  if (match) return `#${match[1]}`;

  // fallback
  return '#14b8a6';
}

function hexToRgb(hex) {
  const hexClean = hex.replace('#', '');
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);
  return { r, g, b };
}

function lightenHex(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const newR = Math.round(r + (255 - r) * percent);
  const newG = Math.round(g + (255 - g) * percent);
  const newB = Math.round(b + (255 - b) * percent);
  return '#' + [newR, newG, newB].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function buildReceiptSvg({ businessName, businessAddress, receiptLines, total, receiptColor, logoPath }) {
  const safeName = escapeXml(businessName || 'Your Business');
  const safeAddress = escapeXml(businessAddress || 'No address provided');
  const safeColor = normalizeColor(receiptColor);
  const accentLight = lightenHex(safeColor, 0.7);
  const lines = [
    `Receipt for ${safeName}`,
    safeAddress,
    '',
    ...receiptLines.map((line) => escapeXml(line)),
    '',
    `Total: ${escapeXml(total || 'N/A')}`,
  ];

  const width = 1200;
  const lineHeight = 48;
  const paddingTop = 120;
  const paddingBottom = 80;
  const height = paddingTop + paddingBottom + lines.length * lineHeight;
  const titleColor = safeColor;

  const textElements = lines
    .map((line, index) => {
      return `<tspan x="60" dy="${index === 0 ? '0' : '1.2em'}">${line}</tspan>`;
    })
    .join('');

  // If a logoPath is provided and exists, read and embed as data URL
  let logoImageTag = '';
  try {
    if (logoPath) {
      const docsRoot = path.resolve(__dirname, '..', '..', 'tmp-docs');
      // logoPath is expected like '/docs/uploads/merchant-logo-<id>.png'
      const rel = logoPath.replace(/^\/docs\//, '');
      const absolute = path.join(docsRoot, rel.replace(/\//g, path.sep));
      if (fs.existsSync(absolute)) {
        const imgBuf = fs.readFileSync(absolute);
        const ext = path.extname(absolute).substring(1) || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        const dataUri = `data:image/${mime};base64,${imgBuf.toString('base64')}`;
        // Place logo in top-right corner
        logoImageTag = `<image x="${1200 - 240}" y="60" width="160" height="80" href="${dataUri}" preserveAspectRatio="xMidYMid meet" />`;
      }
    }
  } catch (err) {
    console.warn('Failed to embed logo:', err && err.message ? err.message : err);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${titleColor}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${accentLight}" stop-opacity="0.9" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.15" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#f6f7fb" />
  <g filter="url(#shadow)">
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="28" fill="url(#g)" />
  </g>
  <rect x="40" y="40" width="${width - 80}" height="150" rx="24" fill="${titleColor}" opacity="0.06" />
  <text x="60" y="110" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="${titleColor}">${escapeXml('RECEIPT')}</text>
  ${logoImageTag}
  <text x="60" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#374151">${escapeXml('Business')}:</text>
  <text x="220" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#111827">${safeName}</text>
  <text x="60" y="200" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#6b7280">${safeAddress}</text>
  <g transform="translate(0,40)">
    <text x="60" y="260" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">
      ${textElements}
    </text>
  </g>
  <rect x="60" y="${height - paddingBottom + 10}" width="${width - 120}" height="6" rx="3" fill="#ffffff" opacity="0.15" />
  <text x="60" y="${height - paddingBottom + 70}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#0f172a">Total: ${escapeXml(total || 'N/A')}</text>
  <text x="60" y="${height - paddingBottom + 120}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#9ca3af">Generated by FisiAI</text>
</svg>`;
}

async function createPdfFromJpegBuffer(jpegBuffer, width, height) {
  const header = Buffer.from('%PDF-1.3\n%\xFF\xFF\xFF\xFF\n');

  const contentsStream = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;

  const catalog = Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  const pages = Buffer.from(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  const page = Buffer.from(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`);
  const image = Buffer.concat([
    Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`),
    jpegBuffer,
    Buffer.from('\nendstream\nendobj\n'),
  ]);
  const contents = Buffer.from(`5 0 obj\n<< /Length ${Buffer.byteLength(contentsStream)} >>\nstream\n${contentsStream}endstream\nendobj\n`);

  const objects = [catalog, pages, page, image, contents];

  let pos = header.length;
  const xrefEntries = ['0000000000 65535 f \n'];
  for (const obj of objects) {
    xrefEntries.push(String(pos).padStart(10, '0') + ' 00000 n \n');
    pos += obj.length;
  }

  const xref = Buffer.from(`xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}`);
  const trailer = Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`);

  return Buffer.concat([header, ...objects, xref, trailer]);
}

async function generateReceiptAssets({ businessName, businessAddress, receiptText, total, receiptColor, logoPath }) {
  const lines = receiptText
    ? receiptText.split(/\n|\r\n|\|/).map((line) => line.trim()).filter(Boolean)
    : ['No receipt details provided.'];

  const svg = buildReceiptSvg({
    businessName,
    businessAddress,
    receiptLines: lines,
    total,
    receiptColor,
    logoPath,
  });

  const svgBuffer = Buffer.from(svg, 'utf8');
  const pngBuffer = await sharp(svgBuffer)
    .png()
    .toBuffer();

  const jpegBuffer = await sharp(svgBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const linesCount = lines.length;
  const height = 120 + 80 + linesCount * 48;
  const pdfBuffer = await createPdfFromJpegBuffer(jpegBuffer, 1200, height);

  return { pngBuffer, pdfBuffer };
}

function buildInvoiceSvg({ businessName, businessAddress, invoiceLines, total, receiptColor, invoiceNumber, logoPath }) {
  const safeName = escapeXml(businessName || 'Your Business');
  const safeAddress = escapeXml(businessAddress || 'No address provided');
  const safeColor = normalizeColor(receiptColor);
  const accentLight = lightenHex(safeColor, 0.7);
  const safeInvoiceNumber = escapeXml(invoiceNumber || `INV-${Date.now()}`);
  const lines = [
    `Invoice Number: ${safeInvoiceNumber}`,
    `Date: ${new Date().toLocaleDateString()}`,
    '',
    `Bill To: ${safeName}`,
    safeAddress,
    '',
    ...invoiceLines.map((line) => escapeXml(line)),
    '',
    `Total Due: ${escapeXml(total || 'N/A')}`,
  ];

  const width = 1200;
  const lineHeight = 48;
  const paddingTop = 120;
  const paddingBottom = 80;
  const height = paddingTop + paddingBottom + lines.length * lineHeight;
  const titleColor = safeColor;

  // Try to read and embed logo
  let logoImageTag = '';
  try {
    if (logoPath) {
      const docsRoot = path.resolve(__dirname, '..', '..', 'tmp-docs');
      const rel = logoPath.replace(/^\/docs\//, '');
      const absolute = path.join(docsRoot, rel.replace(/\//g, path.sep));
      if (fs.existsSync(absolute)) {
        const imgBuf = fs.readFileSync(absolute);
        const ext = path.extname(absolute).substring(1) || 'png';
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        const dataUri = `data:image/${mime};base64,${imgBuf.toString('base64')}`;
        logoImageTag = `<image x="${1200 - 240}" y="60" width="160" height="80" href="${dataUri}" preserveAspectRatio="xMidYMid meet" />`;
      }
    }
  } catch (err) {
    console.warn('Failed to embed logo:', err && err.message ? err.message : err);
  }

  const textElements = lines
    .map((line, index) => {
      return `<tspan x="60" dy="${index === 0 ? '0' : '1.2em'}">${line}</tspan>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gi" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${titleColor}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${accentLight}" stop-opacity="0.9" />
    </linearGradient>
    <filter id="shadowi" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#000" flood-opacity="0.12" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#f6f7fb" />
  <g filter="url(#shadowi)">
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="28" fill="url(#gi)" />
  </g>
  <rect x="40" y="40" width="${width - 80}" height="150" rx="24" fill="${titleColor}" opacity="0.06" />
  <text x="60" y="110" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="${titleColor}">${escapeXml('INVOICE')}</text>
  ${logoImageTag}
  <text x="60" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#374151">${escapeXml('Business')}:</text>
  <text x="220" y="160" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#111827">${safeName}</text>
  <text x="60" y="200" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#6b7280">${safeAddress}</text>
  <g transform="translate(0,40)">
    <text x="60" y="260" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">
      ${textElements}
    </text>
  </g>
  <rect x="60" y="${height - paddingBottom + 10}" width="${width - 120}" height="6" rx="3" fill="#ffffff" opacity="0.15" />
  <text x="60" y="${height - paddingBottom + 70}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#0f172a">Total Due: ${escapeXml(total || 'N/A')}</text>
  <text x="60" y="${height - paddingBottom + 120}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#9ca3af">Generated by FisiAI</text>
</svg>`;
}

async function generateInvoiceAssets({ businessName, businessAddress, invoiceText, total, receiptColor, invoiceNumber, logoPath }) {
  const lines = invoiceText
    ? invoiceText.split(/\n|\r\n|\|/).map((line) => line.trim()).filter(Boolean)
    : ['No invoice details provided.'];

  const svg = buildInvoiceSvg({
    businessName,
    businessAddress,
    invoiceLines: lines,
    total,
    receiptColor,
    invoiceNumber,
    logoPath,
  });

  const svgBuffer = Buffer.from(svg, 'utf8');
  const pngBuffer = await sharp(svgBuffer)
    .png()
    .toBuffer();

  const jpegBuffer = await sharp(svgBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const svgHeight = 120 + 80 + lines.length * 48;
  const pdfBuffer = await createPdfFromJpegBuffer(jpegBuffer, 1200, svgHeight);

  return { pngBuffer, pdfBuffer };
}

module.exports = {
  generateReceiptAssets,
  generateInvoiceAssets,
};
