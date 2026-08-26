require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require', ''),
  connectionTimeoutMillis: 15000,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('Тестирование подключения...');
    const client = await pool.connect();
    console.log('Подключено!');
    
    const result = await client.query('SELECT NOW()');
    console.log('Время сервера:', result.rows[0].now);
    
    client.release();
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
