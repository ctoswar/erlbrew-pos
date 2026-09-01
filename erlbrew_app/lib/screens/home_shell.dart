import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
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
            icon: Icon(Icons.card_giftcard_outlined),
            selectedIcon: Icon(Icons.card_giftcard),
            label: 'Rewards',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Pickup',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _ProfileScreen extends StatelessWidget {
  const _ProfileScreen();

  @override
  Widget build(BuildContext context) {
    final user = MockData.currentUser!;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AppColors.coffeeBrown,
            child: Text(
              user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
              style: const TextStyle(
                  color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(user.name,
                style: Theme.of(context).textTheme.titleLarge),
          ),
          Center(
            child: Text(user.email,
                style: TextStyle(color: AppColors.slateGrey)),
          ),
          const SizedBox(height: 28),
          Card(
            child: ListTile(
              leading: const Icon(Icons.card_giftcard_outlined),
              title: const Text('Points balance'),
              trailing: Text('${user.points}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.local_cafe_outlined),
              title: const Text('Stamps collected'),
              trailing: Text('${user.stamps}/${user.stampsGoal}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () {
              MockData.currentUser = null;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            icon: const Icon(Icons.logout),
            label: const Text('Log Out'),
          ),
        ],
      ),
    );
  }
}
