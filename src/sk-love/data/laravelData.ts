// @ts-nocheck
// SK-Love Dating Application Database Schema & Controller Data helper

export const SK_LOVE_SQL_SCHEMA = `-- SK-Love Dating Application Database Schema Dump
-- Optimized for MySQL / MariaDB (Laravel Migration Ready)

-- 1. Users Table (Core information & virtual wallets)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    avatar VARCHAR(255) DEFAULT 'default_avatar.png',
    role ENUM('user', 'host', 'agency_admin', 'super_admin') DEFAULT 'user',
    diamond_balance INT DEFAULT 0,
    r_coin_balance INT DEFAULT 0,
    vip_level INT DEFAULT 0,
    avatar_frame VARCHAR(255) DEFAULT NULL,
    entry_effect VARCHAR(255) DEFAULT NULL,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    referred_by_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referred_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Agencies Table (Agency Management System)
CREATE TABLE agencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    agency_name VARCHAR(191) NOT NULL,
    agency_code VARCHAR(100) UNIQUE NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 10.00, -- dynamic commission
    status ENUM('pending', 'active', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Hosts Table (Creator system - mapped under agency or independent)
CREATE TABLE hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    agency_id INT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    host_privilege_panel TEXT DEFAULT NULL,
    total_earned_r_coins BIGINT DEFAULT 0,
    current_status ENUM('idle', 'streaming', 'paused') DEFAULT 'idle',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

-- 4. Live Streams Table (Streaming rooms & categories)
CREATE TABLE live_streams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    room_title VARCHAR(255) NOT NULL,
    room_type ENUM('public', 'private') DEFAULT 'public',
    category ENUM('explore', 'live', 'party', 'pk') DEFAULT 'live',
    viewer_counter INT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    status ENUM('live', 'ended') DEFAULT 'live',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

-- 5. PK Battles Table (Real-time PK system)
CREATE TABLE pk_battles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stream_left_id INT NOT NULL,
    stream_right_id INT NOT NULL,
    score_left INT DEFAULT 0,
    score_right INT DEFAULT 0,
    duration_timer INT DEFAULT 300, -- 5 Minutes
    winner_stream_id INT NULL,
    status ENUM('active', 'ended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stream_left_id) REFERENCES live_streams(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_right_id) REFERENCES live_streams(id) ON DELETE CASCADE
);

-- 6. Gifts Table
CREATE TABLE gifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    diamond_price INT NOT NULL,
    r_coin_value INT NOT NULL,
    icon_image VARCHAR(255) NOT NULL
);

-- 7. Offline Deposits Table (Payment gateway-less recharge)
CREATE TABLE offline_deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    requested_diamonds INT NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    transaction_proof_image VARCHAR(255) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    verified_by_admin_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`;

export const laravelControllerCode = `<?php

namespace App\\Http\\Controllers;

use App\\Models\\User;
use App\\Models\\OfflineDeposit;
use Illuminate\\Http\\Request;
use Illuminate\\Support5\\Facades\\DB;

class RechargeController extends Controller
{
    // Feature 4: Create Manual Offline Recharge Request
    public function submitRechargeRequest(Request $request)
    {
        $request->validate([
            'payment_method' => 'required|string',
            'amount_paid' => 'required|numeric|min:50',
            'transaction_proof_image' => 'required|string', // S3 / Storage Path
        ]);

        $diamonds = $request->amount_paid * 1.1; // 10% special virtual discount rate

        $deposit = OfflineDeposit::create([
            'user_id' => auth()->id(),
            'requested_diamonds' => $diamonds,
            'payment_method' => $request->payment_method,
            'amount_paid' => $request->amount_paid,
            'transaction_proof_image' => $request->transaction_proof_image,
            'status' => 'pending'
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Balance will be credited after manager review!',
            'data' => $deposit
        ]);
    }

    // Feature 4: Admin Approve & Instantly Credit Wallet
    public function approveRequest($id)
    {
        return DB::transaction(function() use ($id) {
            $deposit = OfflineDeposit::findOrFail($id);
            if ($deposit->status !== 'pending') {
                return response()->json(['message' => 'Already processed!'], 400);
            }

            $deposit->update([
                'status' => 'approved',
                'verified_by_admin_id' => auth()->id()
            ]);

            // Real-time diamond increment inside User wallet
            $user = User::findOrFail($deposit->user_id);
            $user->increment('diamond_balance', $deposit->requested_diamonds);

            return response()->json([
                'status' => 'success',
                'message' => 'Recharge was successful and ' . $deposit->requested_diamonds . ' Diamonds have been credited to the user account.'
            ]);
        });
    }
}`;
