const { Markup } = require('telegraf');
const { supabase, resolveIngredients } = require('../supabase');

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

  const rawIngredients = ingredientsText.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  const ingredients = resolveIngredients(rawIngredients);

  if (ingredients.length === 0) {
    return ctx.reply('Не удалось распознать продукты. Попробуйте ещё раз.');
  }

  try {
    // Fuzzy-поиск
    let allFoundIngs = [];
    for (const ing of ingredients) {
      const { data: found } = await supabase
        .from('ingredients')
        .select('id, name_ru')
        .ilike('name_ru', `%${ing}%`);
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
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const ingIds = uniqueIngs.map(i => i.id);

    const { data: recipeIngs } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id')
      .in('ingredient_id', ingIds);

    if (!recipeIngs || recipeIngs.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    const recipeCounts = {};
    for (const ri of recipeIngs) {
      recipeCounts[ri.recipe_id] = (recipeCounts[ri.recipe_id] || 0) + 1;
    }

    const sortedRecipes = Object.entries(recipeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedRecipes.length === 0) {
      return ctx.reply('К сожалению, рецептов с такими продуктами не найдено.');
    }

    await supabase
      .from('users')
      .update({ daily_requests: user.daily_requests + 1 })
      .eq('telegram_id', user.telegram_id);

    const recipeIds = sortedRecipes.map(r => parseInt(r[0]));
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

    const totalIngs = ingredients.length;
    const message = `🔍 Найдено ${orderedRecipes.length} рецептов (из ${totalIngs} продуктов):`;

    const buttons = orderedRecipes.map(r => {
      const count = recipeCounts[r.id];
      const percent = Math.round((count / totalIngs) * 100);
      return [Markup.button.callback(`🍳 ${r.name_ru} (${count}/${totalIngs}, ${percent}%)`, `recipe_${r.id}`)];
    });

    await ctx.reply(message, Markup.inlineKeyboard(buttons));

  } catch (error) {
    console.error('Ошибка:', error.message);
    ctx.reply('Произошла ошибка при поиске. Попробуйте позже.');
  }
};
