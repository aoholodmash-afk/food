const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const user = ctx.user;
  const page = parseInt(ctx.message.text.split(' ')[1]) || 1;
  const pageSize = 5;
  const offset = (page - 1) * pageSize;

  try {
    const favoritesResult = await ctx.pool.query(`
      SELECT f.id, f.created_at, r.*
      FROM favorites f
      JOIN recipes r ON f.recipe_id = r.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      OFFSET $2 LIMIT $3
    `, [user.telegram_id, offset, pageSize]);

    const favorites = favoritesResult.rows;

    if (favorites.length === 0) {
      return ctx.reply('У вас пока нет избранных рецептов.\nНажмите 💾 под рецептом, чтобы добавить.');
    }

    const countResult = await ctx.pool.query(
      'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
      [user.telegram_id]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    let message = `⭐ Избранные рецепты (${page}/${Math.ceil(totalCount / pageSize)}):\n\n`;

    favorites.forEach((fav, index) => {
      message += `${index + 1}. 🍳 ${fav.name_ru}\n`;
      message += `   ⏱ ${fav.time_minutes || '?'} мин | 🔥 ${fav.calories_per_serving || '?'} ккал\n\n`;
    });

    const buttons = [];

    favorites.forEach((fav, index) => {
      buttons.push([
        Markup.button.callback(`${index + 1}. Посмотреть`, `recipe_${fav.id}`)
      ]);
    });

    if (offset + pageSize < totalCount) {
      buttons.push([
        Markup.button.callback('➡️ Ещё', `fav_page_${page + 1}`)
      ]);
    }

    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.reply(message, keyboard);

  } catch (error) {
    console.error('Ошибка получения избранного:', error);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};
