# Спортзал «Ритм» — наскрізний проєкт КП №1–3

**Автор:** Суворов Дмитро · **Група:** ЦІ-31 · **Тема №69:** Спортзал

Повний навчальний web-застосунок: адаптивний клієнт, Node.js / Express 5, PostgreSQL 17, REST API, bcrypt, JWT, Fetch API та автоматизоване тестування. Каталог, деталі та записи завантажуються з БД. Реєстрація, вхід, власні записи й адміністративне керування каталогом працюють через API.

## Швидкий запуск через Docker

Для `make run` потрібні GNU Make, Node.js 22+ та Docker Desktop із Compose. Відкрийте термінал VS Code у папці `Gym_Website` (де знаходиться `Makefile`) і запустіть:

```powershell
make run
```

За замовчуванням Makefile також запускає ціль `run`, тому працює і коротка команда:

```powershell
make
```

Якщо GNU Make ще не встановлений, у Windows його можна встановити командою:

```powershell
winget install --id GnuWin32.Make --exact
```

Після встановлення повністю закрийте й знову відкрийте VS Code, щоб термінал отримав оновлений `PATH`. Якщо `make` усе ще не розпізнається, додайте каталог GNU Make до `PATH` поточного термінала:

```powershell
$env:Path = "C:\Program Files (x86)\GnuWin32\bin;$env:Path"
make --version
```

Ціль `run` встановлює залежності за потреби, створює `.env`, запускає Docker Desktop, чекає на готовність Docker Engine і PostgreSQL, ініціалізує базу та запускає сайт. Залиште термінал відкритим; сайт буде доступний за адресою **http://localhost:3000**. Для зупинки сервера натисніть `Ctrl+C`.

Якщо GNU Make встановлювати не потрібно, запустіть той самий сценарій через PowerShell:

```powershell
npm run run
```

Із батьківської папки `Gym` спершу перейдіть до проєкту командою `cd .\Gym_Website`. У Makefile також є цілі `make db` (підготувати й запустити PostgreSQL), `make db-init` (ініціалізувати схему та початкові дані) і `make test` (запустити тести).

Якщо потрібно виконати запуск вручну, у терміналі проєкту використовуйте:

```powershell
npm ci
npm run setup
docker desktop start
docker info
docker compose up -d --wait db
docker compose ps
npm run db:init
npm start
```

Переконайтеся, що `docker info` завершується без помилки, а `docker compose ps` показує стан бази `healthy`. Не запускайте `npm run db:init` або `npm start`, доки PostgreSQL не готовий. Відкриття HTML як локального файлу не запускає серверну версію.

`npm run setup` створює `.env` із випадковими секретами та паролем адміністратора. Дані для входу admin: `ADMIN_EMAIL` і `ADMIN_PASSWORD` у цьому файлі. Звичайний користувач реєструється через `account.html`. Секрети не додаються до Git. `.env.example` описує змінні для ручного налаштування.

База доступна лише локально на порту 54329; дані зберігаються у Docker volume між перезапусками. `npm run db:init` створює відсутню схему та початкові дані без перезаписування наявних рядків. Якщо порт зайнятий, узгоджено змініть порт у `compose.yaml` і `DATABASE_URL`. Для власного PostgreSQL задайте `DATABASE_URL` і пропустіть запуск Docker.

Перевірити, що PostgreSQL запущений:

```bash
docker compose ps
```

Повторний запуск після першого налаштування через Make:

```powershell
make run
```

Команда запуску сама перевіряє Docker Engine і чекає на готовність бази. Якщо запускаєте вручну, спершу переконайтеся, що `docker info` не показує помилку підключення, а `docker compose ps` показує стан бази `healthy`.

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

## Автоматизовані тести — КП №3

Перед запуском тестів PostgreSQL має бути healthy, а схема — ініціалізована:

```bash
docker compose up -d --wait db
npm run db:init
npm test
```

`npm test` однією командою запускає 12 unit-тестів і 12 REST API-тестів та друкує V8 code coverage. API-тести створюють ізольованого тимчасового користувача й видаляють його дані після завершення.

Окремі набори для швидкої перевірки:

```bash
npm run test:unit
npm run test:api
```

Документація тестування:

- [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) — область, стратегія, середовище та критерії завершення;
- [`docs/TEST-CASES.md`](docs/TEST-CASES.md) — 9 ручних тест-кейсів із фактичними результатами;
- [`docs/BUG-REPORTS.md`](docs/BUG-REPORTS.md) — 3 дефекти, виправлення і регресія;
- [`docs/TEST-SUMMARY.md`](docs/TEST-SUMMARY.md) — підсумок 33/33 Passed і coverage;
- [`lab-report-3/report.pdf`](lab-report-3/report.pdf) — окремий PDF-звіт КП №3.

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
- `Makefile` — цілі `run`, `db`, `db-init` і `test` для GNU Make.
- `scripts/app.js`, `scripts/api.js` — інтерфейс і Fetch; `setup.js`, `init-db.js`, `run.ps1`, `wait-docker.ps1` — налаштування й запуск у Windows.
- `docs/API.md` — методи, URL, приклади JSON, коди відповідей і порядок перевірки.
- `docs/insomnia-collection.json` — імпортована колекція для ручних запитів без секретів.
- `docs/DATABASE.md` — сутності, зв’язки та обґрунтування 3НФ.
- `lab-report-2/` — новий звіт LaTeX/PDF, ER-діаграма, скриншоти API та інтерфейсу, результати перевірок.
- `tests/unit/`, `tests/api/` — unit та інтеграційні API-тести КП №3.
- `lab-report-3/` — окремий звіт LaTeX/PDF і скриншот автоматизованих тестів.

## Прогрес

Матеріали КП №1 збережені у `lab-report/`, КП №2 — у `lab-report-2/`, КП №3 — у `lab-report-3/`. Початковий README — `docs/LAB1-README.md`; код першої версії доступний у тегу `lab1-v1.0`. Нові звіти не замінюють попередні.

Репозиторій: https://github.com/Dima018/Gym_Website

Дошка: https://github.com/users/Dima018/projects/13

## Перевірка

Ручні кейси, unit- та API-набори підтверджують CRUD, 400/401/403/404/409, валідацію і права власника. Результат КП №3: 9/9 ручних, 12/12 unit і 12/12 API-тестів Passed; загальне покриття рядків — 80,44%, `server/validation.js` — 100%.

Для інтернет-розгортання використовуйте HTTPS і власні секрети. Локальний запуск не публікує бекенд в інтернет; GitHub Pages не запускає Node.js/PostgreSQL.
