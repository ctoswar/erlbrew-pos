/// Username policy for customer accounts — the signup form validates
/// against these rules and auto-suggests handles, and the POS server's
/// `POST /api/customers/register` mirrors the same rules server-side.
///
/// Rules: 3-20 characters, letters, numbers and underscores only.
class UsernamePolicy {
  const UsernamePolicy._();

  static final RegExp _pattern = RegExp(r'^[A-Za-z0-9_]{3,20}$');

  /// User-facing message for the first rule the handle breaks, or null
  /// when it satisfies the whole policy.
  static String? validate(String? value) {
    final username = (value ?? '').trim();
    if (username.isEmpty) return 'Pick a username';
    if (!_pattern.hasMatch(username)) {
      return 'Use 3-20 letters, numbers or underscores';
    }
    return null;
  }

  /// A friendly handle suggestion from the person's names, e.g.
  /// "Jan" + "Dela Cruz" → "jandelacruz". Returns the empty string when
  /// there is not enough to work with (shorter than 3 clean characters).
  static String suggest(String firstName, String lastName) {
    final cleaned = ('$firstName$lastName')
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (cleaned.length < 3) return '';
    return cleaned.length > 20 ? cleaned.substring(0, 20) : cleaned;
  }
}
