<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserFrames;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ProfileController extends Controller
{
    /**
     * Public profile fetch — returns the latest row for any user id.
     * Frontend calls this whenever a profile card opens so the role pill
     * always reflects the current value in the users table.
     */
    public function show($id)
    {
        $u = User::findOrFail($id);
        return response()->json(['user' => $this->shape($u)]);
    }

    /**
     * Update display name, bio, gender, and profile personal details.
     */
    public function update(Request $request)
    {
        $data = $request->validate([
            'name'   => ['sometimes', 'string', 'max:120'],
            'bio'    => ['sometimes', 'nullable', 'string', 'max:500'],
            'gender' => ['sometimes', 'nullable', 'in:Male,Female,Other'],
            'location'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'hometown'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'birthday'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'website'     => ['sometimes', 'nullable', 'string', 'max:255'],
            'work'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'education'   => ['sometimes', 'nullable', 'string', 'max:255'],
            'blood_group' => ['sometimes', 'nullable', 'string', 'max:16'],
        ]);

        $user = $request->user();
        $user->fill($data);
        $user->save();

        return response()->json(['user' => $this->shape($user)]);
    }

    /**
     * Upload avatar (data-URL string from cropper). Max ~2 MB after base64.
     */
    public function uploadAvatar(Request $request)
    {
        $data = $request->validate([
            'image' => ['required', 'string', 'max:3000000'],
        ]);

        $this->assertDataUrl($data['image']);

        $user = $request->user();
        $user->avatar = $data['image'];
        $user->save();

        return response()->json(['user' => $this->shape($user)]);
    }

    /**
     * Upload cover image.
     */
    public function uploadCover(Request $request)
    {
        $data = $request->validate([
            'image' => ['required', 'string', 'max:5000000'],
        ]);

        $this->assertDataUrl($data['image']);

        $user = $request->user();
        $user->cover = $data['image'];
        $user->save();

        return response()->json(['user' => $this->shape($user)]);
    }

    private function assertDataUrl(string $s): void
    {
        if (! preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#i', $s) &&
            ! preg_match('#^https?://#i', $s)) {
            abort(422, 'Invalid image payload.');
        }
    }

    private function shape($u): array
    {
        $role = 'user';
        if ((bool) ($u->is_admin ?? false)) {
            $role = 'admin';
        } elseif (Schema::hasColumn('users', 'role')) {
            $candidate = (string) ($u->role ?: 'user');
            if (in_array($candidate, ['user', 'agent', 'reseller', 'admin'], true)) {
                $role = $candidate;
            }
        }

        // Currently equipped avatar frame — read from user_frames (DB), so it
        // follows the user across devices automatically.
        $frameFields = UserFrames::shape($u->id);

        return array_merge([
            'id'        => $u->id,
            'name'      => $u->name,
            'email'     => $u->email,
            'diamonds'  => (int) $u->diamonds,
            'rCoins'    => (int) $u->r_coins,
            'earnings'  => (int) ($u->host_earnings ?? 0),
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
        ], $frameFields);
    }
}
