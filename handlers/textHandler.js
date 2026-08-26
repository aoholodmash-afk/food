const { Markup } = require('telegraf');
const { supabase, resolveIngredients } = require('../supabase');

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

  // Парсинг ингредиентов
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
    // Fuzzy-поиск: ищем ингредиенты по частичному совпадению
    let allFoundIngs = [];

    for (const ing of ingredients) {
      const { data: found } = await supabase
        .from('ingredients')
        .select('id, name_ru')
        .ilike('name_ru', `%${ing}%`);

      if (found && found.length > 0) {
        allFoundIngs.push(...found);
      }
    }

    // Убираем дубликаты
    const uniqueIngs = [];
    const seenIds = new Set();
    for (const ing of allFoundIngs) {
      if (!seenIds.has(ing.id)) {
        seenIds.add(ing.id);
        uniqueIngs.push(ing);
      }
    }

    if (uniqueIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено. Попробуйте другие названия.');
    }

    const ingIds = uniqueIngs.map(i => i.id);

    // Ищем рецепты с любым из ингредиентов
    const { data: recipeIngs } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Считаем совпадения
    const recipeCounts = {};
    for (const ri of recipeIngs) {
      recipeCounts[ri.recipe_id] = (recipeCounts[ri.recipe_id] || 0) + 1;
    }

    // Сортируем по количеству совпадений (больше = лучше)
    const sortedRecipes = Object.entries(recipeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Увеличиваем счетчик запросов
    await supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    // Получаем рецепты
    const recipeIds = sortedRecipes.map(r => parseInt(r[0]));
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds);

    if (!recipes || recipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Сортируем рецепты в правильном порядке
    const recipeMap = {};
    recipes.forEach(r => { recipeMap[r.id] = r; });
    const orderedRecipes = recipeIds.map(id => recipeMap[id]).filter(Boolean);

    const totalIngs = ingredients.length;
    const message = `🔍 Найдено ${orderedRecipes.length} рецептов (из ${totalIngs} продуктов):`;

    const buttons = orderedRecipes.map(r => {
      const count = recipeCounts[r.id];
      const percent = Math.round((count / totalIngs) * 100);
      return [Markup.button.callback(`🍳 ${r.name_ru} (${count}/${totalIngs}, ${percent}%)`, `recipe_${r.id}`)];
    });

    await ctx.reply(message, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка поиска:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
