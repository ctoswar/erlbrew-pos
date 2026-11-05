import 'package:flutter_test/flutter_test.dart';

import 'package:erlbrew_app/utils/password_policy.dart';

void main() {
  group('PasswordPolicy.validate', () {
    test('accepts a password meeting every rule', () {
      expect(PasswordPolicy.validate('Passw0rd!'), isNull);
      expect(PasswordPolicy.validate('GoodPass1#'), isNull);
    });

    test('rejects nothing when null', () {
      expect(PasswordPolicy.validate(null), 'Use at least 6 characters');
    });

    test('rejects short passwords first', () {
      expect(
        PasswordPolicy.validate('Ab1!'),
        'Use at least 6 characters',
      );
    });

    test('rejects a password without a capital letter', () {
      expect(
        PasswordPolicy.validate('password1!'),
        'Add at least one capital letter',
      );
    });

    test('rejects a password without a number', () {
      expect(
        PasswordPolicy.validate('Password!'),
        'Add at least one number',
      );
    });

    test('rejects a password without a special character', () {
      expect(
        PasswordPolicy.validate('Passw0rd'),
        'Add at least one special character (e.g. ! @ #)',
      );
    });
  });

  group('PasswordPolicy.requirements', () {
    test('all rules unmet for an empty value', () {
      final rules = PasswordPolicy.requirements('');
      expect(rules, hasLength(4));
      expect(rules.every((r) => !r.$2), isTrue);
    });

    test('all rules met for a strong value', () {
      final rules = PasswordPolicy.requirements('Strong1!');
      expect(rules.every((r) => r.$2), isTrue);
    });

    test('rules tick off progressively', () {
      final partial = PasswordPolicy.requirements('password');
      expect(partial[0].$2, isTrue); // 6 characters
      expect(partial[1].$2, isFalse); // no capital yet
    });
  });
}
