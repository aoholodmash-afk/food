const { Markup } = require('telegraf');
const { supabase, resolveIngredients } = require('../supabase');
const { generateRecipe } = require('../services/aiService');

module.exports = async (ctx) => {
  const user = ctx.user;
  const args = ctx.message.text.split(' ').slice(1);
  const ingredientsText = args.join(' ');

  if (!ingredientsText) {
    return ctx.reply('Напишите продукты через запятую, например:\n/search яйца, сыр, помидоры');
  }

  if (user.subscription === 'free' && user.daily_requests >= 3) {
    return ctx.reply(`🍳 Вы использовали 3 бесплатных рецепта сегодня.

Оформите подписку:
🥈 Базовая — 299₽/мес (безлимит рецептов)
🥇 Премиум — 599₽/мес (+ фото холодильника)`,
      Markup.inlineKeyboard([[Markup.button.callback('💳 Оплатить Stars', 'subscribe_basic')]])
    );
  }

  const rawWords = ingredientsText.toLowerCase()
    .split(/,|и|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (rawWords.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  try {
    const searchGroups = resolveIngredients(rawWords);
    const allVariants = searchGroups.flat();

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

    const uniqueIngs = [];
    const seenIds = new Set();
    for (const ing of allFoundIngs) {
      if (!seenIds.has(ing.id)) {
        seenIds.add(ing.id);
        uniqueIngs.push(ing);
      }
    }

    if (uniqueIngs.length === 0) {
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

    const ingIds = uniqueIngs.map(i => i.id);

    const { data: recipeIngs } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
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

    const recipeScores = {};
    for (const ri of recipeIngs) {
      if (!recipeScores[ri.recipe_id]) {
        recipeScores[ri.recipe_id] = { matchedGroups: 0, matchedIngs: new Set() };
      }
      recipeScores[ri.recipe_id].matchedIngs.add(ri.ingredient_id);
    }

    for (const recipeId of Object.keys(recipeScores)) {
      const score = recipeScores[recipeId];
      let matchedGroups = 0;

      for (const group of searchGroups) {
        const groupIngs = uniqueIngs.filter(ing =>
          group.some(variant => ing.name_ru.toLowerCase().includes(variant.toLowerCase()))
        );
        const groupIds = groupIngs.map(i => i.id);
        const hasMatch = groupIds.some(id => score.matchedIngs.has(id));
        if (hasMatch) matchedGroups++;
      }

      score.matchedGroups = matchedGroups;
    }

    const sortedRecipes = Object.entries(recipeScores)
      .sort((a, b) => b[1].matchedGroups - a[1].matchedGroups)
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const totalGroups = searchGroups.length;
    const strictRecipes = sortedRecipes.filter(([_, score]) => score.matchedGroups === totalGroups);

    let mode = 'soft';
    let recipesToShow = sortedRecipes;

    if (strictRecipes.length >= 2) {
      mode = 'strict';
      recipesToShow = strictRecipes;
    }

    await supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    const recipeIds = recipesToShow.map(([id]) => parseInt(id));
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds);

    if (!recipes || recipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

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
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
