/**
 * AI-сервис для генерации рецептов (V2)
 * Требует OPENAI_API_KEY в .env
 */

let openai = null;

function initOpenAI() {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
}

/**
 * Сгенерировать рецепт по ингредиентам
 * @param {string[]} ingredients - массив ингредиентов
 * @returns {Promise<Object|null>} - рецепт в формате JSON
 */
async function generateRecipe(ingredients) {
  if (!openai) {
    initOpenAI();
  }

  if (!openai) {
    console.warn('OpenAI не инициализирован. Укажите OPENAI_API_KEY в .env');
    return null;
  }

  try {
    const prompt = `У меня есть: ${ingredients.join(', ')}.
Создай рецепт в JSON формате:
{
  "name_ru": "Название рецепта",
  "time_minutes": 30,
  "calories_per_serving": 350,
  "servings": 2,
  "ingredients": [
    {"name": "Продукт", "amount": "200", "unit": "г"}
  ],
  "instructions": [
    "Шаг 1",
    "Шаг 2"
  ],
  "cuisine": "Русская",
  "category": "Обед",
  "difficulty": "easy"
}

Верни только JSON, без дополнительного текста.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Ты - шеф-повар. Создавай рецепты в указанном JSON формате.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;
    const recipe = JSON.parse(response);

    return {
      nameRu: recipe.name_ru,
      timeMinutes: recipe.time_minutes,
      caloriesPerServing: recipe.calories_per_serving,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      cuisine: recipe.cuisine,
      category: recipe.category,
      difficulty: recipe.difficulty,
      source: 'ai'
    };
  } catch (error) {
    console.error('Ошибка генерации рецепта:', error);
    return null;
  }
}

module.exports = {
  generateRecipe
};
