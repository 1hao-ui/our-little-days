/**
 * 这个文件同时是：
 *  1. 页面门禁：只有 /<APP_SECRET> 才能看到页面；
 *  2. API Worker：/<APP_SECRET>/api/records 与 /<APP_SECRET>/api/export。
 *
 * APP_SECRET 只存在于 Cloudflare 环境变量 / 本地 .dev.vars 中，
 * 不写死在页面可见的代码里。
 */

const SYMPTOM_OPTIONS = ['痛经', '头晕', '乏力', '失眠', '食欲差'];
const POSITIVE_OPTIONS = ['精神好', '睡得好', '胃口好', '身体轻松', '皮肤状态好'];
const PERIOD_OPTIONS = ['none', 'light', 'mid', 'heavy'];
const MOOD_OPTIONS = ['good', 'okay', 'tired'];
const PERIOD_LABELS = {
  none: '没来',
  light: '来了·少',
  mid: '来了·中',
  heavy: '来了·多',
};
const MOOD_LABELS = {
  good: '好',
  okay: '一般',
  tired: '累',
};
const APP_TIME_ZONE = 'Asia/Shanghai';
const ICON_FILES = new Set([
  'pig-cozy-32.png',
  'pig-cozy-180.png',
  'pig-cozy-192.png',
  'pig-cozy-512.png',
]);
const DOWNLOAD_FILES = new Set(['our-little-days.apk']);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete('access-control-allow-origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function tokenMatches(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string' || !expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(value)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function todayInAppTimeZone() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanMessage(value) {
  if (typeof value !== 'string') return '今天也辛苦啦';
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 80);
  return cleaned || '今天也辛苦啦';
}

function cleanRecordPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: '这次没有看清记录，再试一次吧。' };
  }

  const date = body.date;
  const today = todayInAppTimeZone();
  if (!isValidDate(date)) return { error: '日期好像没有选对，再看看呀。' };
  if (date > today) return { error: '未来的日子还没到呢，先记今天吧。' };
  if (date < '2000-01-01') return { error: '日期好像太早啦。' };

  let weight = null;
  if (body.weight !== null && body.weight !== undefined && body.weight !== '') {
    const parsed = typeof body.weight === 'number' ? body.weight : Number(body.weight);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) {
      return { error: '体重数字好像没有填对，再检查一下呀。' };
    }
    weight = Math.round(parsed * 10) / 10;
  }

  const period = typeof body.period === 'string' ? body.period : 'none';
  if (!PERIOD_OPTIONS.includes(period)) return { error: '月经状态没有选对，再试一次吧。' };

  const rawSymptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
  if (rawSymptoms.some((item) => !SYMPTOM_OPTIONS.includes(item))) {
    return { error: '身体感受里有一个选项没有认出来。' };
  }
  const symptomSet = new Set(rawSymptoms);
  const symptoms = SYMPTOM_OPTIONS.filter((item) => symptomSet.has(item)).join(',');

  const rawPositives = Array.isArray(body.positives) ? body.positives : [];
  if (rawPositives.some((item) => !POSITIVE_OPTIONS.includes(item))) {
    return { error: '舒服的感受里有一个选项没有认出来。' };
  }
  const positiveSet = new Set(rawPositives);
  const positives = POSITIVE_OPTIONS.filter((item) => positiveSet.has(item)).join(',');

  const asFlag = (value) => (value === true || value === 1 || value === '1' ? 1 : 0);
  const breakfast = asFlag(body.breakfast);
  const nuts = asFlag(body.nuts);
  const milk = asFlag(body.milk);

  const mood = typeof body.mood === 'string' ? body.mood : '';
  if (mood && !MOOD_OPTIONS.includes(mood)) return { error: '心情选项没有认出来。' };
  const message = cleanMessage(body.message);

  return {
    record: {
      date,
      weight,
      period,
      symptoms,
      mood,
      message,
      breakfast,
      nuts,
      milk,
      positives,
      updated_at: new Date().toISOString(),
    },
  };
}

async function readJson(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { error: '请求格式不对，再试一次吧。' };
  }
  const text = await request.text();
  if (text.length > 10_000) return { error: '这次的内容有点多，再试一次吧。' };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: '这次的内容没有读懂，再试一次吧。' };
  }
}

async function listRecords(env) {
  const { results } = await env.DB.prepare(
    `SELECT date, weight, period, symptoms, mood, message, breakfast, nuts, milk, positives, updated_at
     FROM records
     ORDER BY date DESC`,
  ).all();
  return results || [];
}

async function saveRecord(request, env) {
  const parsed = await readJson(request);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const cleaned = cleanRecordPayload(parsed.body);
  if (cleaned.error) return json({ error: cleaned.error }, 400);
  const record = cleaned.record;

  await env.DB.prepare(
    `INSERT INTO records
       (date, weight, period, symptoms, mood, message, breakfast, nuts, milk, positives, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       weight = excluded.weight,
       period = excluded.period,
       symptoms = excluded.symptoms,
       mood = excluded.mood,
       message = excluded.message,
       breakfast = excluded.breakfast,
       nuts = excluded.nuts,
       milk = excluded.milk,
       positives = excluded.positives,
       updated_at = excluded.updated_at`,
  )
    .bind(
      record.date,
      record.weight,
      record.period,
      record.symptoms,
      record.mood,
      record.message,
      record.breakfast,
      record.nuts,
      record.milk,
      record.positives,
      record.updated_at,
    )
    .run();

  return json({ record }, 200);
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // 防止 Excel 把文本当作公式执行。
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function flagLabel(value) {
  if (value === 1 || value === true) return '是';
  if (value === 0 || value === false) return '否';
  return '';
}

async function exportCsv(env) {
  const { results } = await env.DB.prepare(
    `SELECT date, weight, period, symptoms, mood, message, breakfast, nuts, milk, positives
     FROM records
     ORDER BY date ASC`,
  ).all();

  const header = ['日期', '体重', '月经状态', '身体感受', '心情', '鼓励话', '早餐', '每日坚果', '牛奶', '舒服的感受'];
  const rows = (results || []).map((record) => [
    record.date,
    record.weight === null || record.weight === undefined
      ? ''
      : Number(record.weight).toFixed(1),
    PERIOD_LABELS[record.period] || '没来',
    record.symptoms || '',
    MOOD_LABELS[record.mood] || '',
    record.message || '',
    flagLabel(record.breakfast),
    flagLabel(record.nuts),
    flagLabel(record.milk),
    record.positives || '',
  ]);

  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  const filename = `our-little-days-${todayInAppTimeZone()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

async function handleApi(request, env, endpoint) {
  if (!env.DB) {
    console.error('D1 binding "DB" is missing.');
    return json({ error: '数据暂时没有连上，请稍后再试一次。' }, 500);
  }

  if (endpoint === 'records') {
    if (request.method === 'GET') {
      try {
        return json({ records: await listRecords(env) });
      } catch (error) {
        console.error('Failed to list records:', error);
        return json({ error: '记录暂时没有读出来，请刷新再试一次。' }, 500);
      }
    }
    if (request.method === 'POST') {
      try {
        return await saveRecord(request, env);
      } catch (error) {
        console.error('Failed to save record:', error);
        return json({ error: '这一次没有保存成功，请稍后再试一次。' }, 500);
      }
    }
    return json({ error: '这个操作暂不支持。' }, 405, { allow: 'GET, POST' });
  }

  if (endpoint === 'export') {
    if (request.method !== 'GET') return json({ error: '这个操作暂不支持。' }, 405, { allow: 'GET' });
    try {
      return await exportCsv(env);
    } catch (error) {
      console.error('Failed to export records:', error);
      return json({ error: '导出没有成功，请稍后再试一次。' }, 500);
    }
  }

  return json({ error: '没有找到这个接口。' }, 404);
}

function basePath(token) {
  return `/${encodeURIComponent(token)}`;
}

function appManifest(token) {
  const base = basePath(token);
  const scope = `${base}/`;
  const body = {
    id: scope,
    name: '我们的小日子',
    short_name: '小日子',
    description: '两个人的健康记录小本子',
    start_url: scope,
    scope,
    display: 'standalone',
    background_color: '#FFF9F5',
    theme_color: '#FFF9F5',
    orientation: 'portrait-primary',
    lang: 'zh-CN',
    icons: [
      {
        src: `${base}/icons/pig-cozy-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}/icons/pig-cozy-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}/icons/pig-cozy-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function serveIcon(env, request, filename) {
  if (!env.ASSETS) {
    console.error('ASSETS binding is missing.');
    return new Response('图标暂时没有准备好。', { status: 500 });
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `/icons/${filename}`;
  assetUrl.search = '';
  const response = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: request.method,
      headers: request.headers,
    }),
  );
  if (!response.ok) return notFound();
  const headers = new Headers(response.headers);
  headers.delete('access-control-allow-origin');
  headers.set('content-type', 'image/png');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(response.body, { status: response.status, headers });
}

async function serveDownload(env, request, filename) {
  if (!env.ASSETS) {
    console.error('ASSETS binding is missing.');
    return new Response('安装包暂时没有准备好。', { status: 500 });
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `/download/${filename}`;
  assetUrl.search = '';
  const response = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: request.method,
      headers: request.headers,
    }),
  );
  if (!response.ok) return notFound();
  const headers = new Headers(response.headers);
  headers.delete('access-control-allow-origin');
  headers.set('content-type', 'application/vnd.android.package-archive');
  headers.set('content-disposition', 'attachment; filename="our-little-days.apk"');
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

function injectPwaTags(html, token) {
  const base = basePath(token);
  const tags = [
    `<link rel="icon" type="image/png" sizes="32x32" href="${base}/icons/pig-cozy-32.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${base}/icons/pig-cozy-180.png">`,
    `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  ].join('\n    ');
  if (!html.includes('</head>')) return html;
  return html.replace('</head>', `    ${tags}\n  </head>`);
}

async function serveApp(env, request, token) {
  if (!env.ASSETS) {
    console.error('ASSETS binding is missing.');
    return new Response('页面暂时没有准备好。', { status: 500 });
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/index.html';
  assetUrl.search = '';
  const assetRequest = new Request(assetUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
  const response = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(response.headers);
  headers.delete('access-control-allow-origin');
  headers.delete('content-length');
  headers.delete('etag');
  headers.set(
    'content-security-policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  headers.set('cache-control', 'no-store');
  const html = request.method === 'HEAD' ? '' : injectPwaTags(await response.text(), token);
  return new Response(html || null, {
    status: response.status,
    headers,
  });
}

function notFound() {
  const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>404</title>
<style>
html,body{height:100%}body{margin:0;display:grid;place-items:center;background:#FFF9F5;color:#8F7F7A;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
main{text-align:center;padding:32px}.dot{width:54px;height:54px;border-radius:50%;background:#FBE3E1;display:grid;place-items:center;margin:0 auto 18px;font-size:24px;color:#E7A09F}p{margin:0;font-size:15px}
</style></head>
<body><main><div class="dot">·</div><p>这里什么都没有，去我们的小页面吧。</p></main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let parts;
    try {
      parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      return withSecurityHeaders(notFound());
    }

    const token = parts[0] || '';
    if (!(await tokenMatches(token, env.APP_SECRET))) {
      return withSecurityHeaders(notFound());
    }

    if (parts[1] === 'api') {
      if (parts.length > 3) return withSecurityHeaders(json({ error: '没有找到这个接口。' }, 404));
      const response = await handleApi(request, env, parts[2] || '');
      return withSecurityHeaders(response);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withSecurityHeaders(notFound());
    }

    if (parts[1] === 'manifest.webmanifest' && parts.length === 2) {
      return withSecurityHeaders(appManifest(token));
    }

    if (parts[1] === 'icons' && parts.length === 3 && ICON_FILES.has(parts[2])) {
      try {
        return withSecurityHeaders(await serveIcon(env, request, parts[2]));
      } catch (error) {
        console.error('Failed to serve icon:', error);
        return withSecurityHeaders(notFound());
      }
    }

    if (parts[1] === 'download' && parts.length === 3 && DOWNLOAD_FILES.has(parts[2])) {
      try {
        return withSecurityHeaders(await serveDownload(env, request, parts[2]));
      } catch (error) {
        console.error('Failed to serve download:', error);
        return withSecurityHeaders(notFound());
      }
    }

    if (parts.length === 1) {
      try {
        return withSecurityHeaders(await serveApp(env, request, token));
      } catch (error) {
        console.error('Failed to serve app:', error);
        return withSecurityHeaders(
          new Response('页面暂时没有打开，请稍后再试一次。', { status: 500 }),
        );
      }
    }

    return withSecurityHeaders(notFound());
  },
};
