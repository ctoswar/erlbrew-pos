import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/app_models.dart';
import '../theme/app_theme.dart';
import '../widgets/luxury_button.dart';
import 'my_qr_screen.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  void _showMyQr() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const MyQrScreen()),
    );
    // Points/stamps may have been updated by an admin scan while this
    // screen was hidden — refresh to reflect the shared mock data.
    if (mounted) setState(() {});
  }

  void _redeem(RewardItem item) {
    final user = MockData.currentUser!;
    if (user.points < item.pointsCost) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Not enough points for ${item.title}')),
      );
      return;
    }
    setState(() => user.points -= item.pointsCost);
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reward Redeemed! 🎉'),
        content: Text(
            'Show this screen to the barista to claim: ${item.title}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = MockData.currentUser!;
    final stampProgress = user.stamps / user.stampsGoal;

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
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Points balance card — styled like a membership card
          Container(
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
                      'Hi, ${user.name.split(' ').first} 👋',
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.14),
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppColors.gold.withOpacity(0.4)),
                      ),
                      child: const Icon(Icons.local_cafe,
                          color: AppColors.goldLight, size: 18),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '${user.points}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 42,
                        fontWeight: FontWeight.bold,
                        height: 1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'points',
                      style: TextStyle(
                          color: AppColors.goldLight.withOpacity(0.85),
                          fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Keep ordering to unlock more rewards',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
                const SizedBox(height: 14),
                Container(height: 1, color: Colors.white.withOpacity(0.12)),
                const SizedBox(height: 10),
                Text(
                  'ERLBREW MEMBER',
                  style: TextStyle(
                    color: AppColors.goldLight.withOpacity(0.6),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          SizedBox(
            width: double.infinity,
            child: LuxuryButton(
              label: 'Show My QR Code',
              icon: Icons.qr_code_2,
              onPressed: _showMyQr,
            ),
          ),
          const SizedBox(height: 18),

          // Stamp card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Stamp Card',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      Text('${user.stamps}/${user.stampsGoal}',
                          style: TextStyle(color: AppColors.slateGrey)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: List.generate(user.stampsGoal, (i) {
                      final filled = i < user.stamps;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: CircleAvatar(
                            radius: 16,
                            backgroundColor:
                                filled ? AppColors.espresso : AppColors.latte,
                            child: Icon(
                              filled ? Icons.local_cafe : Icons.local_cafe_outlined,
                              size: 16,
                              color: filled ? AppColors.goldLight : AppColors.slateGrey,
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: stampProgress,
                      minHeight: 6,
                      backgroundColor: AppColors.latte,
                      valueColor:
                          const AlwaysStoppedAnimation(AppColors.gold),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${user.stampsGoal - user.stamps} more to a free drink',
                    style: TextStyle(fontSize: 12, color: AppColors.slateGrey),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),
          Text('Redeem Points', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),

          ...MockData.catalog.map((item) {
            final affordable = user.points >= item.pointsCost;
            return Padding(
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
                        child: Text(item.emoji, style: const TextStyle(fontSize: 20)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title,
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(
                              item.description,
                              style: TextStyle(
                                  color: AppColors.slateGrey, fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      AnimatedOpacity(
                        opacity: affordable ? 1 : 0.45,
                        duration: const Duration(milliseconds: 200),
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: affordable
                                ? AppColors.espresso
                                : AppColors.slateGrey,
                            foregroundColor: AppColors.goldLight,
                            minimumSize: const Size(0, 36),
                            padding:
                                const EdgeInsets.symmetric(horizontal: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          onPressed: () => _redeem(item),
                          child: Text('${item.pointsCost} pts',
                              style: GoogleFonts.quicksand(
                                  fontWeight: FontWeight.w700, fontSize: 12.5)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
