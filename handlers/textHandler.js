const { Markup } = require('telegraf');
const { findRecipes } = require('../supabase');
const { generateRecipe } = require('../services/aiService');

module.exports = async (ctx) => {
  const text = ctx.message.text;

  switch (text) {
    case '🥘 По ингредиентам':
      return ctx.reply('Напишите продукты через запятую, например:\nяйца, сыр, помидоры');

    case '🎲 Случайный':
      return require('../commands/random')(ctx);

    case '📅 Меню на неделю':
      if (ctx.user.subscription === 'free') {
        return ctx.reply('📅 Меню на неделю доступно по подписке.\nОформите /subscribe');
      }
      return ctx.reply('📅 Меню на неделю — в разработке');

    case '⭐ Избранное':
      return require('../commands/favorites')(ctx);

    case '⚙️ Настройки':
      return require('../commands/settings')(ctx);

    case '💎 Подписка':
      return require('../commands/subscribe')(ctx);
  }

  // Парсинг ввода
  const rawWords = text.toLowerCase()
    .split(/,|и|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 1);

  if (rawWords.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  const user = ctx.user;
  if (user.subscription === 'free' && user.daily_requests >= 3) {
    return ctx.reply(`🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`,
      Markup.inlineKeyboard([[Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]])
    );
  }

  try {
    // Ищем рецепты
    const { recipes, mode } = await findRecipes(rawWords);

    if (recipes.length === 0) {
      // AI fallback
      const msg = await ctx.reply('🔍 Не нашёл в базе. Генерирую рецепт специально для вас...');
      const recipe = await generateRecipe(rawWords);
      await ctx.deleteMessage(msg.message_id).catch(() => {});

      if (recipe) {
        const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${(recipe.instructions || []).map((step, i) => `${i + 1}. ${step}`).join('\n')}`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
          [Markup.button.callback('💾 В избранное', `fav_${recipe.id}`)]
        ]);

        return ctx.reply(message, keyboard);
      }

      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено. Попробуйте другие названия.');
    }

    // Увеличиваем счетчик запросов
    await ctx.supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    // Формируем ответ
    const header = mode === 'strict'
      ? `✅ Нашёл рецепты со всеми ингредиентами:`
      : `⚡ Нашёл похожие (не всё есть, но можно адаптировать):`;

    const buttons = recipes.map(r => {
      return [Markup.button.callback(`🍳 ${r.name_ru} (${r.matchedCount}/${r.totalWords}, ${r.percent}%)`, `recipe_${r.id}`)];
    });

    await ctx.reply(header, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка поиска:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
