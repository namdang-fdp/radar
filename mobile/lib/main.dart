import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'theme.dart';
import 'reader.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  runApp(RadarApp(preferences: preferences));
}

class RadarApp extends StatefulWidget {
  const RadarApp({super.key, required this.preferences});
  final SharedPreferences preferences;
  @override
  State<RadarApp> createState() => _RadarAppState();
}

class _RadarAppState extends State<RadarApp> {
  late String server =
      widget.preferences.getString('server') ??
      const String.fromEnvironment(
        'RADAR_API_URL',
        defaultValue: 'http://127.0.0.1:4321',
      );
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Radar',
    debugShowCheckedModeBanner: false,
    theme: radarTheme(),
    themeMode: ThemeMode.light,
    home: HomePage(
      key: ValueKey(server),
      api: RadarApi(server),
      onServer: (value) async {
        await widget.preferences.setString('server', value);
        if (mounted) setState(() => server = value);
      },
    ),
  );
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.api, required this.onServer});
  final RadarApi api;
  final Future<void> Function(String) onServer;
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int tab = 0, page = 1, pageCount = 1, total = 0, generation = 0;
  bool loading = true, more = false;
  String query = '', topic = '', source = '';
  String? error;
  final search = TextEditingController();
  List<Map<String, dynamic>> articles = [],
      recommendations = [],
      sources = [],
      topics = [];
  final pending = <String>{};
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    generation++;
    search.dispose();
    widget.api.close();
    super.dispose();
  }

  List<Map<String, dynamic>> maps(dynamic input) =>
      (input as List).cast<Map<String, dynamic>>();
  Future<void> load({bool append = false}) async {
    final request = ++generation;
    setState(() {
      error = null;
      if (append) {
        more = true;
      } else {
        loading = true;
        more = false;
      }
    });
    try {
      final result = await widget.api.get('/api/articles', {
        'view': tab == 1 ? 'saved' : 'all',
        'q': query,
        'topic': topic,
        'source': source,
        'page': '${append ? page + 1 : 1}',
      });
      Map<String, dynamic>? catalog;
      if (!append) catalog = await widget.api.get('/api/sources');
      List<Map<String, dynamic>> picks = [];
      if (!append &&
          tab == 0 &&
          query.isEmpty &&
          topic.isEmpty &&
          source.isEmpty) {
        try {
          picks = maps(
            (await widget.api.get('/api/recommendations'))['recommendations'],
          );
        } catch (_) {
          /* Optional section. */
        }
      }
      if (!mounted || request != generation) return;
      setState(() {
        articles = append
            ? [...articles, ...maps(result['articles'])]
            : maps(result['articles']);
        page = result['page'];
        pageCount = result['pageCount'];
        total = result['total'];
        if (catalog != null) {
          sources = maps(catalog['sources']);
          topics = maps(catalog['topics']);
        }
        if (!append) recommendations = picks;
        loading = false;
        more = false;
      });
    } catch (_) {
      if (!mounted || request != generation) return;
      setState(() {
        loading = false;
        more = false;
        if (!append) {
          error =
              'Chưa kết nối được thư viện. Kiểm tra kết nối và địa chỉ máy chủ nhé.';
        }
      });
      if (append) {
        notify(context, 'Chưa tải được trang tiếp theo. Bạn thử lại nhé.');
      }
    }
  }

  String sourceName(String id) =>
      sources.where((s) => s['id'] == id).firstOrNull?['name'] ?? id;
  String topicName(String id) =>
      topics.where((t) => t['id'] == id).firstOrNull?['label'] ?? id;
  Future<void> save(Map<String, dynamic> article) async {
    final id = article['id'] as String;
    if (pending.contains(id)) return;
    final value = article['isSaved'] != true;
    setState(() => pending.add(id));
    try {
      await widget.api.state(id, 'saved', value);
      if (!mounted) return;
      setState(() {
        for (final item in [
          ...articles,
          ...recommendations.map((r) => r['article'] as Map<String, dynamic>),
        ]) {
          if (item['id'] == id) item['isSaved'] = value;
        }
        if (tab == 1 && !value) {
          articles.removeWhere((a) => a['id'] == id);
          total--;
        }
      });
      notify(
        context,
        value ? 'Đã lưu vào góc đọc của bạn.' : 'Đã bỏ lưu bài viết.',
      );
    } catch (_) {
      if (mounted) notify(context, 'Chưa lưu được thay đổi. Bạn thử lại nhé.');
    } finally {
      if (mounted) setState(() => pending.remove(id));
    }
  }

  Future<void> open(Map<String, dynamic> article) async {
    final duration = RadarMotion.duration(context);
    await Navigator.of(context).push(
      PageRouteBuilder(
        transitionDuration: duration,
        reverseTransitionDuration: duration,
        pageBuilder: (_, animation, secondaryAnimation) => ReaderPage(
          api: widget.api,
          initial: article,
          publisher: sourceName(article['sourceId']),
        ),
        transitionsBuilder: (_, animation, secondaryAnimation, child) =>
            FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween(begin: const Offset(.035, 0), end: Offset.zero)
                    .animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: RadarMotion.smoothOut,
                      ),
                    ),
                child: child,
              ),
            ),
      ),
    );
    if (mounted) await load();
  }

  Future<void> settings() async {
    final controller = TextEditingController(text: widget.api.baseUrl);
    String? validation;
    final result = await showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Kết nối thư viện'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bản test dùng kết nối USB. Khi có VPS, nhập địa chỉ HTTPS của Radar để đọc ở bất cứ đâu.',
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: InputDecoration(
                    labelText: 'Địa chỉ máy chủ',
                    errorText: validation,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Để sau'),
            ),
            FilledButton(
              onPressed: () {
                final value = controller.text.trim().replaceFirst(
                  RegExp(r'/$'),
                  '',
                );
                if (!RadarApi.validServer(value)) {
                  update(
                    () => validation = 'Dùng HTTPS hoặc localhost qua USB.',
                  );
                  return;
                }
                Navigator.pop(context, value);
              },
              child: const Text('Kết nối'),
            ),
          ],
        ),
      ),
    );
    // The dialog can still be animating out; leave its controller alive until disposal is safe.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    controller.dispose();
    if (result != null && mounted) await widget.onServer(result);
  }

  Widget publisher(Map<String, dynamic> article) {
    final id = article['sourceId'] as String;
    final s = sources.where((item) => item['id'] == id).firstOrNull;
    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: mist,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Text(
            s?['mark'] ?? id.substring(0, 1).toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: blue,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            sourceName(id),
            style: const TextStyle(fontSize: 12, color: muted),
          ),
        ),
      ],
    );
  }

  Widget tile(Map<String, dynamic> article) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: publisher(article)),
            SaveButton(
              saved: article['isSaved'] == true,
              busy: pending.contains(article['id']),
              onPressed: () => save(article),
            ),
          ],
        ),
        InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => open(article),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  article['title'],
                  style: TextStyle(
                    fontSize: 20,
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                    color: article['isRead'] == true ? muted : ink,
                  ),
                ),
                if ((article['excerpt'] as String).isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    article['excerpt'],
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.7,
                      color: muted,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: mist,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        topicName(article['topic']),
                        style: const TextStyle(fontSize: 11, color: blue),
                      ),
                    ),
                    Text(
                      article['contentStatus'] == 'unavailable'
                          ? 'Bài gốc'
                          : '${article['readingMinutes']} phút đọc',
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                    if (article['isRead'] == true)
                      const Text(
                        'Đã đọc',
                        style: TextStyle(fontSize: 11, color: muted),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
  Widget picks() => Container(
    margin: const EdgeInsets.only(bottom: 24),
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: mist,
      borderRadius: BorderRadius.circular(22),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.auto_awesome_outlined, color: blue, size: 20),
            SizedBox(width: 8),
            Text(
              'Gợi ý cho bạn',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w600,
                color: ink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Một bài hay. Một góc nhìn mới.',
          style: TextStyle(fontSize: 13, color: muted),
        ),
        for (var i = 0; i < recommendations.length; i++) ...[
          if (i > 0) const Divider(height: 24),
          InkWell(
            onTap: () => open(recommendations[i]['article']),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.only(top: 14, bottom: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sourceName(recommendations[i]['article']['sourceId']),
                    style: const TextStyle(
                      fontSize: 11,
                      color: blue,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    recommendations[i]['article']['title'],
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      height: 1.55,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    recommendations[i]['reason'],
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    ),
  );
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.dark.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: Colors.white,
    ),
    child: Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.radar_rounded, color: blue, size: 29),
            SizedBox(width: 9),
            Text(
              'radar.',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -1,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Kết nối thư viện',
            onPressed: settings,
            icon: const Icon(Icons.tune_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (value) {
          if (tab == value) return;
          setState(() {
            tab = value;
            topic = '';
            source = '';
            query = '';
            search.clear();
          });
          load();
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: 'Khám phá',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_border_rounded),
            selectedIcon: Icon(Icons.bookmark_rounded),
            label: 'Đã lưu',
          ),
          NavigationDestination(
            icon: Icon(Icons.public_rounded),
            label: 'Nguồn đọc',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: load,
          color: blue,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 30),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Text(
                tab == 1
                    ? 'GÓC ĐỌC CỦA BẠN'
                    : tab == 2
                    ? 'TỪ NHỮNG ĐỘI NGŨ LÀM SẢN PHẨM'
                    : 'MỖI NGÀY, HIỂU THÊM MỘT CHÚT',
                style: const TextStyle(
                  color: blue,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                tab == 1
                    ? 'Để dành đọc sau.'
                    : tab == 2
                    ? 'Nguồn cảm hứng.'
                    : 'Đọc điều mới.',
                style: const TextStyle(
                  fontSize: 30,
                  height: 1.35,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                tab == 1
                    ? 'Những bài bạn muốn dành thêm thời gian.'
                    : tab == 2
                    ? '20 engineering blogs, trong một thư viện.'
                    : 'Công nghệ, kiến trúc và những điều đáng học hỏi.',
                style: const TextStyle(fontSize: 14, height: 1.7, color: muted),
              ),
              const SizedBox(height: 24),
              if (tab != 2) ...[
                TextField(
                  controller: search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (value) {
                    query = value.trim();
                    load();
                  },
                  decoration: InputDecoration(
                    hintText: 'Tìm một điều muốn hiểu…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: IconButton(
                      tooltip: 'Tìm kiếm',
                      onPressed: () {
                        query = search.text.trim();
                        FocusScope.of(context).unfocus();
                        load();
                      },
                      icon: const Icon(Icons.arrow_forward_rounded),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: const Text('Tất cả'),
                          selected: topic.isEmpty,
                          onSelected: (_) {
                            topic = '';
                            load();
                          },
                        ),
                      ),
                      for (final t in topics)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(t['label']),
                            selected: topic == t['id'],
                            onSelected: (_) {
                              topic = t['id'];
                              load();
                            },
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (source.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: InputChip(
                      label: Text(sourceName(source)),
                      onDeleted: () {
                        source = '';
                        load();
                      },
                    ),
                  ),
              ],
              if (loading)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.cloud_off_rounded,
                        size: 40,
                        color: muted,
                      ),
                      const SizedBox(height: 16),
                      Text(error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: load,
                        child: const Text('Thử lại'),
                      ),
                      TextButton(
                        onPressed: settings,
                        child: const Text('Kiểm tra kết nối'),
                      ),
                    ],
                  ),
                )
              else if (tab == 2) ...[
                for (final s in sources)
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    leading: CircleAvatar(
                      backgroundColor: mist,
                      foregroundColor: blue,
                      child: Text(
                        s['mark'],
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    title: Text(s['name']),
                    subtitle: Text(
                      '${s['articleCount']} bài viết${s['lastError'] != null ? ' · Chưa cập nhật được' : ''}',
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      setState(() {
                        tab = 0;
                        source = s['id'];
                      });
                      load();
                    },
                  ),
              ] else ...[
                if (recommendations.isNotEmpty && tab == 0) picks(),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'DÀNH THỜI GIAN KHÁM PHÁ',
                        style: TextStyle(
                          fontSize: 10,
                          letterSpacing: 1,
                          color: muted,
                        ),
                      ),
                    ),
                    Text(
                      '$total bài',
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                  ],
                ),
                if (articles.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Text(
                      'Chưa có bài viết ở đây.\nThử chủ đề khác hoặc lưu một bài bạn thích nhé.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: muted, height: 1.8),
                    ),
                  ),
                for (final article in articles) ...[
                  tile(article),
                  const Divider(height: 1),
                ],
                if (page < pageCount)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: OutlinedButton(
                      onPressed: more ? null : () => load(append: true),
                      child: Text(more ? 'Đang tải…' : 'Đọc thêm bài viết'),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
