import 'package:flutter/material.dart';
import '../../services/pos_api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/reward_icons.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/fade_slide_in.dart';
import '../../widgets/shimmer.dart';

enum _RewardSection { rewards, missions }

class AdminRewardsScreen extends StatefulWidget {
  const AdminRewardsScreen({super.key});

  @override
  State<AdminRewardsScreen> createState() => _AdminRewardsScreenState();
}

class _AdminRewardsScreenState extends State<AdminRewardsScreen> {
  _RewardSection _section = _RewardSection.rewards;

  // Rewards list
  List<Map<String, dynamic>>? _rewards;
  bool _loadingRewards = true;
  String? _error;

  // Missions list — loaded on first visit to the Missions section so the
  // default Rewards tab never pays for requests it doesn't use.
  List<Map<String, dynamic>>? _missions;
  bool _loadingMissions = true;
  String? _missionsError;

  @override
  void initState() {
    super.initState();
    _loadRewards();
  }

  Future<void> _loadRewards() async {
    setState(() {
      _loadingRewards = true;
      _error = null;
    });
    try {
      final rewards = await PosApiService.instance.getAllRewards();
      if (mounted) {
        setState(() {
          _rewards = rewards;
          _loadingRewards = false;
        });
      }
    } on PosApiServiceException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loadingRewards = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load rewards';
          _loadingRewards = false;
        });
      }
    }
  }

  Future<void> _loadMissions() async {
    setState(() {
      _loadingMissions = true;
      _missionsError = null;
    });
    try {
      final missions = await PosApiService.instance.getAllMissions();
      if (mounted) {
        setState(() {
          _missions = missions;
          _loadingMissions = false;
        });
      }
    } on PosApiServiceException catch (e) {
      if (mounted) {
        setState(() {
          _missionsError = e.message;
          _loadingMissions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _missionsError = 'Unable to load missions';
          _loadingMissions = false;
        });
      }
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  // ── Reward catalog ─────────────────────────────────────────────────

  void _openEditor({Map<String, dynamic>? existing}) {
    final titleController =
        TextEditingController(text: existing?['title']?.toString());
    final descController =
        TextEditingController(text: existing?['description']?.toString());
    final costController =
        TextEditingController(text: existing?['points_cost']?.toString());
    final initialIcon =
        rewardIconChoiceFromKey(existing?['icon_key']?.toString());
    RewardIconChoice? pickedIcon;
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 170,
                      child: DropdownButtonFormField<RewardIconChoice>(
                        initialValue: initialIcon,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'Icon'),
                        items: rewardIconChoices
                            .map((choice) => DropdownMenuItem<RewardIconChoice>(
                                  value: choice,
                                  child: Row(
                                    children: [
                                      rewardIconChoicePreview(choice),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          choice.label,
                                          overflow: TextOverflow.ellipsis,
                                          style:
                                              const TextStyle(fontSize: 13.5),
                                        ),
                                      ),
                                    ],
                                  ),
                                ))
                            .toList(),
                        onChanged: (value) => pickedIcon = value,
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
                  decoration: const InputDecoration(labelText: 'Points cost'),
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
                    final iconKey = (pickedIcon ?? initialIcon).key;
                    try {
                      if (existing != null) {
                        await PosApiService.instance.updateReward(
                          id: existing['id'] as int,
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          pointsCost: int.parse(costController.text.trim()),
                          iconKey: iconKey,
                        );
                      } else {
                        await PosApiService.instance.createReward(
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          pointsCost: int.parse(costController.text.trim()),
                          iconKey: iconKey,
                        );
                      }
                      await _loadRewards();
                      if (context.mounted) Navigator.of(context).pop();
                    } catch (e) {
                      if (context.mounted) {
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

  Future<void> _deleteReward(Map<String, dynamic> item) async {
    final title = item['title']?.toString() ?? '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove reward?'),
        content: Text('"$title" will be removed from the catalog.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child:
                const Text('Remove', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final result =
          await PosApiService.instance.deleteReward(item['id'] as int);
      await _loadRewards();
      if (result['deactivated'] == true) {
        _showSnack(
            '"$title" is now Inactive — it already has redemption history, so it stays in the list but hidden from customers.');
      } else {
        _showSnack('"$title" was removed.');
      }
    } catch (e) {
      _showSnack('Error: $e');
    }
  }

  // ── Missions ───────────────────────────────────────────────────────

  String _missionRepeatLabel(String? interval) {
    switch (interval) {
      case 'weekly':
        return 'Weekly';
      case 'once':
        return 'One-time';
      default:
        return 'Daily';
    }
  }

  void _openMissionEditor({Map<String, dynamic>? existing}) {
    final titleController =
        TextEditingController(text: existing?['title']?.toString());
    final descController =
        TextEditingController(text: existing?['description']?.toString());
    final targetController =
        TextEditingController(text: existing?['target']?.toString() ?? '2');
    final rewardController = TextEditingController(
        text: existing?['points_reward']?.toString() ?? '50');
    String repeatInterval =
        (existing?['repeat_interval'] ?? 'daily').toString();
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
                  existing == null ? 'New Mission' : 'Edit Mission',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Customers earn bonus points by completing this challenge.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.slateGrey),
                ),
                const SizedBox(height: 18),
                TextFormField(
                  controller: titleController,
                  decoration: const InputDecoration(
                      labelText: 'Mission name',
                      hintText: 'Order 2 drinks today'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: targetController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Orders needed'),
                        validator: (v) {
                          final n = int.tryParse(v ?? '');
                          if (n == null || n <= 0) {
                            return 'Enter a valid number';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: rewardController,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Bonus points'),
                        validator: (v) {
                          final n = int.tryParse(v ?? '');
                          if (n == null || n <= 0) {
                            return 'Enter a valid number';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: repeatInterval,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Repeats'),
                  items: const [
                    DropdownMenuItem(
                        value: 'daily',
                        child: Text('Daily (resets every day)')),
                    DropdownMenuItem(
                        value: 'weekly', child: Text('Weekly (Mon–Sun)')),
                    DropdownMenuItem(
                        value: 'once', child: Text('One-time (all-time)')),
                  ],
                  onChanged: (value) {
                    if (value != null) repeatInterval = value;
                  },
                ),
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    final target = int.parse(targetController.text.trim());
                    final reward = int.parse(rewardController.text.trim());
                    try {
                      if (existing != null) {
                        await PosApiService.instance.updateMission(
                          id: existing['id'] as int,
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          targetOrders: target,
                          pointsReward: reward,
                          repeatInterval: repeatInterval,
                        );
                      } else {
                        await PosApiService.instance.createMission(
                          title: titleController.text.trim(),
                          description: descController.text.trim(),
                          targetOrders: target,
                          pointsReward: reward,
                          repeatInterval: repeatInterval,
                        );
                      }
                      await _loadMissions();
                      if (context.mounted) Navigator.of(context).pop();
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error: $e')),
                        );
                      }
                    }
                  },
                  child:
                      Text(existing == null ? 'Add Mission' : 'Save Changes'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _deleteMission(Map<String, dynamic> item) async {
    final title = item['title']?.toString() ?? '';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove mission?'),
        content: Text(
            '"$title" will be removed for all customers, including its claim history.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child:
                const Text('Remove', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await PosApiService.instance.deleteMission(item['id'] as int);
      await _loadMissions();
      _showSnack('"$title" was removed.');
    } catch (e) {
      _showSnack('Error: $e');
    }
  }

  // ── Section switching ──────────────────────────────────────────────

  void _selectSection(_RewardSection section) {
    if (_section == section) return;
    setState(() => _section = section);
    // Lazy: fetch the Missions list the first time it is shown.
    if (section == _RewardSection.missions && _missions == null) {
      _loadMissions();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMissions = _section == _RewardSection.missions;
    return Scaffold(
      appBar: AppBar(title: const Text('Rewards')),
      floatingActionButton: isMissions
          ? FloatingActionButton.extended(
              heroTag: 'admin-missions-add',
              onPressed: () => _openMissionEditor(),
              icon: const Icon(Icons.flag_outlined),
              label: const Text('Add Mission'),
            )
          : FloatingActionButton.extended(
              heroTag: 'admin-rewards-add',
              onPressed: () => _openEditor(),
              icon: const Icon(Icons.add),
              label: const Text('Add Reward'),
            ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<_RewardSection>(
                segments: const [
                  ButtonSegment(
                    value: _RewardSection.rewards,
                    icon: Icon(Icons.card_giftcard_outlined, size: 18),
                    label: Text('Rewards'),
                  ),
                  ButtonSegment(
                    value: _RewardSection.missions,
                    icon: Icon(Icons.flag_outlined, size: 18),
                    label: Text('Missions'),
                  ),
                ],
                selected: {_section},
                onSelectionChanged: (selection) =>
                    _selectSection(selection.first),
              ),
            ),
          ),
          Expanded(
            child: isMissions ? _buildMissionsBody() : _buildRewardsBody(),
          ),
        ],
      ),
    );
  }

  // ── Rewards body ───────────────────────────────────────────────────

  Widget _buildRewardsBody() {
    if (_loadingRewards) {
      return const _LoadingList(label: 'rewards');
    }
    if (_error != null) {
      return _ErrorPanel(message: _error!, onRetry: _loadRewards);
    }
    final rewards = _rewards ?? const <Map<String, dynamic>>[];
    if (rewards.isEmpty) {
      return const EmptyState(
        icon: Icons.card_giftcard_outlined,
        title: 'No rewards yet',
        subtitle: 'Tap Add Reward to create one',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      itemCount: rewards.length,
      itemBuilder: (context, i) {
        final item = rewards[i];
        final inactive = item['is_active'] == 0 || item['is_active'] == false;
        return FadeSlideIn(
          delay: fadeStagger(i),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: Opacity(
                opacity: inactive ? 0.6 : 1,
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
                        child: rewardIconVisual(
                          iconKey: item['icon_key']?.toString(),
                          title: item['title']?.toString(),
                          description: item['description']?.toString(),
                          emoji: item['emoji']?.toString(),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(item['title']?.toString() ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700)),
                                ),
                                if (inactive) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.slateGrey
                                          .withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('Inactive',
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.slateGrey)),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(item['description']?.toString() ?? '',
                                style: const TextStyle(
                                    color: AppColors.slateGrey,
                                    fontSize: 12.5)),
                            const SizedBox(height: 4),
                            Text('${item['points_cost']} pts',
                                style: const TextStyle(
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
                        onPressed: () => _deleteReward(item),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ── Missions body ──────────────────────────────────────────────────

  Widget _buildMissionsBody() {
    if (_loadingMissions) {
      return const _LoadingList(label: 'missions');
    }
    if (_missionsError != null) {
      return _ErrorPanel(message: _missionsError!, onRetry: _loadMissions);
    }
    final missions = _missions ?? const <Map<String, dynamic>>[];
    if (missions.isEmpty) {
      return const EmptyState(
        icon: Icons.flag_outlined,
        title: 'No missions yet',
        subtitle: 'Tap Add Mission to create one',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      itemCount: missions.length,
      itemBuilder: (context, i) {
        final item = missions[i];
        final inactive = item['is_active'] == 0 || item['is_active'] == false;
        final claims = (item['total_claims'] as num?)?.toInt() ?? 0;
        return FadeSlideIn(
          delay: fadeStagger(i),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: Opacity(
                opacity: inactive ? 0.6 : 1,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        alignment: Alignment.center,
                        child: Text(item['emoji']?.toString() ?? '🎯',
                            style: const TextStyle(fontSize: 22)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(item['title']?.toString() ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700)),
                                ),
                                if (inactive) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.slateGrey
                                          .withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('Inactive',
                                        style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.slateGrey)),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(item['description']?.toString() ?? '',
                                style: const TextStyle(
                                    color: AppColors.slateGrey,
                                    fontSize: 12.5)),
                            const SizedBox(height: 4),
                            Text(
                              '${item['target']} orders · +${item['points_reward']} pts · '
                              '${_missionRepeatLabel(item['repeat_interval']?.toString())} · '
                              '$claims claimed${inactive ? ' · hidden' : ''}',
                              style: const TextStyle(
                                color: AppColors.matchaDark,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 20),
                        color: AppColors.coffeeBrown,
                        onPressed: () => _openMissionEditor(existing: item),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20),
                        color: AppColors.error,
                        onPressed: () => _deleteMission(item),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _LoadingList extends StatelessWidget {
  final String label;
  const _LoadingList({required this.label});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      physics: const NeverScrollableScrollPhysics(),
      children: const [
        SkeletonTileList(count: 5),
      ],
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorPanel({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Error: $message',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.error)),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
