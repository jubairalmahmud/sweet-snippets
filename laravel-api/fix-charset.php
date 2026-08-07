<?php
/**
 * One-off: make party chat + seat-reaction storage utf8mb4 so Bengali text
 * and 4-byte emojis are stored/rendered correctly (no mojibake).
 *
 * Run once:  php fix-charset.php
 *
 * The party_room_messages table is recreated fresh (old comments are
 * session-scoped and not shown anyway), and reaction_emoji is widened to
 * utf8mb4 so a full emoji fits.
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// 1) Recreate party_room_messages as utf8mb4.
try {
    DB::statement("DROP TABLE IF EXISTS party_room_messages");
    DB::statement(
        "CREATE TABLE party_room_messages (" .
        "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, " .
        "room_id BIGINT UNSIGNED NOT NULL, " .
        "user_id BIGINT UNSIGNED NULL, " .
        "name VARCHAR(191) NULL, " .
        "text VARCHAR(500) NOT NULL, " .
        "reply_to_name VARCHAR(191) NULL, " .
        "created_at TIMESTAMP NULL, " .
        "INDEX prm_room_created (room_id, created_at)" .
        ") DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    echo "OK: party_room_messages recreated as utf8mb4\n";
} catch (\Throwable $e) {
    echo "ERR messages: " . $e->getMessage() . "\n";
}

// 2) Make reaction_emoji utf8mb4 so a 4-byte emoji stores correctly.
try {
    DB::statement(
        "ALTER TABLE party_room_seats MODIFY reaction_emoji " .
        "VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL"
    );
    echo "OK: reaction_emoji is now utf8mb4\n";
} catch (\Throwable $e) {
    echo "ERR reaction_emoji: " . $e->getMessage() . "\n";
}

echo "DONE\n";
