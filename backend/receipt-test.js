const receiptGenerator = require('./src/services/receiptGenerator');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const receiptData = {
      items: [
        { name: 'Widget', quantity: 2, price: 50 },
        { name: 'Service', quantity: 1, price: 100 }
      ],
      total: 200,
      businessName: 'Test Business',
      businessAddress: '123 Main St, City',
      receiptColor: '#FF6B6B',
      receiptText: 'Sold 2 widgets and 1 service.'
    };

    const invoiceData = {
      invoiceNumber: 'INV-123',
      items: [
        { name: 'Widget', quantity: 2, price: 50 },
        { name: 'Service', quantity: 1, price: 100 }
      ],
      total: 200,
      businessName: 'Test Business',
      businessAddress: '123 Main St, City',
      receiptColor: '#4ECDC4',
      invoiceText: 'Invoice for widget and service purchase.'
    };

    console.log('Generating receipt assets...');
    const receiptAssets = await receiptGenerator.generateReceiptAssets(receiptData);
    console.log('Receipt PNG length:', receiptAssets.pngBuffer.length);
    console.log('Receipt PDF length:', receiptAssets.pdfBuffer.length);
    console.log('Generating invoice assets...');
    const invoiceAssets = await receiptGenerator.generateInvoiceAssets(invoiceData);
    console.log('Invoice PNG length:', invoiceAssets.pngBuffer.length);
    console.log('Invoice PDF length:', invoiceAssets.pdfBuffer.length);

    const docsDir = path.resolve(__dirname, 'tmp-docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);
    const receiptPdfPath = path.join(docsDir, 'test-receipt.pdf');
    const receiptPngPath = path.join(docsDir, 'test-receipt.png');
    const invoicePdfPath = path.join(docsDir, 'test-invoice.pdf');
    const invoicePngPath = path.join(docsDir, 'test-invoice.png');
    fs.writeFileSync(receiptPdfPath, receiptAssets.pdfBuffer);
    fs.writeFileSync(receiptPngPath, receiptAssets.pngBuffer);
    fs.writeFileSync(invoicePdfPath, invoiceAssets.pdfBuffer);
    fs.writeFileSync(invoicePngPath, invoiceAssets.pngBuffer);
    console.log('Wrote test files to', docsDir);
    console.log('Files exist:', {
      receiptPdf: fs.existsSync(receiptPdfPath),
      receiptPng: fs.existsSync(receiptPngPath),
      invoicePdf: fs.existsSync(invoicePdfPath),
      invoicePng: fs.existsSync(invoicePngPath)
    });
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
