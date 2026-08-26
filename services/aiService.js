const { supabase } = require('../supabase');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function generateRecipe(ingredients) {
  if (!DEEPSEEK_API_KEY) {
    console.warn('DEEPSEEK_API_KEY не установлен');
    return null;
  }

  const prompt = `Создай реалистичный рецепт из продуктов: ${ingredients.join(', ')}.
Верни ТОЛЬКО JSON без дополнительного текста:
{
  "name": "Название на русском",
  "timeMinutes": число,
  "caloriesPerServing": число,
  "servings": 2,
  "difficulty": "easy",
  "instructions": ["шаг 1", "шаг 2", "шаг 3"],
  "ingredients": [{"name": "продукт на русском", "amount": "200", "unit": "г"}],
  "tags": ["тег1", "тег2"]
}`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json\n?|\n?```/g, '').trim();
    const recipe = JSON.parse(content);

    // Сохраняем в базу
    const savedRecipe = await saveRecipe(recipe);
    return savedRecipe;
  } catch (error) {
    console.error('Ошибка генерации рецепта:', error.message);
    return null;
  }
}

async function saveRecipe(data) {
  try {
    // Создаём рецепт
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        name_ru: data.name,
        time_minutes: data.timeMinutes,
        calories_per_serving: data.caloriesPerServing,
        servings: data.servings,
        difficulty: data.difficulty,
        instructions: data.instructions,
        tags: data.tags,
        source: 'ai_fallback'
      })
      .select()
      .single();

    if (recipeError) {
      console.error('Ошибка создания рецепта:', recipeError.message);
      return null;
    }

    // Создаём ингредиенты и связи
    for (const ing of data.ingredients) {
      // Ищем или создаём ингредиент
      let { data: existingIng } = await supabase
        .from('ingredients')
        .select('id')
        .eq('name_ru', ing.name)
        .single();

      if (!existingIng) {
        const { data: newIng } = await supabase
          .from('ingredients')
          .insert({ name_ru: ing.name, category: 'general' })
          .select()
          .single();
        existingIng = newIng;
      }

      // Создаём связь
      await supabase
        .from('recipe_ingredients')
        .insert({
          recipe_id: recipe.id,
          ingredient_id: existingIng.id,
          amount: ing.amount,
          unit: ing.unit,
          is_main: true
        });
    }

    return recipe;
  } catch (error) {
    console.error('Ошибка сохранения рецепта:', error.message);
    return null;
  }
}

module.exports = { generateRecipe };
