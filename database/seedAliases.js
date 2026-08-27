require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function seedAliases() {
  console.log('Заполняем алиасы ингредиентов...');

  // Получаем все ингредиенты
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name_ru');

  if (!ingredients) {
    console.error('Не удалось получить ингредиенты');
    return;
  }

  const ingMap = {};
  ingredients.forEach(i => { ingMap[i.name_ru] = i.id; });

  console.log('Ингредиенты в базе:', Object.keys(ingMap).join(', '));

  // Алиасы: alias → name_ru ингредиента
  const aliases = {
    // Мясо
    'мясо': ['говядина', 'курица'],
    'говяжье': ['говядина'],
    'стейк': ['говядина'],
    'фарш': ['говядина'],
    'грудка': ['курица'],
    'филе': ['курица'],
    'куриное': ['курица'],
    'индейка': ['курица'],
    'баранина': ['говядина'],

    // Макароны
    'паста': ['макароны'],
    'спагетти': ['макароны'],
    'фузилли': ['макароны'],
    'пенне': ['макароны'],

    // Картофель
    'картошка': ['картофель'],
    'картоха': ['картофель'],

    // Помидоры
    'томаты': ['помидоры'],
    'помидор': ['помидоры'],
    'томат': ['помидоры'],
    'черри': ['помидоры'],

    // Лук
    'луковица': ['лук'],
    'репчатый лук': ['лук'],
    'зеленый лук': ['лук'],

    // Молоко
    'молочко': ['молоко'],

    // Масло
    'маслице': ['масло'],
    'подсолнечное масло': ['масло'],
    'растительное масло': ['масло'],
    'сливочное масло': ['масло'],

    // Яйца
    'яйцо': ['яйца'],
    'яичко': ['яйца'],

    // Творог
    'творожок': ['творог'],
    'сырок': ['творог'],

    // Сахар
    'сахарок': ['сахар'],

    // Перец
    'перчик': ['перец'],

    // Чеснок
    'чесночок': ['чеснок'],

    // Огурцы
    'огурец': ['огурцы'],

    // Морковь
    'морковка': ['морковь'],

    // Грибы
    'гриб': ['грибы'],
    'грибочки': ['грибы'],
    'шампиньоны': ['грибы'],

    // Креветки
    'креветка': ['креветки'],
    'креветочка': ['креветки'],

    // Лимон
    'лимончик': ['лимон'],

    // Бекон
    'грудинка': ['бекон'],

    // Рис
    'рисик': ['рис'],

    // Зелень
    'укроп': ['укроп'],
    'петрушка': ['петрушка'],
  };

  let count = 0;
  for (const [alias, ingredientNames] of Object.entries(aliases)) {
    for (const name of ingredientNames) {
      const ingredientId = ingMap[name];
      if (ingredientId) {
        const { error } = await supabase
          .from('ingredient_aliases')
          .insert({ ingredient_id: ingredientId, alias: alias });

        if (error) {
          console.log(`Ошибка ${alias} → ${name}: ${error.message}`);
        } else {
          count++;
        }
      }
    }
  }

  console.log(`Добавлено ${count} алиасов`);
}

seedAliases().catch(console.error);
