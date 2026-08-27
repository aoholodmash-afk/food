const { Markup } = require('telegraf');
const { findRecipes } = require('../supabase');
const { generateRecipe } = require('../services/aiService');

module.exports = async (ctx) => {
  const user = ctx.user;
  const args = ctx.message.text.split(' ').slice(1);
  const ingredientsText = args.join(' ');

  if (!ingredientsText) {
    return ctx.reply('Напишите продукты через запятую, например:\n/search яйца, сыр, помидоры');
  }

  if (user.subscription === 'free' && user.daily_requests >= 3) {
    return ctx.reply(`🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`,
      Markup.inlineKeyboard([[Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]])
    );
  }

  const rawWords = ingredientsText.toLowerCase()
    .split(/,|и|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 1);

  if (rawWords.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  try {
    const { recipes, mode } = await findRecipes(rawWords);

    if (recipes.length === 0) {
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

      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    await ctx.supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    const header = mode === 'strict'
      ? `✅ Нашёл рецепты со всеми ингредиентами:`
      : `⚡ Нашёл похожие (не всё есть, но можно адаптировать):`;

    const buttons = recipes.map(r => {
      return [Markup.button.callback(`🍳 ${r.name_ru} (${r.matchedCount}/${r.totalWords}, ${r.percent}%)`, `recipe_${r.id}`)];
    });

    await ctx.reply(header, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
