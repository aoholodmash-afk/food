require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Подключение к базе данных...');
    const client = await pool.connect();
    console.log('Подключено!');
    
    await client.query(schema);
    console.log('Таблицы успешно созданы!');
    
    client.release();
  } catch (error) {
    console.error('Ошибка создания таблиц:', error.message);
  } finally {
    await pool.end();
  }
}

runSchema();
