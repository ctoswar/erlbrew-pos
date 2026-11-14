import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Resolves the Flutter built-in icon for a reward from its category or name
/// (case-insensitive contains-match). The rewards API has no dedicated
/// category field yet, so [description] is matched too — e.g. "Free Matcha
/// Latte" / "coffee" both resolve this way.
///
/// An explicitly picked icon ([iconKey], stored in
/// `loyalty_rewards.icon_key` by the admin editor) always wins over the
/// name-based inference below.
///
/// More specific drinks are checked before the generic coffee match so
/// "iced matcha latte" maps to matcha, not the latte icon.
///
/// Returns the matching [IconData], or `null` when nothing matches so callers
/// can fall back to the reward's emoji.
IconData? rewardIconFor({
  String? category,
  String? title,
  String? description,
  String? iconKey,
}) {
  final key = (iconKey ?? '').trim().toLowerCase();
  if (key == 'latte') return Icons.local_cafe;
  if (key == 'matcha') return Icons.emoji_food_beverage;
  if (key == 'coldbrew') return Icons.local_drink;
  if (key == 'pastry') return Icons.bakery_dining;

  final text = [
    category,
    title,
    description,
  ].whereType<String>().join(' ').toLowerCase();

  if (text.contains('matcha')) return Icons.emoji_food_beverage;
  if (text.contains('cold brew') || text.contains('coldbrew') || text.contains('iced')) {
    return Icons.local_drink;
  }
  if (text.contains('pastry') ||
      text.contains('croissant') ||
      text.contains('bread') ||
      text.contains('cake')) {
    return Icons.bakery_dining;
  }
  if (text.contains('latte') ||
      text.contains('coffee') ||
      text.contains('espresso') ||
      text.contains('americano') ||
      text.contains('cappuccino')) {
    return Icons.local_cafe;
  }
  return null;
}

/// Renders a reward's icon for use inside the existing beige rounded
/// container: the [rewardIconFor] Flutter icon when one matches, otherwise
/// the reward's emoji.
Widget rewardIconVisual({
  String? category,
  String? title,
  String? description,
  String? emoji,
  String? iconKey,
  double iconSize = 30,
  double emojiFontSize = 20,
}) {
  final icon = rewardIconFor(
    category: category,
    title: title,
    description: description,
    iconKey: iconKey,
  );
  if (icon != null) {
    return Icon(icon, size: iconSize, color: AppColors.gold);
  }
  return Text(emoji ?? '🎁', style: TextStyle(fontSize: emojiFontSize));
}

/// One choice in the reward editor's icon dropdown.
///
/// [key] is stored in `loyalty_rewards.icon_key` ('' = auto: the app infers
/// the icon from the reward's name, legacy behavior for existing rewards).
class RewardIconChoice {
  final String key;
  final String label;
  final IconData icon; // Flutter built-in icon shown in the dropdown

  const RewardIconChoice({
    required this.key,
    required this.label,
    required this.icon,
  });
}

/// The icon dropdown options, in display order.
const List<RewardIconChoice> rewardIconChoices = [
  RewardIconChoice(
      key: '', label: 'Auto (from name)', icon: Icons.auto_awesome),
  RewardIconChoice(key: 'latte', label: 'Latte / Coffee', icon: Icons.local_cafe),
  RewardIconChoice(
      key: 'matcha', label: 'Matcha', icon: Icons.emoji_food_beverage),
  RewardIconChoice(key: 'coldbrew', label: 'Cold Brew', icon: Icons.local_drink),
  RewardIconChoice(key: 'pastry', label: 'Pastry', icon: Icons.bakery_dining),
];

/// Maps a stored `loyalty_rewards.icon_key` back to its dropdown choice,
/// falling back to auto for legacy rows (null key) or unknown values.
RewardIconChoice rewardIconChoiceFromKey(String? key) {
  final k = (key ?? '').trim().toLowerCase();
  return rewardIconChoices.firstWhere(
    (choice) => choice.key == k,
    orElse: () => rewardIconChoices.first,
  );
}

/// Small preview widget for a [RewardIconChoice], used by the editor's
/// dropdown items and selected value row.
Widget rewardIconChoicePreview(RewardIconChoice choice, {double iconSize = 22}) {
  return Icon(choice.icon, size: iconSize, color: AppColors.gold);
}
