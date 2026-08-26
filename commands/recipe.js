const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const recipeId = parseInt(args[0]);

  if (!recipeId) {
    return ctx.reply('Укажите ID рецепта: /recipe 1');
  }

  try {
    const recipeResult = await ctx.pool.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
    const recipe = recipeResult.rows[0];

    if (!recipe) {
      return ctx.reply('Рецепт не найден.');
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
  } catch (error) {
    console.error('Ошибка получения рецепта:', error);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};
