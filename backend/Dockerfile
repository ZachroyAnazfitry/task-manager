FROM php:8.2-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libzip-dev libicu-dev libonig-dev \
    && docker-php-ext-install zip intl mbstring pdo pdo_mysql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV COMPOSER_ALLOW_SUPERUSER=1
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist 2>/dev/null || true

COPY . .
RUN cp .env.example .env 2>/dev/null || true
RUN tr -d '\r' < docker-entrypoint.sh > docker-entrypoint.sh.tmp && mv docker-entrypoint.sh.tmp docker-entrypoint.sh && chmod +x docker-entrypoint.sh
RUN composer install --no-dev --prefer-dist --optimize-autoloader

EXPOSE 8000
ENTRYPOINT ["/bin/sh", "/var/www/docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
