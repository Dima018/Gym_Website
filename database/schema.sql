BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(80) NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS trainings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id integer NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL UNIQUE,
  description text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 0 AND 1000000),
  image varchar(30) NOT NULL CHECK (image IN ('strength.png','cardio.png','yoga.png','boxing.png','stretch.png','personal.png')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  training_id integer NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT,
  session_date date NOT NULL,
  phone varchar(13) NOT NULL CHECK (phone ~ '^\+380[0-9]{9}$'),
  note varchar(300) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, training_id, session_date)
);
CREATE INDEX IF NOT EXISTS trainings_category_idx ON trainings(category_id);
CREATE INDEX IF NOT EXISTS bookings_training_idx ON bookings(training_id);
COMMIT;
