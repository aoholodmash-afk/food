const { Markup } = require('telegraf');
const { resolveIngredients } = require('../supabase');

module.exports = async (ctx) => {
  const text = ctx.message.text;

  switch (text) {
    case '🥘 По ингредиентам':
      return ctx.reply('Напишите продукты через запятую, например:\nяйца, сыр, помидоры');

    case '🎲 Случайный':
      return require('./commands/random')(ctx);

    case '📅 Меню на неделю':
      if (ctx.user.subscription === 'free') {
        return ctx.reply('📅 Меню на неделю доступно по подписке.\nОформите /subscribe');
      }
      return ctx.reply('📅 Меню на неделю — в разработке');

    case '⭐ Избранное':
      return require('./commands/favorites')(ctx);

    case '⚙️ Настройки':
      return require('./commands/settings')(ctx);

    case '💎 Подписка':
      return require('./commands/subscribe')(ctx);
  }

  // Считаем ингредиентами
  const rawIngredients = text.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  const ingredients = resolveIngredients(rawIngredients);

  if (ingredients.length === 0) {
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
    const { data: foundIngs } = await ctx.supabase
      .from('ingredients')
      .select('id, name_ru')
      .in('name_ru', ingredients);

    if (!foundIngs || foundIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const ingIds = foundIngs.map(i => i.id);

    const { data: recipeIngs } = await ctx.supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const recipeCounts = {};
    for (const ri of recipeIngs) {
      recipeCounts[ri.recipe_id] = (recipeCounts[ri.recipe_id] || 0) + 1;
    }

    const sortedRecipes = Object.entries(recipeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    await ctx.supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    const recipeIds = sortedRecipes.map(r => r[0]);
    const { data: recipes } = await ctx.supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds);

    const message = `🔍 Найдено ${recipes.length} рецептов:`;

    const buttons = recipes.map(r => {
      const count = recipeCounts[r.id];
      return [Markup.button.callback(`🍳 ${r.name_ru} (${count} совп.)`, `recipe_${r.id}`)];
    });

    await ctx.reply(message, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
