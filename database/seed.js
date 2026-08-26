require('dotenv').config();
const { Pool } = require('pg');

async function query(sql, params) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000
  });
  
  try {
    const client = await pool.connect();
    const result = await client.query(sql, params);
    client.release();
    await pool.end();
    return result;
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }
}

async function seed() {
  try {
    console.log('Добавляем ингредиенты...');

    const ingredients = [
      ['яйца', 'eggs', 'Молочные'], ['сыр', 'cheese', 'Молочные'], ['помидоры', 'tomatoes', 'Овощи'],
      ['лук', 'onion', 'Овощи'], ['чеснок', 'garlic', 'Овощи'], ['курица', 'chicken', 'Мясо'],
      ['рис', 'rice', 'Крупы'], ['макароны', 'pasta', 'Крупы'], ['молоко', 'milk', 'Молочные'],
      ['масло', 'butter', 'Молочные'], ['соль', 'salt', 'Специи'], ['перец', 'pepper', 'Специи'],
      ['мука', 'flour', 'Крупы'], ['сахар', 'sugar', 'Специи'], ['картофель', 'potato', 'Овощи'],
      ['морковь', 'carrot', 'Овощи'], ['говядина', 'beef', 'Мясо'], ['шпинат', 'spinach', 'Овощи'],
      ['креветки', 'shrimp', 'Рыба'], ['оливковое масло', 'olive oil', 'Масла'],
      ['творог', 'cottage cheese', 'Молочные'], ['лимон', 'lemon', 'Фрукты'],
      ['огурцы', 'cucumbers', 'Овощи'], ['бекон', 'bacon', 'Мясо']
    ];

    for (const [ru, en, cat] of ingredients) {
      try {
        await query('INSERT INTO ingredients (name_ru, name_en, category) VALUES ($1,$2,$3) ON CONFLICT (name_ru) DO NOTHING', [ru, en, cat]);
      } catch (e) {
        console.log(`Пропуск ${ru}: ${e.message}`);
      }
    }
    console.log('Ингредиенты добавлены');

    // Получаем ID ингредиентов
    const ingResult = await query('SELECT id, name_ru FROM ingredients');
    const ingMap = {};
    for (const row of ingResult.rows) {
      ingMap[row.name_ru] = row.id;
    }
    console.log(`Ингредиентов в базе: ${Object.keys(ingMap).length}`);

    console.log('Добавляем рецепты...');

    const recipes = [
      {
        name: 'Яичница по-флорентийски', en: 'Florentine eggs', cuisine: 'Итальянская', cat: 'Завтрак',
        diff: 'easy', time: 15, cal: 320, serv: 2,
        instr: ['Разогрейте сковороду с маслом.','Добавьте шпинат на 2-3 минуты.','Разбейте яйца, посыпьте сыром.','Накройте крышкой на 5-7 минут.'],
        img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8',
        tags: ['завтрак','быстрое','яйца'],
        ings: [['яйца','4','шт',true],['шпинат','200','г',true],['сыр','50','г',false],['масло','20','г',false]]
      },
      {
        name: 'Курица с рисом', en: 'Chicken with rice', cuisine: 'Русская', cat: 'Обед',
        diff: 'easy', time: 40, cal: 450, serv: 4,
        instr: ['Нарежьте курицу, обжарьте.','Добавьте лук и морковь.','Добавьте рис и воду.','Готовьте под крышкой 20 минут.'],
        img: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8',
        tags: ['обед','курица','рис'],
        ings: [['курица','500','г',true],['рис','200','г',true],['лук','1','шт',false],['морковь','1','шт',false]]
      },
      {
        name: 'Паста карбонара', en: 'Pasta carbonara', cuisine: 'Итальянская', cat: 'Ужин',
        diff: 'medium', time: 25, cal: 520, serv: 2,
        instr: ['Отварите макароны.','Обжарьте бекон.','Взбейте яйца с сыром.','Смешайте всё вместе.'],
        img: 'https://images.unsplash.com/photo-1612874742237-6526221588e3',
        tags: ['ужин','паста','итальянская'],
        ings: [['макароны','200','г',true],['яйца','2','шт',true],['сыр','100','г',true],['бекон','100','г',true]]
      },
      {
        name: 'Омлет с сыром', en: 'Cheese omelette', cuisine: 'Французская', cat: 'Завтрак',
        diff: 'easy', time: 10, cal: 280, serv: 1,
        instr: ['Взбейте яйца с молоком.','Вылейте на сковороду.','Посыпьте сыром.','Сложите пополам.'],
        img: 'https://images.unsplash.com/photo-1510693206972-df098062cb71',
        tags: ['завтрак','быстрое','яйца'],
        ings: [['яйца','3','шт',true],['сыр','50','г',true],['молоко','50','мл',false],['масло','20','г',false]]
      },
      {
        name: 'Блины', en: 'Pancakes', cuisine: 'Русская', cat: 'Завтрак',
        diff: 'easy', time: 30, cal: 220, serv: 4,
        instr: ['Взбейте яйца с сахаром.','Добавьте молоко и муку.','Жарьте на сковороде.','Подавайте с медом.'],
        img: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445',
        tags: ['завтрак','блины','русская'],
        ings: [['яйца','2','шт',true],['молоко','500','мл',true],['мука','200','г',true],['сахар','2','ст.л.',false]]
      },
      {
        name: 'Салат Цезарь', en: 'Caesar salad', cuisine: 'Американская', cat: 'Салат',
        diff: 'medium', time: 20, cal: 380, serv: 2,
        instr: ['Обжарьте курицу.','Нарежьте салат и помидоры.','Приготовьте заправку.','Смешайте всё.'],
        img: 'https://images.unsplash.com/photo-1546793665-c74683f339c1',
        tags: ['салат','курица','легкое'],
        ings: [['курица','200','г',true],['помидоры','2','шт',true],['сыр','50','г',false],['оливковое масло','30','мл',false]]
      },
      {
        name: 'Котлеты из говядины', en: 'Beef cutlets', cuisine: 'Русская', cat: 'Основное',
        diff: 'medium', time: 40, cal: 380, serv: 4,
        instr: ['Пропустите мясо через мясорубку.','Добавьте лук, яйцо, соль.','Сформируйте котлеты.','Обжарьте на сковороде.'],
        img: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8',
        tags: ['основное','мясо','русская'],
        ings: [['говядина','500','г',true],['лук','1','шт',true],['яйца','1','шт',false],['мука','50','г',false]]
      },
      {
        name: 'Сырники', en: 'Cottage cheese pancakes', cuisine: 'Русская', cat: 'Завтрак',
        diff: 'easy', time: 20, cal: 250, serv: 2,
        instr: ['Смешайте творог, яйцо, сахар, муку.','Сформируйте сырники.','Обжарьте на масле.','Подавайте со сметаной.'],
        img: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445',
        tags: ['завтрак','творог','русская'],
        ings: [['творог','200','г',true],['яйца','1','шт',true],['мука','50','г',true],['сахар','2','ст.л.',false]]
      },
      {
        name: 'Греческий салат', en: 'Greek salad', cuisine: 'Греческая', cat: 'Салат',
        diff: 'easy', time: 15, cal: 220, serv: 2,
        instr: ['Нарежьте помидоры и огурцы.','Добавьте оливки и лук.','Выложите сыр.','Заправьте маслом.'],
        img: 'https://images.unsplash.com/photo-1546793665-c74683f339c1',
        tags: ['салат','овощи','легкое'],
        ings: [['помидоры','2','шт',true],['огурцы','1','шт',true],['сыр','100','г',true],['оливковое масло','30','мл',false]]
      },
      {
        name: 'Креветки в чесночном масле', en: 'Garlic shrimp', cuisine: 'Средиземноморская', cat: 'Закуска',
        diff: 'medium', time: 15, cal: 180, serv: 2,
        instr: ['Разогрейте масло.','Добавьте чеснок.','Добавьте креветки.','Жарьте 2-3 минуты с каждой стороны.'],
        img: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8',
        tags: ['закуска','креветки','быстрое'],
        ings: [['креветки','300','г',true],['чеснок','5','зубчиков',true],['оливковое масло','50','мл',true],['лимон','1','шт',false]]
      }
    ];

    let count = 0;
    for (const r of recipes) {
      try {
        const res = await query(
          `INSERT INTO recipes (name_ru, name_en, cuisine, category, difficulty, time_minutes, calories_per_serving, servings, instructions, image_url, tags, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [r.name, r.en, r.cuisine, r.cat, r.diff, r.time, r.cal, r.serv, r.instr, r.img, r.tags, 'manual']
        );
        
        if (res.rows.length > 0) {
          const rid = res.rows[0].id;
          for (const [n, a, u, m] of r.ings) {
            if (ingMap[n]) {
              try {
                await query('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit, is_main) VALUES ($1,$2,$3,$4,$5)', [rid, ingMap[n], a, u, m]);
              } catch (e) {
                console.log(`Пропуск связи ${r.name}-${n}: ${e.message}`);
              }
            }
          }
          count++;
          console.log(`Добавлен: ${r.name}`);
        }
      } catch (e) {
        console.log(`Пропуск рецепта ${r.name}: ${e.message}`);
      }
    }

    console.log(`\nИтого добавлено рецептов: ${count}`);
    console.log('Готово!');

  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

seed();
