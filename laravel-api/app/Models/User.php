<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'name', 'email', 'password',
        'diamonds', 'r_coins', 'vip_level', 'is_admin', 'is_banned', 'role',
        'gender', 'bio', 'avatar', 'cover',
        'location', 'hometown', 'birthday', 'website', 'work', 'education', 'blood_group',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
        'is_admin'          => 'boolean',
        'is_banned'         => 'boolean',
    ];
}
