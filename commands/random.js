const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  try {
    const { count } = await ctx.supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true });

    if (!count || count === 0) {
      return ctx.reply('В базе пока нет рецептов.');
    }

    const randomOffset = Math.floor(Math.random() * count);

    const { data: recipes } = await ctx.supabase
      .from('recipes')
      .select('*')
      .range(randomOffset, randomOffset);

    const recipe = recipes?.[0];
    if (!recipe) {
      return ctx.reply('Не удалось найти рецепт.');
    }

    const { data: ingredients } = await ctx.supabase
      .from('recipe_ingredients')
      .select('amount, unit, is_main, ingredients(name_ru)')
      .eq('recipe_id', recipe.id);

    const ingList = (ingredients || [])
      .map(ri => `• ${ri.ingredients.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
      .join('\n');

    const message = `🎲 Случайный рецепт:

🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingList}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
      [
        Markup.button.callback('💾 В избранное', `fav_${recipe.id}`),
        Markup.button.callback('🎲 Ещё случайный', 'random_again')
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
