import 'dart:async';

import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/fade_slide_in.dart';
import '../../widgets/shimmer.dart';

class AdminCustomersScreen extends StatefulWidget {
  const AdminCustomersScreen({super.key});

  @override
  State<AdminCustomersScreen> createState() => _AdminCustomersScreenState();
}

class _AdminCustomersScreenState extends State<AdminCustomersScreen> {
  final _searchController = TextEditingController();
  Timer? _searchDebounce;
  String _query = '';
  List<AppUser> _customers = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  /// The list holds up to 500 rows — rebuilding the whole screen on every
  /// keystroke is what made search feel laggy. Debounce ~250ms and only
  /// setState with the final value.
  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(
      const Duration(milliseconds: 250),
      () {
        if (!mounted) return;
        final trimmed = value.trim();
        if (trimmed == _query) return;
        setState(() => _query = trimmed);
      },
    );
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final customers = await PosApiService.instance.getCustomers(
        search: _query.isEmpty ? null : _query,
        limit: 500,
      );
      if (!mounted) return;
      setState(() {
        _customers = customers;
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

  Future<void> _adjustPoints(AppUser customer) async {
    final controller = TextEditingController();
    final result = await showDialog<int>(
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
              Navigator.of(context).pop(delta == 0 ? null : delta);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );

    if (result == null || !mounted) return;

    try {
      final updated = await PosApiService.instance.adjustCustomerPoints(
        customerId: int.parse(customer.id),
        delta: result,
        reason: 'Manual adjustment by admin',
      );
      if (!mounted) return;
      setState(() {
        customer.points = updated.points;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text('${customer.name} now has ${updated.points} points.')),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to update points.')),
      );
    }
  }

  List<AppUser> get _filteredCustomers {
    if (_query.isEmpty) return _customers;
    final q = _query.toLowerCase();
    return _customers.where((c) {
      return c.name.toLowerCase().contains(q) ||
          c.email.toLowerCase().contains(q);
    }).toList();
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
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'Search customers',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Unable to load customers: $_error',
                style: const TextStyle(color: AppColors.error),
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: _loading
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                    physics: const NeverScrollableScrollPhysics(),
                    children: const [
                      SkeletonTileList(count: 8),
                    ],
                  )
                : RefreshIndicator(
                    onRefresh: _loadCustomers,
                    child: _filteredCustomers.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              const SizedBox(height: 72),
                              EmptyState(
                                icon: Icons.people_outline,
                                title: 'No customers found',
                                subtitle: _query.isEmpty
                                    ? 'No customers registered yet'
                                    : 'Try a different name or email',
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                            itemCount: _filteredCustomers.length,
                            itemBuilder: (context, i) {
                              final c = _filteredCustomers[i];
                              return FadeSlideIn(
                                delay: fadeStagger(i),
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Card(
                                    child: ListTile(
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 6),
                                      leading: CircleAvatar(
                                        backgroundColor: AppColors.coffeeBrown,
                                        child: Text(
                                          c.name.isNotEmpty
                                              ? c.name[0].toUpperCase()
                                              : '?',
                                          style: const TextStyle(
                                              color: Colors.white),
                                        ),
                                      ),
                                      title: Text(c.name,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600)),
                                      subtitle: Text(c.email,
                                          style: const TextStyle(
                                              color: AppColors.slateGrey,
                                              fontSize: 12.5)),
                                      trailing: Text('${c.points} pts',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.matchaDark)),
                                      onTap: () => _adjustPoints(c),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
