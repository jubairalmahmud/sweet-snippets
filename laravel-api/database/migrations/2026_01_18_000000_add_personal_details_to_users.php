<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('location')->nullable()->after('cover');
            $table->string('hometown')->nullable()->after('location');
            $table->string('birthday')->nullable()->after('hometown');
            $table->string('website')->nullable()->after('birthday');
            $table->string('work')->nullable()->after('website');
            $table->string('education')->nullable()->after('work');
            $table->string('blood_group', 16)->nullable()->after('education');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'location',
                'hometown',
                'birthday',
                'website',
                'work',
                'education',
                'blood_group',
            ]);
        });
    }
};
