# SK Love — Laravel 11 Auth API

Production-ready Laravel API for the SK Love React app.
Endpoints: `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/wallet`.
Auth: Laravel Sanctum (Bearer JWT-style tokens).

---

## 1. Local Setup

```bash
cd laravel-api
composer install
cp .env.example .env
php artisan key:generate
# MySQL credential .env-এ বসান (DB_DATABASE, DB_USERNAME, DB_PASSWORD)
php artisan migrate
php artisan serve --host=0.0.0.0 --port=8000
```

তারপর React app-এর root-এ `.env` ফাইলে দিন:

```
VITE_LARAVEL_API_URL=http://localhost:8000
```

Vite restart দিলেই login/register Laravel API দিয়ে কাজ করবে।

---

## 2. Production Deploy — যে কোনো একটি বেছে নিন

### Option A: Hostinger / cPanel (সবচেয়ে সহজ, ~৳২৫০/মাস)
1. Hostinger-এ একটা MySQL database create করুন।
2. cPanel File Manager-এ এই পুরো `laravel-api/` ফোল্ডার zip করে upload + extract করুন (`public_html`-এর বাইরে, যেমন `/home/USER/laravel-api`)।
3. `public_html` ফোল্ডারের ভেতরে Laravel-এর `public/` ফোল্ডারের কনটেন্ট symlink/copy করুন; `index.php`-তে path গুলো update:
   ```php
   require __DIR__.'/../laravel-api/vendor/autoload.php';
   $app = require_once __DIR__.'/../laravel-api/bootstrap/app.php';
   ```
4. cPanel Terminal-এ: `cd ~/laravel-api && composer install --no-dev && php artisan migrate --force && php artisan config:cache`
5. আপনার domain হবে production API URL, যেমন `https://api.yourdomain.com`।

### Option B: Railway (free tier, auto-deploy, recommended)
1. https://railway.app-এ GitHub দিয়ে signup।
2. New Project → Deploy from GitHub Repo → এই `laravel-api/` ফোল্ডার push করা একটা repo select করুন।
3. Add MySQL plugin → Railway auto-inject করবে `MYSQL_URL` ইত্যাদি; `.env`-এ map করুন।
4. Deploy-এর পর Railway একটা URL দেবে, যেমন `https://sk-love-api-production.up.railway.app`।

### Option C: DigitalOcean App Platform (~$5/মাস)
1. DigitalOcean App Platform → Create App → GitHub repo connect।
2. Detect PHP/Laravel, Build cmd: `composer install --no-dev && php artisan migrate --force`।
3. Run cmd: `heroku-php-apache2 public/`।
4. Add Managed MySQL DB। ENV variables Dashboard-এ বসান।

---

## 3. Production API URL React App-এ বসান

Deploy শেষে যেই URL পাবেন সেটা Lovable project-এর environment variable হিসেবে set করুন:

```
VITE_LARAVEL_API_URL=https://your-deployed-api.com
```

Lovable preview/published app সাথে সাথেই Laravel backend ব্যবহার শুরু করবে।
API down থাকলে App.tsx-এ একটা sandbox fallback আছে — তাই UX break হয় না।

---

## 4. Endpoints Quick Reference

| Method | Path           | Body                                       | Returns                     |
|--------|----------------|--------------------------------------------|-----------------------------|
| POST   | /api/register  | `{name,email,password,password_confirmation}` | `{token,user}`           |
| POST   | /api/login     | `{email,password}`                         | `{token,user}`              |
| POST   | /api/logout    | (Bearer token)                             | `{message}`                 |
| GET    | /api/me        | (Bearer token)                             | `{user}`                    |
| GET    | /api/wallet    | (Bearer token)                             | `{diamonds,rCoins,vipLevel}`|

CORS সব origin-এর জন্য enabled (`config/cors.php`)।
