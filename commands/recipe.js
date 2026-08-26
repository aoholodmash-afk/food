const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const recipeId = parseInt(args[0]);

  if (!recipeId) {
    return ctx.reply('Укажите ID рецепта: /recipe 1');
  }

  try {
    const { data: recipe } = await ctx.supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (!recipe) {
      return ctx.reply('Рецепт не найден.');
    }

    const { data: ingredients } = await ctx.supabase
      .from('recipe_ingredients')
      .select('amount, unit, is_main, ingredients(name_ru)')
      .eq('recipe_id', recipeId);

    const ingList = (ingredients || [])
      .map(ri => `• ${ri.ingredients.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
      .join('\n');

    const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingList}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
      [
        Markup.button.callback('💾 В избранное', `fav_${recipe.id}`),
        Markup.button.callback('🔍 Ещё варианты', `more_${recipe.id}`)
      ]
    ]);

    if (recipe.image_url) {
      await ctx.replyWithPhoto(recipe.image_url, { caption: message, ...keyboard });
    } else {
      await ctx.reply(message, keyboard);
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};
