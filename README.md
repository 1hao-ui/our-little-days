# 我们的小日子

<img src="public/icons/pig-cozy-192.png" width="112" alt="粉色小猪图标">

两个人共用的手机优先健康记录页：记月经、体重、身体感受和心情，也能看趋势、日历和全部明细。

- 前端：纯 HTML + 内联 CSS/JS，放在 Cloudflare Pages
- API：同项目的 Pages Worker（`public/_worker.js`，运行在 Cloudflare 边缘）
- 数据：Cloudflare D1 一张 `records` 表
- 免费：只用 Cloudflare Pages、Workers、D1 的免费额度，没有第三方依赖

当前线上地址：

```text
https://our-little-days-4u7.pages.dev/<APP_SECRET>
```

`<APP_SECRET>` 这一段就是门禁密钥。根路径 `/` 和错误密钥都会返回 404。页面和 API 都做同一层校验，两个人打开同一个网址即可读写同一份数据。

> 当前仓库里的 `.dev.vars` 已经生成了一条本地开发密钥，但它被 `.gitignore` 忽略，不会进入版本库。部署时请单独设置生产环境的 `APP_SECRET`。

---

## 1. 已经做好的功能

- 今日打卡：日期可回看过去，未来日期不可选；体重可为空，保留一位小数
- 月经状态：没来 / 来了·少 / 来了·中 / 来了·多
- 今天的小习惯：早餐、每日坚果、牛奶，点一下即可记录
- 身体感受分成「有点辛苦」和「也有舒服的时候」两组，可以同时选择
  - 有点辛苦：痛经、头晕、乏力、失眠、食欲差
  - 也有舒服的时候：精神好、睡得好、胃口好、身体轻松、皮肤状态好
- 心情：好 / 一般 / 累，可选
- 同一天重复保存会覆盖当天记录，不会新增重复行
- 保存成功有爱心上浮动画和随机鼓励话
- 体重趋势：最近 30 天 / 90 天，柔和折线，可选目标体重虚线
- 月经日历：可左右翻月，按流量显示深浅粉色，今天有细描边
- 周期统计：最近一次来潮、最近三次间隔、平均间隔
- 明细列表：按日期倒序；点击任意一条回到打卡区修改
- CSV 导出：UTF-8 带 BOM，Excel 打开中文不乱码
- 自定义粉色小猪 PWA 图标，iPhone 和 Android 都可以添加到主屏幕
- 附带一个轻量 Android WebView 包装工程，可自行构建 APK
- 全站无账号、无第三方统计、无外部脚本；数据只在 D1
- 移动端优先，桌面端居中，内容宽度约 420px

鼓励话、目标体重、颜色都已经做成明显常量，见第 6 节。

---

## 2. 目录结构

```text
our-little-days/
├─ public/
│  ├─ index.html          # 页面、样式、交互、图表、日历全部在这里
│  ├─ _worker.js          # Pages Worker：路径门禁 + API + D1 + CSV + PWA
│  └─ icons/              # 小猪主屏幕图标 32/180/192/512
├─ assets/                # 小猪图标源图
├─ android/               # Android WebView 包装工程
├─ schema.sql             # D1 表结构（新库）
├─ migrations/            # 已有数据库的升级 SQL
├─ wrangler.jsonc         # Pages 项目、D1 绑定、兼容日期
├─ scripts/wrangler.mjs   # 包一层 Wrangler，顺带处理 Windows 临时目录
├─ package.json
├─ .dev.vars              # 本地密钥（已忽略，不提交）
├─ .dev.vars.example
└─ README.md
```

这个项目只有一个 Cloudflare Pages 项目。`public/_worker.js` 使用 Pages 的 Advanced Mode，实际就是运行在 Cloudflare 边缘的 Worker，因此页面和 API 能共享同一个域名、同一个随机路径，不用处理跨域，也不需要再部署第二个 Worker 项目。D1 绑定通过 `wrangler.jsonc` 配置。

---

## 3. 本地预览

需要 Node.js 22+。

```powershell
npm install
npm run db:local
npm run dev
```

然后打开：

```text
http://127.0.0.1:8788/<.dev.vars 里的 APP_SECRET>
```

`.dev.vars` 里已经有一条现成的 48 位随机密钥，直接复制等号后面的值即可。根路径打不开是正常的，必须带着密钥路径访问。

停止服务后，本地数据保存在 `.wrangler/state/`，下次启动还在。想重新开始，可以删掉 `.wrangler/state/` 后重新执行 `npm run db:local`。

### 添加到手机主屏幕

- iPhone / iPad：用 Safari 打开完整网址，点分享按钮，选「添加到主屏幕」。
- Android：用 Chrome 打开完整网址，点右上角菜单，选「安装应用」或「添加到主屏幕」。
- 微信内置浏览器不支持添加：点右上角「…」→「在浏览器打开」，再按上面的方法操作。

小猪图标由 Worker 动态生成 manifest，`start_url` 和图标路径都会自动带上当前 `APP_SECRET`，不会把密钥写进静态文件。如果手机上还留着旧图标，先删掉旧快捷方式，再用最新页面重新添加。

---

## 4. 首次部署到 Cloudflare

以下命令使用 `npx`，不需要全局安装 Wrangler。

### 4.1 登录 Cloudflare

```powershell
npx wrangler login
```

浏览器会弹出授权页，选择自己的 Cloudflare 账号即可。

### 4.2 创建 D1 数据库

```powershell
npx wrangler d1 create our-little-days-db
```

命令会输出类似：

```text
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

把这一串 ID 填进 `wrangler.jsonc` 的 `database_id`，替换掉现在的全零占位值：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "our-little-days-db",
    "database_id": "刚刚拿到的 database_id"
  }
]
```

`binding` 必须保持 `DB`，代码里用的是 `env.DB`。

### 4.3 创建表

```powershell
npm run db:remote
```

这个命令会在远程 D1 执行 `schema.sql`，创建 `records` 表和日期索引。重复执行也没关系，语句是幂等的。

### 4.4 创建 Pages 项目

```powershell
npx wrangler pages project create our-little-days --production-branch main
```

如果项目名被占用，换成自己喜欢的名字，同时把 `package.json` 里 `deploy` 脚本的 `--project-name` 和 `wrangler.jsonc` 里的 `name` 一起改掉。

### 4.5 生成并设置生产密钥

生成一条新的长随机串：

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

复制输出结果，然后执行：

```powershell
npx wrangler pages secret put APP_SECRET --project-name our-little-days
```

终端会提示输入值，粘贴刚才生成的随机串并回车。这个值就是网址里那段门禁路径。

> 也可以直接使用 `.dev.vars` 里的密钥，本地和线上保持一致，少记一个值。只要确保它足够长、足够随机即可。

### 4.6 部署

```powershell
npm run deploy
```

部署完成后，Wrangler 会输出一个 `*.pages.dev` 地址。这个项目的正式域名是：

```text
https://our-little-days-4u7.pages.dev
```

### 4.7 打开正确网址

把密钥拼到域名后面：

```text
https://our-little-days-4u7.pages.dev/你的APP_SECRET
```

`APP_SECRET` 只保存在 Cloudflare 项目和你的私密记录里，不写进仓库。打开完整网址即可开始使用。

你和女朋友都打开这一条完整网址，就能看到并修改同一份记录。可以直接把它加到手机主屏幕，当作小应用使用。

---

## 5. 以后更新

改完代码后，重新部署：

```powershell
npm run deploy
```

数据在 D1 里，不会因为重新部署而丢失。生产密钥也不会变，网址不变。

如果改了 `_worker.js`，本地开发时如果发现行为没更新，按一次 `Ctrl+C` 再 `npm run dev`。

### 更换密钥（例如链接不小心外传）

```powershell
npx wrangler pages secret put APP_SECRET --project-name our-little-days
npm run deploy
```

换完后旧网址返回 404，新网址使用新密钥，D1 里的记录都还在。

---

## 6. 想自己改的地方

都在 `public/index.html` 的 `<script>` 开头附近，搜索这些名字就能找到。

### 鼓励话池

```js
const ENCOURAGEMENTS = [
  '今天也辛苦啦',
  '好好吃饭，慢慢来',
  ...
];
```

数组里想加多少句就加多少句，保存时会随机挑一句；如果只有一句，就一直显示那一句。保存时选中的句子会写进当天的记录，明细里展示的也是它。

### 目标体重虚线

```js
const TARGET_WEIGHT = null;
```

填数字就会出现虚线，例如：

```js
const TARGET_WEIGHT = 55.0;
```

再改回 `null` 就隐藏。

### 颜色和圆角

`public/index.html` 顶部的 `:root` 里集中放了颜色变量：

```css
--bg: #FFF9F5;
--pink: #F7A8A8;
--pink-strong: #F19BA1;
--text: #5A4F4C;
```

改主色、背景色、文字色只动这里即可。卡片圆角、按钮胶囊、间距也都可以在对应 CSS 里调整。

### 文案

页面上的中文都可以直接在 HTML 里改，包括大标题、副标题、按钮文字、空状态和底部文案。页面上唯一一处装饰小猪是内联 SVG，不需要图片文件。

---

## 7. 接口和数据

所有接口都在随机路径下面，路径不对一律 404：

```text
GET  /<APP_SECRET>/api/records    # 读取全部记录
POST /<APP_SECRET>/api/records    # 保存或覆盖某一天
GET  /<APP_SECRET>/api/export     # 下载 CSV
```

表结构：

```sql
CREATE TABLE records (
  date TEXT PRIMARY KEY,
  weight REAL,
  period TEXT,
  symptoms TEXT,
  mood TEXT,
  message TEXT,
  breakfast INTEGER,
  nuts INTEGER,
  milk INTEGER,
  positives TEXT,
  updated_at TEXT
);
```

- `period`：`none` / `light` / `mid` / `heavy`
- `symptoms`：逗号分隔的负面身体感受，例如 `痛经,乏力`
- `positives`：逗号分隔的正面身体感受，例如 `精神好,睡得好`
- `breakfast` / `nuts` / `milk`：`1` 表示吃了或喝了，`0` 表示没有；旧记录为 `NULL`
- `mood`：`good` / `okay` / `tired`，也可以为空
- `date`：`YYYY-MM-DD`，主键，因此一天只有一条
- `updated_at`：UTC ISO 时间

API 会检查日期格式、未来日期、体重范围、固定选项和长度，并使用参数化 SQL；页面用 `textContent` 渲染数据，不把用户内容当 HTML 插入。

CSV 列固定为：

```text
日期,体重,月经状态,身体感受,心情,鼓励话,早餐,每日坚果,牛奶,舒服的感受
```

文件带 UTF-8 BOM，Excel 直接打开不会乱码；同时做了 CSV 转义和公式注入防护。旧记录的新增列会留空，不会误写成「没吃」。

已有旧数据库升级时，执行一次：

```powershell
npx wrangler d1 execute our-little-days-db --remote --file=./migrations/0002_add_habits_and_positives.sql --yes
```

新数据库直接执行 `npm run db:remote` 即可，`schema.sql` 已经包含新字段。

---

## 8. 门禁、隐私和注意事项

- 没有账号、密码、注册流程。完整网址就是唯一的门禁。
- 页面和 API 都会校验 `APP_SECRET`，错误路径返回 404，不会返回数据。
- `APP_SECRET` 只存储在 Cloudflare 环境变量和本地 `.dev.vars` 中，没有写进前端源码。
- 页面没有第三方脚本、统计、字体 CDN、图片 CDN 或外链请求。
- 所有请求走 HTTPS。
- 拿到完整网址的人拥有读写权限，所以不要把网址发到公开群组、截图或公开仓库。
- 浏览器历史、手机主屏幕图标、聊天记录里都会留下完整网址，这是无账号方案的取舍。
- 最稳妥的备份方式就是定期点一次「导出全部记录」，把 CSV 收藏好。

---

## 9. 常见问题

### 打开域名根路径是 404

这是设计如此。必须访问 `https://域名/<APP_SECRET>`。

### 输入正确密钥还是 404

- 检查 `APP_SECRET` 前后有没有多复制空格
- 确认 Cloudflare Pages 项目里已经设置这个 Secret
- 改完 Secret 后重新执行一次 `npm run deploy`
- 本地开发时检查 `.dev.vars`，线上检查 Pages 项目设置

### 页面能打开，但保存失败

- 检查 `wrangler.jsonc` 里的 D1 `binding` 是否为 `DB`
- 检查 `database_id` 是否是真实创建出来的 ID
- 确认已经执行过 `npm run db:remote`
- 重新部署一次，让绑定生效

### 想换端口

改 `package.json` 里 `dev` 脚本的 `--port 8788`。

### 免费额度够不够

两个人每天一条记录，体量非常小，Pages 和 D1 的免费额度足够长期使用。项目没有 R2、KV、Queues、AI 等其它付费依赖。

---

## 10. Android APK

`android/` 里是一个不依赖第三方库的 WebView 包装工程：

- 包名 `com.onehao.littledays`
- 最低 Android 8.0（API 26），targetSdk 34
- 奶油色启动页 + 小猪图标 + 加载失败重试
- 页面内 CSV 导出会交给系统下载管理器
- 外部链接会交给系统浏览器
- 返回键会退出 App，不会在页面里乱跳
- 页面链接通过 `BuildConfig.APP_URL` 编译进 APK，不会出现在源码里

### 构建

要求：JDK 21、Android SDK（platform 35、build-tools 34）。先确保 `android/local.properties` 里的 `sdk.dir` 指向本机 Android SDK。

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug "-PAPP_URL=https://our-little-days-4u7.pages.dev/<APP_SECRET>/"
```

生成的 APK 在：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

把 APK 复制成 `public/download/our-little-days.apk` 后重新部署，就可以通过下面的地址下载：

```text
https://our-little-days-4u7.pages.dev/<APP_SECRET>/download/our-little-days.apk
```

`dist/`、`public/download/*.apk` 和所有 `*.apk` 都被忽略，不会提交到仓库。构建时请把 `<APP_SECRET>` 换成本地或线上对应的密钥；APK 一旦分发，拿到 APK 的人就拥有这个入口，不要公开分享。

更换 `APP_SECRET` 后，旧 APK 会失效，需要重新构建并重新安装。
