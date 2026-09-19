import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/app_models.dart';
import '../services/pos_api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/animated_counter.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/luxury_button.dart';
import 'my_qr_screen.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  List<Map<String, dynamic>> _rewards = [];
  bool _loadingRewards = true;
  String? _error;
  int _points = 0;
  String _tier = 'bronze';
  String _customerName = 'Guest';
  List<Map<String, dynamic>> _pointsHistory = [];
  bool _loadingHistory = false;
  List<Map<String, dynamic>> _redemptions = [];
  bool _redeeming = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loadingRewards = true;
      _error = null;
    });
    try {
      final futures = await Future.wait([
        PosApiService.instance.getPoints(),
        PosApiService.instance.getRewards(),
        PosApiService.instance.getProfile(),
      ]);
      final pointsData = futures[0] as Map<String, dynamic>;
      final rewardsData = futures[1] as List<Map<String, dynamic>>;
      final profile = futures[2] as AppUser;

      if (mounted) setState(() {
        _points = pointsData['points'] ?? 0;
        _tier = pointsData['tier'] ?? 'bronze';
        _customerName = profile.name;
        _rewards = rewardsData;
        _loadingRewards = false;
      });
      _loadPointsHistory();
      _loadRedemptions();
    } on PosApiServiceException catch (e) {
      if (mounted) setState(() {
        _error = e.message;
        _loadingRewards = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _error = 'Unable to load rewards';
        _loadingRewards = false;
      });
    }
  }

  Future<void> _loadPointsHistory() async {
    setState(() => _loadingHistory = true);
    try {
      final data = await PosApiService.instance.getPointsHistory(limit: 10);
      if (mounted) setState(() {
        _pointsHistory = List<Map<String, dynamic>>.from(data['history'] ?? []);
        _loadingHistory = false;
      });
    } on PosApiServiceException catch (e) {
      if (mounted) setState(() {
        _error = e.message;
        _loadingHistory = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  Future<void> _loadRedemptions() async {
    try {
      final data = await PosApiService.instance.getRedemptions();
      if (mounted) setState(() => _redemptions = data);
    } catch (_) {
      // Redemption history is non-critical; leave empty on error.
    }
  }

  String _tierLabel(String tier) {
    switch (tier) {
      case 'platinum': return '⭐ Platinum';
      case 'gold': return '🥇 Gold';
      case 'silver': return '🥈 Silver';
      default: return '🥉 Bronze';
    }
  }

  Color _tierColor(String tier) {
    switch (tier) {
      case 'platinum': return const Color(0xFFE5E4E2);
      case 'gold': return const Color(0xFFD4AF37);
      case 'silver': return const Color(0xFFC0C0C0);
      default: return const Color(0xFFCD7F32);
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayName = _customerName.split(' ').first;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rewards'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_2),
            tooltip: 'Show my QR code',
            onPressed: _showMyQr,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            FadeSlideIn(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: AppColors.onyxGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.gold.withOpacity(0.35)),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.espresso.withOpacity(0.32),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Hi, $displayName 👋',
                          style: const TextStyle(color: Colors.white70, fontSize: 14),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: _tierColor(_tier).withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _tierColor(_tier).withOpacity(0.5)),
                          ),
                          child: Text(
                            _tierLabel(_tier),
                            style: TextStyle(color: _tierColor(_tier), fontSize: 11, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        AnimatedCounter(
                          value: _points,
                          style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.bold, height: 1),
                        ),
                        const SizedBox(width: 8),
                        Text('points', style: TextStyle(color: AppColors.goldLight.withOpacity(0.85), fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text('Keep ordering to unlock more rewards', style: TextStyle(color: Colors.white54, fontSize: 12)),
                    const SizedBox(height: 14),
                    Container(height: 1, color: Colors.white.withOpacity(0.12)),
                    const SizedBox(height: 10),
                    Text('ERLBREW MEMBER', style: TextStyle(color: AppColors.goldLight.withOpacity(0.6), fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 2.4)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),

            if (_error != null && !_loadingRewards) ...[
              FadeSlideIn(
                delay: const Duration(milliseconds: 70),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.error.withOpacity(0.25)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: AppColors.error, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: TextStyle(color: AppColors.error, fontSize: 13),
                        ),
                      ),
                      TextButton(
                        onPressed: _loadData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],

            FadeSlideIn(
              delay: const Duration(milliseconds: 90),
              child: SizedBox(
                width: double.infinity,
                child: LuxuryButton(label: 'Show My QR Code', icon: Icons.qr_code_2, onPressed: _showMyQr),
              ),
            ),
            const SizedBox(height: 24),

            FadeSlideIn(
              delay: const Duration(milliseconds: 160),
              child: Text('Points History', style: Theme.of(context).textTheme.titleLarge),
            ),
            const SizedBox(height: 12),
            if (_loadingHistory)
              const Center(child: CircularProgressIndicator())
            else if (_pointsHistory.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: Text('No points history yet. Place an order to start earning!', style: TextStyle(color: AppColors.slateGrey)),
                  ),
                ),
              )
            else
              ...(_pointsHistory.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                final points = item['points'] ?? 0;
                final type = item['type'] ?? 'earned';
                final notes = item['notes'] ?? '';
                final createdAt = item['created_at'];
                String dateStr = '';
                if (createdAt != null) {
                  try {
                    final dt = DateTime.parse(createdAt.toString());
                    dateStr = '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
                  } catch (_) {
                    dateStr = createdAt.toString().substring(0, 16);
                  }
                }
                return FadeSlideIn(
                  delay: Duration(milliseconds: 200 + index * 50),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        leading: Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: type == 'earned' ? AppColors.matchaDark.withOpacity(0.15) : AppColors.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            type == 'earned' ? Icons.add_circle_outline : Icons.remove_circle_outline,
                            color: type == 'earned' ? AppColors.matchaDark : AppColors.error,
                            size: 20,
                          ),
                        ),
                        title: Text(notes.isNotEmpty ? notes : (type == 'earned' ? 'Points earned' : 'Points redeemed'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: Text(dateStr, style: TextStyle(fontSize: 11, color: AppColors.slateGrey)),
                        trailing: Text('${points > 0 ? '+' : ''}$points pts', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: type == 'earned' ? AppColors.matchaDark : AppColors.error)),
                      ),
                    ),
                  ),
                );
              }).toList()),
            const SizedBox(height: 24),

            FadeSlideIn(
              delay: const Duration(milliseconds: 250),
              child: Text('Redeem Points', style: Theme.of(context).textTheme.titleLarge),
            ),
            const SizedBox(height: 12),
            if (_loadingRewards)
              const Center(child: CircularProgressIndicator())
            else if (_rewards.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(child: Text('No rewards available yet', style: TextStyle(color: AppColors.slateGrey))),
                ),
              )
            else
              ...(_rewards.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                final pointsCost = item['points_cost'] ?? 0;
                final affordable = _points >= pointsCost;
                return FadeSlideIn(
                  delay: Duration(milliseconds: 300 + index * 70),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              width: 46, height: 46,
                              decoration: BoxDecoration(color: AppColors.latte, borderRadius: BorderRadius.circular(14)),
                              alignment: Alignment.center,
                              child: Text(item['emoji'] ?? '🎁', style: const TextStyle(fontSize: 20)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 2),
                                  Text(item['description'] ?? '', style: TextStyle(color: AppColors.slateGrey, fontSize: 12.5)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            AnimatedOpacity(
                              opacity: affordable && !_redeeming ? 1 : 0.45,
                              duration: const Duration(milliseconds: 200),
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: affordable ? AppColors.espresso : AppColors.slateGrey,
                                  foregroundColor: AppColors.goldLight,
                                  minimumSize: const Size(0, 36),
                                  padding: const EdgeInsets.symmetric(horizontal: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: affordable && !_redeeming ? () => _redeem(item) : null,
                                child: _redeeming
                                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : Text('$pointsCost pts', style: GoogleFonts.quicksand(fontWeight: FontWeight.w700, fontSize: 12.5)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList()),

            if (_redemptions.isNotEmpty) ...[
              const SizedBox(height: 24),
              FadeSlideIn(
                delay: const Duration(milliseconds: 350),
                child: Text('Redemption History', style: Theme.of(context).textTheme.titleLarge),
              ),
              const SizedBox(height: 12),
              ...(_redemptions.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                final createdAt = item['created_at'];
                String dateStr = '';
                if (createdAt != null) {
                  try {
                    final dt = DateTime.parse(createdAt.toString());
                    dateStr = '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
                  } catch (_) {
                    dateStr = createdAt.toString().substring(0, 16);
                  }
                }
                return FadeSlideIn(
                  delay: Duration(milliseconds: 400 + index * 50),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        leading: Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.gold.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: Text(item['emoji'] ?? '🎁', style: const TextStyle(fontSize: 18)),
                        ),
                        title: Text(item['title'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: Text(dateStr, style: TextStyle(fontSize: 11, color: AppColors.slateGrey)),
                        trailing: Text('-${item['points_spent'] ?? 0} pts', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.error)),
                      ),
                    ),
                  ),
                );
              }).toList()),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  void _showMyQr() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MyQrScreen()));
    _loadData();
  }

  void _redeem(Map<String, dynamic> reward) async {
    if (_redeeming) return;
    final rewardId = reward['id'];
    final rewardTitle = reward['title'] ?? '';
    final pointsCost = reward['points_cost'] ?? 0;

    if (_points < pointsCost) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Not enough points for $rewardTitle')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Redeem $rewardTitle?'),
        content: Text('This will deduct $pointsCost points from your balance.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Redeem', style: TextStyle(color: AppColors.gold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _redeeming = true);
    try {
      final result = await PosApiService.instance.redeemReward(rewardId);
      if (mounted) {
        setState(() {
          _points = result['balance'] ?? _points;
          _tier = result['tier'] ?? _tier;
        });
        _loadPointsHistory();
        _loadRedemptions();

        if (mounted) {
          showDialog(
            context: context,
            builder: (_) => TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOutBack,
              builder: (context, t, child) => Transform.scale(scale: t, child: child),
              child: AlertDialog(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: const Text('Reward Redeemed!'),
                content: Text('Show this screen to the barista to claim: $rewardTitle.'),
                actions: [
                  TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
                ],
              ),
            ),
          );
        }
      }
    } on PosApiServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Redemption failed: ${e.message}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Redemption failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _redeeming = false);
    }
  }
}
