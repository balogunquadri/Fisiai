(async () => {
  process.env.TELEGRAM_BOT_TOKEN = '8834229152:AAHDZ2yzF00-CkkQ7wjVIfwP4x8MRLXNhhI';
  const TelegramService = require('./src/services/TelegramService');
  const aiAgentService = require('./src/services/aiAgentService');
  const receiptGenerator = require('./src/services/receiptGenerator');
  const axios = require('axios');
  
  console.log('🧪 END-TO-END TEST WITH REAL TOKEN\n');
  
  // Test 1: Parse Telegram voice message
  console.log('1️⃣  PARSING TELEGRAM VOICE MESSAGE...');
  const voicePayload = {
    message: {
      message_id: 1,
      date: 1691200000,
      chat: { id: 7731103085 },
      from: { id: 1234, username: 'testuser' },
      voice: { file_id: 'AwAC0gADKgCeEkl_Qv_5XkFTZs-AAAAA', mime_type: 'audio/ogg' }
    }
  };
  const voiceMsg = TelegramService.parseIncomingTelegram(voicePayload);
  console.log('✓ Voice message parsed:', { type: voiceMsg.type, chatId: voiceMsg.chatId, audio: !!voiceMsg.audio });
  
  // Test 2: Parse Telegram image message
  console.log('\n2️⃣  PARSING TELEGRAM IMAGE MESSAGE...');
  const imagePayload = {
    message: {
      message_id: 2,
      date: 1691200000,
      chat: { id: 7731103085 },
      from: { id: 1234, username: 'testuser' },
      photo: [{ file_id: 'AgADAgAD0qcxG_dU5Fa8KN7RxcKBaIkqrzQABOPvB_DfuXTFmTQBAAEC' }]
    }
  };
  const imageMsg = TelegramService.parseIncomingTelegram(imagePayload);
  console.log('✓ Image message parsed:', { type: imageMsg.type, chatId: imageMsg.chatId, image: !!imageMsg.image });
  
  // Test 3: Download media with real token
  console.log('\n3️⃣  DOWNLOADING MEDIA WITH REAL TOKEN...');
  try {
    const voiceResult = await aiAgentService.downloadAndParseMedia(voiceMsg, 'telegram');
    if (voiceResult) {
      console.log('✓ Voice download successful:', { bufferLength: voiceResult.buffer.length, mimeType: voiceResult.mimeType });
    } else {
      console.log('⚠ Voice download returned null (may need valid file_id)');
    }
  } catch (err) {
    console.log('⚠ Voice download error (expected if file_id invalid):', err.message);
  }
  
  try {
    const imageResult = await aiAgentService.downloadAndParseMedia(imageMsg, 'telegram');
    if (imageResult) {
      console.log('✓ Image download successful:', { bufferLength: imageResult.buffer.length, mimeType: imageResult.mimeType });
    } else {
      console.log('⚠ Image download returned null (may need valid file_id)');
    }
  } catch (err) {
    console.log('⚠ Image download error (expected if file_id invalid):', err.message);
  }
  
  // Test 4: Generate receipt assets
  console.log('\n4️⃣  GENERATING RECEIPT ASSETS...');
  try {
    const receiptData = {
      items: [
        { name: 'Item 1', quantity: 2, price: 50 },
        { name: 'Item 2', quantity: 1, price: 100 }
      ],
      total: 200,
      businessName: 'Test Business',
      businessAddress: '123 Main St, City',
      receiptColor: '#FF6B6B'
    };
    const receiptAssets = await receiptGenerator.generateReceiptAssets(receiptData);
    console.log('✓ Receipt generated:', { 
      pngBuffer: receiptAssets.pngBuffer ? receiptAssets.pngBuffer.length + ' bytes' : 'null',
      pdfBuffer: receiptAssets.pdfBuffer ? receiptAssets.pdfBuffer.length + ' bytes' : 'null'
    });
  } catch (err) {
    console.log('✗ Receipt generation error:', err.message);
  }
  
  // Test 5: Generate invoice assets
  console.log('\n5️⃣  GENERATING INVOICE ASSETS...');
  try {
    const invoiceData = {
      invoiceNumber: 'INV-001',
      items: [
        { name: 'Service A', quantity: 1, price: 500 }
      ],
      total: 500,
      businessName: 'Test Business',
      businessAddress: '123 Main St, City',
      receiptColor: '#4ECDC4'
    };
    const invoiceAssets = await receiptGenerator.generateInvoiceAssets(invoiceData);
    console.log('✓ Invoice generated:', { 
      pngBuffer: invoiceAssets.pngBuffer ? invoiceAssets.pngBuffer.length + ' bytes' : 'null',
      pdfBuffer: invoiceAssets.pdfBuffer ? invoiceAssets.pdfBuffer.length + ' bytes' : 'null'
    });
  } catch (err) {
    console.log('✗ Invoice generation error:', err.message);
  }
  
  console.log('\n✅ END-TO-END TEST COMPLETE');
  process.exit(0);
})().catch(e => {
  console.error('❌ TEST FAILED:', e.message);
  console.error(e);
  process.exit(1);
});
