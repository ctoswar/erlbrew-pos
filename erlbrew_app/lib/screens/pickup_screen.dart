import 'package:flutter/material.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/pulse.dart';

class PickupScreen extends StatefulWidget {
  const PickupScreen({super.key});

  @override
  State<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends State<PickupScreen> {
  String _statusLabel(PickupStatus s) {
    switch (s) {
      case PickupStatus.preparing:
        return 'Preparing';
      case PickupStatus.ready:
        return 'Ready for Pickup';
      case PickupStatus.completed:
        return 'Completed';
    }
  }

  Color _statusColor(PickupStatus s) {
    switch (s) {
      case PickupStatus.preparing:
        return AppColors.gold;
      case PickupStatus.ready:
        return AppColors.matcha;
      case PickupStatus.completed:
        return AppColors.slateGrey;
    }
  }

  void _newMockOrder() {
    setState(() {
      MockData.orders.insert(
        0,
        PickupOrder(
          id: 'EB-${1000 + MockData.orders.length + 43}',
          customerName: MockData.currentUser?.name ?? 'Walk-in Customer',
          itemSummary: '1x Cappuccino, 1x Blueberry Muffin',
          placedAt: DateTime.now(),
          status: PickupStatus.preparing,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final orders = MockData.orders;

    return Scaffold(
      appBar: AppBar(title: const Text('Pickup')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newMockOrder,
        backgroundColor: AppColors.coffeeBrown,
        icon: const Icon(Icons.add),
        label: const Text('New Order'),
      ),
      body: orders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.coffee_outlined,
                      size: 48, color: AppColors.latte),
                  const SizedBox(height: 12),
                  Text(
                    'No pickup orders yet',
                    style: TextStyle(color: AppColors.slateGrey),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                return FadeSlideIn(
                  delay: Duration(milliseconds: index * 70),
                  child: Card(
                  margin: const EdgeInsets.only(bottom: 14),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.latte,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Icon(Icons.receipt_long,
                                      size: 18, color: AppColors.coffeeBrown),
                                ),
                                const SizedBox(width: 10),
                                Text('#${order.id}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                            Pulse(
                              active: order.status == PickupStatus.ready,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: _statusColor(order.status)
                                      .withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  _statusLabel(order.status),
                                  style: TextStyle(
                                    color: _statusColor(order.status),
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(order.itemSummary,
                            style: TextStyle(color: AppColors.slateGrey)),
                        const SizedBox(height: 4),
                        Text(
                          'Placed ${order.placedAt.hour.toString().padLeft(2, '0')}:${order.placedAt.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                              color: AppColors.slateGrey, fontSize: 12),
                        ),
                        if (order.status != PickupStatus.completed) ...[
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  order.status =
                                      order.status == PickupStatus.preparing
                                          ? PickupStatus.ready
                                          : PickupStatus.completed;
                                });
                              },
                              child: Text(
                                order.status == PickupStatus.preparing
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
  }
}
