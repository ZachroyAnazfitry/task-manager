#!/bin/sh
set -e

# Inject env vars into .env so Laravel sees them (avoids "No APP_KEY" and ensures DB_* from compose)
if [ -f .env ]; then
  php -r '
    $f = ".env";
    $env = file_get_contents($f);
    $vars = ["APP_KEY","DB_HOST","DB_PORT","DB_DATABASE","DB_USERNAME","DB_PASSWORD","JWT_SECRET","CORS_ALLOWED_ORIGINS"];
    foreach ($vars as $k) {
      $v = getenv($k);
      if ($v !== false && $v !== "") {
        $repl = $k . "=" . str_replace(["\\", "\$"], ["\\\\", "\\\$"], $v);
        $env = preg_replace("/^" . preg_quote($k, "/") . "=.*/m", $repl, $env, 1);
        if (strpos($env, $k . "=") === false) $env .= $k . "=" . $v . "\n";
      }
    }
    file_put_contents($f, $env);
  '
fi

# Generate APP_KEY and JWT_SECRET if not set (so no manual artisan commands are needed)
php artisan key:generate --no-interaction
php artisan jwt:secret --no-interaction --force 2>/dev/null || true

# Wait for MySQL to accept connections (healthcheck can pass before TCP is ready)
echo "Waiting for MySQL..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if php artisan db:show 2>/dev/null; then
    echo "MySQL is ready."
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "MySQL did not become ready in time."
    exit 1
  fi
  sleep 2
done

exec "$@"
