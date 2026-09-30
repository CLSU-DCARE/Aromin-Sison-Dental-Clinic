FROM php:8.3-apache-bookworm

# PDO MySQL is required by the application; mbstring is used when validating
# user-entered text. Apache serves the existing PHP endpoints directly.
RUN apt-get update \
<<<<<<< HEAD
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev libonig-dev unzip \
    && docker-php-ext-install curl pdo_mysql mbstring \
=======
    && apt-get install -y --no-install-recommends libonig-dev unzip \
    && docker-php-ext-install pdo_mysql mbstring calendar \
>>>>>>> 431a792 (Fix production holiday calendar support)
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader

COPY . .
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/start-apache.sh /usr/local/bin/start-apache
COPY docker/php-production.ini /usr/local/etc/php/conf.d/production.ini

RUN sed -i 's/\r$//' /usr/local/bin/start-apache \
    && chmod 755 /usr/local/bin/start-apache

EXPOSE 8080
CMD ["/usr/local/bin/start-apache"]
