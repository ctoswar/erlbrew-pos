import 'package:flutter/material.dart';
import '../../models/app_models.dart';
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

  void _adjustPoints(AppUser customer) {
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
            onPressed: () {
              final delta = int.tryParse(controller.text.trim()) ?? 0;
              setState(() {
                customer.points =
                    (customer.points + delta).clamp(0, 999999);
              });
              Navigator.of(context).pop();
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final customers = MockData.customers
        .where((c) =>
            c.name.toLowerCase().contains(_query.toLowerCase()) ||
            c.email.toLowerCase().contains(_query.toLowerCase()))
        .toList();

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
            child: customers.isEmpty
                ? Center(
                    child: Text('No customers found',
                        style: TextStyle(color: AppColors.slateGrey)),
                  )
                : ListView.builder(
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
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('${c.points} pts',
                                    style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.matchaDark)),
                                Text('${c.stamps}/${c.stampsGoal} stamps',
                                    style: TextStyle(
                                        fontSize: 11, color: AppColors.slateGrey)),
                              ],
                            ),
                            onTap: () => _adjustPoints(c),
                          ),
                        ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
