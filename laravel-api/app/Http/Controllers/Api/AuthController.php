<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserFrames;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'diamonds' => 1000,
            'r_coins'  => 350,
            'vip_level'=> 1,
        ]);

        $token = $user->createToken('sk-love-app')->plainTextToken;
        $this->touchLastSeen($user);

        return response()->json([
            'token' => $token,
            'user'  => $this->shape($user),
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if ($user->is_banned) {
            return response()->json(['message' => 'Account banned.'], 403);
        }

        $token = $user->createToken('sk-love-app')->plainTextToken;
        $this->touchLastSeen($user);

        return response()->json([
            'token' => $token,
            'user'  => $this->shape($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        $this->touchLastSeen($request->user());
        return response()->json(['user' => $this->shape($request->user())]);
    }

    public function heartbeat(Request $request)
    {
        $this->touchLastSeen($request->user());
        return response()->json(['ok' => true]);
    }

    private function touchLastSeen(User $user): void
    {
        if (Schema::hasColumn('users', 'last_seen_at')) {
            $user->forceFill(['last_seen_at' => now()])->save();
        }
    }

    private function shape(User $u): array
    {
        $role = $this->resolveRole($u);
        $frameFields = UserFrames::shape($u->id);

        return array_merge([
            'id'        => $u->id,
            'name'      => $u->name,
            'email'     => $u->email,
            'diamonds'  => (int) $u->diamonds,
            'rCoins'    => (int) $u->r_coins,
            'vipLevel'  => (int) $u->vip_level,
            'isAdmin'   => (bool) $u->is_admin,
            'role'      => $role,
            'bio'       => $u->bio,
            'gender'    => $u->gender,
            'avatar'    => $u->avatar,
            'cover'     => $u->cover,
            'location'   => $u->location,
            'hometown'   => $u->hometown,
            'birthday'   => $u->birthday,
            'website'    => $u->website,
            'work'       => $u->work,
            'education'  => $u->education,
            'bloodGroup' => $u->blood_group,
            'avatarFrame'  => $frameFields['activeFrame'] ?? ($u->avatar_frame ?? null),
            'entryEffect'  => Schema::hasColumn('users', 'entry_effect') ? ($u->entry_effect ?? null) : null,
            'entry_effect' => Schema::hasColumn('users', 'entry_effect') ? ($u->entry_effect ?? null) : null,
        ], $frameFields);
    }

    private function resolveRole(User $u): string
    {
        if ((bool) $u->is_admin) {
            return 'admin';
        }

        if (Schema::hasColumn('users', 'role')) {
            $role = (string) ($u->role ?: 'user');
            if (in_array($role, ['user', 'agent', 'reseller', 'admin'], true)) {
                return $role;
            }
        }

        return 'user';
    }
}
