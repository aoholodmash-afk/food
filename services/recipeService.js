const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Поиск рецептов по ингредиентам
 * @param {string[]} ingredients - массив ингредиентов
 * @param {number} limit - количество рецептов
 * @returns {Promise<Array>} - массив рецептов
 */
async function findByIngredients(ingredients, limit = 5) {
  const normalizedIngredients = ingredients.map(i => i.toLowerCase().trim());

  const recipes = await prisma.$queryRaw`
    SELECT r.*, 
      COUNT(ri.ingredient_id) as matched_ingredients,
      ARRAY_AGG(i.name_ru) as ingredient_names
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE LOWER(i.name_ru) = ANY(${normalizedIngredients})
    GROUP BY r.id
    HAVING COUNT(ri.ingredient_id) >= 2
    ORDER BY matched_ingredients DESC, r.id
    LIMIT ${limit}
  `;

  return recipes;
}

/**
 * Поиск рецептов с хотя бы одним совпадением
 * @param {string[]} ingredients - массив ингредиентов
 * @param {number} limit - количество рецептов
 * @returns {Promise<Array>} - массив рецептов
 */
async function findByIngredientsSingle(ingredients, limit = 3) {
  const normalizedIngredients = ingredients.map(i => i.toLowerCase().trim());

  const recipes = await prisma.$queryRaw`
    SELECT r.*, 
      COUNT(ri.ingredient_id) as matched_ingredients,
      ARRAY_AGG(i.name_ru) as ingredient_names
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE LOWER(i.name_ru) = ANY(${normalizedIngredients})
    GROUP BY r.id
    ORDER BY matched_ingredients DESC, r.id
    LIMIT ${limit}
  `;

  return recipes;
}

/**
 * Получить рецепт по ID
 * @param {number} id - ID рецепта
 * @returns {Promise<Object|null>} - рецепт
 */
async function findById(id) {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      recipeIngredients: {
        include: { ingredient: true }
      }
    }
  });
}

/**
 * Получить случайный рецепт
 * @returns {Promise<Object|null>} - рецепт
 */
async function getRandom() {
  const count = await prisma.recipe.count();
  if (count === 0) return null;

  const randomIndex = Math.floor(Math.random() * count);
  return prisma.recipe.findFirst({
    skip: randomIndex,
    include: {
      recipeIngredients: {
        include: { ingredient: true }
      }
    }
  });
}

/**
 * Получить похожие рецепты
 * @param {number} recipeId - ID рецепта
 * @param {string[]} ingredientNames - названия ингредиентов
 * @param {number} limit - количество рецептов
 * @returns {Promise<Array>} - массив рецептов
 */
async function getSimilar(recipeId, ingredientNames, limit = 3) {
  const normalizedNames = ingredientNames.map(n => n.toLowerCase());

  return prisma.$queryRaw`
    SELECT r.*, 
      COUNT(ri.ingredient_id) as matched_ingredients
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE LOWER(i.name_ru) = ANY(${normalizedNames})
      AND r.id != ${recipeId}
    GROUP BY r.id
    ORDER BY matched_ingredients DESC, r.id
    LIMIT ${limit}
  `;
}

module.exports = {
  findByIngredients,
  findByIngredientsSingle,
  findById,
  getRandom,
  getSimilar
};
