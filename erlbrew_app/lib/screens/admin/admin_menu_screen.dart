import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';

class AdminMenuScreen extends StatefulWidget {
  const AdminMenuScreen({super.key});

  @override
  State<AdminMenuScreen> createState() => _AdminMenuScreenState();
}

class _AdminMenuScreenState extends State<AdminMenuScreen> {
  List<MenuItem> _items = [];
  bool _loading = true;
  String _search = '';
  String _selectedCategory = 'All';

  List<String> get _categories {
    final cats = _items.map((m) => m.category).toSet().toList();
    cats.sort();
    return ['All', ...cats];
  }

  List<MenuItem> get _filtered {
    return _items.where((m) {
      final matchSearch = _search.isEmpty ||
          m.name.toLowerCase().contains(_search.toLowerCase()) ||
          m.category.toLowerCase().contains(_search.toLowerCase());
      final matchCat = _selectedCategory == 'All' || m.category == _selectedCategory;
      return matchSearch && matchCat;
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  Future<void> _loadMenu() async {
    setState(() => _loading = true);
    try {
      final items = await PosApiService.instance.getMenu();
      if (mounted) setState(() { _items = items; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openEditor({MenuItem? existing}) {
    final nameCtrl = TextEditingController(text: existing?.name);
    final catCtrl = TextEditingController(text: existing?.category ?? 'Coffee');
    final priceCtrl = TextEditingController(text: existing?.price.toStringAsFixed(0));
    final emojiCtrl = TextEditingController(text: existing?.emoji ?? '☕');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final formKey = GlobalKey<FormState>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40, height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(color: AppColors.latte, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  Text(existing == null ? 'New Menu Item' : 'Edit Menu Item',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 18),
                  Row(children: [
                    SizedBox(
                      width: 70,
                      child: TextFormField(controller: emojiCtrl, textAlign: TextAlign.center,
                          decoration: const InputDecoration(labelText: 'Icon')),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(controller: nameCtrl,
                          decoration: const InputDecoration(labelText: 'Item name'),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                    ),
                  ]),
                  const SizedBox(height: 14),
                  TextFormField(controller: catCtrl,
                      decoration: const InputDecoration(labelText: 'Category'),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                  const SizedBox(height: 14),
                  TextFormField(controller: priceCtrl, keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Price (₱)'),
                      validator: (v) { final n = double.tryParse(v ?? ''); if (n == null || n <= 0) return 'Enter a valid price'; return null; }),
                  const SizedBox(height: 14),
                  TextFormField(controller: descCtrl,
                      decoration: const InputDecoration(labelText: 'Description (optional)')),
                  const SizedBox(height: 22),
                  ElevatedButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;
                      final nav = Navigator.of(ctx);
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        final id = existing?.id ?? 'm${DateTime.now().millisecondsSinceEpoch}';
                        final name = nameCtrl.text.trim();
                        final category = catCtrl.text.trim();
                        final price = double.parse(priceCtrl.text.trim());
                        final emoji = emojiCtrl.text.trim().isEmpty ? '☕' : emojiCtrl.text.trim();
                        final desc = descCtrl.text.trim();
                        if (existing != null) {
                          await PosApiService.instance.updateMenuItem(
                            id: existing.id, name: name, category: category,
                            price: price, emoji: emoji, description: desc,
                          );
                        } else {
                          await PosApiService.instance.createMenuItem(
                            id: id, name: name, category: category,
                            price: price, emoji: emoji, description: desc,
                          );
                        }
                        nav.pop();
                        _loadMenu();
                      } catch (e) {
                        messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
                      }
                    },
                    child: Text(existing == null ? 'Add Item' : 'Save Changes'),
                  ),
                ],
              ),
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
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              Navigator.of(context).pop();
              try {
                await PosApiService.instance.deleteMenuItem(item.id);
                _loadMenu();
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: Text('Remove', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Café Menu'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadMenu),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Search bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search menu items...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onChanged: (v) => setState(() => _search = v),
                  ),
                ),
                // Category chips
                SizedBox(
                  height: 40,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final cat = _categories[i];
                      final selected = _selectedCategory == cat;
                      return ChoiceChip(
                        label: Text(cat),
                        selected: selected,
                        onSelected: (_) => setState(() => _selectedCategory = cat),
                        selectedColor: AppColors.gold,
                        labelStyle: TextStyle(color: selected ? Colors.white : AppColors.espresso),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
                // Item count
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text('${_filtered.length} items',
                        style: TextStyle(color: AppColors.slateGrey, fontSize: 12)),
                  ),
                ),
                const SizedBox(height: 8),
                // Menu items grid
                Expanded(
                  child: _filtered.isEmpty
                      ? Center(child: Text('No menu items found',
                          style: TextStyle(color: AppColors.slateGrey)))
                      : GridView.builder(
                          padding: const EdgeInsets.all(16),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 1.4,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                          ),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) => _MenuCard(
                            item: _filtered[i],
                            onEdit: () => _openEditor(existing: _filtered[i]),
                            onDelete: () => _delete(_filtered[i]),
                          ),
                        ),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.gold,
        onPressed: () => _openEditor(),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class _MenuCard extends StatelessWidget {
  final MenuItem item;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _MenuCard({required this.item, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(item.emoji, style: const TextStyle(fontSize: 24)),
                const Spacer(),
                PopupMenuButton<String>(
                  onSelected: (v) { if (v == 'edit') onEdit(); else if (v == 'delete') onDelete(); },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    const PopupMenuItem(value: 'delete', child: Text('Delete')),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(item.name,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(item.category.toUpperCase(),
                style: TextStyle(color: AppColors.slateGrey, fontSize: 10, letterSpacing: 0.5)),
            const Spacer(),
            Text('₱${item.price.toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          ],
        ),
      ),
    );
  }
}
