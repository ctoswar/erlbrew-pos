import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/app_theme.dart';

/// Bundled reward icons (see `assets/icons/` in pubspec.yaml).
const String _latteIcon = 'assets/icons/erlbrew_latte_icon.svg';
const String _matchaIcon = 'assets/icons/erlbrew_matcha_icon.svg';
const String _coldBrewIcon = 'assets/icons/erlbrew_coldbrew_icon.svg';
const String _pastryIcon = 'assets/icons/erlbrew_pastry_icon.svg';

/// Resolves the custom SVG icon for a reward from its category or name
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
/// Returns the SVG asset path, or `null` when nothing matches so callers
/// can fall back to the reward's emoji.
String? rewardIconFor({
  String? category,
  String? title,
  String? description,
  String? iconKey,
}) {
  final key = (iconKey ?? '').trim().toLowerCase();
  if (key == 'latte') return _latteIcon;
  if (key == 'matcha') return _matchaIcon;
  if (key == 'coldbrew') return _coldBrewIcon;
  if (key == 'pastry') return _pastryIcon;

  final text = [
    category,
    title,
    description,
  ].whereType<String>().join(' ').toLowerCase();

  if (text.contains('matcha')) return _matchaIcon;
  if (text.contains('cold brew') || text.contains('coldbrew') || text.contains('iced')) {
    return _coldBrewIcon;
  }
  if (text.contains('pastry') ||
      text.contains('croissant') ||
      text.contains('bread') ||
      text.contains('cake')) {
    return _pastryIcon;
  }
  if (text.contains('latte') ||
      text.contains('coffee') ||
      text.contains('espresso') ||
      text.contains('americano') ||
      text.contains('cappuccino')) {
    return _latteIcon;
  }
  return null;
}

/// Renders a reward's icon for use inside the existing beige rounded
/// container: the [rewardIconFor] SVG when one matches, otherwise the
/// reward's emoji.
Widget rewardIconVisual({
  String? category,
  String? title,
  String? description,
  String? emoji,
  String? iconKey,
  double iconSize = 30,
  double emojiFontSize = 20,
}) {
  final asset = rewardIconFor(
    category: category,
    title: title,
    description: description,
    iconKey: iconKey,
  );
  if (asset != null) {
    return SvgPicture.asset(asset, width: iconSize, height: iconSize);
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
  final String? asset; // null only for the auto choice
  final String emoji; // shown when the reward has no SVG asset

  const RewardIconChoice({
    required this.key,
    required this.label,
    this.asset,
    required this.emoji,
  });
}

/// The icon dropdown options, in display order.
const List<RewardIconChoice> rewardIconChoices = [
  RewardIconChoice(key: '', label: 'Auto (from name)', emoji: '✨'),
  RewardIconChoice(
      key: 'latte', label: 'Latte / Coffee', asset: _latteIcon, emoji: '☕'),
  RewardIconChoice(key: 'matcha', label: 'Matcha', asset: _matchaIcon, emoji: '🍵'),
  RewardIconChoice(
      key: 'coldbrew', label: 'Cold Brew', asset: _coldBrewIcon, emoji: '🧋'),
  RewardIconChoice(
      key: 'pastry', label: 'Pastry', asset: _pastryIcon, emoji: '🥐'),
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
  final asset = choice.asset;
  if (asset != null) {
    return SvgPicture.asset(asset, width: iconSize, height: iconSize);
  }
  if (choice.key == '') {
    return Icon(Icons.auto_awesome, size: iconSize, color: AppColors.gold);
  }
  return Text(choice.emoji, style: TextStyle(fontSize: iconSize - 4));
}
