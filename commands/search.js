const { Markup } = require('telegraf');
const { resolveIngredients } = require('../supabase');

module.exports = async (ctx) => {
  const user = ctx.user;
  const args = ctx.message.text.split(' ').slice(1);
  const ingredientsText = args.join(' ');

  if (!ingredientsText) {
    return ctx.reply('Напишите продукты через запятую, например:\n/search яйца, сыр, помидоры');
  }

  if (user.subscription === 'free' && user.daily_requests >= 3) {
    const message = `🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`;

    return ctx.reply(message, Markup.inlineKeyboard([
      [Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]
    ]));
  }

  const rawIngredients = ingredientsText.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  const ingredients = resolveIngredients(rawIngredients);

  if (ingredients.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  try {
    // Ищем ингредиенты
    const { data: foundIngs } = await ctx.supabase
      .from('ingredients')
      .select('id, name_ru')
      .in('name_ru', ingredients);

    if (!foundIngs || foundIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const ingIds = foundIngs.map(i => i.id);

    // Ищем рецепты
    const { data: recipeIngs } = await ctx.supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredients(name_ru)')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Считаем совпадения
    const recipeCounts = {};
    for (const ri of recipeIngs) {
      recipeCounts[ri.recipe_id] = (recipeCounts[ri.recipe_id] || 0) + 1;
    }

    // Сортируем по количеству совпадений
    const sortedRecipes = Object.entries(recipeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Увеличиваем счетчик
    await ctx.supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    // Получаем рецепты
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
