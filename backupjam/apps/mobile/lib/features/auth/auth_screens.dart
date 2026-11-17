import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../design/tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.signUp});
  final bool signUp;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _accept = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = AppLocalizations.of(context);
    if (!_form.currentState!.validate()) return;
    if (widget.signUp && !_accept) {
      setState(() => _error = t.errorsValidation);
      return;
    }
    setState(() { _busy = true; _error = null; });
    final session = AppScope.of(context).session;
    try {
      widget.signUp
          ? await session.signUp(_email.text.trim(), _password.text, _name.text.trim(), _accept)
          : await session.signIn(_email.text.trim(), _password.text);
      if (mounted) context.go('/profile');
    } on ApiException catch (e) {
      setState(() => _error = e.message.isNotEmpty ? e.message : t.statesErrorBody);
    } catch (_) {
      setState(() => _error = t.statesOfflineBody);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    String? required(String? v) => (v == null || v.trim().isEmpty) ? t.errorsValidation : null;
    return Scaffold(
      appBar: AppBar(title: Text(widget.signUp ? t.authSignUp : t.authSignIn)),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(BujSpace.s4), children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: BujSpace.s4),
                child: Semantics(liveRegion: true, child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
              ),
            if (widget.signUp) ...[
              TextFormField(controller: _name, decoration: InputDecoration(labelText: t.authDisplayName), validator: required, textInputAction: TextInputAction.next),
              const SizedBox(height: BujSpace.s4),
            ],
            TextFormField(
              controller: _email,
              decoration: InputDecoration(labelText: t.authEmail),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              validator: required,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: BujSpace.s4),
            TextFormField(
              controller: _password,
              decoration: InputDecoration(labelText: t.authPassword, helperText: widget.signUp ? t.authPasswordHint : null),
              obscureText: true,
              autofillHints: [widget.signUp ? AutofillHints.newPassword : AutofillHints.password],
              validator: (v) => (v == null || (widget.signUp && v.length < 10) || v.isEmpty) ? t.errorsWeakPassword : null,
            ),
            if (widget.signUp)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _accept,
                onChanged: (v) => setState(() => _accept = v ?? false),
                title: Text(t.authAcceptTerms),
                controlAffinity: ListTileControlAffinity.leading,
              ),
            const SizedBox(height: BujSpace.s4),
            FilledButton(onPressed: _busy ? null : _submit, child: Text(widget.signUp ? t.authSignUp : t.authSignIn)),
            const SizedBox(height: BujSpace.s3),
            TextButton(
              onPressed: () => context.pushReplacement(widget.signUp ? '/sign-in' : '/sign-up'),
              child: Text(widget.signUp ? t.authHaveAccount : t.authNoAccount),
            ),
          ]),
        ),
      ),
    );
  }
}
