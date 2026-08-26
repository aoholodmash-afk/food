const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const text = ctx.message.text;

  // Обработка кнопок Reply Keyboard
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

  // Если текст не кнопка — считаем ингредиентами
  const ingredients = text
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  if (ingredients.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  // Проверка лимита
  const user = ctx.user;
  if (user.subscription === 'free' && user.daily_requests >= 3) {
    const message = `🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]
    ]);

    return ctx.reply(message, keyboard);
  }

  try {
    // Поиск рецептов
    const recipesResult = await ctx.pool.query(`
      SELECT r.*, 
        COUNT(ri.ingredient_id) as matched_ingredients,
        ARRAY_AGG(i.name_ru) as ingredient_names
      FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE LOWER(i.name_ru) = ANY($1)
      GROUP BY r.id
      HAVING COUNT(ri.ingredient_id) >= 2
      ORDER BY matched_ingredients DESC, r.id
      LIMIT 5
    `, [ingredients]);

    const recipes = recipesResult.rows;

    if (recipes.length === 0) {
      // Пробуем найти хотя бы по одному ингредиенту
      const singleResult = await ctx.pool.query(`
        SELECT r.*, 
          COUNT(ri.ingredient_id) as matched_ingredients,
          ARRAY_AGG(i.name_ru) as ingredient_names
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE LOWER(i.name_ru) = ANY($1)
        GROUP BY r.id
        ORDER BY matched_ingredients DESC, r.id
        LIMIT 3
      `, [ingredients]);

      const singleRecipes = singleResult.rows;

      if (singleRecipes.length === 0) {
        return ctx.reply('К сожалению, рецептов с такими продуктами не найдено. Попробуйте другие продукты.');
      }

      const message = `🔍 Найдено ${singleRecipes.length} рецептов (по одному продукту):`;

      const buttons = singleRecipes.map(r => [
        Markup.button.callback(
          `🍳 ${r.name_ru} (${r.matched_ingredients} совп.)`,
          `recipe_${r.id}`
        )
      ]);

      const keyboard = Markup.inlineKeyboard(buttons);
      return ctx.reply(message, keyboard);
    }

    // Увеличиваем счетчик запросов
    await ctx.pool.query(
      'UPDATE users SET daily_requests = daily_requests + 1 WHERE telegram_id = $1',
      [user.telegram_id]
    );

    const message = `🔍 Найдено ${recipes.length} рецептов:`;

    const buttons = recipes.map(r => [
      Markup.button.callback(
        `🍳 ${r.name_ru} (${r.matched_ingredients} совп.)`,
        `recipe_${r.id}`
      )
    ]);

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.reply(message, keyboard);

  } catch (error) {
    console.error('Ошибка поиска рецептов:', error);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
