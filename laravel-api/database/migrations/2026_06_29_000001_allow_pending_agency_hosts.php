<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE agency_hosts MODIFY status ENUM('Pending','Active','Suspended') DEFAULT 'Pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE agency_hosts SET status = 'Suspended' WHERE status = 'Pending'");
        DB::statement("ALTER TABLE agency_hosts MODIFY status ENUM('Active','Suspended') DEFAULT 'Active'");
    }
};
