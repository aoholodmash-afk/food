const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const user = ctx.user;

  const isBasic = user.subscription === 'basic' && new Date(user.sub_expires_at) > new Date();
  const isPremium = user.subscription === 'premium' && new Date(user.sub_expires_at) > new Date();

  let message = `💎 Подписка

Текущий тариф: ${isPremium ? '🥇 Премиум' : isBasic ? '🥈 Базовый' : '🆓 Бесплатный'}
${user.sub_expires_at ? `Действует до: ${new Date(user.sub_expires_at).toLocaleDateString('ru-RU')}` : ''}

Доступные тарифы:

🆓 Бесплатный
• 3 рецепта в день
• Поиск по ингредиентам
• Избранное

🥈 Базовый — 299₽/мес
• Безлимит рецептов
• Все функции бота

🥇 Премиум — 599₽/мес
• Все функции Базового
• Фото холодильника (AI)`;

  const buttons = [];

  if (!isBasic && !isPremium) {
    buttons.push([Markup.button.callback('🥈 Базовый — 299₽/мес', 'subscribe_basic')]);
    buttons.push([Markup.button.callback('🥇 Премиум — 599₽/мес', 'subscribe_premium')]);
  } else if (isBasic) {
    buttons.push([Markup.button.callback('⬆️ Улучшить до Премиум', 'subscribe_premium')]);
  }

  buttons.push([Markup.button.callback('🔙 Назад', 'subscribe_back')]);

  await ctx.reply(message, Markup.inlineKeyboard(buttons));
};
