<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::define('admin', function ($user) {
            if (!$user) return false;
            return (bool) ($user->is_admin ?? false)
                || (bool) ($user->is_superadmin ?? false)
                || in_array(strtolower((string) ($user->role ?? '')), ['admin', 'superadmin'], true);
        });
    }
}
