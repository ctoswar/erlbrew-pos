/// Password policy for account creation — the signup form and its live
/// requirements checklist read their rules from here, and the POS server's
/// `POST /api/customers/register` mirrors the same rules server-side.
///
/// Rules: at least 8 characters, one capital letter, one number and one
/// special character.
class PasswordPolicy {
  const PasswordPolicy._();

  static final RegExp _capital = RegExp(r'[A-Z]');
  static final RegExp _number = RegExp(r'[0-9]');
  static final RegExp _special = RegExp(r'[^A-Za-z0-9]');

  /// User-facing message for the first rule the password breaks, or null
  /// when it satisfies the whole policy.
  static String? validate(String? value) {
    final password = value ?? '';
    if (password.length < 8) return 'Use at least 8 characters';
    if (!_capital.hasMatch(password)) {
      return 'Add at least one capital letter';
    }
    if (!_number.hasMatch(password)) {
      return 'Add at least one number';
    }
    if (!_special.hasMatch(password)) {
      return 'Add at least one special character (e.g. ! @ #)';
    }
    return null;
  }

  /// Every rule with whether [value] currently satisfies it, for the
  /// live checklist shown under the signup password field.
  static List<(String text, bool met)> requirements(String value) {
    return [
      ('At least 8 characters', value.length >= 8),
      ('One capital letter (A-Z)', _capital.hasMatch(value)),
      ('One number (0-9)', _number.hasMatch(value)),
      ('One special character (e.g. ! @ #)', _special.hasMatch(value)),
    ];
  }
}
