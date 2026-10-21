import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'theme.dart';

class ReaderPage extends StatefulWidget {
  const ReaderPage({
    super.key,
    required this.api,
    required this.initial,
    required this.publisher,
  });
  final RadarApi api;
  final Map<String, dynamic> initial;
  final String publisher;
  @override
  State<ReaderPage> createState() => _ReaderPageState();
}

class _ReaderPageState extends State<ReaderPage> {
  late Map<String, dynamic> article = Map.of(widget.initial);
  bool loading = true, saving = false, marking = false;
  String? error;
  double fontSize = 18;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.get('/api/articles/${article['id']}');
      if (!mounted) return;
      setState(() {
        article = result['article'];
        loading = false;
      });
      if (article['isRead'] != true) await markRead(true, silent: true);
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'Chưa tải được nội dung. Bạn thử lại nhé.';
        });
      }
    }
  }

  Future<void> markRead(bool value, {bool silent = false}) async {
    if (marking) return;
    setState(() => marking = true);
    try {
      await widget.api.state(article['id'], 'read', value);
      if (mounted) {
        setState(() => article['isRead'] = value);
        if (!silent) {
          notify(
            context,
            value ? 'Đã đánh dấu đã đọc.' : 'Đã đánh dấu chưa đọc.',
          );
        }
      }
    } catch (_) {
      if (mounted && !silent) notify(context, 'Chưa lưu được trạng thái đọc.');
    } finally {
      if (mounted) setState(() => marking = false);
    }
  }

  Future<void> save() async {
    setState(() => saving = true);
    final value = article['isSaved'] != true;
    try {
      await widget.api.state(article['id'], 'saved', value);
      if (mounted) {
        setState(() => article['isSaved'] = value);
        notify(context, value ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.');
      }
    } catch (_) {
      if (mounted) notify(context, 'Chưa lưu được bài viết.');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<bool> openUrl(String value) async {
    final url = Uri.tryParse(value);
    if (url == null || !['https', 'http'].contains(url.scheme)) return false;
    try {
      if (await launchUrl(url, mode: LaunchMode.externalApplication)) {
        return true;
      }
    } catch (_) {
      /* Show a recoverable message below. */
    }
    if (mounted) notify(context, 'Chưa mở được liên kết.');
    return false;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.publisher,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      actions: [
        SaveButton(
          saved: article['isSaved'] == true,
          busy: saving,
          onPressed: save,
        ),
        const SizedBox(width: 8),
      ],
    ),
    body: SafeArea(
      child: SelectionArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
          children: [
            Text(
              widget.publisher.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.1,
                color: blue,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              article['title'],
              style: const TextStyle(
                fontSize: 28,
                height: 1.45,
                fontWeight: FontWeight.w600,
                letterSpacing: -.5,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '${article['readingMinutes']} phút đọc${article['author'] != null ? ' · ${article['author']}' : ''}',
              style: const TextStyle(fontSize: 12, color: muted),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: mist,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: Text(
                      'Cỡ chữ',
                      style: TextStyle(fontSize: 12, color: muted),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Giảm cỡ chữ',
                    onPressed: fontSize > 16
                        ? () => setState(() => fontSize -= 1)
                        : null,
                    icon: const Icon(Icons.text_decrease_rounded),
                  ),
                  IconButton(
                    tooltip: 'Tăng cỡ chữ',
                    onPressed: fontSize < 26
                        ? () => setState(() => fontSize += 1)
                        : null,
                    icon: const Icon(Icons.text_increase_rounded),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Mở bài gốc',
                    onPressed: () => openUrl(article['url']),
                    icon: const Icon(Icons.open_in_new_rounded),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            if (loading)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (error != null)
              Column(
                children: [
                  Text(error!),
                  TextButton(onPressed: load, child: const Text('Thử lại')),
                ],
              )
            else ...[
              if (article['contentStatus'] != 'full')
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: mist,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    article['contentStatus'] == 'feed'
                        ? 'Nội dung từ RSS có thể chưa đầy đủ. Bạn có thể mở bài gốc để đọc tiếp.'
                        : 'Bài này chưa có nội dung đầy đủ trong thư viện. Mở bài gốc để đọc nhé.',
                    style: const TextStyle(
                      fontSize: 13,
                      color: muted,
                      height: 1.7,
                    ),
                  ),
                ),
              if (article['contentHtml'] != null)
                HtmlWidget(
                  article['contentHtml'],
                  baseUrl: Uri.parse(article['url']),
                  textStyle: TextStyle(
                    fontSize: fontSize,
                    height: 1.8,
                    color: ink,
                  ),
                  onTapUrl: openUrl,
                  customStylesBuilder: (element) {
                    if (element.localName == 'a') return {'color': '#205bd5'};
                    if (element.localName == 'pre') {
                      return {
                        'background-color': '#f2f7ff',
                        'padding': '16px',
                        'white-space': 'pre-wrap',
                        'font-size': '14px',
                      };
                    }
                    if (element.localName == 'blockquote') {
                      return {
                        'color': '#596b7a',
                        'padding-left': '16px',
                        'border-left': '3px solid #205bd5',
                      };
                    }
                    return null;
                  },
                )
              else
                Text(
                  article['excerpt'] ?? '',
                  style: TextStyle(fontSize: fontSize, height: 1.8),
                ),
              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),
              const Text(
                'Đọc sâu hơn. Hiểu rõ hơn.',
                textAlign: TextAlign.center,
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => openUrl(article['url']),
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Ghé bài viết gốc'),
              ),
              TextButton(
                onPressed: marking
                    ? null
                    : () => markRead(article['isRead'] != true),
                child: Text(
                  article['isRead'] == true
                      ? 'Đánh dấu chưa đọc'
                      : 'Đánh dấu đã đọc',
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}
