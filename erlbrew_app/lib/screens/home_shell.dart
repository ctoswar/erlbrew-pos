import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_models.dart';
import '../services/firebase_auth_service.dart';
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

class _ProfileScreen extends StatefulWidget {
  const _ProfileScreen();

  @override
  State<_ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<_ProfileScreen> {
  final FirebaseAuthService _authService = FirebaseAuthService.instance;

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
      await _authService.updateDisplayName(updatedName);
      if (!mounted) return;
      setState(() {
        MockData.currentUser = AppUser(
          id: user.id,
          name: updatedName,
          email: user.email,
          points: user.points,
          isAdmin: user.isAdmin,
        );
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name updated successfully.')),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message ?? 'Unable to update your name.')),
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
                Text(
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
                    subtitle: const Text('Send a secure reset link to your email'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      final email = user.email.trim();
                      if (email.isEmpty) return;
                      try {
                        await FirebaseAuth.instance
                            .sendPasswordResetEmail(email: email);
                      } on FirebaseAuthException catch (error) {
                        if (!sheetContext.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              error.message ??
                                  'Unable to send the reset email.',
                            ),
                          ),
                        );
                        return;
                      }
                      if (!sheetContext.mounted) return;
                      Navigator.of(sheetContext).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Password reset email sent. Check your inbox.',
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
          const SizedBox(height: 20),
          Card(
            child: ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              subtitle: const Text('Account and security preferences'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _showSettings(context, user),
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
