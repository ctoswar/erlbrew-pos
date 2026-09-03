import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../models/app_models.dart';
import '../../services/firebase_auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/fade_slide_in.dart';

class AdminCustomersScreen extends StatefulWidget {
  const AdminCustomersScreen({super.key});

  @override
  State<AdminCustomersScreen> createState() => _AdminCustomersScreenState();
}

class _AdminCustomersScreenState extends State<AdminCustomersScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  Future<void> _adjustPoints(AppUser customer) async {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Adjust points — ${customer.name}'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(signed: true),
          decoration: const InputDecoration(
            labelText: 'Points to add (use - to deduct)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final delta = int.tryParse(controller.text.trim()) ?? 0;
              if (delta == 0) return;
              try {
                final updated = await FirebaseAuthService.instance
                    .adjustCustomerPoints(customerId: customer.id, delta: delta);
                if (!mounted) return;
                setState(() => customer.points = updated);
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${customer.name} now has $updated points.')),
                );
              } on FirebaseException catch (error) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(error.message ?? 'Unable to update points.')),
                );
              }
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search customers',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: StreamBuilder<List<AppUser>>(
              stream: FirebaseAuthService.instance.adminCustomersStream(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'Unable to load customers: ${snapshot.error}',
                      style: TextStyle(color: AppColors.error),
                      textAlign: TextAlign.center,
                    ),
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final customers = snapshot.data!
                    .where((c) =>
                        c.name.toLowerCase().contains(_query.toLowerCase()) ||
                        c.email.toLowerCase().contains(_query.toLowerCase()))
                    .toList();
                if (customers.isEmpty) {
                  return Center(
                    child: Text('No customers found',
                        style: TextStyle(color: AppColors.slateGrey)),
                  );
                }
                return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                    itemCount: customers.length,
                    itemBuilder: (context, i) {
                      final c = customers[i];
                      return FadeSlideIn(
                        delay: Duration(milliseconds: i * 60),
                        child: Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 6),
                            leading: CircleAvatar(
                              backgroundColor: AppColors.coffeeBrown,
                              child: Text(
                                c.name.isNotEmpty
                                    ? c.name[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(color: Colors.white),
                              ),
                            ),
                            title: Text(c.name,
                                style:
                                    const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(c.email,
                                style: TextStyle(
                                    color: AppColors.slateGrey, fontSize: 12.5)),
                            trailing: Text('${c.points} pts',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.matchaDark)),
                            onTap: () => _adjustPoints(c),
                          ),
                        ),
                        ),
                      );
                    },
                  );
              },
            ),
          ),
        ],
      ),
    );
  }
}
