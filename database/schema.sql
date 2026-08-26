-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    subscription VARCHAR(20) DEFAULT 'free',
    sub_expires_at TIMESTAMP,
    daily_requests INTEGER DEFAULT 0,
    last_request_date DATE DEFAULT CURRENT_DATE,
    servings_default INTEGER DEFAULT 2,
    excluded_ingredients TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Рецепты
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    name_ru VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    cuisine VARCHAR(50),
    category VARCHAR(50),
    difficulty VARCHAR(20),
    time_minutes INTEGER,
    calories_per_serving INTEGER,
    servings INTEGER DEFAULT 2,
    instructions TEXT[],
    image_url VARCHAR(500),
    tags TEXT[],
    ingredients_text TEXT,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ингредиенты
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    name_ru VARCHAR(100) UNIQUE NOT NULL,
    name_en VARCHAR(100),
    category VARCHAR(50)
);

-- Связь рецепт ↔ ингредиент
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id),
    amount VARCHAR(50),
    unit VARCHAR(20),
    is_main BOOLEAN DEFAULT true
);

-- Избранное
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    recipe_id INTEGER REFERENCES recipes(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, recipe_id)
);

-- Платежи
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    amount INTEGER,
    currency VARCHAR(10) DEFAULT 'XTR',
    status VARCHAR(20),
    provider_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
