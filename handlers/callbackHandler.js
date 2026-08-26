const { Markup } = require('telegraf');

module.exports = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const user = ctx.user;

  try {
    // Просмотр рецепта
    if (data.startsWith('recipe_')) {
      const recipeId = parseInt(data.split('_')[1]);

      const { data: recipe } = await ctx.supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (!recipe) return ctx.answerCbQuery('Рецепт не найден');

      const { data: ingredients } = await ctx.supabase
        .from('recipe_ingredients')
        .select('amount, unit, is_main, ingredients(name_ru)')
        .eq('recipe_id', recipeId);

      const ingList = (ingredients || [])
        .map(ri => `• ${ri.ingredients.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n');

      const message = `🍳 ${recipe.name_ru}
⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал | 👤 ${recipe.servings} порции

📝 Ингредиенты:
${ingList}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👨‍🍳 Готовить', `cook_${recipe.id}`)],
        [
          Markup.button.callback('💾 В избранное', `fav_${recipe.id}`),
          Markup.button.callback('🔍 Ещё варианты', `more_${recipe.id}`)
        ]
      ]);

      if (recipe.image_url) {
        await ctx.replyWithPhoto(recipe.image_url, { caption: message, ...keyboard });
      } else {
        await ctx.reply(message, keyboard);
      }
      return ctx.answerCbQuery();
    }

    // Готовить
    if (data.startsWith('cook_')) {
      const recipeId = parseInt(data.split('_')[1]);

      const { data: recipe } = await ctx.supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (!recipe) return ctx.answerCbQuery('Рецепт не найден');

      const { data: ingredients } = await ctx.supabase
        .from('recipe_ingredients')
        .select('amount, unit, is_main, ingredients(name_ru)')
        .eq('recipe_id', recipeId);

      const ingList = (ingredients || [])
        .map(ri => `• ${ri.ingredients.name_ru} — ${ri.amount || ''} ${ri.unit || ''}`)
        .join('\n');

      const instructions = (recipe.instructions || [])
        .map((step, i) => `${i + 1}. ${step}`)
        .join('\n\n');

      const message = `🍳 ${recipe.name_ru}

📝 Ингредиенты:
${ingList}

👨‍🍳 Приготовление:
${instructions}

💡 Совет: Приятного аппетита!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Поделиться', `share_${recipe.id}`)],
        [Markup.button.callback('🔙 Назад', `recipe_${recipe.id}`)]
      ]);

      await ctx.reply(message, keyboard);
      return ctx.answerCbQuery();
    }

    // В избранное
    if (data.startsWith('fav_')) {
      const recipeId = parseInt(data.split('_')[1]);

      const { data: existing } = await ctx.supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.telegram_id)
        .eq('recipe_id', recipeId)
        .single();

      if (existing) {
        await ctx.supabase.from('favorites').delete().eq('id', existing.id);
        return ctx.answerCbQuery('Удалено из избранного');
      }

      await ctx.supabase.from('favorites').insert({
        user_id: user.telegram_id,
        recipe_id: recipeId
      });
      return ctx.answerCbQuery('Добавлено в избранное ⭐');
    }

    // Ещё варианты
    if (data.startsWith('more_')) {
      const recipeId = parseInt(data.split('_')[1]);

      const { data: recipeIngs } = await ctx.supabase
        .from('recipe_ingredients')
        .select('ingredient_id')
        .eq('recipe_id', recipeId);

      const ingIds = (recipeIngs || []).map(ri => ri.ingredient_id);

      const { data: similarIngs } = await ctx.supabase
        .from('recipe_ingredients')
        .select('recipe_id')
        .in('ingredient_id', ingIds)
        .neq('recipe_id', recipeId);

      const recipeCounts = {};
      for (const ri of (similarIngs || [])) {
        recipeCounts[ri.recipe_id] = (recipeCounts[ri.recipe_id] || 0) + 1;
      }

      const sorted = Object.entries(recipeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (sorted.length === 0) {
        return ctx.answerCbQuery('Похожих рецептов не найдено');
      }

      const recipeIds = sorted.map(r => r[0]);
      const { data: recipes } = await ctx.supabase
        .from('recipes')
        .select('*')
        .in('id', recipeIds);

      const message = `🔍 Похожие рецепты:`;

      const buttons = recipes.map(r => [
        Markup.button.callback(`🍳 ${r.name_ru} (${recipeCounts[r.id]} совп.)`, `recipe_${r.id}`)
      ]);

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
      return ctx.answerCbQuery();
    }

    // Случайный рецепт
    if (data === 'random_again') {
      const { count } = await ctx.supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true });

      if (!count) return ctx.answerCbQuery('В базе пока нет рецептов');

      const randomOffset = Math.floor(Math.random() * count);
      const { data: recipes } = await ctx.supabase
        .from('recipes')
        .select('*')
        .range(randomOffset, randomOffset);

      const recipe = recipes?.[0];
      if (!recipe) return ctx.answerCbQuery('Не удалось найти рецепт');

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
      return ctx.answerCbQuery();
    }

    // Подписка
    if (data.startsWith('subscribe_')) {
      const plan = data.split('_')[1];
      if (plan === 'basic' || plan === 'premium') {
        const amount = plan === 'basic' ? 299 : 599;
        await ctx.replyWithInvoice({
          title: plan === 'basic' ? 'Базовая подписка' : 'Премиум подписка',
          description: plan === 'basic' ? 'Безлимит рецептов на 30 дней' : 'Безлимит рецептов + фото холодильника на 30 дней',
          payload: `subscribe_${plan}_${user.telegram_id}`,
          provider_token: '',
          currency: 'XTR',
          prices: [{ label: 'Подписка', amount }]
        });
      }
      return ctx.answerCbQuery();
    }

    // Настройки
    if (data.startsWith('settings_')) {
      const action = data.split('_')[1];
      if (action === 'servings') {
        await ctx.reply('Введите количество порций по умолчанию (1-10):');
      } else if (action === 'exclude') {
        await ctx.reply('Введите продукты через запятую, которые хотите исключить из поиска:');
      } else if (action === 'back') {
        await ctx.reply('Главное меню');
      }
      return ctx.answerCbQuery();
    }

    // Поделиться
    if (data.startsWith('share_')) {
      const recipeId = parseInt(data.split('_')[1]);
      const { data: recipe } = await ctx.supabase
        .from('recipes')
        .select('name_ru, time_minutes, calories_per_serving')
        .eq('id', recipeId)
        .single();

      if (recipe) {
        await ctx.reply(`🍳 ${recipe.name_ru}\n⏱ ${recipe.time_minutes || '?'} мин | 🔥 ${recipe.calories_per_serving || '?'} ккал\n\nНайди этот рецепт в @MyFoodShefBot!`);
      }
      return ctx.answerCbQuery();
    }

    if (data === 'subscribe_back') {
      return ctx.answerCbQuery();
    }

    return ctx.answerCbQuery();

  } catch (error) {
    console.error('Ошибка:', error.message);
    return ctx.answerCbQuery('Произошла ошибка');
  }
};
