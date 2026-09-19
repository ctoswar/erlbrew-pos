import 'package:flutter/material.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/fade_slide_in.dart';

class AdminOrdersScreen extends StatefulWidget {
  const AdminOrdersScreen({super.key});

  @override
  State<AdminOrdersScreen> createState() => _AdminOrdersScreenState();
}

class _AdminOrdersScreenState extends State<AdminOrdersScreen> {
  String? _filter;
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;

  final _statuses = ['pending', 'preparing', 'ready', 'completed', 'voided', 'refunded'];

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orders = await PosApiService.instance.getAdminOrders(limit: 100);
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _loading = false;
      });
    } on PosApiServiceException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load orders';
        _loading = false;
      });
    }
  }

  String _label(String s) => switch (s.toLowerCase()) {
        'pending' => 'Payment Pending',
        'preparing' => 'Preparing',
        'ready' => 'Ready',
        'completed' => 'Completed',
        'voided' => 'Voided',
        'refunded' => 'Refunded',
        _ => s,
      };

  Color _color(String s) => switch (s.toLowerCase()) {
        'pending' => AppColors.gold,
        'preparing' => AppColors.gold,
        'ready' => AppColors.matcha,
        'completed' => AppColors.slateGrey,
        'voided' || 'refunded' => AppColors.error,
        _ => AppColors.slateGrey,
      };

  IconData _icon(String s) => switch (s.toLowerCase()) {
        'pending' => Icons.hourglass_empty,
        'preparing' => Icons.hourglass_top,
        'ready' => Icons.check_circle_outline,
        'completed' => Icons.task_alt,
        'voided' || 'refunded' => Icons.cancel_outlined,
        _ => Icons.receipt_long,
      };

  Future<void> _advance(Map<String, dynamic> order) async {
    final current = order['status']?.toString().toLowerCase() ?? '';
    final nextStatus = switch (current) {
      'preparing' => 'ready',
      'ready' => 'completed',
      _ => current,
    };
    if (nextStatus == current) return;

    final orderId = order['id']?.toString() ?? '';
    if (orderId.isEmpty) return;

    setState(() => order['status'] = nextStatus);
    try {
      await PosApiService.instance.updateOrderStatus(
        orderId: orderId,
        status: nextStatus,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$orderId marked ${_label(nextStatus)}')),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      setState(() => order['status'] = current);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => order['status'] = current);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to save order status.')),
      );
    }
  }

  String _itemSummary(Map<String, dynamic> order) {
    final items = (order['items'] as List<dynamic>?) ?? [];
    if (items.isEmpty) return '—';
    return items.map((it) => '${it['qty']}× ${it['name'] ?? it['menu_item_id']}').join(', ');
  }

  String _formatTime(dynamic dateStr) {
    final date = DateTime.tryParse(dateStr?.toString() ?? '');
    if (date == null) return '--:--';
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == null
        ? _orders
        : _orders.where((o) => o['status']?.toString().toLowerCase() == _filter).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(
                    label: 'All',
                    selected: _filter == null,
                    onTap: () => setState(() => _filter = null),
                  ),
                  const SizedBox(width: 8),
                  ..._statuses.map((s) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _FilterChip(
                          label: _label(s),
                          selected: _filter == s,
                          color: _color(s),
                          onTap: () => setState(() => _filter = s),
                        ),
                      )),
                ],
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Unable to load orders: $_error',
                style: TextStyle(color: AppColors.error),
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _loadOrders,
                    child: filtered.isEmpty
                        ? ListView(
                            children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                              Center(
                                child: Text(
                                  'No orders in this filter',
                                  style: TextStyle(color: AppColors.slateGrey),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                            itemCount: filtered.length,
                            itemBuilder: (context, i) {
                              final order = filtered[i];
                              final status = order['status']?.toString().toLowerCase() ?? 'pending';
                              return FadeSlideIn(
                                delay: Duration(milliseconds: i * 60),
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Card(
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 42,
                                            height: 42,
                                            decoration: BoxDecoration(
                                              color: _color(status).withOpacity(0.15),
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            alignment: Alignment.center,
                                            child: Icon(_icon(status),
                                                color: _color(status), size: 20),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.spaceBetween,
                                                  children: [
                                                    Text('#${order['id']}',
                                                        style: const TextStyle(
                                                            fontWeight: FontWeight.w700)),
                                                    Text(
                                                      _formatTime(order['created_at']),
                                                      style: TextStyle(
                                                          fontSize: 12,
                                                          color: AppColors.slateGrey),
                                                    ),
                                                  ],
                                                ),
                                                const SizedBox(height: 4),
                                                Text(order['customer_name']?.toString() ?? 'Walk-in',
                                                    style: TextStyle(
                                                        color: AppColors.coffeeBrown,
                                                        fontWeight: FontWeight.w600,
                                                        fontSize: 13)),
                                                const SizedBox(height: 2),
                                                Text(_itemSummary(order),
                                                    style: TextStyle(
                                                        color: AppColors.slateGrey,
                                                        fontSize: 13)),
                                                const SizedBox(height: 12),
                                                if (status == 'preparing' || status == 'ready')
                                                  SizedBox(
                                                    width: double.infinity,
                                                    child: FilledButton(
                                                      style: FilledButton.styleFrom(
                                                        backgroundColor:
                                                            AppColors.coffeeBrown,
                                                        minimumSize: const Size(0, 40),
                                                        shape: RoundedRectangleBorder(
                                                          borderRadius:
                                                              BorderRadius.circular(10),
                                                        ),
                                                      ),
                                                      onPressed: () => _advance(order),
                                                      child: Text(
                                                        status == 'preparing'
                                                            ? 'Mark Ready'
                                                            : 'Mark Completed',
                                                      ),
                                                    ),
                                                  )
                                                else
                                                  Row(
                                                    children: [
                                                      Icon(Icons.check_circle,
                                                          size: 16,
                                                          color: AppColors.success),
                                                      const SizedBox(width: 6),
                                                      Text(_label(status),
                                                          style: TextStyle(
                                                              color: AppColors.success,
                                                              fontWeight:
                                                                  FontWeight.w600,
                                                              fontSize: 12.5)),
                                                    ],
                                                  ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
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

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppColors.coffeeBrown;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? chipColor : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? chipColor : AppColors.latte,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.slateGrey,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
