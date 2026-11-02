import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_models.dart';
import '../services/firebase_auth_service.dart';
import '../services/pos_api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/fade_slide_in.dart';
import '../widgets/luxury_button.dart';
import 'home_shell.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  String _firebasePhoneNumber(String value) {
    final phone = value.trim().replaceAll(RegExp(r'[^0-9+]'), '');
    if (phone.startsWith('09')) return '+63${phone.substring(1)}';
    if (phone.startsWith('63')) return '+$phone';
    return phone;
  }

  Future<bool> _verifyPhoneOtp() async {
    final firebase = FirebaseAuthService.instance;
    ConfirmationResult confirmation;
    try {
      confirmation = await firebase.sendPhoneOtp(
        _firebasePhoneNumber(_phoneController.text),
      );
    } on FirebaseAuthException catch (error) {
      if (error.code != 'quota-exceeded' && error.code != 'too-many-requests') {
        rethrow;
      }
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'SMS verification is temporarily unavailable. We will verify your email instead.',
          ),
        ),
      );
      return true;
    }
    if (!mounted) return false;

    final codeController = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Verify your mobile number'),
        content: TextField(
          controller: codeController,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(
            labelText: 'SMS verification code',
            hintText: '123456',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(
              codeController.text.trim(),
            ),
            child: const Text('Verify'),
          ),
        ],
      ),
    );
    codeController.dispose();
    if (code == null || code.length != 6) return false;

    await confirmation.confirm(code);
    await firebase.signOut();
    return true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleSignup() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final phoneVerified = await _verifyPhoneOtp();
      if (!phoneVerified) return;

      final firebase = FirebaseAuthService.instance;
      AppUser firebaseUser;
      try {
        firebaseUser = await firebase.signUp(
          name: _nameController.text,
          email: _emailController.text,
          phone: _phoneController.text,
          password: _passwordController.text,
        );
      } on FirebaseAuthException catch (error) {
        if (error.code != 'email-already-in-use') rethrow;
        firebaseUser = await firebase.signInWithEmailPassword(
          email: _emailController.text,
          password: _passwordController.text,
          isAdmin: false,
        );
      }
      await firebase.sendEmailVerification();

      final posService = PosApiService.instance;
      await posService.register(
        phone: _phoneController.text,
        name: _nameController.text,
        email: _emailController.text,
        password: _passwordController.text,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Verification link sent to ${firebaseUser.email}. Check your inbox.',
          ),
        ),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    } on PosApiServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      final message = switch (error.code) {
        'invalid-phone-number' => 'Enter a valid phone number in +63 format.',
        'invalid-app-credential' ||
        'captcha-check-failed' =>
          'The reCAPTCHA check failed. Refresh the page and try again.',
        'quota-exceeded' => 'Firebase SMS quota has been reached for today.',
        'operation-not-allowed' =>
          'Phone or email sign-in is not enabled in Firebase.',
        'too-many-requests' =>
          'Too many attempts. Please wait before requesting another code.',
        'email-already-in-use' => 'This email already has a Firebase account.',
        'invalid-credential' ||
        'wrong-password' =>
          'This email already has an account, but the password does not match. Use Log In and Forgot password.',
        _ => 'Firebase signup failed (${error.code}). ${error.message ?? ''}',
      };
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Something went wrong while creating your account.'),
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
      appBar: AppBar(
        title: const Text('Join Erlbrew'),
        backgroundColor: AppColors.ivory,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 8),
          child: FadeSlideIn(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 4),
                  Center(child: const BrandMark(width: 108)),
                  const SizedBox(height: 26),
                  Text(
                    'Make every cup count.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Create your account to collect points, discover rewards, and keep your pickup history close.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.slateGrey,
                      fontSize: 13.5,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: Icon(Icons.person_outline, size: 20),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Enter your name'
                        : null,
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.mail_outline, size: 20),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty)
                        return 'Enter your email';
                      if (!v.contains('@')) return 'Enter a valid email';
                      return null;
                    },
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Mobile Number',
                      hintText: '+63 917 123 4567',
                      prefixIcon: Icon(Icons.phone_outlined, size: 20),
                    ),
                    validator: (v) => (v == null || v.trim().length < 7)
                        ? 'Enter a valid mobile number'
                        : null,
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          size: 20,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),
                  LuxuryButton(
                    label: 'Create Account',
                    loading: _loading,
                    onPressed: _handleSignup,
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
