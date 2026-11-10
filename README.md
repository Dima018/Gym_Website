# Спортзал «Ритм» — КП №2

**Автор:** Суворов Дмитро · **Група:** ЦІ-31 · **Тема №69:** Спортзал

Продовження КП №1: Node.js / Express 5, PostgreSQL 17, REST API, bcrypt, JWT та клієнтський Fetch API. Каталог, деталі та записи завантажуються з БД. Реєстрація, вхід, власні записи і адміністративне керування каталогом працюють через API.

## Швидкий запуск через Docker

Потрібні Node.js 22+ та Docker із Compose. Виконайте у корені репозиторію:

```bash
npm ci
npm run setup
docker compose up -d --wait db
npm run db:init
npm start
```

Відкрийте **http://localhost:3000**. Відкриття HTML як локального файлу вже не запускає серверну версію.

Не закривайте термінал із `npm start`, доки перевіряєте сайт. Для зупинки сервера натисніть `Ctrl+C`.

`npm run setup` створює `.env` із випадковими секретами та паролем адміністратора. Дані для входу admin: `ADMIN_EMAIL` і `ADMIN_PASSWORD` у цьому файлі. Звичайний користувач реєструється через `account.html`. Секрети не додаються до Git. `.env.example` описує змінні для ручного налаштування.

База доступна лише локально на порту 54329; дані зберігаються у Docker volume між перезапусками. `npm run db:init` створює відсутню схему та початкові дані без перезаписування наявних рядків. Якщо порт зайнятий, узгоджено змініть порт у `compose.yaml` і `DATABASE_URL`. Для власного PostgreSQL задайте `DATABASE_URL` і пропустіть запуск Docker.

Перевірити, що PostgreSQL запущений:

```bash
docker compose ps
```

Повторний запуск після першого налаштування:

```bash
docker compose up -d --wait db
npm start
```

Зупинка без видалення даних:

```bash
docker compose stop
```

## Перевірка сайту крок за кроком

1. Відкрийте http://localhost:3000 і переконайтеся, що каталог тренувань завантажився з БД.
2. Відкрийте «Кабінет», зареєструйте нового користувача та увійдіть.
3. На сторінці «Записатися» виберіть тренування, дату, введіть телефон у форматі `+380XXXXXXXXX` і створіть запис.
4. У «Кабінеті» перевірте перегляд, зміну та скасування власного запису.
5. Вийдіть і увійдіть як адміністратор. Логін і пароль знаходяться у змінних `ADMIN_EMAIL` та `ADMIN_PASSWORD` файлу `.env`.
6. Відкрийте http://localhost:3000/admin.html та перевірте створення, редагування й видалення тренування. Тренування, на яке вже є записи, навмисно не видаляється.

JWT діє одну годину та зберігається у `sessionStorage` поточної вкладки. Самостійно зареєстрований користувач завжди отримує роль `member`, а не `admin`.

## Перегляд даних PostgreSQL

У новому терміналі з папки проєкту відкрийте консоль БД:

```bash
docker compose exec db psql -U ritm -d ritm
```

Запрошення має змінитися на `ritm=#`. Список таблиць:

```sql
\dt
```

Користувачі (паролі зберігаються лише як bcrypt-хеші):

```sql
SELECT id, name, email, role, created_at
FROM users
ORDER BY id;
```

Категорії та тренування:

```sql
SELECT * FROM categories ORDER BY id;

SELECT
    t.id,
    t.name AS training,
    c.name AS category,
    t.duration_minutes,
    t.price_cents
FROM trainings t
JOIN categories c ON c.id = t.category_id
ORDER BY t.id;
```

Хто, коли і на яке тренування записався:

```sql
SELECT
    b.id AS booking_id,
    u.name AS client,
    u.email,
    t.name AS training,
    c.name AS category,
    b.session_date,
    b.phone,
    b.note,
    b.created_at
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN trainings t ON t.id = b.training_id
JOIN categories c ON c.id = t.category_id
ORDER BY b.session_date, b.id;
```

Подивитися структуру таблиць:

```sql
\d users
\d trainings
\d bookings
```

Вийти з PostgreSQL:

```sql
\q
```

Для графічного перегляду можна підключити DBeaver або pgAdmin: host `localhost`, port `54329`, database `ritm`, username `ritm`, password — значення `POSTGRES_PASSWORD` із `.env`.

## Швидка перевірка API

Публічний список тренувань відкривається у браузері або через термінал:

```bash
curl -i http://localhost:3000/api/trainings
```

Очікується статус `HTTP/1.1 200 OK` і JSON із тренуваннями. Повна таблиця маршрутів, приклади реєстрації, входу та CRUD є у [`docs/API.md`](docs/API.md). Готову колекцію для ручної перевірки можна імпортувати з [`docs/insomnia-collection.json`](docs/insomnia-collection.json).

## Часті проблеми

- `role "gym_user" does not exist` — використовуйте команду з актуальними назвами: `docker compose exec db psql -U ritm -d ritm`.
- Сайт не відкривається — перевірте, що `npm start` досі працює і відкриваєте саме `http://localhost:3000`.
- База не готова — виконайте `docker compose ps` і `docker compose logs db`.
- Після реєстрації не відкривається адмін-панель — це правильно: новий акаунт має роль `member`; для адмін-панелі потрібні дані `ADMIN_EMAIL` і `ADMIN_PASSWORD` із `.env`.
- Потрібна повністю чиста БД — команда нижче видаляє всі локальні дані, після чого створює БД заново:

```bash
docker compose down -v
docker compose up -d --wait db
npm run db:init
```

Останню операцію використовуйте лише тоді, коли старі користувачі та записи більше не потрібні.

## Структура

- `server/` — Express, маршрути, авторизація, валідація та PostgreSQL pool.
- `database/` — SQL-схема і DBML для dbdiagram.io.
- `scripts/app.js`, `scripts/api.js` — інтерфейс і Fetch; `setup.js`, `init-db.js` — локальне налаштування.
- `docs/API.md` — методи, URL, приклади JSON, коди відповідей і порядок перевірки.
- `docs/insomnia-collection.json` — імпортована колекція для ручних запитів без секретів.
- `docs/DATABASE.md` — сутності, зв’язки та обґрунтування 3НФ.
- `lab-report-2/` — новий звіт LaTeX/PDF, ER-діаграма, скриншоти API та інтерфейсу, результати перевірок.

## Прогрес

Матеріали КП №1 збережені у `lab-report/`, початковий README — `docs/LAB1-README.md`; код першої версії доступний у тегу `lab1-v1.0`. Новий звіт не замінює попередній.

Репозиторій: https://github.com/Dima018/Gym_Website

Дошка: https://github.com/users/Dima018/projects/13

## Перевірка

Ручні запити Insomnia й окремі перевірочні HTTP-запити підтверджують CRUD, 400/401/403/404/409 та обмеження власника. UI перевірено у Chromium і Firefox на desktop/mobile, включно з входом, помилкою мережі та повторним завантаженням. Автоматизовані unit/API-набори для КП №3 ще не додаються.

Для інтернет-розгортання використовуйте HTTPS і власні секрети. Локальний запуск не публікує бекенд в інтернет; GitHub Pages не запускає Node.js/PostgreSQL.
