import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

/**
 * ดึงรหัส OTP 6 หลักจาก Hotmail ที่ส่งเข้ามาล่าสุดผ่าน IMAP
 */
export async function fetchBitcashOTP(email, password) {
  const config = {
    imap: {
      user: email,
      password: password,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  console.log('✉️ กำลังเชื่อมต่อ Hotmail IMAP เพื่อดึง OTP...');
  
  const startTime = Date.now();
  // ค้นหาอีเมลต่อเนื่องสูงสุด 60 วินาที
  while (Date.now() - startTime < 60000) {
    try {
      const connection = await imaps.connect(config);
      await connection.openBox('INBOX');

      const delay = 5 * 60 * 1000; // ย้อนหลังไม่เกิน 5 นาที
      const lastFiveMinutes = new Date(Date.now() - delay).toISOString();
      const searchCriteria = ['UNSEEN', ['SINCE', lastFiveMinutes]];
      const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true };

      const messages = await connection.search(searchCriteria, fetchOptions);

      for (const item of messages) {
        const all = item.parts.find(part => part.which === '');
        const id = item.attributes.uid;
        const idHeader = 'Imap-Id: ' + id;
        const mail = await simpleParser(all.body + '\n' + idHeader);

        const bodyText = mail.text || mail.html || '';
        const otpMatch = bodyText.match(/\b\d{6}\b/);
        
        if (otpMatch) {
          connection.end();
          console.log(`✅ พบรหัส OTP: ${otpMatch[0]}`);
          return otpMatch[0];
        }
      }

      connection.end();
    } catch (err) {
      console.log('⏳ กำลังรออีเมล OTP เข้าสู่ระบบ...', err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('❌ Timeout: ไม่ได้รับอีเมล OTP ภายใน 60 วินาที');
}