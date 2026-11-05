import 'package:flutter_test/flutter_test.dart';

import 'package:erlbrew_app/utils/username_policy.dart';

void main() {
  group('UsernamePolicy.validate', () {
    test('accepts 3-20 letter/number/underscore handles', () {
      expect(UsernamePolicy.validate('jandelacruz'), isNull);
      expect(UsernamePolicy.validate('jane_doe99'), isNull);
      expect(UsernamePolicy.validate('abc'), isNull);
    });

    test('rejects empty, short and long handles', () {
      expect(UsernamePolicy.validate(''), 'Pick a username');
      expect(UsernamePolicy.validate('   '), 'Pick a username');
      expect(
        UsernamePolicy.validate('ab'),
        'Use 3-20 letters, numbers or underscores',
      );
      expect(
        UsernamePolicy.validate('a' * 21),
        'Use 3-20 letters, numbers or underscores',
      );
    });

    test('rejects spaces and symbols', () {
      expect(
        UsernamePolicy.validate('jane doe'),
        'Use 3-20 letters, numbers or underscores',
      );
      expect(
        UsernamePolicy.validate('jane-doe'),
        'Use 3-20 letters, numbers or underscores',
      );
    });
  });

  group('UsernamePolicy.suggest', () {
    test('builds a lowercase handle from the names', () {
      expect(UsernamePolicy.suggest('Jan', 'Dela Cruz'), 'jandelacruz');
      expect(UsernamePolicy.suggest('  Ana ', 'Reyes!'), 'anareyes');
    });

    test('caps the suggestion at 20 characters', () {
      expect(
        UsernamePolicy.suggest('Bartholomew', ' Montgomery-Longname').length,
        20,
      );
    });

    test('returns empty when there is not enough to work with', () {
      expect(UsernamePolicy.suggest('', ''), '');
      expect(UsernamePolicy.suggest('Jo', ''), '');
    });
  });
}
