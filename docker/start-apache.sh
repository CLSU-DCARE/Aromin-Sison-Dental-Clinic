#!/bin/sh
set -eu

# Railway supplies PORT at runtime. The base Apache image otherwise binds 80.
: "${PORT:=8080}"
sed -ri "s/^Listen [0-9]+$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# This is the Railway Volume mount point. The application already writes to
# these paths, so no upload-path changes are necessary.
mkdir -p /var/www/html/backend/uploads/receipts \
         /var/www/html/backend/uploads/profiles \
         /var/www/html/backend/uploads/promotions \
         /var/www/html/backend/uploads/.sessions
chown -R www-data:www-data /var/www/html/backend/uploads
chmod 0755 /var/www/html/backend/uploads \
           /var/www/html/backend/uploads/receipts \
           /var/www/html/backend/uploads/profiles \
           /var/www/html/backend/uploads/promotions \
           /var/www/html/backend/uploads/.sessions

# Railway's runtime can re-enable the event MPM. PHP's Apache integration
# requires prefork, so enforce exactly that one just before startup.
rm -f /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_event.load \
      /etc/apache2/mods-enabled/mpm_worker.conf \
      /etc/apache2/mods-enabled/mpm_worker.load
exec apache2-foreground
