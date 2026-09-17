import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class AdminMenuScreen extends StatefulWidget {
  const AdminMenuScreen({super.key});

  @override
  State<AdminMenuScreen> createState() => _AdminMenuScreenState();
}

class _AdminMenuScreenState extends State<AdminMenuScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Café Menu')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.store_outlined,
                size: 64,
                color: AppColors.gold.withOpacity(0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'Menu managed in POS',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                'Menu items are managed through the POS Admin Panel. Any changes made there will appear here automatically.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.slateGrey, fontSize: 14),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
