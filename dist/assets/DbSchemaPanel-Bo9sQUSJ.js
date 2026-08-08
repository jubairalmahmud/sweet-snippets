import{c as n,j as e,s as l,p as s,t as r}from"./index-CMKkTNQ5.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],E=n("code",o);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],N=n("terminal",c),i=`-- SK-Love Dating Application Database Schema Dump
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
);`,d=`<?php

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
}`;function T({copiedText:a,handleCopyText:t}){return e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-12 gap-6",children:[e.jsxs("div",{className:"lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[500px]",children:[e.jsxs("div",{className:"p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2 text-slate-200 font-semibold text-sm",children:[e.jsx(l,{className:"w-4 h-4 text-emerald-400"}),"Laravel MySQL Schema Dumper"]}),e.jsx("button",{id:"btn_copy_schema",onClick:()=>t(i,"schema"),className:"text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer",children:a==="schema"?e.jsxs(e.Fragment,{children:[e.jsx(s,{className:"w-3.5 h-3.5 text-emerald-400"}),"Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{className:"w-3.5 h-3.5"}),"Copy SQL Schema"]})})]}),e.jsxs("div",{className:"p-4 flex-1 flex flex-col",children:[e.jsx("label",{htmlFor:"schema_textarea",className:"sr-only",children:"Laravel MySQL Schema"}),e.jsx("textarea",{id:"schema_textarea",value:i,readOnly:!0,className:"w-full flex-1 min-h-[460px] bg-slate-950 rounded-xl p-4 font-mono text-[10.5px] text-teal-300 border border-slate-800/80 leading-relaxed resize-none focus:outline-none"})]}),e.jsxs("div",{className:"p-3 bg-slate-950/65 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-2",children:[e.jsx(N,{className:"w-4 h-4 text-emerald-500"}),e.jsxs("span",{children:["Model migration file ready to paste in ",e.jsx("code",{children:"database/migrations/"})]})]})]}),e.jsxs("div",{className:"lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[500px]",children:[e.jsxs("div",{className:"p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2 text-slate-200 font-semibold text-sm",children:[e.jsx(E,{className:"w-4 h-4 text-purple-400"}),"Laravel Backend Logic (RechargeController.php)"]}),e.jsx("button",{id:"btn_copy_laravel",onClick:()=>t(d,"laravel"),className:"text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer",children:a==="laravel"?e.jsxs(e.Fragment,{children:[e.jsx(s,{className:"w-3.5 h-3.5 text-emerald-400"}),"Copied!"]}):e.jsxs(e.Fragment,{children:[e.jsx(r,{className:"w-3.5 h-3.5"}),"Copy Code"]})})]}),e.jsx("div",{className:"p-5 flex-1 overflow-auto max-h-[500px]",children:e.jsx("pre",{className:"text-[11px] font-mono text-purple-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-850/80",children:e.jsx("code",{children:d})})}),e.jsxs("div",{className:"p-4 bg-slate-950/65 border-t border-slate-800 text-[10.5px] text-slate-400 leading-relaxed",children:[e.jsx("span",{className:"font-bold text-indigo-400",children:"🔥 Pro Recommendation:"})," Define API routes in your Laravel project like this:"," ",e.jsx("code",{className:"bg-slate-900 px-1 py-0.5 rounded text-white text-[10px]",children:"Route::post('/recharge', [RechargeController::class, 'submitRechargeRequest']);"})]})]})]})}export{T as default};
