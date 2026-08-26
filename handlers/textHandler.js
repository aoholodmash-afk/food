const { Markup } = require('telegraf');
const { supabase, resolveIngredients } = require('../supabase');
const { generateRecipe } = require('../services/aiService');

module.exports = async (ctx) => {
  const text = ctx.message.text;

  switch (text) {
    case '🥘 По ингредиентам':
      return ctx.reply('Напишите продукты через запятую, например:\nяйца, сыр, помидоры');

    case '🎲 Случайный':
      return require('./commands/random')(ctx);

    case '📅 Меню на неделю':
      if (ctx.user.subscription === 'free') {
        return ctx.reply('📅 Меню на неделю доступно по подписке.\nОформите /subscribe');
      }
      return ctx.reply('📅 Меню на неделю — в разработке');

    case '⭐ Избранное':
      return require('./commands/favorites')(ctx);

    case '⚙️ Настройки':
      return require('./commands/settings')(ctx);

    case '💎 Подписка':
      return require('./commands/subscribe')(ctx);
  }

  // Парсинг ввода
  const rawWords = text.toLowerCase()
    .split(/,|и|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (rawWords.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  const user = ctx.user;
  if (user.subscription === 'free' && user.daily_requests >= 3) {
    return ctx.reply(`🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`,
      Markup.inlineKeyboard([[Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]])
    );
  }

  try {
    // Расширяем синонимы: для каждого слова → массив вариантов
    const searchGroups = resolveIngredients(rawWords);
    const allVariants = searchGroups.flat();

    // Ищем кандидатов через ilike
    let allFoundIngs = [];
    for (const variant of allVariants) {
      const { data: found } = await supabase
        .from('ingredients')
        .select('id, name_ru')
        .ilike('name_ru', `%${variant}%`);
      if (found && found.length > 0) {
        allFoundIngs.push(...found);
      }
    }

    // Убираем дубликаты ингредиентов
    const uniqueIngs = [];
    const seenIds = new Set();
    for (const ing of allFoundIngs) {
      if (!seenIds.has(ing.id)) {
        seenIds.add(ing.id);
        uniqueIngs.push(ing);
      }
    }

    if (uniqueIngs.length === 0) {
      // AI fallback
      const msg = await ctx.reply('🔍 Не нашёл в базе. Генерирую рецепт специально для вас...');
      const recipe = await generateRecipe(rawWords);
      await ctx.deleteMessage(msg.message_id).catch(() => {});

      if (recipe) {
        const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${(recipe.instructions || []).map((step, i) => `${i + 1}. ${step}`).join('\n')}`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
          [Markup.button.callback('💾 В избранное', `fav_${recipe.id}`)]
        ]);

        return ctx.reply(message, keyboard);
      }

      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено. Попробуйте другие названия.');
    }

    const ingIds = uniqueIngs.map(i => i.id);

    // Ищем рецепты с любым из ингредиентов
    const { data: recipeIngs } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
      // AI fallback
      const msg = await ctx.reply('🔍 Не нашёл в базе. Генерирую рецепт специально для вас...');
      const recipe = await generateRecipe(rawWords);
      await ctx.deleteMessage(msg.message_id).catch(() => {});

      if (recipe) {
        const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${(recipe.instructions || []).map((step, i) => `${i + 1}. ${step}`).join('\n')}`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
          [Markup.button.callback('💾 В избранное', `fav_${recipe.id}`)]
        ]);

        return ctx.reply(message, keyboard);
      }

      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Ранжирование: считаем сколько ГРУПП совпало
    const recipeScores = {};
    for (const ri of recipeIngs) {
      if (!recipeScores[ri.recipe_id]) {
        recipeScores[ri.recipe_id] = { matchedGroups: 0, matchedIngs: new Set() };
      }
      recipeScores[ri.recipe_id].matchedIngs.add(ri.ingredient_id);
    }

    // Для каждого рецепта считаем сколько групп продуктов совпало
    for (const recipeId of Object.keys(recipeScores)) {
      const score = recipeScores[recipeId];
      let matchedGroups = 0;

      for (const group of searchGroups) {
        // Проверяем есть ли хотя бы один ингредиент из группы в рецепте
        const groupIngs = uniqueIngs.filter(ing =>
          group.some(variant => ing.name_ru.toLowerCase().includes(variant.toLowerCase()))
        );
        const groupIds = groupIngs.map(i => i.id);
        const hasMatch = groupIds.some(id => score.matchedIngs.has(id));
        if (hasMatch) matchedGroups++;
      }

      score.matchedGroups = matchedGroups;
    }

    // Сортируем по количеству совпавших групп
    const sortedRecipes = Object.entries(recipeScores)
      .sort((a, b) => b[1].matchedGroups - a[1].matchedGroups)
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Режим строгий: все группы совпали
    const totalGroups = searchGroups.length;
    const strictRecipes = sortedRecipes.filter(([_, score]) => score.matchedGroups === totalGroups);

    let mode = 'soft';
    let recipesToShow = sortedRecipes;

    if (strictRecipes.length >= 2) {
      mode = 'strict';
      recipesToShow = strictRecipes;
    }

    // Увеличиваем счетчик запросов
    await supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    // Получаем рецепты
    const recipeIds = recipesToShow.map(([id]) => parseInt(id));
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds);

    if (!recipes || recipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    // Сортируем рецепты в правильном порядке
    const recipeMap = {};
    recipes.forEach(r => { recipeMap[r.id] = r; });
    const orderedRecipes = recipeIds.map(id => recipeMap[id]).filter(Boolean);

    const header = mode === 'strict'
      ? `✅ Нашёл рецепты со всеми ингредиентами (${totalGroups}/${totalGroups}):`
      : `⚡ Нашёл похожие (не всё есть, но можно адаптировать):`;

    const buttons = orderedRecipes.map(r => {
      const score = recipeScores[r.id];
      const percent = Math.round((score.matchedGroups / totalGroups) * 100);
      return [Markup.button.callback(`🍳 ${r.name_ru} (${score.matchedGroups}/${totalGroups}, ${percent}%)`, `recipe_${r.id}`)];
    });

    await ctx.reply(header, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка поиска:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
