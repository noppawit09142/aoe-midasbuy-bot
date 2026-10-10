import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fetchBitcashOTP } from '../services/otpService.js';
import fs from 'fs';
import path from 'path';

// ติดตั้ง Stealth Plugin เพื่อซ่อนตัวบอทจากการตรวจจับ
chromium.use(stealthPlugin());

/**
 * ฟังก์ชันหลักสำหรับรันบอทเติมเกมผ่าน Midasbuy JP และชำระเงินด้วย Bitcash
 * @param {Object} config - ข้อมูล Credential และ UID
 */
export async function runMidasbuyBitcashBot(config) {
  const browser = await chromium.launch({
    headless: false, // ปรับเป็น true เมื่อรันบน Production
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=ja-JP'
    ]
  });

  const context = await browser.newContext({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    console.log('🚀 [Step 1] เข้าสู่เว็บไซต์ Midasbuy Japan (Age of Empires Mobile)...');
    await page.goto('https://www.midasbuy.com/midasbuy/jp/buy/aoem', { waitUntil: 'networkidle' });

    // ปิดหน้าต่าง Cookie Banner (ถ้ามี)
    const cookieAccept = page.locator('button:has-text("Accept All"), button:has-text("同意する")');
    if (await cookieAccept.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieAccept.click();
    }

    // [Step 2] Login Midasbuy Account
    console.log('🔑 [Step 2] ล็อกอิน Midasbuy Account...');
    const loginTrigger = page.locator('.sign-in-btn, button:has-text("ログイン"), .header-login-btn').first();
    if (await loginTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginTrigger.click();
      await page.fill('input[type="email"], input[name="email"]', config.midasbuy.email);
      await page.fill('input[type="password"], input[name="password"]', config.midasbuy.password);
      await page.click('button[type="submit"], .login-btn');
      await page.waitForTimeout(2000);
    }

    // [Step 3] กรอกข้อมูล Player UID และ Server
    console.log(`🎮 [Step 3] กรอกข้อมูล Player UID: ${config.player.uid}...`);
    const editUidBtn = page.locator('.player-id-input-trigger, .edit-uid-btn, text="IDを入力"').first();
    if (await editUidBtn.isVisible().catch(() => false)) {
      await editUidBtn.click();
    }
    await page.fill('input[placeholder*="Player ID"], input[placeholder*="ID"]', config.player.uid);
    await page.click('button:has-text("OK"), button:has-text("確定")');
    await page.waitForTimeout(1500);

    // [Step 4] เลือกแพ็กเกจ 99+109 Coin (ราคา 146 JPY)
    console.log('📦 [Step 4] เลือกแพ็กเกจ 99+109 Coin (ราคา 146 JPY)...');
    const packItem = page.locator('.shop-item-card, .price-item, .item-card', { hasText: '99+109' }).first();
    await packItem.scrollIntoViewIfNeeded();
    await packItem.click();

    // [Step 5] เลือกช่องทางการชำระเงิน Bitcash
    console.log('💳 [Step 5] เลือกช่องทาง Bitcash และกด Pay...');
    const bitcashOption = page.locator('text="Bitcash"').first();
    await bitcashOption.click();

    const payBtn = page.locator('button:has-text("Pay"), button:has-text("支払う"), .pay-btn').first();
    await payBtn.click();

    // [Step 5.1] สลับเข้าสู่หน้า Bitcash Gateway
    console.log('🌐 [Step 5.1] นำทางไปยัง Gateway ชำระเงิน Bitcash...');
    await page.waitForURL(/bitcash/, { timeout: 30000 });

    // [Step 5.2] เลือก MyBitCash และกรอก ID / Password
    console.log('🔐 [Step 5.2] เลือก MyBitCash และกรอกข้อมูลล็อกอิน...');
    const myBitcashOpt = page.locator('text="MyBitCash", text="マイビットキャッシュ"').first();
    if (await myBitcashOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myBitcashOpt.click();
    }

    await page.fill('input[name*="id"], input[type="text"]', config.bitcash.id);
    await page.fill('input[type="password"]', config.bitcash.password);
    await page.click('button[type="submit"], input[type="submit"]');

    // [Step 5.3] รอรับและกรอก OTP จาก Hotmail
    console.log('📩 [Step 5.3] ดึงรหัส OTP จาก Hotmail อัตโนมัติ...');
    const otpCode = await fetchBitcashOTP(config.hotmail.email, config.hotmail.password);
    console.log(`⌨️ กรอกรหัส OTP: ${otpCode}`);

    await page.fill('input[name*="otp"], input[name*="code"], input[type="number"]', otpCode);
    await page.click('button[type="submit"], input[type="submit"]');

    // [Step 5.4] รอหน้าทำรายการเสร็จสิ้น และสกัดข้อมูลใบเสร็จ
    console.log('🎉 [Step 5.4] ยืนยันการชำระเงิน ดึงข้อมูลใบเสร็จ...');
    await page.waitForSelector('text="お支払いが完了しました"', { timeout: 30000 });

    const invoiceNoText = await page.locator('xpath=//*[contains(text(),"請求番号") or contains(text(),"Invoice No")]/following-sibling::* | //*[contains(text(),"INV")]').innerText().catch(() => 'N/A');
    const paidAmountText = await page.locator('xpath=//*[contains(text(),"お支払い額")]/following-sibling::*').innerText().catch(() => '146 JPY');
    const remainingBalanceText = await page.locator('xpath=//*[contains(text(),"マイビットキャッシュ残高")]/following-sibling::*').innerText().catch(() => 'N/A');

    const invoiceNo = invoiceNoText.trim();
    const paidAmount = paidAmountText.trim();
    const remainingBalance = remainingBalanceText.trim();

    console.log('\n========================================');
    console.log(`🧾 Invoice No: ${invoiceNo}`);
    console.log(`💰 Paid Amount: ${paidAmount}`);
    console.log(`🏦 Remaining Balance: ${remainingBalance}`);
    console.log('========================================\n');

    const screenshotDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const cleanInvoiceNo = invoiceNo.replace(/[^a-zA-Z0-9]/g, '_') || Date.now();
    const screenshotPath = path.join(screenshotDir, `invoice_${cleanInvoiceNo}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 บันทึกรูปภาพใบเสร็จเรียบร้อยที่: ${screenshotPath}`);

    await browser.close();

    return {
      status: 'SUCCESS',
      invoiceNo,
      paidAmount,
      remainingBalance,
      screenshotPath
    };

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดระหว่างรันบอท:', error.message);
    const errorDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });
    await page.screenshot({ path: path.join(errorDir, `error_${Date.now()}.png`), fullPage: true }).catch(() => {});
    await browser.close();
    throw error;
  }
}