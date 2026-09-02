import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/fade_slide_in.dart';

class AdminMenuScreen extends StatefulWidget {
  const AdminMenuScreen({super.key});

  @override
  State<AdminMenuScreen> createState() => _AdminMenuScreenState();
}

class _AdminMenuScreenState extends State<AdminMenuScreen> {
  void _openEditor({MenuItem? existing}) {
    final nameController = TextEditingController(text: existing?.name);
    final categoryController =
        TextEditingController(text: existing?.category ?? 'Coffee');
    final priceController =
        TextEditingController(text: existing?.price.toStringAsFixed(0));
    final emojiController = TextEditingController(text: existing?.emoji ?? '☕');
    final formKey = GlobalKey<FormState>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.latte,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Text(
                  existing == null ? 'New Menu Item' : 'Edit Menu Item',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    SizedBox(
                      width: 70,
                      child: TextFormField(
                        controller: emojiController,
                        textAlign: TextAlign.center,
                        decoration: const InputDecoration(labelText: 'Icon'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: nameController,
                        decoration: const InputDecoration(labelText: 'Item name'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: categoryController,
                  decoration: const InputDecoration(
                      labelText: 'Category (e.g. Coffee, Pastries)'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: priceController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Price (₱)'),
                  validator: (v) {
                    final n = double.tryParse(v ?? '');
                    if (n == null || n <= 0) return 'Enter a valid price';
                    return null;
                  },
                ),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: () {
                    if (!formKey.currentState!.validate()) return;
                    setState(() {
                      if (existing != null) {
                        existing.name = nameController.text.trim();
                        existing.category = categoryController.text.trim();
                        existing.price =
                            double.parse(priceController.text.trim());
                        existing.emoji = emojiController.text.trim().isEmpty
                            ? '☕'
                            : emojiController.text.trim();
                      } else {
                        MockData.menu.add(MenuItem(
                          id: 'local-${DateTime.now().millisecondsSinceEpoch}',
                          name: nameController.text.trim(),
                          category: categoryController.text.trim(),
                          price: double.parse(priceController.text.trim()),
                          emoji: emojiController.text.trim().isEmpty
                              ? '☕'
                              : emojiController.text.trim(),
                        ));
                      }
                    });
                    Navigator.of(context).pop();
                  },
                  child:
                      Text(existing == null ? 'Add Item' : 'Save Changes'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _delete(MenuItem item) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove item?'),
        content: Text('"${item.name}" will be removed from the menu.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              setState(() => MockData.menu.remove(item));
              Navigator.of(context).pop();
            },
            child: Text('Remove', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = MockData.menu.map((m) => m.category).toSet().toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Café Menu')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Add Item'),
      ),
      body: MockData.menu.isEmpty
          ? Center(
              child: Text('No menu items yet — add one',
                  style: TextStyle(color: AppColors.slateGrey)),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
              children: [
                for (final category in categories) ...[
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10, top: 6),
                    child: Text(
                      category.toUpperCase(),
                      style: TextStyle(
                        color: AppColors.gold,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        letterSpacing: 1.6,
                      ),
                    ),
                  ),
                  ...MockData.menu
                      .where((m) => m.category == category)
                      .toList()
                      .asMap()
                      .entries
                      .map((entry) {
                    final item = entry.value;
                    return FadeSlideIn(
                      delay: Duration(milliseconds: entry.key * 50),
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    color: AppColors.latte,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(item.emoji,
                                      style: const TextStyle(fontSize: 20)),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(item.name,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 2),
                                      Text(
                                          '₱${item.price.toStringAsFixed(0)}',
                                          style: TextStyle(
                                              color: AppColors.matchaDark,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12.5)),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined,
                                      size: 20),
                                  color: AppColors.coffeeBrown,
                                  onPressed: () => _openEditor(existing: item),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline,
                                      size: 20),
                                  color: AppColors.error,
                                  onPressed: () => _delete(item),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
    );
  }
}
