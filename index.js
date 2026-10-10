import { runMidasbuyBitcashBot } from './src/bot/topupBot.js';

const BOT_CONFIG = {
  midasbuy: {
    email: 'Botfordevinblack@hotmail.com',
    password: 'testdev123'
  },
  player: {
    uid: '5250140737488366145',
    server: 'Empire#239'
  },
  bitcash: {
    id: 'Inblackm7',
    password: 'kanomtandede@7'
  },
  hotmail: {
    email: 'Inblackbitcash7g@hotmail.com',
    password: 'Tishaluna123'
  }
};

async function main() {
  console.log('==================================================');
  console.log('🤖 เริ่มต้นระบบบอทเติมเกม Age of Empires Mobile');
  console.log('==================================================');

  try {
    const result = await runMidasbuyBitcashBot(BOT_CONFIG);
    console.log('\n✅ สรุปผลการทำรายการสำเร็จ:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n🔴 การทำรายการล้มเหลว:', error.message);
    process.exit(1);
  }
}

main();