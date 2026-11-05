import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/app_models.dart';
import '../services/paymongo_service.dart';
import '../services/pos_api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/shimmer.dart';
import '../widgets/luxury_button.dart';

/// Opens the "New Order" pull-up sheet. Returns the created [PickupOrder]
/// if the customer placed one, or null if they dismissed the sheet.
Future<PickupOrder?> showNewOrderSheet(BuildContext context) {
  return showModalBottomSheet<PickupOrder>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const _NewOrderSheet(),
  );
}

class _NewOrderSheet extends StatefulWidget {
  const _NewOrderSheet();

  @override
  State<_NewOrderSheet> createState() => _NewOrderSheetState();
}

class _NewOrderSheetState extends State<_NewOrderSheet> {
  // menu item -> quantity in cart
  final Map<MenuItem, int> _cart = {};
  PickupPaymentMethod _paymentMethod = PickupPaymentMethod.gcash;
  bool _placingOrder = false;
  List<MenuItem> _menuItems = [];
  bool _loadingMenu = true;

  int get _totalItems => _cart.values.fold(0, (a, b) => a + b);

  double get _totalPrice =>
      _cart.entries.fold(0.0, (sum, e) => sum + e.key.price * e.value);

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  Future<void> _loadMenu() async {
    try {
      // Served from the in-memory cache (stale-while-revalidate) when the
      // sheet is re-opened shortly after — the previous behaviour
      // re-downloaded the full menu on every single open.
      final items = await PosApiService.instance.getMenu();
      if (mounted) {
        setState(() {
          _menuItems = items;
          _loadingMenu = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMenu = false);
    }
  }

  void _addOne(MenuItem item) {
    setState(() => _cart[item] = (_cart[item] ?? 0) + 1);
  }

  void _removeOne(MenuItem item) {
    setState(() {
      final current = _cart[item] ?? 0;
      if (current <= 1) {
        _cart.remove(item);
      } else {
        _cart[item] = current - 1;
      }
    });
  }

  Future<void> _placeOrder() async {
    if (_cart.isEmpty) return;
    final summary =
        _cart.entries.map((e) => '${e.value}x ${e.key.name}').join(', ');

    final customer = PosApiService.instance.currentCustomer;
    if (customer == null) return;

    setState(() => _placingOrder = true);
    try {
      final checkout = await PayMongoService.instance.createCheckout(
        items: [
          for (final entry in _cart.entries)
            CartLine(item: entry.key, quantity: entry.value),
        ],
        paymentMethod: _paymentMethod,
      );
      final opened = await launchUrl(
        Uri.parse(checkout.checkoutUrl),
        mode: LaunchMode.externalApplication,
      );
      if (!opened) {
        throw const PosApiException('Unable to open the secure checkout page.');
      }

      final order = PickupOrder(
        id: checkout.orderId,
        customerName: customer.name,
        itemSummary: summary,
        placedAt: DateTime.now(),
        paymentMethod: _paymentMethod,
        total: checkout.total,
        checkoutUrl: checkout.checkoutUrl,
        paymentStatus: PickupPaymentStatus.pending,
        // A client redirect is not proof of payment. The API changes this to
        // preparing only after PayMongo's signed webhook arrives.
        status: PickupStatus.pending,
      );
      MockData.orders.insert(0, order);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Checkout opened. Your order will stay pending until payment is confirmed.'),
          ),
        );
        Navigator.of(context).pop(order);
      }
    } on PosApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Unable to start checkout. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _placingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.ivory,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('New Order',
                        style: Theme.of(context).textTheme.displayMedium),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _loadingMenu
                    ? _MenuSkeleton()
                    : _menuItems.isEmpty
                        ? const Center(
                            child: Text('No menu items available',
                                style: TextStyle(color: AppColors.slateGrey)),
                          )
                        : _MenuRows(
                            controller: scrollController,
                            items: _menuItems,
                            cart: _cart,
                            onAdd: _addOne,
                            onRemove: _removeOne,
                          ),
              ),
              // Cart footer grows in when the first item is added and
              // collapses away when the cart empties. (SizeTransition
              // actually releases the layout space — an AnimatedSlide
              // would leave a dead gap under the list.)
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: _cart.isEmpty ? 0.0 : 1.0),
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                builder: (context, t, child) => SizeTransition(
                  sizeFactor: AlwaysStoppedAnimation(t),
                  // was `axisAlignment: -1` — child pinned to the top-edge
                  // while the footer collapses (see SizeTransition docs).
                  alignment: const Alignment(-1.0, -1.0),
                  child: child,
                ),
                child: Container(
                  padding: EdgeInsets.fromLTRB(
                    22,
                    14,
                    22,
                    14 + MediaQuery.of(context).padding.bottom,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: const Border(
                        top: BorderSide(color: AppColors.hairline)),
                    boxShadow: [AppColors.softShadow],
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Pay with',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: SegmentedButton<PickupPaymentMethod>(
                                segments: const [
                                  ButtonSegment(
                                    value: PickupPaymentMethod.gcash,
                                    label: Text('GCash'),
                                    icon: Icon(
                                        Icons.account_balance_wallet_outlined),
                                  ),
                                  ButtonSegment(
                                    value: PickupPaymentMethod.qrph,
                                    label: Text('QRPh'),
                                    icon: Icon(Icons.qr_code_2),
                                  ),
                                ],
                                selected: {_paymentMethod},
                                onSelectionChanged: (selection) {
                                  setState(
                                      () => _paymentMethod = selection.first);
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$_totalItems item${_totalItems == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                        color: AppColors.slateGrey,
                                        fontSize: 12),
                                  ),
                                  Text(
                                    '₱${_totalPrice.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 18),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            SizedBox(
                              width: 180,
                              child: LuxuryButton(
                                label: _placingOrder
                                    ? 'Opening checkout…'
                                    : 'Continue to checkout',
                                onPressed: _placingOrder ? null : _placeOrder,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Category headers + item rows flattened into one index so the
/// ListView only builds rows as they scroll into view instead of
/// constructing the entire grouped tree up front.
class _MenuRows extends StatelessWidget {
  final ScrollController controller;
  final List<MenuItem> items;
  final Map<MenuItem, int> cart;
  final ValueChanged<MenuItem> onAdd;
  final ValueChanged<MenuItem> onRemove;

  const _MenuRows({
    required this.controller,
    required this.items,
    required this.cart,
    required this.onAdd,
    required this.onRemove,
  });

  ({int? headerCategory, MenuItem? item}) _rowAt(int index) {
    final categories = _categoriesOf();
    var position = 0;
    for (final category in categories) {
      if (index == position) return (headerCategory: position, item: null);
      position += 1;
      final inCategory = items.where((m) => m.category == category);
      for (final item in inCategory) {
        if (index == position) return (headerCategory: null, item: item);
        position += 1;
      }
    }
    return (headerCategory: null, item: null);
  }

  List<String> _categoriesOf() {
    final categories = <String>[];
    for (final item in items) {
      if (!categories.contains(item.category)) categories.add(item.category);
    }
    return categories;
  }

  int get _rowCount {
    // one header per category + one row per item
    return _categoriesOf().length + items.length;
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
      itemCount: _rowCount,
      itemBuilder: (context, index) {
        final row = _rowAt(index);
        if (row.headerCategory != null || row.item == null) {
          final category = _categoriesOf()[row.headerCategory!];
          return Padding(
            padding: const EdgeInsets.only(top: 16, bottom: 10),
            child: Text(
              category.toUpperCase(),
              style: const TextStyle(
                color: AppColors.gold,
                fontWeight: FontWeight.w700,
                fontSize: 12,
                letterSpacing: 1.6,
              ),
            ),
          );
        }
        final item = row.item!;
        return FadeSlideIn(
          child: _MenuRow(
            item: item,
            quantity: cart[item] ?? 0,
            onAdd: () => onAdd(item),
            onRemove: () => onRemove(item),
          ),
        );
      },
    );
  }
}

/// Skeleton stand-in while the menu loads — mirrors row heights so the
/// sheet doesn't jump when content arrives.
class _MenuSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (var section = 0; section < 2; section++) ...[
          const Padding(
            padding: EdgeInsets.only(top: 16, bottom: 10),
            child: SkeletonLine(widthFactor: 0.25, height: 12),
          ),
          const SkeletonTileList(count: 3),
        ],
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  final MenuItem item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  const _MenuRow({
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final inCart = quantity > 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.latte,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(item.emoji, style: const TextStyle(fontSize: 18)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('₱${item.price.toStringAsFixed(0)}',
                        style: const TextStyle(
                            color: AppColors.slateGrey, fontSize: 12.5)),
                  ],
                ),
              ),
              if (!inCart)
                OutlinedButton(
                  onPressed: onAdd,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 34),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text('Add'),
                )
              else
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.espresso,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove, size: 16),
                        color: AppColors.goldLight,
                        onPressed: onRemove,
                        constraints:
                            const BoxConstraints(minWidth: 32, minHeight: 32),
                        padding: EdgeInsets.zero,
                      ),
                      SizedBox(
                        width: 20,
                        child: Text(
                          '$quantity',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.add, size: 16),
                        color: AppColors.goldLight,
                        onPressed: onAdd,
                        constraints:
                            const BoxConstraints(minWidth: 32, minHeight: 32),
                        padding: EdgeInsets.zero,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
