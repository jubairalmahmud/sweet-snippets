<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('about:sk-love', function () {
    $this->info('SK Love Laravel API is installed.');
})->purpose('Show SK Love API installation status');