<?php

namespace App\Providers;

use App\Models\Task;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Scoped route model binding: resolve task only for the authenticated user (404 for others).
        Route::bind('task', function (string $value) {
            return Task::forUser(auth('api')->id())->findOrFail($value);
        });
    }
}
