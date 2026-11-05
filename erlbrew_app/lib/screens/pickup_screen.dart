import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../services/pos_api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/empty_state.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/pulse.dart';
import '../widgets/shimmer.dart';
import 'order_sheet.dart';

class PickupScreen extends StatefulWidget {
  const PickupScreen({super.key});

  @override
  State<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends State<PickupScreen> {
  late Future<List<Map<String, dynamic>>> _ordersFuture;

  @override
  void initState() {
    super.initState();
    _ordersFuture = PosApiService.instance.getOrderHistory(limit: 20);
  }

  Future<void> _refreshOrders() async {
    setState(() {
      _ordersFuture = PosApiService.instance.getOrderHistory(limit: 20);
    });
    await _ordersFuture;
  }

  static const List<String> _monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /// "Nov 5, 2026 · 2:45 PM" — friendly timestamp for order cards.
  String _formatPlacedAt(DateTime d) {
    final hour12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final ampm = d.hour < 12 ? 'AM' : 'PM';
    final mm = d.minute.toString().padLeft(2, '0');
    return '${_monthLabels[d.month - 1]} ${d.day}, ${d.year} · $hour12:$mm $ampm';
  }

  String _formatTotal(double total) {
    if (total == total.roundToDouble()) return total.toInt().toString();
    return total.toStringAsFixed(2);
  }

  String _itemSummary(Map<String, dynamic> order) {
    final items = order['items'];
    if (items is List && items.isNotEmpty) {
      return items.map((item) {
        if (item is! Map) return 'Menu item';
        final quantity = item['qty'] ?? item['quantity'] ?? 1;
        final name = item['name'] ??
            item['menu_item_name'] ??
            item['menu_item_id'] ??
            'Menu item';
        return '${quantity}x $name';
      }).join(', ');
    }
    return 'Order details unavailable';
  }

  PickupPaymentMethod _paymentMethod(dynamic value) {
    return value?.toString().toLowerCase() == 'qrph'
        ? PickupPaymentMethod.qrph
        : PickupPaymentMethod.gcash;
  }

  PickupStatus _statusFromServer(String status) {
    switch (status) {
      case 'completed':
        return PickupStatus.completed;
      case 'ready':
        return PickupStatus.ready;
      case 'preparing':
        return PickupStatus.preparing;
      case 'refunded':
      case 'voided':
        return PickupStatus.cancelled;
      default:
        return PickupStatus.pending;
    }
  }

  String _statusLabel(PickupStatus s) {
    switch (s) {
      case PickupStatus.pending:
        return 'Payment Pending';
      case PickupStatus.preparing:
        return 'Preparing';
      case PickupStatus.ready:
        return 'Ready for Pickup';
      case PickupStatus.completed:
        return 'Completed';
      case PickupStatus.cancelled:
        return 'Payment Cancelled';
    }
  }

  Color _statusColor(PickupStatus s) {
    switch (s) {
      case PickupStatus.pending:
        return AppColors.gold;
      case PickupStatus.preparing:
        return AppColors.gold;
      case PickupStatus.ready:
        return AppColors.matcha;
      case PickupStatus.completed:
        return AppColors.slateGrey;
      case PickupStatus.cancelled:
        return AppColors.error;
    }
  }

  void _openNewOrder() async {
    final order = await showNewOrderSheet(context);
    if (order != null && mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final customer = PosApiService.instance.currentCustomer;

    return Scaffold(
      appBar: AppBar(title: const Text('Pickup')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'pickup-new-order',
        onPressed: _openNewOrder,
        backgroundColor: AppColors.coffeeBrown,
        icon: const Icon(Icons.add),
        label: const Text('New Order'),
      ),
      body: customer == null
          ? const Center(child: Text('Sign in to view your pickup orders.'))
          : FutureBuilder<List<Map<String, dynamic>>>(
              future: _ordersFuture,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return _PickupError(onRetry: _refreshOrders);
                }
                if (!snapshot.hasData) {
                  // Shimmer order cards mirror the list layout while loading.
                  return ListView(
                    padding: const EdgeInsets.all(20),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SkeletonTileList(count: 5, trailingPill: true),
                    ],
                  );
                }
                final orders = snapshot.data!;
                return RefreshIndicator(
                  onRefresh: _refreshOrders,
                  child: orders.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            const SizedBox(height: 80),
                            EmptyState(
                              icon: Icons.coffee_outlined,
                              title: 'No pickup orders yet',
                              subtitle: 'Start an order and track it here',
                              action: TextButton.icon(
                                onPressed: _openNewOrder,
                                icon: const Icon(Icons.add),
                                label: const Text('Start an order'),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(20),
                          itemCount: orders.length,
                          itemBuilder: (context, index) {
                            final o = orders[index];
                            // Convert API response to PickupOrder
                            final order = PickupOrder(
                              id: o['id']?.toString().substring(0, 8) ?? '',
                              customerName: o['customer_name'] ?? '',
                              itemSummary: _itemSummary(o),
                              placedAt: o['created_at'] != null
                                  ? DateTime.tryParse(
                                          o['created_at'].toString()) ??
                                      DateTime.now()
                                  : DateTime.now(),
                              paymentMethod: _paymentMethod(
                                o['pay_method'] ?? o['payment_method'],
                              ),
                              total: (o['total'] as num?)?.toDouble() ?? 0,
                              status: _statusFromServer(o['status'] ?? ''),
                            );
                            return FadeSlideIn(
                              delay: fadeStagger(index),
                              child: Card(
                                margin: const EdgeInsets.only(bottom: 14),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 36,
                                            height: 36,
                                            decoration: BoxDecoration(
                                              color: AppColors.latte,
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            alignment: Alignment.center,
                                            child: const Icon(
                                                Icons.receipt_long,
                                                size: 18,
                                                color: AppColors.coffeeBrown),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              order.itemSummary,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  height: 1.3),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Pulse(
                                            active: order.status ==
                                                PickupStatus.ready,
                                            child: Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 10,
                                                      vertical: 4),
                                              decoration: BoxDecoration(
                                                color:
                                                    _statusColor(order.status)
                                                        .withValues(
                                                            alpha: 0.15),
                                                borderRadius:
                                                    BorderRadius.circular(20),
                                              ),
                                              child: Text(
                                                _statusLabel(order.status),
                                                style: TextStyle(
                                                  color: _statusColor(
                                                      order.status),
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Placed ${_formatPlacedAt(order.placedAt)}'
                                        '${order.total != null && order.total! > 0 ? ' · ₱${_formatTotal(order.total!)}' : ''}',
                                        style: const TextStyle(
                                            color: AppColors.slateGrey,
                                            fontSize: 12.5),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Payment: ${order.paymentMethod == PickupPaymentMethod.gcash ? 'GCash' : 'QRPh'}'
                                        '${order.paymentStatus == PickupPaymentStatus.pending ? ' · Awaiting confirmation' : ''}'
                                        '${order.paymentStatus == PickupPaymentStatus.failed ? ' · Failed' : ''}'
                                        '${order.paymentStatus == PickupPaymentStatus.cancelled ? ' · Cancelled' : ''}',
                                        style: const TextStyle(
                                          color: AppColors.coffeeBrown,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      if (order.status ==
                                          PickupStatus.pending) ...[
                                        const SizedBox(height: 12),
                                        const Text(
                                          'Complete payment in the checkout window. We will start preparing your order after PayMongo confirms it.',
                                          style: TextStyle(
                                            color: AppColors.slateGrey,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ] else if (order.status !=
                                              PickupStatus.completed &&
                                          order.status !=
                                              PickupStatus.cancelled) ...[
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          width: double.infinity,
                                          child: OutlinedButton(
                                            onPressed: () {
                                              setState(() {
                                                order.status = order.status ==
                                                        PickupStatus.preparing
                                                    ? PickupStatus.ready
                                                    : PickupStatus.completed;
                                              });
                                            },
                                            child: Text(
                                              order.status ==
                                                      PickupStatus.preparing
                                                  ? 'Simulate: Mark Ready'
                                                  : "I've Picked This Up",
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                );
              },
            ),
    );
  }
}

class _PickupError extends StatelessWidget {
  final Future<void> Function() onRetry;

  const _PickupError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined,
                size: 42, color: AppColors.slateGrey),
            const SizedBox(height: 12),
            Text(
              'We could not load your pickup orders.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
