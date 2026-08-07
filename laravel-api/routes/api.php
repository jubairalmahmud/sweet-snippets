<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\CashoutController;
use App\Http\Controllers\Api\GiftController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\VipPriceController;
use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\AdminAgencyController;
use App\Http\Controllers\Api\AgencyApplicationController;
use App\Http\Controllers\Api\AgencyDashboardController;
use App\Http\Controllers\Api\AgencySalaryController;
use App\Http\Controllers\Api\Admin\SalarySettingsController;
use App\Http\Controllers\Api\Admin\SalaryController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\BannerController;
use App\Http\Controllers\Api\GiftCatalogController;
use App\Http\Controllers\Api\LiveRoomController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\FollowController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\PushTokenController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\CallSessionController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\AdminStatsController;
use App\Http\Controllers\Api\AgoraTokenController;
use App\Http\Controllers\Api\PartyRoomController;
use App\Http\Controllers\Api\PartyJoinRequestController;
use App\Http\Controllers\Api\MatchRequestController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\RoleRequestController;
use App\Http\Controllers\Api\HostRequestController;
use App\Http\Controllers\Api\AdminHostTargetController;
use App\Http\Controllers\Api\PartyThemeController;

use App\Http\Controllers\Api\PKBattleController;

use App\Http\Controllers\Api\GameController;
// ---- Phase A+B new controllers ----
use App\Http\Controllers\FrameCatalogController;
use App\Http\Controllers\EntryEffectController;
use App\Http\Controllers\UserBlockController;
use App\Http\Controllers\RoomMuteController;
use App\Http\Controllers\PostCommentController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// ---------- Phase A+B: Public read-only ----------
Route::get('/party-themes/catalog',     [PartyThemeController::class, 'catalog']);
Route::get('/frame-catalog',            [FrameCatalogController::class, 'index']);
Route::get('/entry-effects',            [EntryEffectController::class, 'index']);
Route::get('/posts/{postId}/comments',  [PostCommentController::class, 'index']);

// Game Controller
Route::get('/games/config', [GameController::class, 'config']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);
    Route::post('/heartbeat', [AuthController::class, 'heartbeat']);
    Route::get('/wallet',           [WalletController::class, 'show']);
    Route::post('/wallet/convert',  [WalletController::class, 'convert']);
    Route::post('/wallet/cashout',  [WalletController::class, 'cashout']);
    Route::post('/wallet/vip',      [WalletController::class, 'buyVip']);
    Route::post('/wallet/buy-item', [WalletController::class, 'buyItem']);
    Route::post('/wallet/gift',     [WalletController::class, 'sendGift']);
    Route::get('/reseller/dashboard', [WalletController::class, 'resellerDashboard']);
    Route::post('/reseller/transfer', [WalletController::class, 'resellerTransfer']);
    Route::get('/role-requests/mine', [RoleRequestController::class, 'mine']);
    Route::post('/role-requests', [RoleRequestController::class, 'store']);
    Route::post('/party-rooms/{id}/theme', [PartyRoomController::class, 'setTheme']);


    
    Route::get('/host/my-target', [AdminHostTargetController::class, 'forHost']);
    Route::get('/admin/host-target', [AdminHostTargetController::class, 'index']);
    Route::post('/admin/host-target', [AdminHostTargetController::class, 'store']);
    Route::put('/admin/host-target/{id}', [AdminHostTargetController::class, 'update']);
    Route::delete('/admin/host-target/{id}', [AdminHostTargetController::class, 'destroy']);
    Route::get('/host/my-target', [AdminHostTargetController::class, 'forHost']);



    // Game Controller

    Route::get('/games/balance',          [GameController::class, 'balance']);
    Route::post('/games/{game}/play',     [GameController::class, 'play'])
        ->where('game', 'casino|ferry|teenpatti');
    Route::get('/games/{game}/history',   [GameController::class, 'history'])
        ->where('game', 'casino|ferry|teenpatti');

        

    // PKBattle
    Route::get ('/pk/online-hosts',       [PKBattleController::class, 'onlineHosts']);
    Route::get ('/pk/active',             [PKBattleController::class, 'active']);
    Route::post('/pk/invite',             [PKBattleController::class, 'invite']);
    Route::get ('/pk/mine',               [PKBattleController::class, 'mine']);
    Route::post('/pk/accept',             [PKBattleController::class, 'accept']);
    Route::post('/pk/reject',             [PKBattleController::class, 'reject']);
    Route::post('/pk/cancel',             [PKBattleController::class, 'cancel']);
    Route::post('/pk/end',                [PKBattleController::class, 'end']);
    Route::get ('/pk/{battle}/score',     [PKBattleController::class, 'score']);
    Route::post('/pk/{battle}/gift',      [PKBattleController::class, 'gift']);
    Route::get ('/pk/{battle}/comments',  [PKBattleController::class, 'listComments']);
    Route::post('/pk/{battle}/comment',   [PKBattleController::class, 'postComment']);

    // Gift history & live feed
    Route::get('/gifts/recent',     [GiftController::class, 'recent']);
    Route::get('/gifts/mine',       [GiftController::class, 'mine']);
    Route::get('/admin/gifts',      [GiftController::class, 'adminIndex']);

    // VIP level pricing (read for all auth users, update admin only)
    Route::get('/vip-prices',         [VipPriceController::class, 'index']);
    Route::post('/admin/vip-prices',  [VipPriceController::class, 'update']);

    // User deposits
    Route::get('/deposits',  [DepositController::class, 'index']);
    Route::post('/deposits', [DepositController::class, 'store']);

    // Admin deposit management
    Route::get('/admin/deposits',                 [DepositController::class, 'adminIndex']);
    Route::post('/admin/deposits/{id}/approve',   [DepositController::class, 'approve']);
    Route::post('/admin/deposits/{id}/reject',    [DepositController::class, 'reject']);

    // Cashouts
    Route::get('/cashouts',                       [CashoutController::class, 'mine']);
    Route::get('/admin/cashouts',                 [CashoutController::class, 'adminIndex']);
    Route::post('/admin/cashouts/{id}/approve',   [CashoutController::class, 'approve']);
    Route::post('/admin/cashouts/{id}/reject',    [CashoutController::class, 'reject']);

    // Admin user management
    Route::get('/admin/users',                [AdminUserController::class, 'index']);
    Route::post('/admin/users/{id}/ban',      [AdminUserController::class, 'ban']);
    Route::post('/admin/users/{id}/unban',    [AdminUserController::class, 'unban']);
    Route::post('/admin/users/{id}/role',     [AdminUserController::class, 'updateRole']);
    Route::post('/admin/users/{id}/adjust-coins', [AdminUserController::class, 'adjustCoins']);
    Route::post('/admin/wallet-transfer',     [AdminUserController::class, 'walletTransfer']);
    Route::get('/admin/role-requests',        [RoleRequestController::class, 'adminIndex']);
    Route::post('/admin/role-requests/{id}/respond', [RoleRequestController::class, 'respond']);

    // Agencies (public list for hosts; admin CRUD)
    Route::get('/agencies',                              [AgencyController::class, 'index']);
    Route::post('/admin/agencies',                       [AgencyController::class, 'store']);
    Route::patch('/admin/agencies/{id}',                 [AgencyController::class, 'update']);
    Route::delete('/admin/agencies/{id}',                [AgencyController::class, 'destroy']);
    Route::get('/admin/agencies/{code}/hosts',           [AgencyController::class, 'hosts']);
    Route::post('/admin/agencies/{code}/hosts',          [AgencyController::class, 'addHost']);
    Route::patch('/admin/hosts/{id}',                    [AgencyController::class, 'updateHost']);
    Route::delete('/admin/hosts/{id}',                   [AgencyController::class, 'removeHost']);
    Route::get('/agency-applications/mine', [AgencyApplicationController::class, 'mine']);

    // Admin agency monitor (approved agencies performance)
    Route::get ('/admin/agencies',                 [AdminAgencyController::class, 'index']);
    Route::get ('/admin/agencies/{id}/hosts',      [AdminAgencyController::class, 'hosts']);
    Route::post('/admin/agencies/{id}/suspend',    [AdminAgencyController::class, 'suspend']);
    Route::post('/admin/agencies/{id}/reactivate', [AdminAgencyController::class, 'reactivate']);

    // Agency applications (user submits + admin approve/reject)
    Route::post('/agency-applications',                        [AgencyApplicationController::class, 'store']);
    Route::get ('/admin/agency-applications',                  [AgencyApplicationController::class, 'index']);
    Route::post('/admin/agency-applications/{id}/approve',     [AgencyApplicationController::class, 'approve']);
    Route::post('/admin/agency-applications/{id}/reject',      [AgencyApplicationController::class, 'reject']);


    // Agency Dashboard Controller
    Route::get   ('/agency/hosts',                       [AgencyDashboardController::class, 'hosts']);
    Route::post  ('/agency/hosts',                       [AgencyDashboardController::class, 'addHost']);
    Route::delete('/agency/hosts/{id}',                  [AgencyDashboardController::class, 'removeHost']);
    Route::get   ('/agency/host-requests',               [AgencyDashboardController::class, 'hostRequests']);
    Route::post  ('/agency/host-requests/{id}/approve',  [AgencyDashboardController::class, 'approveRequest']);
    Route::post  ('/agency/host-requests/{id}/reject',   [AgencyDashboardController::class, 'rejectRequest']);
    Route::get   ('/agency/target',                      [AgencyDashboardController::class, 'target']);
    Route::get   ('/agency/reports',                     [AgencyDashboardController::class, 'reports']);
    Route::get   ('/agency/reports/export',              [AgencyDashboardController::class, 'exportReports']);

    // ============================================================
    // Host Requests (user-side: apply, view status, cancel, change)
    // ============================================================
    Route::post('/host-requests',              [HostRequestController::class, 'store']);
    Route::get ('/host-requests/mine',         [HostRequestController::class, 'mine']);
    Route::post('/host-requests/mine/cancel',  [HostRequestController::class, 'cancel']);
    Route::post('/host-requests/mine/change',  [HostRequestController::class, 'change']);

    // Admin-only host target CRUD (RBAC enforced inside controller)
    Route::get   ('/admin/host-target',        [AdminHostTargetController::class, 'index']);
    Route::post  ('/admin/host-target',        [AdminHostTargetController::class, 'store']);
    Route::put   ('/admin/host-target/{id}',   [AdminHostTargetController::class, 'update']);
    Route::delete('/admin/host-target/{id}',   [AdminHostTargetController::class, 'destroy']);


    Route::get ('/admin/agency-noc-requests', function () {
        $u = auth()->user();
        $role = strtolower((string)($u->role ?? ''));
        if (!in_array($role, ['admin','superadmin','super_admin'], true))
            return response()->json(['message'=>'Forbidden'], 403);
        if (!\Schema::hasTable('agency_noc_requests'))
            return response()->json(['requests' => []]);
        $rows = \DB::table('agency_noc_requests')->orderByDesc('id')->get();
        return response()->json(['requests' => $rows]);
    });

    Route::post('/admin/agency-noc-requests/{id}/{action}', function ($id, $action) {
        $u = auth()->user();
        $role = strtolower((string)($u->role ?? ''));
        if (!in_array($role, ['admin','superadmin','super_admin'], true))
            return response()->json(['message'=>'Forbidden'], 403);
        if (!in_array($action, ['approve','reject'], true))
            return response()->json(['message'=>'Bad action'], 400);
        if (\Schema::hasTable('agency_noc_requests')) {
            \DB::table('agency_noc_requests')->where('id',$id)->update([
                'status' => $action === 'approve' ? 'approved' : 'rejected',
                'updated_at' => now(),
            ]);
        }
        return response()->json(['ok' => true]);
    });


    // Agent (read-only)
    Route::get('/agency/salary/months', [AgencySalaryController::class, 'months']);
    Route::get('/agency/salary',        [AgencySalaryController::class, 'show']);
    Route::get('/agency/salary/pdf',    [AgencySalaryController::class, 'pdf']);

    // Admin
    Route::get   ('/admin/salary-settings',             [SalarySettingsController::class, 'index']);
    Route::put   ('/admin/salary-settings',             [SalarySettingsController::class, 'update']);
    Route::get   ('/admin/agency-share-overrides',      [SalarySettingsController::class, 'overrides']);
    Route::post  ('/admin/agency-share-overrides',      [SalarySettingsController::class, 'addOverride']);
    Route::delete('/admin/agency-share-overrides/{id}', [SalarySettingsController::class, 'deleteOverride']);

    Route::get ('/admin/salary/preview',                           [SalaryController::class, 'preview']);
    Route::post('/admin/salary/{agency_id}/{year}/{month}/lock',   [SalaryController::class, 'lock']);
    Route::post('/admin/salary/{agency_id}/{year}/{month}/unlock', [SalaryController::class, 'unlock']);
    Route::put ('/admin/salary/lines/{id}',                        [SalaryController::class, 'updateLine']);


    // Host self-bind to an agency
    Route::get('/me/agency',    [AgencyController::class, 'me']);
    Route::post('/me/agency',   [AgencyController::class, 'bindMe']);
    Route::delete('/me/agency', [AgencyController::class, 'unbindMe']);

    // Profile (self) — update name/bio/gender, upload avatar/cover
    Route::put('/me/profile',   [ProfileController::class, 'update']);
    Route::post('/me/avatar',   [ProfileController::class, 'uploadAvatar']);
    Route::post('/me/cover',    [ProfileController::class, 'uploadCover']);

    // Social posts
    Route::get('/posts',         [PostController::class, 'index']);
    Route::post('/posts',        [PostController::class, 'store']);
    Route::post('/posts/{id}/like', [PostController::class, 'toggleLike']);
    Route::post('/posts/{id}/comments', [PostController::class, 'comment']);
    Route::put('/posts/{id}', [PostController::class, 'update']);
    Route::delete('/posts/{id}', [PostController::class, 'destroy']);

    // Banners / sliders
    Route::get('/banners',                  [BannerController::class, 'index']);
    Route::get('/admin/banners',            [BannerController::class, 'adminIndex']);
    Route::post('/admin/banners',           [BannerController::class, 'store']);
    Route::patch('/admin/banners/{id}',     [BannerController::class, 'update']);
    Route::delete('/admin/banners/{id}',    [BannerController::class, 'destroy']);

    // Gift catalog (configurable gifts)
    Route::get('/gift-catalog',                  [GiftCatalogController::class, 'index']);
    Route::get('/admin/gift-catalog',            [GiftCatalogController::class, 'adminIndex']);
    Route::post('/admin/gift-catalog',           [GiftCatalogController::class, 'store']);
    Route::patch('/admin/gift-catalog/{id}',     [GiftCatalogController::class, 'update']);
    Route::delete('/admin/gift-catalog/{id}',    [GiftCatalogController::class, 'destroy']);

    // Live rooms
    Route::post('/agora/token',                     [AgoraTokenController::class, 'issue']);
    Route::get('/live-rooms',                       [LiveRoomController::class, 'index']);
    Route::get('/live-rooms/{id}',                  [LiveRoomController::class, 'show']);
    Route::post('/live-rooms',                      [LiveRoomController::class, 'start']);
    Route::patch('/live-rooms/{id}',                [LiveRoomController::class, 'update']);
    Route::post('/live-rooms/{id}/end',             [LiveRoomController::class, 'end']);
    Route::post('/live-rooms/{id}/join',            [LiveRoomController::class, 'join']);
    Route::post('/live-rooms/{id}/leave',           [LiveRoomController::class, 'leave']);
    Route::post('/live-rooms/{id}/heartbeat',       [LiveRoomController::class, 'heartbeat']);
    Route::post('/live-rooms/{id}/like',            [LiveRoomController::class, 'like']);
    Route::get('/live-rooms/{id}/viewers',          [LiveRoomController::class, 'viewers']);
    Route::post('/live-rooms/{id}/cohost-requests', [LiveRoomController::class, 'requestCohost']);
    Route::post('/live-rooms/{id}/cohost-invites',   [LiveRoomController::class, 'inviteCohost']);
    Route::get('/live-room-invites',                  [LiveRoomController::class, 'myInvites']);
    Route::post('/live-room-invites/{requestId}/respond', [LiveRoomController::class, 'respondInvite']);
    Route::get('/live-rooms/{id}/cohost-requests',  [LiveRoomController::class, 'cohostRequests']);
    Route::post('/live-rooms/{id}/cohost-requests/{requestId}/respond', [LiveRoomController::class, 'respondCohost']);
    Route::get('/live-rooms/{id}/cohosts',          [LiveRoomController::class, 'cohosts']);
    Route::post('/live-rooms/{id}/cohosts/{userId}/kick', [LiveRoomController::class, 'kickCohost']);
    Route::post('/live-rooms/{id}/cohosts/leave',   [LiveRoomController::class, 'leaveCohost']);




    // Party rooms
    Route::get('/party-rooms',                       [PartyRoomController::class, 'index']);
    Route::get('/party-rooms/{id}',                  [PartyRoomController::class, 'show']);
    Route::post('/party-rooms',                      [PartyRoomController::class, 'start']);
    Route::post('/party-rooms/{id}/join',            [PartyRoomController::class, 'join']);
    Route::post('/party-rooms/{id}/end',             [PartyRoomController::class, 'end']);
    Route::post('/party-rooms/{id}/seats/{seatNum}/join',  [PartyRoomController::class, 'joinSeat']);
    Route::post('/party-rooms/{id}/seats/{seatNum}/leave', [PartyRoomController::class, 'leaveSeat']);
    Route::post('/party-rooms/{id}/seats/{seatNum}/mute',  [PartyRoomController::class, 'muteSeat']);
    Route::post('/party-rooms/{id}/seats/{seatNum}/react', [PartyRoomController::class, 'reactSeat']);
    Route::post('/party-rooms/{id}/chat', [PartyRoomController::class, 'postChat']);
    Route::post('/party-rooms/{id}/suspend', [PartyRoomController::class, 'suspendUser']);
    Route::post('/party-rooms/{id}/settings', [PartyRoomController::class, 'updateSettings']);
    Route::post('/party-rooms/{id}/update',   [PartyRoomController::class, 'updateSettings']);

    // Party Join Request Controller
    
    Route::post  ('/party-rooms/{room}/join-requests',              [PartyJoinRequestController::class, 'store']);
    Route::get   ('/party-rooms/{room}/join-requests',              [PartyJoinRequestController::class, 'index']);
    Route::get   ('/party-rooms/{room}/join-requests/mine',         [PartyJoinRequestController::class, 'mine']);
    Route::post  ('/party-rooms/{room}/join-requests/{id}/accept',  [PartyJoinRequestController::class, 'accept']);
    Route::post  ('/party-rooms/{room}/join-requests/{id}/reject',  [PartyJoinRequestController::class, 'reject']);
    Route::delete('/party-rooms/{room}/join-requests/mine',         [PartyJoinRequestController::class, 'cancelMine']);



    // 1-to-1 calls
    Route::get('/match-users',                       [MatchRequestController::class, 'users']);
    Route::get('/match-requests',                   [MatchRequestController::class, 'index']);
    Route::post('/match-requests',                  [MatchRequestController::class, 'store']);
    Route::post('/match-requests/{id}/respond',     [MatchRequestController::class, 'respond']);
    Route::post('/call-sessions',                   [CallSessionController::class, 'start']);
    Route::post('/call-sessions/{id}/end',          [CallSessionController::class, 'end']);

    // Messages (DM)
    Route::get('/messages/conversations',           [MessageController::class, 'conversations']);
    Route::get('/messages/unread-count',            [MessageController::class, 'unreadCount']);
    Route::get('/messages/{peerId}',                [MessageController::class, 'thread']);
    Route::post('/messages',                        [MessageController::class, 'send']);
    Route::post('/messages/{peerId}/read',          [MessageController::class, 'markRead']);

    // Room chat
    Route::get('/live-rooms/{id}/messages',         [MessageController::class, 'roomList']);
    Route::post('/live-rooms/{id}/messages',        [MessageController::class, 'roomSend']);

    // Public user profile (fetches fresh row from DB — includes live role)
    Route::get("/users/{id}",                     [ProfileController::class, "show"]);

    // Followers / Following
    Route::post('/users/{userId}/follow',           [FollowController::class, 'follow']);
    Route::delete('/users/{userId}/follow',         [FollowController::class, 'unfollow']);
    Route::get('/users/{userId}/followers',         [FollowController::class, 'followers']);
    Route::get('/users/{userId}/following',         [FollowController::class, 'following']);
    Route::get('/users/{userId}/follow-stats',      [FollowController::class, 'stats']);

    // Notifications
    Route::get('/notifications',                    [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count',       [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read',         [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all',          [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/{id}',            [NotificationController::class, 'destroy']);

    // Reports / Moderation
    Route::post('/reports',                         [ReportController::class, 'store']);
    Route::get('/reports/mine',                     [ReportController::class, 'mine']);
    Route::get('/admin/reports',                    [ReportController::class, 'adminIndex']);
    Route::post('/admin/reports/{id}/review',       [ReportController::class, 'review']);

    // Leaderboard
    Route::get('/leaderboard',                      [LeaderboardController::class, 'index']);

    // Search
    Route::get('/search/users',                     [SearchController::class, 'users']);
    Route::get('/search/rooms',                     [SearchController::class, 'rooms']);

    // App settings
    Route::get('/app-settings',                     [AppSettingController::class, 'index']);
    Route::get('/admin/app-settings',               [AppSettingController::class, 'adminIndex']);
    Route::post('/admin/app-settings',              [AppSettingController::class, 'upsert']);
    Route::delete('/admin/app-settings/{key}',      [AppSettingController::class, 'destroy']);

    // Push tokens (FCM)
    Route::post('/push-tokens',                     [PushTokenController::class, 'register']);
    Route::delete('/push-tokens',                   [PushTokenController::class, 'unregister']);
    Route::get('/me/push-tokens',                   [PushTokenController::class, 'mine']);

    // Audit logs
    Route::get('/admin/audit-logs',                 [AuditLogController::class, 'index']);

    // Admin dashboard overview stats
    Route::get('/admin/stats',                      [AdminStatsController::class, 'overview']);

    // Help center support chat
    Route::get('/support/conversation',             [SupportController::class, 'mine']);
    Route::post('/support/messages',                [SupportController::class, 'send']);
    Route::get('/admin/support/conversations',      [SupportController::class, 'adminIndex']);
    Route::get('/admin/support/conversations/{id}', [SupportController::class, 'adminShow']);
    Route::post('/admin/support/conversations/{id}/messages', [SupportController::class, 'adminReply']);

    // ============================================================
    // Phase A+B — Frames, Entry Effects, Blocks, Room Mutes, Comments
    // ============================================================

    // Frames
    Route::get   ('/me/frames',                    [FrameCatalogController::class, 'myFrames']);
    Route::post  ('/me/frames/equip',              [FrameCatalogController::class, 'equip']);
    Route::post  ('/me/frames/unequip',            [FrameCatalogController::class, 'unequip']);
    Route::post  ('/me/frames/purchase',           [FrameCatalogController::class, 'buy']);
    Route::post  ('/me/frames/{id}/equip',         [FrameCatalogController::class, 'equip']);
    Route::post  ('/frame-catalog/{id}/buy',       [FrameCatalogController::class, 'buy']);

    // Entry Effects
    Route::get   ('/me/entry-effects',             [EntryEffectController::class, 'myEffects']);
    Route::post  ('/me/entry-effects/equip',       [EntryEffectController::class, 'equip']);
    Route::post  ('/me/entry-effects/unequip',     [EntryEffectController::class, 'unequip']);
    Route::post  ('/me/entry-effects/purchase',    [EntryEffectController::class, 'buy']);
    Route::post  ('/me/entry-effects/{id}/equip',  [EntryEffectController::class, 'equip']);
    Route::post  ('/entry-effects/{id}/buy',       [EntryEffectController::class, 'buy']);

    // Blocks
    Route::get   ('/me/blocks',                    [UserBlockController::class, 'index']);
    Route::post  ('/me/blocks',                    [UserBlockController::class, 'store']);
    Route::delete('/me/blocks/{userId}',           [UserBlockController::class, 'destroy']);
    Route::get   ('/me/is-blocked/{userId}',       [UserBlockController::class, 'check']);

    // Room Mutes (host/admin only — enforced in controller)
    Route::get   ('/rooms/{type}/{roomId}/mutes',           [RoomMuteController::class, 'index']);
    Route::post  ('/rooms/{type}/{roomId}/mutes',           [RoomMuteController::class, 'store']);
    Route::delete('/rooms/{type}/{roomId}/mutes/{userId}',  [RoomMuteController::class, 'destroy']);

    // Post Comments (Phase A+B extended)
    Route::post  ('/posts/{postId}/comments',      [PostCommentController::class, 'store']);
    Route::delete('/posts/{postId}/comments/{id}', [PostCommentController::class, 'destroy']);

    // Party Themes
    Route::get   ('/party-themes/my',            [PartyThemeController::class, 'my']);
    Route::post  ('/party-themes/purchase',      [PartyThemeController::class, 'purchase']);
    Route::post  ('/party-themes/equip',         [PartyThemeController::class, 'equip']);
    Route::post  ('/party-themes/unequip',       [PartyThemeController::class, 'unequip']);

    // Admin Party Themes
    Route::get   ('/party-themes/admin/catalog', [PartyThemeController::class, 'adminCatalog']);
    Route::post  ('/party-themes/admin/upsert',  [PartyThemeController::class, 'adminUpsert']);
    Route::post  ('/party-themes/admin/seed',    [PartyThemeController::class, 'adminSeed']);
    Route::delete('/party-themes/admin/{id}',    [PartyThemeController::class, 'adminDelete']);

    // Admin CRUD for catalogs
    Route::post  ('/admin/frame-catalog/seed', [FrameCatalogController::class, 'seed']);
    Route::middleware('can:admin')->group(function () {
        Route::post  ('/admin/frame-catalog',      [FrameCatalogController::class, 'store']);
        Route::put   ('/admin/frame-catalog/{id}', [FrameCatalogController::class, 'update']);
        Route::delete('/admin/frame-catalog/{id}', [FrameCatalogController::class, 'destroy']);

        Route::post  ('/admin/entry-effects',      [EntryEffectController::class, 'store']);
        Route::put   ('/admin/entry-effects/{id}', [EntryEffectController::class, 'update']);
        Route::delete('/admin/entry-effects/{id}', [EntryEffectController::class, 'destroy']);
    });
});

require __DIR__.'/api-additions-rankings.php';
