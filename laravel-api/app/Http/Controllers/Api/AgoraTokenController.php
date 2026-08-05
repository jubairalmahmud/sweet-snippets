<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AgoraTokenController extends Controller
{
    private const PRIVILEGE_JOIN_CHANNEL = 1;
    private const PRIVILEGE_PUBLISH_AUDIO_STREAM = 2;
    private const PRIVILEGE_PUBLISH_VIDEO_STREAM = 3;
    private const PRIVILEGE_PUBLISH_DATA_STREAM = 4;

    public function issue(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        $data = $request->validate([
            'channelName' => 'required|string|max:128|regex:/^[A-Za-z0-9_\-]+$/',
            'uid' => 'nullable',
            'role' => 'nullable|string|in:publisher,subscriber,host,audience',
            'expireSeconds' => 'nullable|integer|min:60|max:86400',
        ]);

        $appId = (string) config('services.agora.app_id');
        $certificate = (string) config('services.agora.app_certificate');
        if ($appId === '' || $certificate === '') {
            abort(500, 'Agora credentials are not configured.');
        }
        if (!preg_match('/^[0-9a-f]{32}$/i', $appId) || !preg_match('/^[0-9a-f]{32}$/i', $certificate)) {
            abort(500, 'Agora credentials are invalid. Check AGORA_APP_ID and AGORA_APP_CERTIFICATE.');
        }

        $role = $data['role'] ?? 'publisher';
        $uid = (string) ($data['uid'] ?? $user->id);
        $ttl = (int) ($data['expireSeconds'] ?? config('services.agora.token_ttl', 3600));
        $expiresAt = time() + $ttl;

        $token = $this->buildRtcToken(
            $appId,
            $certificate,
            $data['channelName'],
            $uid,
            $role === 'publisher' || $role === 'host',
            $expiresAt,
        );

        return response()->json([
            'appId' => $appId,
            'token' => $token,
            'channelName' => $data['channelName'],
            'uid' => $uid,
            'role' => $role,
            'expiresAt' => $expiresAt,
        ]);
    }

    private function buildRtcToken(
        string $appId,
        string $certificate,
        string $channelName,
        string $uid,
        bool $canPublish,
        int $expiresAt,
    ): string {
        $privileges = [
            self::PRIVILEGE_JOIN_CHANNEL => $expiresAt,
        ];

        if ($canPublish) {
            $privileges[self::PRIVILEGE_PUBLISH_AUDIO_STREAM] = $expiresAt;
            $privileges[self::PRIVILEGE_PUBLISH_VIDEO_STREAM] = $expiresAt;
            $privileges[self::PRIVILEGE_PUBLISH_DATA_STREAM] = $expiresAt;
        }

        $message = $this->packMessage(random_int(1, 99999999), $expiresAt, $privileges);
        $signatureBase = $appId . $channelName . $uid . $message;
        $signature = hash_hmac('sha256', $signatureBase, $certificate, true);

        $tokenBody = $this->packString($signature)
            . $this->packUint32($this->unsignedCrc32($channelName))
            . $this->packUint32($this->unsignedCrc32($uid))
            . $this->packString($message);

        return '006' . $appId . base64_encode($tokenBody);
    }

    private function packMessage(int $salt, int $expiresAt, array $privileges): string
    {
        $buffer = $this->packUint32($salt)
            . $this->packUint32($expiresAt)
            . $this->packUint16(count($privileges));

        foreach ($privileges as $privilege => $timestamp) {
            $buffer .= $this->packUint16((int) $privilege)
                . $this->packUint32((int) $timestamp);
        }

        return $buffer;
    }

    private function packString(string $value): string
    {
        return $this->packUint16(strlen($value)) . $value;
    }

    private function packUint16(int $value): string
    {
        return pack('v', $value);
    }

    private function packUint32(int $value): string
    {
        return pack('V', $value);
    }

    private function unsignedCrc32(string $value): int
    {
        return (int) sprintf('%u', crc32($value));
    }
}
