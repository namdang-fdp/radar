import 'package:flutter/material.dart';

const ink = Color(0xff172b3a);
const blue = Color(0xff205bd5);
const muted = Color(0xff596b7a);
const line = Color(0xffe5ecf3);
const mist = Color(0xfff2f7ff);

// Transitions.dev semantic timing, adapted to native Flutter widgets.
class RadarMotion {
  static const fast = Duration(milliseconds: 250);
  static const smoothOut = Cubic(.22, 1, .36, 1);
  static Duration duration(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context) ||
          MediaQuery.accessibleNavigationOf(context)
      ? Duration.zero
      : fast;
}

ThemeData radarTheme() => ThemeData(
  useMaterial3: true,
  brightness: Brightness.light,
  fontFamily: 'BeVietnamPro',
  scaffoldBackgroundColor: Colors.white,
  colorScheme: ColorScheme.fromSeed(
    seedColor: blue,
    brightness: Brightness.light,
    surface: Colors.white,
  ),
  textTheme: const TextTheme(
    bodyMedium: TextStyle(color: ink, height: 1.6),
    bodyLarge: TextStyle(color: ink, height: 1.6),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: Colors.white,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
  ),
  dividerTheme: const DividerThemeData(color: line, thickness: 1),
  navigationBarTheme: const NavigationBarThemeData(
    backgroundColor: Colors.white,
    indicatorColor: mist,
    surfaceTintColor: Colors.transparent,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: const Color(0xfff5f8fc),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),
  snackBarTheme: SnackBarThemeData(
    behavior: SnackBarBehavior.floating,
    backgroundColor: ink,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
  ),
);

void notify(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

class SaveButton extends StatelessWidget {
  const SaveButton({
    super.key,
    required this.saved,
    required this.busy,
    required this.onPressed,
  });
  final bool saved, busy;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết',
    onPressed: busy ? null : onPressed,
    isSelected: saved,
    icon: AnimatedSwitcher(
      duration: RadarMotion.duration(context),
      switchInCurve: RadarMotion.smoothOut,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: .8, end: 1).animate(animation),
          child: child,
        ),
      ),
      child: Icon(
        saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
        key: ValueKey(saved),
        color: saved ? blue : muted,
      ),
    ),
  );
}
