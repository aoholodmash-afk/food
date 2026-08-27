const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Поиск ингредиентов по алиасам
 * @param {string[]} userWords - слова пользователя
 * @returns {Promise<{ingredientId: number, matchedWord: string}[]>}
 */
async function findIngredientsByAliases(userWords) {
  const results = [];

  // Ищем алиасы
  const { data: aliases } = await supabase
    .from('ingredient_aliases')
    .select('ingredient_id, alias')
    .in('alias', userWords);

  if (aliases && aliases.length > 0) {
    for (const a of aliases) {
      results.push({ ingredientId: a.ingredient_id, matchedWord: a.alias });
    }
  }

  // Ищем прямые совпадения в ingredients
  const { data: directIngs } = await supabase
    .from('ingredients')
    .select('id, name_ru')
    .in('name_ru', userWords);

  if (directIngs && directIngs.length > 0) {
    for (const ing of directIngs) {
      // Не дублируем
      if (!results.find(r => r.ingredientId === ing.id)) {
        results.push({ ingredientId: ing.id, matchedWord: ing.name_ru });
      }
    }
  }

  return results;
}

/**
 * Поиск рецептов по ингредиентам
 * @param {string[]} userWords - слова пользователя
 * @returns {Promise<{recipes: Object[], mode: string}>}
 */
async function findRecipes(userWords) {
  // 1. Ищем ингредиенты по алиасам
  const foundIngs = await findIngredientsByAliases(userWords);

  if (foundIngs.length === 0) {
    return { recipes: [], mode: 'none' };
  }

  const ingIds = foundIngs.map(i => i.ingredientId);

  // 2. Ищем рецепты с этими ингредиентами
  const { data: recipeIngs } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_id')
    .in('ingredient_id', ingIds);

  if (!recipeIngs || recipeIngs.length === 0) {
    return { recipes: [], mode: 'none' };
  }

  // 3. Считаем совпадения для каждого рецепта
  const recipeScores = {};
  for (const ri of recipeIngs) {
    if (!recipeScores[ri.recipe_id]) {
      recipeScores[ri.recipe_id] = { matchedIngs: new Set() };
    }
    recipeScores[ri.recipe_id].matchedIngs.add(ri.ingredient_id);
  }

  // 4. Считаем сколько ПРОДУКТОВ из ввода совпало
  const totalWords = userWords.length;
  const scoredRecipes = [];

  for (const [recipeId, score] of Object.entries(recipeScores)) {
    // Считаем сколько уникальных ингредиентов из ввода есть в рецепте
    const matchedCount = score.matchedIngs.size;
    const percent = Math.round((matchedCount / totalWords) * 100);

    scoredRecipes.push({
      recipeId: parseInt(recipeId),
      matchedCount,
      totalWords,
      percent
    });
  }

  // 5. Сортируем по количеству совпадений
  scoredRecipes.sort((a, b) => b.matchedCount - a.matchedCount);

  // 6. Определяем режим
  const topScore = scoredRecipes[0];
  let mode = 'soft';
  if (topScore && topScore.matchedCount === totalWords) {
    mode = 'strict';
  }

  // 7. Получаем рецепты
  const recipeIds = scoredRecipes.slice(0, 5).map(r => r.recipeId);
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .in('id', recipeIds);

  if (!recipes || recipes.length === 0) {
    return { recipes: [], mode: 'none' };
  }

  // 8. Сортируем рецепты в правильном порядке
  const recipeMap = {};
  recipes.forEach(r => { recipeMap[r.id] = r; });
  const orderedRecipes = recipeIds.map(id => recipeMap[id]).filter(Boolean);

  // 9. Добавляем score к рецептам
  const result = orderedRecipes.map(r => {
    const score = scoredRecipes.find(s => s.recipeId === r.id);
    return {
      ...r,
      matchedCount: score?.matchedCount || 0,
      totalWords: score?.totalWords || totalWords,
      percent: score?.percent || 0
    };
  });

  return { recipes: result, mode };
}

module.exports = { supabase, findIngredientsByAliases, findRecipes };
