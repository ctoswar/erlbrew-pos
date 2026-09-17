import 'package:flutter/material.dart';
import '../../models/app_models.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/fade_slide_in.dart';

class AdminRewardsScreen extends StatefulWidget {
  const AdminRewardsScreen({super.key});

  @override
  State<AdminRewardsScreen> createState() => _AdminRewardsScreenState();
}

class _AdminRewardsScreenState extends State<AdminRewardsScreen> {
  List<Map<String, dynamic>> _rewards = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRewards();
  }

  Future<void> _loadRewards() async {
    setState(() => _loading = true);
    try {
      final rewards = await PosApiService.instance.getAllRewards();
      if (mounted) setState(() {
        _rewards = rewards;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openEditor({Map<String, dynamic>? existing}) {
    final titleController = TextEditingController(text: existing?['title']?.toString());
    final descController = TextEditingController(text: existing?['description']?.toString());
    final costController = TextEditingController(text: existing?['points_cost']?.toString());
    final emojiController = TextEditingController(text: existing?['emoji']?.toString() ?? '☕');
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
                  existing == null ? 'New Reward' : 'Edit Reward',
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
                        controller: titleController,
                        decoration:
                            const InputDecoration(labelText: 'Reward name'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: costController,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Points cost'),
                  validator: (v) {
                    final n = int.tryParse(v ?? '');
                    if (n == null || n <= 0) return 'Enter a valid number';
                    return null;
                  },
                ),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    try {
                      if (existing != null) {
                        await PosApiService.instance.updateReward(
                          id: existing['id'] as int,
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          pointsCost: int.parse(costController.text.trim()),
                          emoji: emojiController.text.trim().isEmpty
                              ? '☕'
                              : emojiController.text.trim(),
                        );
                      } else {
                        await PosApiService.instance.createReward(
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          pointsCost: int.parse(costController.text.trim()),
                          emoji: emojiController.text.trim().isEmpty
                              ? '☕'
                              : emojiController.text.trim(),
                        );
                      }
                      await _loadRewards();
                      if (mounted) Navigator.of(context).pop();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error: $e')),
                        );
                      }
                    }
                  },
                  child: Text(existing == null ? 'Add Reward' : 'Save Changes'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _delete(Map<String, dynamic> item) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove reward?'),
        content: Text('"${item['title']}" will be removed from the catalog.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              try {
                await PosApiService.instance.deleteReward(item['id'] as int);
                await _loadRewards();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
              if (mounted) Navigator.of(context).pop();
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
      appBar: AppBar(title: const Text('Reward Catalog')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Add Reward'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _rewards.isEmpty
              ? Center(
                  child: Text('No rewards yet — add one',
                      style: TextStyle(color: AppColors.slateGrey)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                  itemCount: _rewards.length,
                  itemBuilder: (context, i) {
                    final item = _rewards[i];
                    return FadeSlideIn(
                      delay: Duration(milliseconds: i * 60),
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
                                  child: Text(item['emoji']?.toString() ?? '🎁',
                                      style: const TextStyle(fontSize: 20)),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item['title']?.toString() ?? '',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 2),
                                      Text(item['description']?.toString() ?? '',
                                          style: TextStyle(
                                              color: AppColors.slateGrey,
                                              fontSize: 12.5)),
                                      const SizedBox(height: 4),
                                      Text('${item['points_cost']} pts',
                                          style: TextStyle(
                                              color: AppColors.matchaDark,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12.5)),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, size: 20),
                                  color: AppColors.coffeeBrown,
                                  onPressed: () => _openEditor(existing: item),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 20),
                                  color: AppColors.error,
                                  onPressed: () => _delete(item),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
