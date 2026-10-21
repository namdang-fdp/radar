import 'dart:convert';
import 'package:http/http.dart' as http;

class RadarApi {
  RadarApi(this.baseUrl, {http.Client? client})
    : client = client ?? http.Client();
  final String baseUrl;
  final http.Client client;
  static bool validServer(String input) {
    final uri = Uri.tryParse(input);
    return uri != null &&
        uri.host.isNotEmpty &&
        uri.userInfo.isEmpty &&
        (uri.path.isEmpty || uri.path == '/') &&
        !uri.hasQuery &&
        !uri.hasFragment &&
        (uri.scheme == 'https' ||
            (uri.scheme == 'http' &&
                ['127.0.0.1', 'localhost'].contains(uri.host)));
  }

  Future<Map<String, dynamic>> get(
    String path, [
    Map<String, String>? query,
  ]) async {
    final response = await client
        .get(Uri.parse('$baseUrl$path').replace(queryParameters: query))
        .timeout(const Duration(seconds: 20));
    return decode(response);
  }

  Future<void> state(String id, String state, bool value) async {
    final response = await client
        .post(
          Uri.parse('$baseUrl/api/articles/$id/state'),
          headers: {
            'content-type': 'application/json',
            'origin': Uri.parse(baseUrl).origin,
          },
          body: jsonEncode({'state': state, 'value': value}),
        )
        .timeout(const Duration(seconds: 20));
    decode(response);
  }

  Map<String, dynamic> decode(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Máy chủ chưa xử lý được yêu cầu (${response.statusCode}).',
      );
    }
    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  void close() => client.close();
}
