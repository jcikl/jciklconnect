import os, re, json, subprocess, collections
import sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.chdir(ROOT)

def read(p):
    return open(p, encoding='utf-8', errors='ignore').read()

def all_src():
    out = []
    for d in ['components','services','hooks','utils','contexts','App.tsx','index.tsx','functions/src']:
        if os.path.isfile(d): out.append(d); continue
        for r, _, fs in os.walk(d):
            if 'node_modules' in r or '/lib' in r: continue
            for f in fs:
                if f.endswith(('.ts','.tsx')) and not f.endswith('.d.ts'):
                    out.append(os.path.join(r, f).replace(chr(92), '/'))
    return out

SRC = all_src()
SRC_TEXT = {p: read(p) for p in SRC}

def doc_before(lines, i):
    # find JSDoc/comment directly above line i
    j = i - 1
    buf = []
    while j >= 0 and lines[j].strip() == '': j -= 1
    if j >= 0 and lines[j].strip().endswith('*/'):
        k = j
        while k >= 0 and '/**' not in lines[k] and '/*' not in lines[k]: k -= 1
        for l in lines[k:j+1]:
            t = l.strip().lstrip('/*').rstrip('*/').strip()
            if t and not t.startswith('@'): buf.append(t)
    elif j >= 0 and lines[j].strip().startswith('//'):
        k = j
        while k >= 0 and lines[k].strip().startswith('//'): k -= 1
        for l in lines[k+1:j+1]:
            t = l.strip().lstrip('/').strip()
            if t: buf.append(t)
    s = ' '.join(buf)
    s = re.sub(r'\s+', ' ', s)
    return (s[:110] + '…') if len(s) > 110 else s

def importers(path):
    base = os.path.splitext(path)[0]
    name = os.path.basename(base)
    pat = re.compile(r"""from\s+['"][^'"]*/""" + re.escape(name) + r"""['"]""")
    users = [p for p, t in SRC_TEXT.items() if p != path and pat.search(t)]
    return users

def file_header(text):
    lines = text.split('\n')
    for i, l in enumerate(lines[:40]):
        if l.strip().startswith('/**') or l.strip().startswith('//'):
            # header comment at top before imports
            d = doc_before(lines, 0) if False else None
    m = re.match(r'\s*/\*\*(.*?)\*/', text, re.S)
    if m:
        t = ' '.join(x.strip().lstrip('*').strip() for x in m.group(1).split('\n') if x.strip().lstrip('*').strip() and not x.strip().lstrip('*').strip().startswith('@'))
        return (t[:140] + '…') if len(t) > 140 else t
    m = re.match(r'\s*((?://[^\n]*\n)+)', text)
    if m:
        t = ' '.join(x.strip().lstrip('/').strip() for x in m.group(1).split('\n') if x.strip())
        return (t[:140] + '…') if len(t) > 140 else t
    return ''

def collections_used(text):
    s = set(re.findall(r'COLLECTIONS\.([A-Z_]+)', text))
    s |= set("'" + x + "'" for x in re.findall(r"""collection\(\s*db\s*,\s*['"]([a-zA-Z_]+)['"]""", text))
    return sorted(s)

def analyze(path):
    text = SRC_TEXT[path]
    lines = text.split('\n')
    exports = []
    cls = None
    for i, l in enumerate(lines):
        m = re.match(r'export\s+(?:default\s+)?class\s+(\w+)', l)
        if m: cls = m.group(1); exports.append(('class', cls, doc_before(lines, i), i+1)); continue
        m = re.match(r'export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(', l)
        if m: exports.append(('fn', m.group(1), doc_before(lines, i), i+1)); continue
        m = re.match(r'export\s+const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(\(|[a-zA-Z_]+\s*=>|function|\{|React\.|memo|forwardRef|create)', l)
        if m: exports.append(('const', m.group(1), doc_before(lines, i), i+1)); continue
        m = re.match(r'  (?:public\s+)?static\s+(?:async\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(', l)
        if m and cls and not m.group(1).startswith('_'):
            exports.append(('method', cls + '.' + m.group(1), doc_before(lines, i), i+1))
        if re.match(r'  private\s+static', l): pass
    return {
        'path': path, 'loc': len(lines), 'header': file_header(text),
        'exports': exports, 'collections': collections_used(text),
        'users': importers(path),
    }

result = {}
for group, d in [('services','services'),('hooks','hooks'),('utils','utils'),('contexts','contexts'),('ui','components/ui'),('shared','components/shared')]:
    files = sorted(p for p in SRC if p.startswith(d + '/') and '.test.' not in p)
    result[group] = [analyze(p) for p in files]

# functions (cloud functions)
fn_files = sorted(p for p in SRC if p.startswith('functions/'))
result['functions'] = [analyze(p) for p in fn_files]

# duplicate detection: local definitions in components that shadow utils exports
util_names = {}
for f in result['utils']:
    for k, n, _, _ in f['exports']:
        util_names[n] = f['path']
dups = collections.defaultdict(list)
defpat = re.compile(r'^\s*(?:export\s+)?(?:const|function|let)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|=\s*\w+\s*=>|\()', re.M)
for p, t in SRC_TEXT.items():
    if p.startswith('utils/'): continue
    for m in defpat.finditer(t):
        n = m.group(1)
        if n in util_names:
            line = t[:m.start()].count('\n') + 1
            dups[n].append(f'{p}:{line}')
result['shadow_utils'] = {n: {'canonical': util_names[n], 'redefined_in': v} for n, v in dups.items()}

# same-name top-level function defined in >=3 non-util files
cnt = collections.defaultdict(list)
for p, t in SRC_TEXT.items():
    for m in re.finditer(r'^(?:const|function)\s+((?:format|calc|calculate|get|parse|normalize|to|is|build)\w+)\s*(?:=|\()', t, re.M):
        cnt[m.group(1)].append(p)
result['repeated_local'] = {n: v for n, v in cnt.items() if len(v) >= 3}

# direct firestore in components
result['direct_fs'] = sorted(p for p, t in SRC_TEXT.items() if p.startswith('components/') and re.search(r"""from\s+['"]firebase/firestore['"]""", t))

# orphan files (no importers) among services/hooks/utils
result['orphans'] = [f['path'] for g in ['services','hooks','utils'] for f in result[g] if not f['users']]

import tempfile
CAP_JSON = os.path.join(tempfile.gettempdir(), 'cap.json')
json.dump(result, open(CAP_JSON,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print({g: len(result[g]) for g in ['services','hooks','utils','contexts','ui','shared','functions']})
print('shadow', {k: len(v['redefined_in']) for k, v in result['shadow_utils'].items()})
print('repeated', {k: len(v) for k, v in result['repeated_local'].items()})
print('direct_fs', len(result['direct_fs']))
print('orphans', result['orphans'])

# ---- generate markdown ----
import json, re, os, collections
r = json.load(open(CAP_JSON,encoding='utf-8'))
ROOT = os.path.abspath(ROOT)
TEXT = {}
def t(p):
    if p not in TEXT: TEXT[p] = open(os.path.join(ROOT, p), encoding='utf-8', errors='ignore').read()
    return TEXT[p]

# all source text for mention fallback
ALL = {}
for d in ['components','services','hooks','utils','contexts','functions/src']:
    for rt, _, fs in os.walk(os.path.join(ROOT, d)):
        if 'node_modules' in rt: continue
        for f in fs:
            if f.endswith(('.ts','.tsx')):
                p = os.path.relpath(os.path.join(rt, f), ROOT).replace(chr(92), '/'); ALL[p] = t(p)
ALL['App.tsx'] = t('App.tsx')

def users(f):
    if f['users']: return f['users']
    name = os.path.splitext(os.path.basename(f['path']))[0]
    pat = re.compile(r"""import\(\s*['"][^'"]*/""" + re.escape(name) + r"""['"]|from\s+['"][^'"]*/""" + re.escape(name) + r"""['"]""")
    return [p for p, s in ALL.items() if p != f['path'] and pat.search(s)]

DOMAINS = [
 ('會員 Member', ['member','introducer','mentorship','promotion','membership','senator','learningPath','memberJourney','memberStats','memberBenefit','behavioral','engagement']),
 ('財務 Finance', ['finance','transaction','reconciliation','paymentRequest','projectAccounts','projectFinancial','eventBudget','eventPaymentMatching','toyyib','incentive','sponsorship']),
 ('活動與項目 Events & Projects', ['event','project','activityPlan','flagship','zoom']),
 ('積分與遊戲化 Points & Gamification', ['points','pointsRule','gamification','ruleExecution']),
 ('組織治理 Board & Governance', ['board','permission','auditLog','contract','documents','templates','workflow','automation','sisterChapter','hobbyClub']),
 ('溝通與行銷 Communication & Marketing', ['communication','notification','email','socialPost','socialPersona','publication','advertisement','surveys','surveyAnalytics','inquiry','businessDirectory','partnership','guestAnalytics','webhook','larkSync','knowledge']),
 ('基礎設施 Infrastructure', ['cache','cloudinary','errorLogging','firestoreLogger','dataImportExport','postcode','mockData','inventory','aiPrediction']),
]
def domain_of(path):
    n = os.path.splitext(os.path.basename(path))[0].replace('Service','')
    n0 = n[0].lower() + n[1:]
    for d, keys in DOMAINS:
        for k in keys:
            if n0.lower().startswith(k.lower()): return d
    return '其他 Other'

out = []
W = out.append
W('# CAPABILITIES.md — JCIKL Connect 能力地圖')
W('')
W('> **用途：** 寫任何新的函數 / hook / service / 元件之前，先在本文件搜尋。這是「系統已經有什麼」的唯一索引。')
W('> **生成方式：** 由 `scripts/gen-capabilities` 掃描原始碼自動產生（重新生成後請以 git log 為準）。用途說明取自原始碼的檔頭註解；沒有註解的標記為「⚠️ 無說明」，需人工補上。')
W('> **維護規則：** 新增或修改 export 的 PR，必須在同一個 PR 內更新本文件。')
W('')
W('## 0. 使用方式（給人和 AI）')
W('')
W('| 步驟 | 動作 |')
W('|---|---|')
W('| 1 | 用 Ctrl+F 或 `grep -n "關鍵字" CAPABILITIES.md` 找能力，例如 member、payment、format、attendance |')
W('| 2 | 找到後，打開對應檔案的行號，確認簽名 |')
W('| 3 | 在計畫中寫明：✅ 複用 / 🔧 擴充 / 🆕 新建（並列出查過的檔案） |')
W('| 4 | 分層規則：元件 → hook → service → Firestore。**元件不得直接 import `firebase/firestore`** |')
W('')
W('**規模總覽：**')
W('')
W('| 層 | 檔案數 | 位置 |')
W('|---|---|---|')
for g, label, loc in [('services','Service（業務邏輯與資料存取）','services/'),('hooks','Hook（React 資料綁定）','hooks/'),('utils','Util（純函數工具）','utils/'),('ui','UI 元件（通用）','components/ui/'),('shared','共用業務元件','components/shared/'),('contexts','Context','contexts/'),('functions','Cloud Functions','functions/src/')]:
    W(f'| {label} | {len(r[g])} | `{loc}` |')
W('')

# ---------- Section 1: reuse alerts
W('## 1. ⚠️ 重複造輪子警示（先修正認知，不急著改碼）')
W('')
W('### 1.1 已有標準版本，卻在元件內重寫')
W('')
W('| 函數 | 標準版本（請用這個） | 重寫位置 |')
W('|---|---|---|')
for n, v in sorted(r['shadow_utils'].items()):
    W(f"| `{n}` | `{v['canonical']}` | " + '<br>'.join(f'`{x}`' for x in v['redefined_in']) + ' |')
W('')
W('### 1.2 同一函數在多個元件各寫一份（應抽出到 utils）')
W('')
W('| 函數 | 出現次數 | 位置 |')
W('|---|---|---|')
for n, v in sorted(r['repeated_local'].items(), key=lambda x: -len(x[1])):
    W(f'| `{n}` | {len(v)} | ' + '<br>'.join(f'`{x}`' for x in v) + ' |')
W('')
W('### 1.3 元件直接存取 Firestore（繞過 service 層）')
W('')
for p in r['direct_fs']:
    W(f'- `{p}`')
W('')
W('### 1.4 疑似未被使用（建新功能前先確認是否就是你要的）')
W('')
W('| 檔案 | 行數 | 檔頭說明 |')
W('|---|---|---|')
allf = {f['path']: f for g in ['services','hooks','utils'] for f in r[g]}
for p in sorted(allf):
    f = allf[p]
    if not users(f):
        W(f"| `{p}` | {f['loc']} | {f['header'] or '⚠️ 無說明'} |")
W('')
W('### 1.5 超大檔案（> 1,500 行，修改時務必精準定位，勿整檔重寫）')
W('')
big = sorted([(f['loc'], f['path']) for g in ['services','hooks','utils','ui','shared'] for f in r[g] if f['loc'] > 1500], reverse=True)
W('| 檔案 | 行數 |')
W('|---|---|')
for loc, p in big:
    W(f'| `{p}` | {loc:,} |')
W('')

# ---------- Section 2: services by domain
W('## 2. Service 層（按業務領域）')
W('')
W('> 欄位說明：**集合**＝此 service 讀寫的 Firestore 集合（`COLLECTIONS.*` 常數）；**引用**＝有多少檔案 import 它。')
W('')
by = collections.defaultdict(list)
for f in r['services']: by[domain_of(f['path'])].append(f)
order = [d for d, _ in DOMAINS] + ['其他 Other']
for d in order:
    if d not in by: continue
    W(f'### 2.{order.index(d)+1} {d}')
    W('')
    W('| Service | 行數 | 引用 | 用途 | 集合 |')
    W('|---|---|---|---|---|')
    for f in sorted(by[d], key=lambda x: x['path']):
        name = os.path.basename(f['path'])
        cols = ', '.join(f['collections'][:6]) + (' …' if len(f['collections']) > 6 else '')
        W(f"| `{name}` | {f['loc']:,} | {len(users(f))} | {f['header'] or '⚠️ 無說明'} | {cols or '—'} |")
    W('')
    for f in sorted(by[d], key=lambda x: x['path']):
        methods = [e for e in f['exports'] if e[0] == 'method']
        others = [e for e in f['exports'] if e[0] in ('fn','const')]
        W(f"<details><summary><code>{f['path']}</code> — {len(methods)} 個方法{('、' + str(len(others)) + ' 個函數/常數') if others else ''}</summary>")
        W('')
        if methods:
            W('| 方法 | 行 | 說明 |')
            W('|---|---|---|')
            for _, n, doc, ln in methods:
                W(f'| `{n.split(".",1)[1]}` | {ln} | {doc} |')
        if others:
            W('')
            W('**其他 export：** ' + ', '.join(f'`{n}` (L{ln})' for _, n, _, ln in others))
        W('')
        W('</details>')
        W('')

# ---------- Section 3: hooks
W('## 3. Hook 層')
W('')
W('> **依賴 Service**＝此 hook 包裝了哪些 service。需要資料時，優先找現成 hook，而不是在元件內直接呼叫 service。')
W('')
W('| Hook 檔案 | 行數 | 引用 | Export | 依賴 Service | 說明 |')
W('|---|---|---|---|---|---|')
for f in r['hooks']:
    deps = sorted(set(re.findall(r"""from\s+['"][^'"]*services/(\w+)['"]""", t(f['path']))))
    ex = ', '.join(f'`{n}`' for k, n, _, _ in f['exports'] if k in ('fn','const'))
    W(f"| `{os.path.basename(f['path'])}` | {f['loc']:,} | {len(users(f))} | {ex} | {', '.join(deps) or '—'} | {f['header'] or '⚠️ 無說明'} |")
W('')

# ---------- Section 4: utils
W('## 4. Util 層（純函數，優先複用）')
W('')
for f in r['utils']:
    ex = [e for e in f['exports'] if e[0] in ('fn','const')]
    W(f"### `{f['path']}` （{f['loc']} 行，{len(users(f))} 處引用）")
    if f['header']: W(f"> {f['header']}")
    W('')
    if ex:
        W('| 函數 | 行 | 說明 |')
        W('|---|---|---|')
        for _, n, doc, ln in ex:
            W(f'| `{n}` | {ln} | {doc} |')
    W('')

# ---------- Section 5: UI
W('## 5. UI 元件庫（`components/ui/`，寫新 UI 前必查）')
W('')
W('| 元件檔 | 行數 | 引用 | Export |')
W('|---|---|---|---|')
for f in r['ui']:
    ex = ', '.join(f'`{n}`' for k, n, _, _ in f['exports'] if k in ('fn','const','class'))
    W(f"| `{os.path.basename(f['path'])}` | {f['loc']} | {len(users(f))} | {ex or '—'} |")
W('')
W('## 6. 共用業務元件（`components/shared/`）')
W('')
W('| 檔案 | 行數 | Export |')
W('|---|---|---|')
for f in r['shared']:
    ex = ', '.join(f'`{n}`' for k, n, _, _ in f['exports'] if k in ('fn','const','class'))
    W(f"| `{f['path'].replace('components/shared/','')}` | {f['loc']} | {ex or '—'} |")
W('')
W('## 7. Context 與 Cloud Functions')
W('')
W('| 檔案 | 行數 | Export | 說明 |')
W('|---|---|---|---|')
for f in r['contexts'] + r['functions']:
    ex = ', '.join(f'`{n}`' for k, n, _, _ in f['exports'] if k in ('fn','const','class'))
    W(f"| `{f['path']}` | {f['loc']} | {ex or '—'} | {f['header'] or '⚠️ 無說明'} |")
W('')

# ---------- Section 8: doc debt
nodoc = [f['path'] for g in ['services','hooks','utils'] for f in r[g] if not f['header']]
W('## 8. 文件債：缺少檔頭說明的檔案')
W('')
W(f'共 {len(nodoc)} 個。請在檔案第一行補上 `/** 一句話說明此檔案職責 */`，下次重新生成時就會自動帶入本文件。')
W('')
W(', '.join(f'`{p}`' for p in nodoc))
W('')
open(os.path.join(ROOT, 'CAPABILITIES.md'),'w',encoding='utf-8',newline='\n').write('\n'.join(out))
print(len(out), 'lines', len(nodoc), 'nodoc', sum(len([e for e in f['exports'] if e[0]=='method']) for f in r['services']), 'methods')
