import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/fade_slide_in.dart';

class AdminOrdersScreen extends StatefulWidget {
  const AdminOrdersScreen({super.key});

  @override
  State<AdminOrdersScreen> createState() => _AdminOrdersScreenState();
}

class _AdminOrdersScreenState extends State<AdminOrdersScreen> {
  PickupStatus? _filter;

  String _label(PickupStatus s) => switch (s) {
        PickupStatus.preparing => 'Preparing',
        PickupStatus.ready => 'Ready',
        PickupStatus.completed => 'Completed',
      };

  Color _color(PickupStatus s) => switch (s) {
        PickupStatus.preparing => AppColors.gold,
        PickupStatus.ready => AppColors.matcha,
        PickupStatus.completed => AppColors.slateGrey,
      };

  IconData _icon(PickupStatus s) => switch (s) {
        PickupStatus.preparing => Icons.hourglass_top,
        PickupStatus.ready => Icons.check_circle_outline,
        PickupStatus.completed => Icons.task_alt,
      };

  void _advance(PickupOrder order) {
    setState(() {
      order.status = switch (order.status) {
        PickupStatus.preparing => PickupStatus.ready,
        PickupStatus.ready => PickupStatus.completed,
        PickupStatus.completed => PickupStatus.completed,
      };
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${order.id} marked ${_label(order.status)}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orders = MockData.orders
        .where((o) => _filter == null || o.status == _filter)
        .toList();

    final counts = {
      for (final s in PickupStatus.values)
        s: MockData.orders.where((o) => o.status == s).length,
    };

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
                    label: 'All (${MockData.orders.length})',
                    selected: _filter == null,
                    onTap: () => setState(() => _filter = null),
                  ),
                  const SizedBox(width: 8),
                  ...PickupStatus.values.map((s) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _FilterChip(
                          label: '${_label(s)} (${counts[s]})',
                          selected: _filter == s,
                          color: _color(s),
                          onTap: () => setState(() => _filter = s),
                        ),
                      )),
                ],
              ),
            ),
          ),
          Expanded(
            child: orders.isEmpty
                ? Center(
                    child: Text('No orders in this filter',
                        style: TextStyle(color: AppColors.slateGrey)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                    itemCount: orders.length,
                    itemBuilder: (context, i) {
                      final order = orders[i];
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
                                    color: _color(order.status).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  alignment: Alignment.center,
                                  child: Icon(_icon(order.status),
                                      color: _color(order.status), size: 20),
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
                                          Text('#${order.id}',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                          Text(
                                            '${order.placedAt.hour.toString().padLeft(2, '0')}:${order.placedAt.minute.toString().padLeft(2, '0')}',
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: AppColors.slateGrey),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(order.customerName,
                                          style: TextStyle(
                                              color: AppColors.coffeeBrown,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13)),
                                      const SizedBox(height: 2),
                                      Text(order.itemSummary,
                                          style: TextStyle(
                                              color: AppColors.slateGrey,
                                              fontSize: 13)),
                                      const SizedBox(height: 12),
                                      if (order.status != PickupStatus.completed)
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
                                              order.status ==
                                                      PickupStatus.preparing
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
                                            Text('Completed',
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
            fontWeight: FontWeight.w600,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }
}
