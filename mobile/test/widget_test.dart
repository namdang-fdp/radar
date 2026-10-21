import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:radar_app/api.dart';
import 'package:radar_app/main.dart';
import 'package:radar_app/reader.dart';
import 'package:radar_app/theme.dart';

void main() {
  testWidgets('reader loads content, marks read and changes font size', (
    tester,
  ) async {
    var markedRead = false;
    final article = {
      'id': 'article-1',
      'title': 'Readable engineering',
      'sourceId': 'netflix',
      'topic': 'data',
      'excerpt': 'Overview',
      'contentHtml': '<p>A complete engineering article.</p>',
      'url': 'https://netflixtechblog.com/example',
      'contentStatus': 'full',
      'readingMinutes': 5,
      'isRead': false,
      'isSaved': false,
    };
    final api = RadarApi(
      'http://127.0.0.1:4321',
      client: MockClient((request) async {
        if (request.method == 'POST') {
          markedRead = jsonDecode(request.body)['state'] == 'read';
          return http.Response('{"ok":true}', 200);
        }
        return http.Response(jsonEncode({'article': article}), 200);
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: radarTheme(),
        home: ReaderPage(api: api, initial: article, publisher: 'Netflix'),
      ),
    );
    await tester.pumpAndSettle();
    expect(markedRead, isTrue);
    expect(
      find.text('A complete engineering article.', findRichText: true),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('Tăng cỡ chữ'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  test(
    'server validation restricts HTTP to the USB loopback and excludes credentials',
    () {
      expect(RadarApi.validServer('http://127.0.0.1:4321'), isTrue);
      expect(RadarApi.validServer('https://radar.example.com'), isTrue);
      for (final value in [
        'http://example.com',
        'https://user:secret@example.com',
        'file:///tmp',
        'https://example.com/api',
        'https://example.com?token=secret',
      ]) {
        expect(RadarApi.validServer(value), isFalse);
      }
    },
  );
  testWidgets(
    'library uses light surfaces, saves through API, and switches to saved articles',
    (tester) async {
      var saved = false;
      final article = {
        'id': 'article-1',
        'title': 'Engineering a reading app',
        'sourceId': 'netflix',
        'topic': 'data',
        'excerpt': 'A readable library.',
        'contentStatus': 'full',
        'readingMinutes': 5,
        'isRead': false,
        'isSaved': false,
      };
      final api = RadarApi(
        'http://127.0.0.1:4321',
        client: MockClient((request) async {
          Object data;
          if (request.method == 'POST') {
            expect(request.headers['origin'], 'http://127.0.0.1:4321');
            saved = jsonDecode(request.body)['value'];
            article['isSaved'] = saved;
            data = {'ok': true};
          } else if (request.url.path == '/api/sources') {
            data = {
              'sources': [
                {'id': 'netflix', 'name': 'Netflix', 'mark': 'N'},
              ],
              'topics': [
                {'id': 'data', 'label': 'Dữ liệu'},
              ],
            };
          } else if (request.url.path == '/api/recommendations') {
            data = {'recommendations': []};
          } else {
            data = {
              'articles': [article],
              'page': 1,
              'pageCount': 1,
              'total': 1,
            };
          }
          return http.Response(
            jsonEncode(data),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: radarTheme(),
          home: HomePage(api: api, onServer: (_) async {}),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Engineering a reading app'), findsOneWidget);
      expect(
        tester.widget<Scaffold>(find.byType(Scaffold)).backgroundColor,
        isNull,
      );
      expect(
        Theme.of(tester.element(find.byType(Scaffold))).scaffoldBackgroundColor,
        Colors.white,
      );
      await tester.ensureVisible(find.byTooltip('Lưu bài viết'));
      await tester.tap(find.byTooltip('Lưu bài viết'));
      await tester.pumpAndSettle();
      expect(saved, isTrue);
      expect(find.byTooltip('Bỏ lưu bài viết'), findsOneWidget);
      await tester.tap(find.text('Đã lưu'));
      await tester.pumpAndSettle();
      expect(find.text('Để dành đọc sau.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('connection errors offer retry without an endless spinner', (
    tester,
  ) async {
    final api = RadarApi(
      'http://127.0.0.1:4321',
      client: MockClient((_) async => http.Response('{}', 503)),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: radarTheme(),
        home: HomePage(api: api, onServer: (_) async {}),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
