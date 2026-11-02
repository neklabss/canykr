import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.status, this.code, this.message);
  final int status;
  final String code;

  /// Already localized by the API (Accept-Language / X-BUJ-Locale).
  final String message;
  @override
  String toString() => 'ApiException($status, $code)';
}

class AuthTokens {
  AuthTokens({required this.accessToken, required this.refreshToken, required this.sessionId});
  final String accessToken;
  final String refreshToken;
  final String sessionId;

  factory AuthTokens.fromJson(Map<String, dynamic> j) =>
      AuthTokens(accessToken: j['accessToken'] as String, refreshToken: j['refreshToken'] as String, sessionId: j['sessionId'] as String);
  Map<String, String> toJson() => {'accessToken': accessToken, 'refreshToken': refreshToken, 'sessionId': sessionId};
}

abstract class TokenStore {
  Future<AuthTokens?> read();
  Future<void> write(AuthTokens? tokens);
}

/// Keychain (iOS) / EncryptedSharedPreferences (Android).
class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _s;
  static const _key = 'buj.session';

  @override
  Future<AuthTokens?> read() async {
    final raw = await _s.read(key: _key);
    return raw == null ? null : AuthTokens.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<void> write(AuthTokens? tokens) =>
      tokens == null ? _s.delete(key: _key) : _s.write(key: _key, value: jsonEncode(tokens.toJson()));
}

class MemoryTokenStore implements TokenStore {
  AuthTokens? _t;
  @override
  Future<AuthTokens?> read() async => _t;
  @override
  Future<void> write(AuthTokens? tokens) async => _t = tokens;
}

/// Minimal client for the BackUpJam API; mirrors packages/api-client semantics
/// (locale header, bearer auth, single-flight refresh rotation).
class ApiClient {
  ApiClient({required this.baseUrl, required this.tokens, required this.locale, http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  final String baseUrl;
  final TokenStore tokens;
  final String Function() locale;
  final http.Client _http;
  Future<bool>? _refreshing;

  Future<Map<String, dynamic>> _send(String method, String path, {Object? body, bool auth = true}) async {
    final t = auth ? await tokens.read() : null;
    final req = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll({
        'Accept': 'application/json',
        'X-BUJ-Locale': locale(),
        if (body != null) 'Content-Type': 'application/json',
        if (t != null) 'Authorization': 'Bearer ${t.accessToken}',
      });
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _http.send(req));
    final data = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final err = (data is Map ? data['error'] : null) as Map<String, dynamic>? ?? {};
      throw ApiException(res.statusCode, err['code'] as String? ?? 'internal', err['message'] as String? ?? '');
    }
    return data is Map<String, dynamic> ? data : {'items': data};
  }

  Future<Map<String, dynamic>> call(String method, String path, {Object? body}) async {
    try {
      return await _send(method, path, body: body);
    } on ApiException catch (e) {
      if (e.status == 401 && await tokens.read() != null && await _refresh()) return _send(method, path, body: body);
      rethrow;
    }
  }

  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final current = await tokens.read();
        if (current == null) return false;
        final r = await _send('POST', '/v1/auth/refresh', body: {'refreshToken': current.refreshToken}, auth: false);
        await tokens.write(AuthTokens.fromJson(r));
        return true;
      } catch (_) {
        await tokens.write(null);
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final r = await _send('POST', '/v1/auth/login', body: {'email': email, 'password': password, 'deviceName': 'Mobile'}, auth: false);
    await tokens.write(AuthTokens.fromJson(r['tokens'] as Map<String, dynamic>));
    return r['user'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register({required String email, required String password, required String displayName, required bool acceptTerms}) async {
    final r = await _send('POST', '/v1/auth/register',
        body: {'email': email, 'password': password, 'displayName': displayName, 'acceptTerms': acceptTerms, 'deviceName': 'Mobile'}, auth: false);
    await tokens.write(AuthTokens.fromJson(r['tokens'] as Map<String, dynamic>));
    return r['user'] as Map<String, dynamic>;
  }

  Future<void> logout() async {
    try {
      await call('POST', '/v1/auth/logout');
    } finally {
      await tokens.write(null);
    }
  }

  Future<Map<String, dynamic>> me() => call('GET', '/v1/me');
  Future<Map<String, dynamic>> setLocalePreference(String? tag) => call('PUT', '/v1/me/preferences', body: {'locale': tag});
}
