const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const user = ctx.user;

  try {
    // Просмотр рецепта
    if (data.startsWith('recipe_')) {
      const recipeId = parseInt(data.split('_')[1]);
      const recipeResult = await ctx.pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
      const recipe = recipeResult.rows[0];

      if (!recipe) {
        return ctx.answerCbQuery('Рецепт не найден');
      }

      const ingredientsResult = await ctx.pool.query(`
        SELECT i.name_ru, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
        ORDER BY ri.is_main DESC
      `, [recipeId]);

      const ingredients = ingredientsResult.rows
        .map(ri => `• ${ri.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n');

      const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingredients}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
        [
          Markup.button.callback('💾 В избранное', `fav_${recipe.id}`),
          Markup.button.callback('🔍 Ещё варианты', `more_${recipe.id}`)
        ]
      ]);

      if (recipe.image_url) {
        await ctx.replyWithPhoto(recipe.image_url, {
          caption: message,
          ...keyboard
        });
      } else {
        await ctx.reply(message, keyboard);
      }

      return ctx.answerCbQuery();
    }

    // Готовить — показать полный рецепт
    if (data.startsWith('cook_')) {
      const recipeId = parseInt(data.split('_')[1]);
      const recipeResult = await ctx.pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
      const recipe = recipeResult.rows[0];

      if (!recipe) {
        return ctx.answerCbQuery('Рецепт не найден');
      }

      const ingredientsResult = await ctx.pool.query(`
        SELECT i.name_ru, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
        ORDER BY ri.is_main DESC
      `, [recipeId]);

      const ingredients = ingredientsResult.rows
        .map(ri => `• ${ri.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n');

      const instructions = recipe.instructions
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n\n');

      const message = `🍳 ${recipe.name_ru}

📝 Ингредиенты:
${ingredients}

👨‍🍳 Приготовление:
${instructions}

💡 Совет: Приятного аппетита!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Поделиться', `share_${recipe.id}`)],
        [Markup.button.callback('🔙 Назад', `recipe_${recipe.id}`)]
      ]);

      await ctx.reply(message, keyboard);
      return ctx.answerCbQuery();
    }

    // Добавить в избранное
    if (data.startsWith('fav_')) {
      const recipeId = parseInt(data.split('_')[1]);

      const existingResult = await ctx.pool.query(
        'SELECT id FROM favorites WHERE user_id = $1 AND recipe_id = $2',
        [user.telegram_id, recipeId]
      );

      if (existingResult.rows.length > 0) {
        await ctx.pool.query('DELETE FROM favorites WHERE id = $1', [existingResult.rows[0].id]);
        return ctx.answerCbQuery('Удалено из избранного');
      }

      await ctx.pool.query(
        'INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)',
        [user.telegram_id, recipeId]
      );

      return ctx.answerCbQuery('Добавлено в избранное ⭐');
    }

    // Ещё варианты
    if (data.startsWith('more_')) {
      const recipeId = parseInt(data.split('_')[1]);
      const recipeResult = await ctx.pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
      const recipe = recipeResult.rows[0];

      if (!recipe) {
        return ctx.answerCbQuery('Рецепт не найден');
      }

      const ingredientsResult = await ctx.pool.query(`
        SELECT i.name_ru
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
      `, [recipeId]);

      const ingredientNames = ingredientsResult.rows.map(r => r.name_ru.toLowerCase());

      const similarResult = await ctx.pool.query(`
        SELECT r.*, 
          COUNT(ri.ingredient_id) as matched_ingredients
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE LOWER(i.name_ru) = ANY($1)
          AND r.id != $2
        GROUP BY r.id
        ORDER BY matched_ingredients DESC, r.id
        LIMIT 3
      `, [ingredientNames, recipeId]);

      const similarRecipes = similarResult.rows;

      if (similarRecipes.length === 0) {
        return ctx.answerCbQuery('Похожих рецептов не найдено');
      }

      const message = `🔍 Похожие рецепты:`;

      const buttons = similarRecipes.map(r => [
        Markup.button.callback(
          `🍳 ${r.name_ru} (${r.matched_ingredients} совп.)`,
          `recipe_${r.id}`
        )
      ]);

      const keyboard = Markup.inlineKeyboard(buttons);
      await ctx.reply(message, keyboard);
      return ctx.answerCbQuery();
    }

    // Случайный рецепт (кнопка)
    if (data === 'random_again') {
      const countResult = await ctx.pool.query('SELECT COUNT(*) FROM recipes');
      const recipesCount = parseInt(countResult.rows[0].count);

      if (recipesCount === 0) {
        return ctx.answerCbQuery('В базе пока нет рецептов');
      }

      const randomIndex = Math.floor(Math.random() * recipesCount);
      const recipeResult = await ctx.pool.query('SELECT * FROM recipes OFFSET $1 LIMIT 1', [randomIndex]);
      const recipe = recipeResult.rows[0];

      if (!recipe) {
        return ctx.answerCbQuery('Не удалось найти рецепт');
      }

      const ingredientsResult = await ctx.pool.query(`
        SELECT i.name_ru, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = $1
        ORDER BY ri.is_main DESC
      `, [recipe.id]);

      const ingredients = ingredientsResult.rows
        .map(ri => `• ${ri.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n');

      const message = `🎲 Случайный рецепт:

🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingredients}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
        [
          Markup.button.callback('💾 В избранное', `fav_${recipe.id}`),
          Markup.button.callback('🎲 Ещё случайный', 'random_again')
        ]
      ]);

      if (recipe.image_url) {
        await ctx.replyWithPhoto(recipe.image_url, {
          caption: message,
          ...keyboard
        });
      } else {
        await ctx.reply(message, keyboard);
      }

      return ctx.answerCbQuery();
    }

    // Страница избранного
    if (data.startsWith('fav_page_')) {
      const page = parseInt(data.split('_')[2]);
      const pageSize = 5;
      const offset = (page - 1) * pageSize;

      const favoritesResult = await ctx.pool.query(`
        SELECT f.id, f.created_at, r.*
        FROM favorites f
        JOIN recipes r ON f.recipe_id = r.id
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
        OFFSET $2 LIMIT $3
      `, [user.telegram_id, offset, pageSize]);

      const favorites = favoritesResult.rows;

      const countResult = await ctx.pool.query(
        'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
        [user.telegram_id]
      );
      const totalCount = parseInt(countResult.rows[0].count);

      if (favorites.length === 0) {
        return ctx.answerCbQuery('Нет больше избранных рецептов');
      }

      let message = `⭐ Избранные рецепты (${page}/${Math.ceil(totalCount / pageSize)}):\n\n`;

      favorites.forEach((fav, index) => {
        message += `${index + 1}. 🍳 ${fav.name_ru}\n`;
        message += `   ⏱ ${fav.time_minutes || '?'} мин | 🔥 ${fav.calories_per_serving || '?'} ккал\n\n`;
      });

      const buttons = favorites.map((fav, index) => [
        Markup.button.callback(`${index + 1}. Посмотреть`, `recipe_${fav.id}`)
      ]);

      if (offset + pageSize < totalCount) {
        buttons.push([
          Markup.button.callback('➡️ Ещё', `fav_page_${page + 1}`)
        ]);
      }

      if (page > 1) {
        buttons.push([
          Markup.button.callback('⬅️ Назад', `fav_page_${page - 1}`)
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);
      await ctx.reply(message, keyboard);
      return ctx.answerCbQuery();
    }

    // Подписка
    if (data.startsWith('subscribe_')) {
      const plan = data.split('_')[1];

      if (plan === 'basic' || plan === 'premium') {
        const amount = plan === 'basic' ? 299 : 599;

        await ctx.replyWithInvoice({
          title: plan === 'basic' ? 'Базовая подписка' : 'Премиум подписка',
          description: plan === 'basic'
            ? 'Безлимит рецептов на 30 дней'
            : 'Безлимит рецептов + фото холодильника на 30 дней',
          payload: `subscribe_${plan}_${user.telegram_id}`,
          provider_token: '',
          currency: 'XTR',
          prices: [{ label: 'Подписка', amount }]
        });
      }

      return ctx.answerCbQuery();
    }

    // Настройки
    if (data.startsWith('settings_')) {
      const action = data.split('_')[1];

      if (action === 'servings') {
        await ctx.reply('Введите количество порций по умолчанию (1-10):');
      } else if (action === 'exclude') {
        await ctx.reply('Введите продукты через запятую, которые хотите исключить из поиска:');
      } else if (action === 'back') {
        await ctx.reply('Главное меню');
      }

      return ctx.answerCbQuery();
    }

    // Поделиться
    if (data.startsWith('share_')) {
      const recipeId = parseInt(data.split('_')[1]);
      const recipeResult = await ctx.pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
      const recipe = recipeResult.rows[0];

      if (recipe) {
        const shareText = `🍳 ${recipe.name_ru}\n⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал\n\nНайди этот рецепт в @MyFoodShefBot!`;
        await ctx.reply(shareText);
      }

      return ctx.answerCbQuery();
    }

    // Назад в подписке
    if (data === 'subscribe_back') {
      return ctx.answerCbQuery();
    }

    return ctx.answerCbQuery();

  } catch (error) {
    console.error('Ошибка обработки callback:', error);
    return ctx.answerCbQuery('Произошла ошибка');
  }
};
