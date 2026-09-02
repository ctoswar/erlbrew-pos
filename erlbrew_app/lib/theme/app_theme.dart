import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Erlbrew Café brand palette — a boutique-café take on espresso and gold,
/// built around the café's own logo lockup (deep coffee brown, warm cream,
/// metallic gold) rather than a generic Material palette.
class AppColors {
  static const Color espresso = Color(0xFF3C2A21);
  static const Color onyx = Color(0xFF231913); // near-black, for hero surfaces
  static const Color coffeeBrown = Color(0xFF6F4E37);
  static const Color cream = Color(0xFFFFF8F0);
  static const Color ivory = Color(0xFFFBF6ED);
  static const Color latte = Color(0xFFEFE1D1);
  static const Color hairline = Color(0xFFE6D9C4);
  static const Color matcha = Color(0xFF7C9070);
  static const Color matchaDark = Color(0xFF5A6E4F);
  static const Color slateGrey = Color(0xFF70726E); // Estuko Grey, from wall décor
  static const Color gold = Color(0xFFC9A227);
  static const Color goldLight = Color(0xFFE3C777);
  static const Color error = Color(0xFFB3413B);
  static const Color success = Color(0xFF5A6E4F);

  static const List<Color> espressoGradient = [
    Color(0xFF4A362A),
    Color(0xFF2E2019),
  ];

  static const List<Color> onyxGradient = [
    Color(0xFF2E2019),
    Color(0xFF1A130F),
  ];

  static BoxShadow softShadow = BoxShadow(
    color: espresso.withOpacity(0.10),
    blurRadius: 24,
    offset: const Offset(0, 12),
  );

  static BoxShadow goldGlow = BoxShadow(
    color: gold.withOpacity(0.18),
    blurRadius: 30,
    spreadRadius: 2,
  );
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ivory,
      colorScheme: base.colorScheme.copyWith(
        primary: AppColors.espresso,
        secondary: AppColors.gold,
        surface: AppColors.ivory,
        error: AppColors.error,
      ),
      textTheme: GoogleFonts.quicksandTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.playfairDisplay(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
          color: AppColors.espresso,
        ),
        displayMedium: GoogleFonts.playfairDisplay(
          fontSize: 27,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
          color: AppColors.espresso,
        ),
        titleLarge: GoogleFonts.playfairDisplay(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: AppColors.espresso,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.ivory,
        foregroundColor: AppColors.espresso,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.playfairDisplay(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: AppColors.espresso,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.espresso,
          foregroundColor: AppColors.goldLight,
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.quicksand(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1,
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.espresso,
          side: const BorderSide(color: AppColors.gold, width: 1.2),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.quicksand(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.hairline, width: 1.2),
        ),
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.hairline, width: 1.2),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.gold, width: 1.6),
        ),
        errorBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.error, width: 1.2),
        ),
        labelStyle: GoogleFonts.quicksand(
          color: AppColors.slateGrey,
          fontSize: 13.5,
        ),
        floatingLabelStyle: GoogleFonts.quicksand(
          color: AppColors.gold,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        prefixIconColor: AppColors.slateGrey,
        suffixIconColor: AppColors.slateGrey,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.hairline),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 70,
        elevation: 0,
        backgroundColor: Colors.white,
        indicatorColor: AppColors.gold.withOpacity(0.16),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.quicksand(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            letterSpacing: 0.3,
            color: selected ? AppColors.espresso : AppColors.slateGrey,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.espresso : AppColors.slateGrey,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.onyx,
        contentTextStyle: GoogleFonts.quicksand(color: AppColors.goldLight),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.hairline),
        ),
        titleTextStyle: GoogleFonts.playfairDisplay(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: AppColors.espresso,
        ),
        contentTextStyle: GoogleFonts.quicksand(
          fontSize: 14,
          color: AppColors.slateGrey,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.latte,
        labelStyle: GoogleFonts.quicksand(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.espresso,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide.none,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.hairline,
        thickness: 1,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.espresso,
        foregroundColor: AppColors.goldLight,
        elevation: 2,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
