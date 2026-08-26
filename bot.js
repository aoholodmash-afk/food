require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');

// HTTP-сервер для Render (требует открытый порт)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

// Парсим DATABASE_URL и принудительно используем IPv4
const dbUrl = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 5432,
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: dbUrl.password,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// Логирование всех обновлений
bot.use(async (ctx, next) => {
  console.log('Получено обновление:', ctx.updateType, ctx.message?.text || '');
  return next();
});

// Middleware для сессий
bot.use(session());

// Middleware для проверки пользователя и лимитов
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const telegramId = ctx.from.id;
  ctx.pool = pool;
  ctx.telegramId = telegramId;

  try {
    let result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    let user = result.rows[0];

    if (!user) {
      result = await pool.query(
        'INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) RETURNING *',
        [telegramId, ctx.from.username, ctx.from.first_name]
      );
      user = result.rows[0];
    }

    ctx.user = user;

    // Проверка сброса дневного счетчика
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastRequest = new Date(user.last_request_date);
    lastRequest.setHours(0, 0, 0, 0);

    if (lastRequest < today) {
      await pool.query(
        'UPDATE users SET daily_requests = 0, last_request_date = CURRENT_DATE WHERE telegram_id = $1',
        [telegramId]
      );
      ctx.user.daily_requests = 0;
    }
  } catch (error) {
    console.error('Ошибка middleware:', error.message);
  }

  return next();
});

// Импорт команд
const startCommand = require('./commands/start');
const recipeCommand = require('./commands/recipe');
const randomCommand = require('./commands/random');
const searchCommand = require('./commands/search');
const favoritesCommand = require('./commands/favorites');
const settingsCommand = require('./commands/settings');
const subscribeCommand = require('./commands/subscribe');
const helpCommand = require('./commands/help');

// Импорт обработчиков
const textHandler = require('./handlers/textHandler');
const callbackHandler = require('./handlers/callbackHandler');

// Регистрация команд
bot.start(startCommand);
bot.command('recipe', recipeCommand);
bot.command('random', randomCommand);
bot.command('search', searchCommand);
bot.command('favorites', favoritesCommand);
bot.command('settings', settingsCommand);
bot.command('subscribe', subscribeCommand);
bot.command('help', helpCommand);

// Обработка текстовых сообщений
bot.on('text', textHandler);

// Обработка callback-кнопок
bot.on('callback_query', callbackHandler);

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err.message);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});

// Запуск бота
const startBot = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Подключение к базе данных установлено');

    bot.launch();
    console.log('Бот запущен в режиме polling');

    process.once('SIGINT', () => {
      bot.stop('SIGINT');
      pool.end();
    });
    process.once('SIGTERM', () => {
      bot.stop('SIGTERM');
      pool.end();
    });
  } catch (error) {
    console.error('Ошибка запуска бота:', error.message);
    process.exit(1);
  }
};

startBot();
