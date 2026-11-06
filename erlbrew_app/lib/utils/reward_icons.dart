import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

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
/// More specific drinks are checked before the generic coffee match so
/// "iced matcha latte" maps to matcha, not the latte icon.
///
/// Returns the SVG asset path, or `null` when nothing matches so callers
/// can fall back to the reward's emoji.
String? rewardIconFor({String? category, String? title, String? description}) {
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
  double iconSize = 30,
  double emojiFontSize = 20,
}) {
  final asset = rewardIconFor(
    category: category,
    title: title,
    description: description,
  );
  if (asset != null) {
    return SvgPicture.asset(asset, width: iconSize, height: iconSize);
  }
  return Text(emoji ?? '🎁', style: TextStyle(fontSize: emojiFontSize));
}
