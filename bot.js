require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const http = require('http');
const supabase = require('./supabase');

// HTTP-сервер для Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

const bot = new Telegraf(process.env.BOT_TOKEN);

// Middleware
bot.use(session());

bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const telegramId = ctx.from.id;
  ctx.supabase = supabase;
  ctx.telegramId = telegramId;

  try {
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      const { data } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          username: ctx.from.username,
          first_name: ctx.from.first_name
        })
        .select()
        .single();
      user = data;
    }

    ctx.user = user;

    // Сброс дневного счетчика
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastRequest = new Date(user.last_request_date);
    lastRequest.setHours(0, 0, 0, 0);

    if (lastRequest < today) {
      await supabase
        .from('users')
        .update({ daily_requests: 0, last_request_date: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      ctx.user.daily_requests = 0;
    }
  } catch (error) {
    console.error('Ошибка middleware:', error.message);
  }

  return next();
});

// Команды
const startCommand = require('./commands/start');
const recipeCommand = require('./commands/recipe');
const randomCommand = require('./commands/random');
const searchCommand = require('./commands/search');
const favoritesCommand = require('./commands/favorites');
const settingsCommand = require('./commands/settings');
const subscribeCommand = require('./commands/subscribe');
const helpCommand = require('./commands/help');

// Обработчики
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

bot.on('text', textHandler);
bot.on('callback_query', callbackHandler);

bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err.message);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});

// Запуск
bot.launch();
console.log('Бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
