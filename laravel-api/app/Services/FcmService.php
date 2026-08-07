<?php

namespace App\Services;

use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FcmNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class FcmService
{
    protected static $messaging = null;

    protected static function messaging()
    {
        if (self::$messaging) {
            return self::$messaging;
        }

        $credentialsPath = env('FIREBASE_CREDENTIALS', storage_path('app/firebase/service-account.json'));
        if (! preg_match('/^([A-Za-z]:[\\\\\\/]|[\\\\\\/])/', $credentialsPath)) {
            $credentialsPath = base_path($credentialsPath);
        }

        if (! is_file($credentialsPath)) {
            throw new RuntimeException("Firebase credentials not found at: {$credentialsPath}");
        }

        self::$messaging = (new Factory())
            ->withServiceAccount($credentialsPath)
            ->createMessaging();

        return self::$messaging;
    }

    public static function sendToUser($userId, string $title, string $body, array $data = []): int
    {
        $tokens = DB::table('push_tokens')->where('user_id', $userId)->pluck('token')->all();
        return self::sendToTokens($tokens, $title, $body, $data);
    }

    public static function sendToUsers(array $userIds, string $title, string $body, array $data = []): int
    {
        $tokens = DB::table('push_tokens')->whereIn('user_id', $userIds)->pluck('token')->all();
        return self::sendToTokens($tokens, $title, $body, $data);
    }

    public static function sendToTokens(array $tokens, string $title, string $body, array $data = []): int
    {
        $tokens = array_values(array_unique(array_filter($tokens)));
        if (empty($tokens)) {
            return 0;
        }

        try {
            $messaging = self::messaging();
            $message = CloudMessage::new()
                ->withNotification(FcmNotification::create($title, $body))
                ->withData(self::stringData($data));

            $report = $messaging->sendMulticast($message, $tokens);
            self::deleteInvalidTokens($report, $tokens);

            return $report->successes()->count();
        } catch (Throwable $e) {
            Log::error('FCM send failed: '.$e->getMessage());
            return 0;
        }
    }

    public static function sendToTopic(string $topic, string $title, string $body, array $data = []): bool
    {
        try {
            $message = CloudMessage::withTarget('topic', $topic)
                ->withNotification(FcmNotification::create($title, $body))
                ->withData(self::stringData($data));

            self::messaging()->send($message);
            return true;
        } catch (Throwable $e) {
            Log::error('FCM topic send failed: '.$e->getMessage());
            return false;
        }
    }

    private static function stringData(array $data): array
    {
        $stringData = [];
        foreach ($data as $key => $value) {
            $stringData[(string) $key] = is_scalar($value) ? (string) $value : json_encode($value);
        }
        return $stringData;
    }

    private static function deleteInvalidTokens($report, array $tokens): void
    {
        $invalid = [];
        foreach ($report->getItems() as $index => $item) {
            if (! $item->isFailure()) {
                continue;
            }

            $error = $item->error();
            $message = (string) ($error?->getMessage() ?? '');
            if ($error instanceof NotFound || str_contains($message, 'registration-token-not-registered')) {
                $invalid[] = $tokens[$index] ?? null;
            }
        }

        $invalid = array_values(array_filter($invalid));
        if ($invalid) {
            DB::table('push_tokens')->whereIn('token', $invalid)->delete();
        }
    }
}
