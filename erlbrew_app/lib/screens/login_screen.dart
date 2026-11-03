import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_models.dart';
import '../services/firebase_auth_service.dart';
import '../services/pos_api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/luxury_button.dart';
import 'admin/admin_home_shell.dart';
import 'home_shell.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  bool _isAdmin = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _sendPasswordResetEmail(String email) async {
    final trimmedEmail = email.trim();

    if (trimmedEmail.isEmpty || !trimmedEmail.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Enter a valid email to reset your password.')),
      );
      return;
    }

    try {
      await FirebaseAuthService.instance.sendPasswordResetEmail(trimmedEmail);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Password reset link sent. Check your inbox.')),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message ?? 'Unable to send reset link.')),
      );
    }
  }

  Future<void> _handleForgotPassword() async {
    final controller =
        TextEditingController(text: _emailController.text.trim());

    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          backgroundColor: Colors.transparent,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.hairline, width: 1.2),
              boxShadow: [AppColors.softShadow],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: AppColors.cream,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.lock_reset_rounded,
                        color: AppColors.gold,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Reset Password',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'Enter your email address and we will send you a secure reset link.',
                  style: TextStyle(
                    color: AppColors.slateGrey,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.emailAddress,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    hintText: 'you@example.com',
                    filled: true,
                    fillColor: AppColors.cream,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppColors.hairline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppColors.hairline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide:
                          const BorderSide(color: AppColors.gold, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.espresso,
                      ),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () async {
                        final email = controller.text;
                        Navigator.of(dialogContext).pop();
                        await _sendPasswordResetEmail(email);
                      },
                      style: TextButton.styleFrom(
                        backgroundColor: AppColors.onyx,
                        foregroundColor: AppColors.goldLight,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Send'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleResendVerification() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || !email.contains('@') || password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your email and password first.')),
      );
      return;
    }

    try {
      final firebase = FirebaseAuthService.instance;
      await firebase.signInWithEmailPassword(
        email: email,
        password: password,
        isAdmin: false,
      );
      await firebase.sendEmailVerification();
      await firebase.signOut();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Verification email sent. Check your inbox.')),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      final message =
          error.code == 'wrong-password' || error.code == 'invalid-credential'
              ? 'The password is incorrect. Use Forgot password first.'
              : error.message ?? 'Unable to send verification email.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      if (_isAdmin) {
        final firebase = FirebaseAuthService.instance;
        await firebase.signInWithEmailPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          isAdmin: true,
        );
        final idToken = await firebase.getIdToken();
        if (idToken == null || idToken.isEmpty) {
          throw PosApiServiceException(
              'Unable to create a secure staff session.');
        }
        await PosApiService.instance.firebaseStaffLogin(idToken);
      } else {
        final firebase = FirebaseAuthService.instance;
        AppUser customer;
        try {
          await firebase.signInWithEmailPassword(
            email: _emailController.text.trim(),
            password: _passwordController.text,
            isAdmin: false,
          );
          if (!await firebase.isEmailVerified()) {
            await firebase.sendEmailVerification();
            await firebase.signOut();
            throw FirebaseAuthException(
              code: 'email-not-verified',
              message: 'Verify your email before signing in.',
            );
          }
          final idToken = await firebase.getIdToken();
          if (idToken == null || idToken.isEmpty) {
            throw PosApiServiceException(
              'Unable to create a secure customer session.',
            );
          }
          customer =
              await PosApiService.instance.firebaseCustomerLogin(idToken);
        } on FirebaseAuthException catch (error) {
          if (error.code == 'user-not-found' ||
              error.code == 'wrong-password' ||
              error.code == 'invalid-credential') {
            customer = await PosApiService.instance.login(
              email: _emailController.text,
              password: _passwordController.text,
            );
          } else {
            rethrow;
          }
        }
        MockData.currentUser = customer;
      }

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => _isAdmin ? const AdminHomeShell() : const HomeShell(),
        ),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      final message = switch (error.code) {
        'invalid-email' => 'Enter a valid Firebase account email.',
        'user-not-found' ||
        'wrong-password' ||
        'invalid-credential' =>
          'The staff email or password is incorrect.',
        'user-disabled' => 'This Firebase staff account is disabled.',
        'too-many-requests' =>
          'Too many sign-in attempts. Please wait and try again.',
        'network-request-failed' =>
          'Unable to reach Firebase. Check the internet connection.',
        'email-not-verified' =>
          'Verify the link in your email before signing in. We sent another link.',
        'not-admin' => 'This Firebase account does not have staff access.',
        _ => 'Firebase sign-in failed. Check the staff account configuration.',
      };
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Something went wrong while signing in.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ivory,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Column(
                children: [
                  FadeSlideIn(child: _HeroPanel(isAdmin: _isAdmin)),
                  Transform.translate(
                    offset: const Offset(0, -30),
                    child: FadeSlideIn(
                      delay: const Duration(milliseconds: 160),
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 22),
                        padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
                        decoration: BoxDecoration(
                          color: AppColors.cream,
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(color: AppColors.hairline),
                          boxShadow: [AppColors.softShadow],
                        ),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                _isAdmin ? 'Staff Sign In' : 'Welcome back',
                                textAlign: TextAlign.center,
                                style:
                                    Theme.of(context).textTheme.displayMedium,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _isAdmin
                                    ? 'Manage orders, rewards, and customers'
                                    : 'Log in to track your points and pickups',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: AppColors.slateGrey, fontSize: 13.5),
                              ),
                              const SizedBox(height: 24),
                              _RoleToggle(
                                isAdmin: _isAdmin,
                                onChanged: (v) => setState(() => _isAdmin = v),
                              ),
                              const SizedBox(height: 28),
                              TextFormField(
                                controller: _emailController,
                                keyboardType: TextInputType.emailAddress,
                                decoration: InputDecoration(
                                  labelText: _isAdmin
                                      ? 'Staff Email'
                                      : 'Email Address',
                                  hintText: 'name@example.com',
                                  prefixIcon: Icon(
                                    Icons.email_outlined,
                                    size: 20,
                                  ),
                                ),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) {
                                    return _isAdmin
                                        ? 'Enter your staff email'
                                        : 'Enter your email address';
                                  }
                                  if (_isAdmin &&
                                      !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                          .hasMatch(v.trim())) {
                                    return 'Enter a valid staff email';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 22),
                              TextFormField(
                                controller: _passwordController,
                                obscureText: _obscure,
                                decoration: InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon:
                                      const Icon(Icons.lock_outline, size: 20),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_outlined
                                          : Icons.visibility_off_outlined,
                                      size: 20,
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                ),
                                validator: (v) {
                                  final minimumLength = 6;
                                  if (v == null || v.length < minimumLength) {
                                    return _isAdmin
                                        ? 'Password must be at least 6 characters'
                                        : 'Password must be at least 6 characters';
                                  }
                                  return null;
                                },
                              ),
                              if (!_isAdmin)
                                Wrap(
                                  alignment: WrapAlignment.end,
                                  children: [
                                    TextButton(
                                      onPressed: _handleResendVerification,
                                      child: Text(
                                        'Resend verification',
                                        style: TextStyle(
                                            color: AppColors.matchaDark),
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: _handleForgotPassword,
                                      child: Text(
                                        'Forgot password?',
                                        style: TextStyle(color: AppColors.gold),
                                      ),
                                    ),
                                  ],
                                ),
                              SizedBox(height: _isAdmin ? 30 : 18),
                              LuxuryButton(
                                label: _isAdmin ? 'Enter Dashboard' : 'Log In',
                                loading: _loading,
                                onPressed: _handleLogin,
                              ),
                              const SizedBox(height: 22),
                              if (!_isAdmin)
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text("Don't have an account?",
                                        style: TextStyle(
                                            color: AppColors.slateGrey,
                                            fontSize: 13.5)),
                                    TextButton(
                                      onPressed: () {
                                        Navigator.of(context).push(
                                          MaterialPageRoute(
                                              builder: (_) =>
                                                  const SignupScreen()),
                                        );
                                      },
                                      child: Text('Sign Up',
                                          style: TextStyle(
                                              color: AppColors.gold,
                                              fontWeight: FontWeight.w700)),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The dark hero panel behind the logo — gives the login screen the
/// "boutique storefront" feel instead of a plain white form.
class _HeroPanel extends StatelessWidget {
  final bool isAdmin;
  const _HeroPanel({required this.isAdmin});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 34, bottom: 66),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: AppColors.onyxGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.espresso.withOpacity(0.16),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Column(
        children: [
          const BrandMark(width: 168),
          const SizedBox(height: 20),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              isAdmin ? 'STAFF PORTAL' : 'REWARDS & PICKUP',
              key: ValueKey(isAdmin),
              style: TextStyle(
                color: AppColors.goldLight,
                fontWeight: FontWeight.w600,
                fontSize: 11.5,
                letterSpacing: 3.2,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            isAdmin
                ? 'A calm command center for the café team.'
                : 'Good coffee, better rituals.',
            style: const TextStyle(
              color: Colors.white60,
              fontSize: 13,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Segmented control the barista/owner uses to switch between the
/// customer login form and the staff/admin one.
class _RoleToggle extends StatelessWidget {
  final bool isAdmin;
  final ValueChanged<bool> onChanged;

  const _RoleToggle({required this.isAdmin, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: _RoleOption(
              label: 'Customer',
              icon: Icons.person_outline,
              selected: !isAdmin,
              onTap: () => onChanged(false),
            ),
          ),
          Expanded(
            child: _RoleOption(
              label: 'Admin',
              icon: Icons.admin_panel_settings_outlined,
              selected: isAdmin,
              onTap: () => onChanged(true),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(colors: AppColors.espressoGradient)
              : null,
          borderRadius: BorderRadius.circular(10),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.espresso.withOpacity(0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 15,
                color: selected ? AppColors.goldLight : AppColors.slateGrey),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
                letterSpacing: 0.3,
                color: selected ? AppColors.goldLight : AppColors.slateGrey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
