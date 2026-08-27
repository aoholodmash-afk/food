CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_alias ON ingredient_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_ingredient_id ON ingredient_aliases(ingredient_id);
