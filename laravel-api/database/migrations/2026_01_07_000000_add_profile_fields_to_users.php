<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('gender', 16)->nullable()->after('vip_level');
            $table->string('bio', 500)->nullable()->after('gender');
            $table->longText('avatar')->nullable()->after('bio');   // data-URL or external URL
            $table->longText('cover')->nullable()->after('avatar'); // data-URL or external URL
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['gender', 'bio', 'avatar', 'cover']);
        });
    }
};
