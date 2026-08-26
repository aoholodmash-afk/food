const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const user = ctx.user;

  try {
    const { data: favorites } = await ctx.supabase
      .from('favorites')
      .select('id, created_at, recipes(*)')
      .eq('user_id', user.telegram_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!favorites || favorites.length === 0) {
      return ctx.reply('У вас пока нет избранных рецептов.\nНажмите 💾 под рецептом, чтобы добавить.');
    }

    let message = `⭐ Избранные рецепты:\n\n`;

    favorites.forEach((fav, index) => {
      const r = fav.recipes;
      message += `${index + 1}. 🍳 ${r.name_ru}\n`;
      message += `   ⏱ ${r.time_minutes || '?'} мин | 🔥 ${r.calories_per_serving || '?'} ккал\n\n`;
    });

    const buttons = favorites.map((fav, index) => [
      Markup.button.callback(`${index + 1}. Посмотреть`, `recipe_${fav.recipes.id}`)
    ]);

    await ctx.reply(message, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};
