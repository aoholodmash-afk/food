/**
 * Парсинг строки ингредиентов
 * @param {string} text - текст с ингредиентами
 * @returns {string[]} - массив ингредиентов
 */
function parseIngredients(text) {
  return text
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

/**
 * Форматирование карточки рецепта (краткой)
 * @param {Object} recipe - объект рецепта
 * @returns {string} - отформатированное сообщение
 */
function formatRecipeCard(recipe) {
  const ingredients = recipe.recipeIngredients
    ? recipe.recipeIngredients
        .map(ri => `• ${ri.ingredient.nameRu} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n')
    : '';

  return `🍳 ${recipe.nameRu}
⏱ ${recipe.timeMinutes || '?'} мин | 🔥 ${recipe.caloriesPerServing || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingredients}`;
}

/**
 * Форматирование полного рецепта
 * @param {Object} recipe - объект рецепта
 * @returns {string} - отформатированное сообщение
 */
function formatFullRecipe(recipe) {
  const ingredients = recipe.recipeIngredients
    ? recipe.recipeIngredients
        .map(ri => `• ${ri.ingredient.nameRu} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n')
    : '';

  const instructions = recipe.instructions
    ? recipe.instructions
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n\n')
    : '';

  return `🍳 ${recipe.nameRu}

📝 Ингредиенты:
${ingredients}

👨‍🍳 Приготовление:
${instructions}

💡 Совет: Приятного аппетита!`;
}

/**
 * Форматирование сообщения об ошибке лимита
 * @returns {string} - сообщение
 */
function formatLimitMessage() {
  return `🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`;
}

/**
 * Проверка, является ли текст кнопкой Reply Keyboard
 * @param {string} text - текст сообщения
 * @returns {boolean} - является ли кнопкой
 */
function isKeyboardButton(text) {
  const buttons = [
    '🥘 По ингредиентам',
    '🎲 Случайный',
    '📅 Меню на неделю',
    '⭐ Избранное',
    '⚙️ Настройки',
    '💎 Подписка'
  ];
  return buttons.includes(text);
}

module.exports = {
  parseIngredients,
  formatRecipeCard,
  formatFullRecipe,
  formatLimitMessage,
  isKeyboardButton
};
