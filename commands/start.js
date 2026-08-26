const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const welcomeMessage = `🍳 Добро пожаловать в MyFoodShef!

Я помогу найти рецепт из того, что есть в холодильнике.

Просто напишите продукты через запятую, например:
"яйца, сыр, помидоры"

Или используйте кнопки меню ниже:`;

  const keyboard = Markup.keyboard([
    ['🥘 По ингредиентам', '🎲 Случайный'],
    ['📅 Меню на неделю', '⭐ Избранное'],
    ['⚙️ Настройки', '💎 Подписка']
  ]).resize();

  await ctx.reply(welcomeMessage, keyboard);
};
