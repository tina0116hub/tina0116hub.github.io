# 个人主页 · Personal Homepage

一个纯静态的个人学术主页，支持**中英文切换**、多个切页、深色模式，可以直接托管到 **GitHub Pages**。

- 线上地址（部署后）：`https://你的用户名.github.io/仓库名/`
- 本地预览：**直接双击 `index.html`** 即可（不需要任何启动脚本、不需要装环境）

---

## 一、文件说明

| 文件 / 文件夹 | 说明 |
| --- | --- |
| `index.html` | **网站入口**（GitHub Pages 自动识别这个文件） |
| `style.css` | 样式与自适应布局 |
| `script.js` | 渲染脚本：中英切换、切页路由 |
| `data/content.js` | **网站实际读取的内容**（由表格生成，请勿手改） |
| `data/content.json` | 同一份内容的 JSON 版（备用，可给别的程序用） |
| `images/` | 图片文件夹（含页面上用的照片） |
| `网站内容.xlsx` | **你的内容源文件**（编辑它 → 运行生成脚本 → 网站更新） |
| `build-data.mjs` | 把 `网站内容.xlsx` 转换成 `data/content.js` |
| `.nojekyll` | 告诉 GitHub Pages 不要用 Jekyll 处理，避免文件被忽略 |

---

## 二、部署到 GitHub Pages（两种方式任选）

### 方式 A：网页上传（最简单，不用装任何软件）

1. 登录 GitHub，点右上角 **+ → New repository**；
2. 仓库名随意，例如 `homepage`；可见性选 **Public**（Pages 免费版需要公开仓库）；**不要**勾选 "Add a README file"；
3. 创建后，点 **uploading an existing file**；
4. 把本项目**里面的所有文件和文件夹**拖进去（`index.html`、`style.css`、`script.js`、`data/`、`images/` 等），
   ⚠️ 注意：**是文件本身，不要把它们放进一个外层文件夹**；
5. 点 **Commit changes**；
6. 进入仓库 **Settings → Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/ (root)**
   - 点 **Save**；
7. 等 1～2 分钟，刷新 Settings → Pages，会显示网址：`https://你的用户名.github.io/仓库名/`。

### 方式 B：命令行（装了 Git 的话）

```bash
cd "项目文件夹"
git init
git add .
git commit -m "init: personal homepage"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

推送后同样到 **Settings → Pages** 选择 `main` 分支 + `/ (root)`。

> 提示：如果图片显示不出来、或页面白屏，先确认 Settings → Pages 里已经显示了网址，并且打开的是**带仓库名的地址**（不是 `用户名.github.io` 根目录）。

---

## 三、以后怎么改内容

网站的**所有文字都来自 `网站内容.xlsx`**，但它不是直接被网页读取的，需要转换一步：

1. 打开 `网站内容.xlsx`，改内容（G 列中文、H 列英文），保存；
2. 在项目文件夹执行一次转换：

   ```bash
   node build-data.mjs
   ```

3. 网页刷新（`Ctrl + F5`）就能看到新内容；
4. 把改动推送到 GitHub（网页上传或 `git push`），线上就会同步更新。

> 表格第 1 行是表头，**不要删列、不要删表头**。
> 第二张工作表「怎么填」里有每一列的说明。

### 如果电脑上没有 Node

也可以不用它：直接修改 `data/content.js` 里的文字（用记事本打开，找到对应文字改掉即可），
只是要注意别改坏引号和逗号。

---

## 四、表格各列含义

| 列 | 含义 |
| --- | --- |
| A `模块_中` | 这一行属于哪个板块；**换成新名字就会自动多出一个切页** |
| B `模块_英` | 板块的英文名（英文界面导航显示这个） |
| C `类型` | `卡片` / `段落` / `列表` / `小标题` / `图片` / `分割线` / `设置` |
| D `排序` | 数字越小越靠前 |
| E `标题_中` | 卡片中文标题；填 `education`、`publication`、`project`、`course` 等时只显示正文不显示标题 |
| F `标题_英` | 英文标题；「网站设置」行的**参数名**也写在 F 列 |
| G `内容_中` | ★ 中文正文 |
| H `内容_英` | 英文正文（留空时英文界面显示 TBD） |
| I `图片` | 例如 `images/edu-1.jpg`，留空则不显示图片 |
| J `链接` | 卡片点击后跳转的网址 |

### 网站设置（模块名「网站设置」，参数名写在 F 列）

| 参数名 | 作用 |
| --- | --- |
| `name` / `nameEn` | 中英文姓名 |
| `heroImage` | 首页头像/照片路径，例如 `images/zhengjianzhao.jpg` |
| `siteTitle` | 浏览器标签标题、导航栏左侧网站名 |
| `heroTitle` / `heroSubtitle` | 首页大标题与副标题 |
| `buttonText` | 首页按钮文字（链接写在同一行 J 列） |
| `footer` | 页脚版权文字 |
| `defaultLang` | 首次访问的默认语言：`zh` 或 `en` |
| `uiTbd` / `uiBackTop` / `uiFooterNote` | 界面上「待填写」「回到顶部」等文字 |

---

## 五、常见问题

**Q：页面显示「内容加载失败」？**
说明 `data/content.js` 没找到或为空。在项目文件夹执行 `node build-data.mjs` 重新生成。

**Q：改了表格，网页没变？**
表格需要转换才会生效：先运行 `node build-data.mjs`，再按 `Ctrl + F5`。

**Q：想加一个新切页（例如「获奖情况」）？**
在表格 A 列写「获奖情况」、B 列写 `Awards`，填好内容 → 运行 `node build-data.mjs` → 导航栏自动多出按钮。

**Q：想换头像 / 加图片？**
把图片放进 `images/` 文件夹，然后在表格 I 列写 `images/文件名.jpg`（英文文件名最稳妥），重新生成即可。
首页照片则在「网站设置」的 `heroImage` 行填写路径。

**Q：照片被裁得不好看？**
`style.css` 里搜 `.hero-photo img`，调整 `aspect-ratio`（照片框比例）和 `object-position`（取景位置）即可。

**Q：想改主色调？**
`style.css` 最上面 `:root` 里的 `--accent`、`--accent-2`。

**Q：手机上好看吗？**
已做响应式：窄屏时导航收成菜单按钮、卡片变单列；页面上还支持深色模式（跟随系统）。
