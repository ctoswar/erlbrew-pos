import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/animated_counter.dart';
import '../../widgets/fade_slide_in.dart';
import '../login_screen.dart';
import 'admin_customers_screen.dart';
import 'admin_menu_screen.dart';
import 'admin_orders_screen.dart';
import 'admin_rewards_screen.dart';
import 'admin_scan_screen.dart';

class AdminHomeShell extends StatefulWidget {
  const AdminHomeShell({super.key});

  @override
  State<AdminHomeShell> createState() => _AdminHomeShellState();
}

class _AdminHomeShellState extends State<AdminHomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      const _AdminDashboard(),
      AdminScanScreen(isActive: _index == 1),
      const AdminOrdersScreen(),
      const AdminMenuScreen(),
      const AdminRewardsScreen(),
      const AdminCustomersScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: Colors.white,
        indicatorColor: AppColors.latte,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: 'Scan',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.restaurant_menu_outlined),
            selectedIcon: Icon(Icons.restaurant_menu),
            label: 'Menu',
          ),
          NavigationDestination(
            icon: Icon(Icons.card_giftcard_outlined),
            selectedIcon: Icon(Icons.card_giftcard),
            label: 'Rewards',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Customers',
          ),
        ],
      ),
    );
  }
}

class _AdminDashboard extends StatefulWidget {
  const _AdminDashboard();

  @override
  State<_AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<_AdminDashboard> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _orders = [];
  List<AppUser> _customers = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        PosApiService.instance.getAdminOrders(limit: 20),
        PosApiService.instance.getCustomers(limit: 500),
      ]);
      if (!mounted) return;
      setState(() {
        _orders = results[0] as List<Map<String, dynamic>>;
        _customers = results[1] as List<AppUser>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _logout() async {
    await PosApiService.instance.adminLogout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  String _orderStatusName(dynamic status) {
    final s = status?.toString().toLowerCase() ?? '';
    if (s.isEmpty) return 'Pending';
    return s[0].toUpperCase() + s.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin Dashboard')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Unable to load dashboard data.\n$_error',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.error),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loadData,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final preparing = _orders.where((o) => o['status']?.toString().toLowerCase() == 'preparing').length;
    final ready = _orders.where((o) => o['status']?.toString().toLowerCase() == 'ready').length;
    final totalCustomers = _customers.length;
    final totalPointsIssued = _customers.fold<int>(0, (sum, c) => sum + c.points);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            FadeSlideIn(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: AppColors.onyxGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.14),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.gold.withOpacity(0.4)),
                      ),
                      child: const Icon(Icons.storefront, color: AppColors.goldLight),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Erlbrew Café',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16)),
                          SizedBox(height: 2),
                          Text('Admin Dashboard',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12.5)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            FadeSlideIn(
              delay: const Duration(milliseconds: 90),
              child: Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.hourglass_top,
                      label: 'Preparing',
                      value: preparing,
                      color: AppColors.gold,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.check_circle_outline,
                      label: 'Ready',
                      value: ready,
                      color: AppColors.matcha,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            FadeSlideIn(
              delay: const Duration(milliseconds: 150),
              child: Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.people_outline,
                      label: 'Customers',
                      value: totalCustomers,
                      color: AppColors.coffeeBrown,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.card_giftcard_outlined,
                      label: 'Points Outstanding',
                      value: totalPointsIssued,
                      color: AppColors.matchaDark,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            FadeSlideIn(
              delay: const Duration(milliseconds: 200),
              child: Text('Recent Orders',
                  style: Theme.of(context).textTheme.titleLarge),
            ),
            const SizedBox(height: 12),
            ..._orders.take(3).toList().asMap().entries.map((entry) {
              final o = entry.value;
              final status = _orderStatusName(o['status']);
              final items = (o['items'] as List<dynamic>?) ?? [];
              final itemSummary = items.isEmpty
                  ? '—'
                  : items.map((it) => '${it['qty']}× ${it['name'] ?? it['menu_item_id']}').join(', ');
              return FadeSlideIn(
                delay: Duration(milliseconds: 240 + entry.key * 70),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      title: Text('#${o['id']} · ${o['customer_name'] ?? 'Walk-in'}',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(itemSummary,
                          style: TextStyle(
                              color: AppColors.slateGrey, fontSize: 12.5)),
                      trailing: Text(
                        status,
                        style: TextStyle(
                          color: status.toLowerCase() == 'ready'
                              ? AppColors.matcha
                              : status.toLowerCase() == 'preparing'
                                  ? AppColors.gold
                                  : AppColors.slateGrey,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final int value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.14),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 12),
            AnimatedCounter(
              value: value,
              style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold),
            ),
            Text(label,
                style: TextStyle(fontSize: 12, color: AppColors.slateGrey)),
          ],
        ),
      ),
    );
  }
}
