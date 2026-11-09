import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../services/firebase_auth_service.dart';
import '../services/pos_api_service.dart';
import '../services/session_service.dart';
import '../theme/app_theme.dart';
import '../utils/username_policy.dart';
import '../widgets/empty_state.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/lazy_indexed_stack.dart';
import '../widgets/page_transitions.dart';
import '../widgets/shimmer.dart';
import '../widgets/ios_tab_bar.dart';
import 'legal_screen.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'pickup_screen.dart';
import 'rewards_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  final _screens = const [
    RewardsScreen(),
    PickupScreen(),
    _ProfileScreen(),
  ];

  // ── In-app order notifications (issue #349) ────────────────────────
  // The server writes order events to Firestore users/{uid}/notifications.
  // The shell listens for delivery while the customer is inside the app and
  // slides a banner down; history lives in NotificationsScreen.
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _notifSub;
  final Set<String> _seenNotificationIds = <String>{};
  bool _notifsSeeded = false;
  Map<String, dynamic>? _banner;
  Timer? _bannerTimer;

  @override
  void initState() {
    super.initState();
    _notifSub = FirebaseAuthService.instance
        .customerNotificationsStream()
        .listen(_onNotifications, onError: (_) {});
  }

  @override
  void dispose() {
    _notifSub?.cancel();
    _bannerTimer?.cancel();
    super.dispose();
  }

  void _onNotifications(QuerySnapshot<Map<String, dynamic>> snapshot) {
    final docs = snapshot.docs;
    if (!_notifsSeeded) {
      // First delivery after opening the app: acknowledge what is already
      // in the inbox so history never banners on launch — only orders that
      // arrive while the app is open will.
      _notifsSeeded = true;
      _seenNotificationIds
        ..clear()
        ..addAll(docs.map((d) => d.id));
      return;
    }
    for (final doc in docs) {
      // Newest first (orderBy createdAt desc) — show the freshest arrival.
      if (_seenNotificationIds.contains(doc.id)) continue;
      _seenNotificationIds.add(doc.id);
      if (doc.data()['read'] == true) continue;
      setState(() {
        _banner = doc.data();
      });
      _bannerTimer?.cancel();
      _bannerTimer = Timer(const Duration(seconds: 6), () {
        if (mounted) setState(() => _banner = null);
      });
      break;
    }
  }

  void _hideBanner() {
    _bannerTimer?.cancel();
    setState(() => _banner = null);
  }

  void _openNotifications() {
    _hideBanner();
    Navigator.of(context).push(fadeThrough(const NotificationsScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // LazyIndexedStack: a tab is only built the first time you visit it
      // (then kept alive), so opening the app doesn't fire every tab's
      // network requests at once — plus a soft fade between tabs.
      body: Stack(
        children: [
          LazyIndexedStack(index: _index, children: _screens),
          // Slide-down alert for a fresh order notification. SafeArea keeps
          // it clear of the status bar (no AppBar in the shell).
          if (_banner != null)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                child: NotificationBanner(
                  title: (_banner!['title'] ?? 'Order update').toString(),
                  message: (_banner!['message'] ?? '').toString(),
                  onTap: _openNotifications,
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: IosTabBar(
        selectedIndex: _index,
        onSelected: (i) => setState(() => _index = i),
        items: const [
          IosTabBarItem(icon: Icons.card_giftcard_outlined, label: 'Rewards'),
          IosTabBarItem(icon: Icons.storefront_outlined, label: 'Pickup'),
          IosTabBarItem(icon: Icons.person_outline, label: 'Profile'),
        ],
      ),
    );
  }
}

class _ProfileScreen extends StatefulWidget {
  const _ProfileScreen();

  @override
  State<_ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<_ProfileScreen> {
  AppUser? _user;
  String _tier = 'bronze';
  int _points = 0;
  List<Map<String, dynamic>> _recentOrders = [];
  bool _loadingOrders = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refreshProfile();
  }

  Future<void> _refreshProfile() async {
    setState(() {
      _error = null;
      _loadingOrders = true;
    });
    try {
      // All three requests in parallel — the old sequential awaits stacked
      // their latency, which made the profile tab feel sluggish.
      final results = await Future.wait<dynamic>([
        PosApiService.instance.getProfile(),
        PosApiService.instance.getPoints(),
        PosApiService.instance.getOrderHistory(limit: 5),
      ]);
      if (mounted) {
        setState(() {
          _user = results[0] as AppUser;
          _tier = ((results[1] as Map<String, dynamic>)['tier'] ?? 'bronze')
              as String;
          _points =
              ((results[1] as Map<String, dynamic>)['points'] ?? 0) as int;
          _recentOrders = results[2] as List<Map<String, dynamic>>;
          _loadingOrders = false;
        });
      }
    } on PosApiServiceException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loadingOrders = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load profile';
          _loadingOrders = false;
        });
      }
    }
  }

  String _tierLabel(String tier) {
    switch (tier) {
      case 'platinum':
        return 'Platinum';
      case 'gold':
        return 'Gold';
      case 'silver':
        return 'Silver';
      default:
        return 'Bronze';
    }
  }

  Color _tierColor(String tier) {
    switch (tier) {
      case 'platinum':
        return const Color(0xFFE5E4E2);
      case 'gold':
        return const Color(0xFFD4AF37);
      case 'silver':
        return const Color(0xFFC0C0C0);
      default:
        return const Color(0xFFCD7F32);
    }
  }

  Future<void> _showEditName(BuildContext context, AppUser user) async {
    final controller = TextEditingController(text: user.name);
    final updatedName = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Change name'),
          content: TextField(
            controller: controller,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Name',
              hintText: 'Enter your name',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(
                controller.text.trim(),
              ),
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
    controller.dispose();

    if (!mounted || updatedName == null || updatedName.isEmpty) return;

    try {
      final updated =
          await PosApiService.instance.updateProfile(name: updatedName);
      if (!mounted) return;
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name updated successfully.')),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to update your name.')),
      );
    }
  }

  /// Lets the user pick or change their @username — validated with the
  /// same rules as signup, and uniqueness is enforced by the server
  /// (which also returns the friendly "already taken" message).
  Future<void> _showEditUsername(BuildContext context, AppUser user) async {
    final formKey = GlobalKey<FormState>();
    final controller = TextEditingController(text: user.username);
    final updatedUsername = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Change username'),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Username',
                prefixText: '@',
                helperText: '3-20 letters, numbers or underscores.',
              ),
              validator: UsernamePolicy.validate,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.of(dialogContext).pop(controller.text.trim());
                }
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
    controller.dispose();

    final candidate = (updatedUsername ?? '').trim().toLowerCase();
    if (!mounted || candidate.isEmpty || candidate == user.username) return;

    try {
      final updated = await PosApiService.instance.updateUsername(candidate);
      if (!mounted) return;
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Username updated — welcome, @${updated.username}.'),
        ),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to update your username.')),
      );
    }
  }

  Future<void> _showSettings(BuildContext context, AppUser user) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Settings',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Manage your account preferences',
                  style: TextStyle(color: AppColors.slateGrey, fontSize: 13),
                ),
                const SizedBox(height: 16),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.person_outline),
                    title: const Text('Name'),
                    subtitle: Text(user.name),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      _showEditName(context, user);
                    },
                  ),
                ),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.alternate_email),
                    title: const Text('Username'),
                    subtitle: user.username.isNotEmpty
                        ? Text('@${user.username}')
                        : const Text('Not set yet — pick yours'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      _showEditUsername(context, user);
                    },
                  ),
                ),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.email_outlined),
                    title: const Text('Email address'),
                    subtitle: Text(user.email),
                  ),
                ),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.lock_reset_outlined),
                    title: const Text('Reset password'),
                    subtitle:
                        const Text('Send a secure reset link to your email'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Please visit the café and ask a staff member to reset your password.',
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: _error != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_outlined,
                          size: 42, color: AppColors.slateGrey),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _refreshProfile,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            : const SafeArea(
                child: SkeletonProfile(), // mirrors the real profile layout
              ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: RefreshIndicator(
        onRefresh: _refreshProfile,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.coffeeBrown,
              child: Text(
                user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(user.name,
                  style: Theme.of(context).textTheme.titleLarge),
            ),
            if (user.username.isNotEmpty)
              Center(
                child: Text('@${user.username}',
                    style: const TextStyle(
                        color: AppColors.coffeeBrown,
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
              ),
            Center(
              child: Text(user.email,
                  style: const TextStyle(color: AppColors.slateGrey)),
            ),
            const SizedBox(height: 28),

            // Points & Tier
            Card(
              child: ListTile(
                leading: const Icon(Icons.card_giftcard_outlined),
                title: const Text('Points balance'),
                subtitle: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _tierColor(_tier).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: _tierColor(_tier).withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        _tierLabel(_tier),
                        style: TextStyle(
                          color: _tierColor(_tier),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                trailing: Text('$_points',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 12),

            // Order Stats
            Card(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _statColumn('Orders', '${user.totalOrders ?? 0}',
                        Icons.receipt_long),
                    _statColumn(
                        'Total Spent',
                        '₱${_formatAmount(user.totalSpent ?? 0)}',
                        Icons.payments),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Recent Orders
            if (_recentOrders.isNotEmpty) ...[
              Text('Recent Orders',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              ..._recentOrders.asMap().entries.map((entry) {
                final o = entry.value;
                return FadeSlideIn(
                    delay: fadeStagger(entry.key),
                    child: Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.latte,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: const Icon(Icons.receipt_long,
                              size: 18, color: AppColors.coffeeBrown),
                        ),
                        title: Text(_orderSummary(o),
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          _formatOrderDate(o['created_at']),
                          style: const TextStyle(
                              color: AppColors.slateGrey, fontSize: 12),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                                '₱${_formatAmount((o['total'] as num?)?.toDouble() ?? 0)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                            Text('+${o['points_earned'] ?? 0} pts',
                                style: const TextStyle(
                                    color: AppColors.matcha, fontSize: 11)),
                          ],
                        ),
                      ),
                    ));
              }),
              const SizedBox(height: 12),
            ] else if (!_loadingOrders) ...[
              const EmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No orders yet',
                subtitle: 'Place a pickup order to start earning points',
              ),
            ],

            // Settings
            Card(
              child: ListTile(
                leading: const Icon(Icons.settings_outlined),
                title: const Text('Settings'),
                subtitle: const Text('Account and security preferences'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showSettings(context, user),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.policy_outlined),
                title: const Text('Terms, Privacy & Cookies'),
                subtitle: const Text('The legal bits, in plain language'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => LegalScreen.show(context),
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () async {
                await PosApiService.instance.logout();
                // Log out must also drop the "Keep me signed in" opt-in and
                // the Firebase session, or the next launch would auto-login.
                try {
                  await FirebaseAuthService.instance.signOut();
                  await SessionService.instance.forget();
                } catch (_) {
                  // Best effort — POS tokens are already cleared.
                }
                if (!mounted) return;
                Navigator.of(context).pushAndRemoveUntil(
                  fadeThrough(const LoginScreen()),
                  (route) => false,
                );
              },
              icon: const Icon(Icons.logout),
              label: const Text('Log Out'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statColumn(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, size: 20, color: AppColors.coffeeBrown),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        Text(label,
            style: const TextStyle(color: AppColors.slateGrey, fontSize: 11)),
      ],
    );
  }

  String _formatAmount(double amount) {
    if (amount == amount.roundToDouble()) return amount.toInt().toString();
    return amount.toStringAsFixed(2);
  }

  /// "2x CHOCOLATE 22oz, 1x Cookies" — real item names for the recent
  /// orders list instead of raw order ids.
  String _orderSummary(Map<String, dynamic> o) {
    final items = o['items'];
    if (items is List && items.isNotEmpty) {
      return items.map((item) {
        if (item is! Map) return 'Order item';
        final qty = item['qty'] ?? 1;
        final name = item['name'] ??
            item['menu_item_name'] ??
            item['menu_item_id'] ??
            'Menu item';
        return '${qty}x $name';
      }).join(', ');
    }
    return 'Order';
  }

  String _formatOrderDate(dynamic dateStr) {
    final date = DateTime.tryParse(dateStr?.toString() ?? '') ?? DateTime.now();
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inDays == 0) {
      return 'Today ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    }
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return '${date.month}/${date.day}/${date.year}';
  }
}
