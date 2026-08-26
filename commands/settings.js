const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const user = ctx.user;

  const message = `⚙️ Настройки

Текущие параметры:
• Порции по умолчанию: ${user.servings_default || 2}
• Исключённые продукты: ${user.excluded_ingredients?.length > 0 ? user.excluded_ingredients.join(', ') : 'нет'}

Выберите, что хотите изменить:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👥 Изменить порции', 'settings_servings')],
    [Markup.button.callback('🚫 Исключить продукты', 'settings_exclude')],
    [Markup.button.callback('🔙 Назад', 'settings_back')]
  ]);

  await ctx.reply(message, keyboard);
};
