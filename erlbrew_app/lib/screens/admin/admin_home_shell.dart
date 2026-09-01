import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../theme/app_theme.dart';
import '../login_screen.dart';
import 'admin_customers_screen.dart';
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

  final _screens = const [
    _AdminDashboard(),
    AdminScanScreen(),
    AdminOrdersScreen(),
    AdminRewardsScreen(),
    AdminCustomersScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
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

class _AdminDashboard extends StatelessWidget {
  const _AdminDashboard();

  @override
  Widget build(BuildContext context) {
    final orders = MockData.orders;
    final preparing =
        orders.where((o) => o.status == PickupStatus.preparing).length;
    final ready = orders.where((o) => o.status == PickupStatus.ready).length;
    final totalCustomers = MockData.customers.length;
    final totalPointsIssued =
        MockData.customers.fold<int>(0, (sum, c) => sum + c.points);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: AppColors.espressoGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.storefront, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Erlbrew Café',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 16)),
                      const SizedBox(height: 2),
                      Text('$preparing preparing · $ready ready for pickup',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.hourglass_top,
                  label: 'Preparing',
                  value: '$preparing',
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.check_circle_outline,
                  label: 'Ready',
                  value: '$ready',
                  color: AppColors.matcha,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.people_outline,
                  label: 'Customers',
                  value: '$totalCustomers',
                  color: AppColors.coffeeBrown,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.card_giftcard_outlined,
                  label: 'Points Outstanding',
                  value: '$totalPointsIssued',
                  color: AppColors.matchaDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Recent Orders', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ...orders.take(3).map((o) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  child: ListTile(
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    title: Text('#${o.id} · ${o.customerName}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(o.itemSummary,
                        style: TextStyle(
                            color: AppColors.slateGrey, fontSize: 12.5)),
                    trailing: Text(
                      o.status.name[0].toUpperCase() + o.status.name.substring(1),
                      style: TextStyle(
                        color: o.status == PickupStatus.ready
                            ? AppColors.matcha
                            : o.status == PickupStatus.preparing
                                ? AppColors.gold
                                : AppColors.slateGrey,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
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
            Text(value,
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.bold)),
            Text(label,
                style: TextStyle(fontSize: 12, color: AppColors.slateGrey)),
          ],
        ),
      ),
    );
  }
}
