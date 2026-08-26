const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  try {
    const countResult = await ctx.pool.query('SELECT COUNT(*) FROM recipes');
    const recipesCount = parseInt(countResult.rows[0].count);

    if (recipesCount === 0) {
      return ctx.reply('В базе пока нет рецептов.');
    }

    const randomIndex = Math.floor(Math.random() * recipesCount);
    const recipeResult = await ctx.pool.query('SELECT * FROM recipes OFFSET $1 LIMIT 1', [randomIndex]);
    const recipe = recipeResult.rows[0];

    if (!recipe) {
      return ctx.reply('Не удалось найти рецепт.');
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
  } catch (error) {
    console.error('Ошибка получения случайного рецепта:', error);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};
