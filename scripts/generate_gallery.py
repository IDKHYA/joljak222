# public/catalog/ 이미지를 카테고리별로 정리한 정적 HTML 갤러리를 생성합니다.
# 외부 JSON 라벨 데이터를 읽어 human_label 미분류 필터, 파일별 보기를 지원합니다.
import re
import sys
import json
import webbrowser
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
CATALOG_FILES = {
    "trainingCatalog.ts": ROOT / "src/data/trainingCatalog.ts",
    "outerCatalog.ts":    ROOT / "src/data/outerCatalog.ts",
}
OUT_HTML = ROOT / "public/catalog/gallery.html"

# 외부 JSON 라벨 루트 (모든 _json 폴더를 재귀 탐색)
LABEL_ROOT = Path(r"C:\Users\dheod\Documents\ForMe\project_image_model\이미지 데이터")

CATEGORY_ORDER = ["상의", "하의", "아우터", "신발", "액세서리"]

# --- 파싱 ---
def _field(line: str, key: str) -> str:
    m = re.search(rf'{key}:\s*"([^"]*)"', line)
    return m.group(1) if m else ""

def parse_catalog():
    items = []
    for fname, path in CATALOG_FILES.items():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "catalogItemId:" not in line:
                continue
            cid = _field(line, "catalogItemId")
            if not cid:
                continue
            items.append({
                "id":       cid,
                "name":     _field(line, "name"),
                "category": _field(line, "category"),
                "subcat":   _field(line, "subcategory"),
                "season":   _field(line, "seasonTag"),
                "img":      Path(_field(line, "imageUrl")).name,
                "source":   fname,          # 소속 TS 파일
                # 라벨 데이터 (아래에서 채움)
                "model_season":  None,
                "human_label":   None,      # None = 미분류, str = 분류됨
                "label_loaded":  False,
            })
    return items

def load_labels(items):
    """_json 폴더를 재귀 탐색해 id 매칭 후 라벨 주입."""
    label_map: dict[str, dict] = {}
    for json_path in LABEL_ROOT.rglob("*.json"):
        if json_path.name == "summary.json":
            continue
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            item_id = data.get("id") or json_path.stem
            label_map[item_id] = data
        except Exception:
            pass

    matched = 0
    for item in items:
        data = label_map.get(item["id"])
        if data:
            item["model_season"] = data.get("season")
            item["human_label"]  = data.get("human_label")  # None이면 미분류
            item["label_loaded"] = True
            matched += 1

    print(f"[INFO] 라벨 매칭 {matched}/{len(items)}개")
    return items

# --- HTML 생성 ---
def build_html(items):
    by_cat = defaultdict(list)
    for item in items:
        cat = item["category"] or "기타"
        by_cat[cat].append(item)

    ordered_cats = [c for c in CATEGORY_ORDER if c in by_cat]
    ordered_cats += [c for c in by_cat if c not in CATEGORY_ORDER]

    source_files = list(CATALOG_FILES.keys())
    # JSON 없는 것도 미분류로 취급 (human_label이 확정되지 않은 모든 항목)
    unlabeled_total = sum(1 for it in items if not it["human_label"])

    all_items_js = json.dumps(items, ensure_ascii=False, default=str)

    sections_html = ""
    idx = 0
    for cat in ordered_cats:
        cards = ""
        for it in by_cat[cat]:
            # human_label이 없으면 미분류 (JSON 없는 것도 포함)
            unlabeled_cls = "unlabeled" if not it["human_label"] else ""
            src_cls = f"src-{it['source'].replace('.', '-')}"

            if it["human_label"]:
                label_badge = f'<span class="badge badge-human">{it["human_label"]}</span>'
            else:
                label_badge = '<span class="badge badge-none">미분류</span>'

            cards += f"""
        <div class="card {unlabeled_cls} {src_cls}" data-idx="{idx}" data-name="{it['name']}" data-subcat="{it['subcat']}" data-season="{it['season']}" data-src="{it['source']}" data-unlabeled="{0 if it['human_label'] else 1}" onclick="openModal({idx})">
          <img src="{it['img']}" alt="{it['name']}" loading="lazy">
          {label_badge}
          <div class="info">
            <span class="name">{it['name']}</span>
            <span class="meta">{it['subcat']} · {it['season']}</span>
          </div>
        </div>"""
            idx += 1

        sections_html += f"""
      <section class="cat-section" data-cat="{cat}">
        <h2>{cat} <span class="cnt">{len(by_cat[cat])}</span></h2>
        <div class="grid">{cards}
        </div>
      </section>"""

    src_pill_html = "".join(
        f'<button class="pill src-pill" onclick="setSrc({repr(s)}, this)">{s}</button>'
        for s in source_files
    )

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>카탈로그 갤러리 — {len(items)}개</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #f7f7f8; color: #111; }}

  /* ── 헤더 ── */
  header {{ position: sticky; top: 0; z-index: 10; background: #fff;
            border-bottom: 1px solid #e5e5e5; padding: 10px 20px;
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
  header h1 {{ font-size: 15px; font-weight: 700; white-space: nowrap; }}
  header h1 span {{ color: #888; font-weight: 400; margin-left: 6px; }}

  .search {{ flex: 1; min-width: 140px; max-width: 280px;
             border: 1px solid #ddd; border-radius: 8px;
             padding: 6px 12px; font-size: 13px; outline: none; }}
  .search:focus {{ border-color: #333; }}

  .pill-row {{ display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }}
  .divider {{ width: 1px; height: 18px; background: #e0e0e0; }}

  .pill {{ border: 1px solid #ddd; border-radius: 20px; padding: 4px 12px;
           font-size: 12px; cursor: pointer; background: #fff; transition: .15s; }}
  .pill.active, .pill:hover {{ background: #111; color: #fff; border-color: #111; }}

  /* 미분류 필터 강조 */
  .pill.unlabeled-pill {{ border-color: #f59e0b; color: #92400e; }}
  .pill.unlabeled-pill.active {{ background: #f59e0b; border-color: #f59e0b; color: #fff; }}
  .pill.unlabeled-pill:hover {{ background: #fbbf24; border-color: #fbbf24; color: #fff; }}

  /* 파일 소스 pill */
  .src-pill {{ font-family: monospace; font-size: 11px; }}

  /* ── 그리드 ── */
  main {{ padding: 24px 20px; max-width: 1400px; margin: 0 auto; }}
  .cat-section {{ margin-bottom: 40px; }}
  .cat-section h2 {{ font-size: 18px; font-weight: 700; margin-bottom: 14px;
                     display: flex; align-items: baseline; gap: 8px; }}
  .cnt {{ font-size: 13px; color: #888; font-weight: 400; }}

  .grid {{ display: grid;
           grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
           gap: 10px; }}

  .card {{ background: #fff; border-radius: 10px; overflow: hidden;
           box-shadow: 0 1px 3px rgba(0,0,0,.08); cursor: pointer;
           transition: transform .15s, box-shadow .15s; position: relative; }}
  .card:hover {{ transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }}
  .card img {{ width: 100%; aspect-ratio: 1; object-fit: cover; display: block;
               background: #f0f0f0; }}
  .info {{ padding: 6px 8px 8px; }}
  .name {{ display: block; font-size: 11px; font-weight: 600;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .meta {{ display: block; font-size: 10px; color: #999; margin-top: 2px;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}

  /* 라벨 뱃지 */
  .badge {{ position: absolute; top: 6px; left: 6px; border-radius: 4px;
            font-size: 10px; font-weight: 700; padding: 2px 6px; }}
  .badge-human {{ background: #d1fae5; color: #065f46; }}
  .badge-none  {{ background: #fef3c7; color: #92400e; }}

  /* 미분류 카드 테두리 강조 */
  .card.unlabeled {{ outline: 2px solid #fbbf24; }}

  /* ── 모달 ── */
  .modal-backdrop {{
    display: none; position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
    align-items: center; justify-content: center;
    animation: fadeIn .18s ease;
  }}
  .modal-backdrop.open {{ display: flex; }}

  @keyframes fadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
  @keyframes slideUp {{ from {{ transform: translateY(16px); opacity: 0; }}
                        to  {{ transform: translateY(0);    opacity: 1; }} }}

  .modal {{
    background: #fff; border-radius: 16px; overflow: hidden;
    display: flex; max-width: 820px; width: calc(100% - 40px);
    max-height: calc(100vh - 60px);
    box-shadow: 0 24px 60px rgba(0,0,0,.3);
    animation: slideUp .2s ease; position: relative;
  }}

  .modal-img-wrap {{
    flex: 0 0 360px; background: #f4f4f4;
    display: flex; align-items: center; justify-content: center;
  }}
  .modal-img-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}

  .modal-body {{
    flex: 1; padding: 28px 28px 24px; display: flex;
    flex-direction: column; overflow-y: auto; min-width: 0; gap: 10px;
  }}

  .modal-category {{ display: inline-block; background: #f0f0f0; border-radius: 20px;
                     padding: 3px 10px; font-size: 11px; color: #555; width: fit-content; }}
  .modal-name {{ font-size: 22px; font-weight: 700; line-height: 1.3; }}

  .modal-tags {{ display: flex; gap: 6px; flex-wrap: wrap; }}
  .tag {{ border: 1px solid #e0e0e0; border-radius: 6px;
          padding: 4px 10px; font-size: 12px; color: #444; }}

  /* 라벨 박스 */
  .label-box {{ background: #f8f8f8; border-radius: 8px; padding: 12px 14px;
                display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }}
  .label-row {{ display: flex; align-items: center; gap: 8px; font-size: 12px; }}
  .label-key {{ color: #888; min-width: 80px; }}
  .label-val {{ font-weight: 600; color: #111; }}
  .label-val.unlabeled {{ color: #d97706; }}
  .label-val.labeled   {{ color: #059669; }}

  .modal-source {{ font-size: 11px; color: #aaa; font-family: monospace;
                   background: #f8f8f8; border-radius: 6px;
                   padding: 6px 10px; word-break: break-all; }}
  .modal-source strong {{ color: #888; }}

  .modal-id {{ font-size: 11px; color: #aaa; font-family: monospace; }}

  .modal-close {{
    position: absolute; top: 12px; right: 14px;
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(0,0,0,.08); border: none; cursor: pointer;
    font-size: 16px; display: flex; align-items: center; justify-content: center;
    color: #444; transition: background .15s;
  }}
  .modal-close:hover {{ background: rgba(0,0,0,.18); }}

  .modal-nav {{
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 38px; height: 38px; border-radius: 50%;
    background: #fff; border: 1px solid #ddd; cursor: pointer;
    font-size: 18px; display: flex; align-items: center; justify-content: center;
    color: #333; box-shadow: 0 2px 8px rgba(0,0,0,.12);
    transition: box-shadow .15s; z-index: 101;
  }}
  .modal-nav:hover {{ box-shadow: 0 4px 14px rgba(0,0,0,.2); }}
  .modal-prev {{ left: -52px; }}
  .modal-next {{ right: -52px; }}

  @media (max-width: 600px) {{
    .modal {{ flex-direction: column; max-height: calc(100vh - 40px); }}
    .modal-img-wrap {{ flex: 0 0 220px; }}
    .modal-prev {{ left: 8px; top: 210px; transform: none; }}
    .modal-next {{ right: 8px; top: 210px; transform: none; }}
  }}

  .hidden {{ display: none !important; }}
  .empty-msg {{ grid-column: 1/-1; color: #999; font-size: 13px; padding: 20px 0; }}
</style>
</head>
<body>
<header>
  <h1>카탈로그 갤러리 <span>{len(items)}개</span></h1>
  <input class="search" type="search" placeholder="이름·소분류 검색..." oninput="applyFilter()">

  <div class="pill-row">
    <!-- 카테고리 -->
    <button class="pill active" onclick="setCat('전체', this)">전체</button>
    {"".join(f'<button class="pill" onclick="setCat({repr(c)}, this)">{c}</button>' for c in ordered_cats)}

    <div class="divider"></div>

    <!-- 소스 파일 -->
    {src_pill_html}

    <div class="divider"></div>

    <!-- 미분류 필터 -->
    <button class="pill unlabeled-pill" onclick="toggleUnlabeled(this)">
      미분류만 ({unlabeled_total})
    </button>
  </div>
</header>

<main>{sections_html}
</main>

<!-- 모달 -->
<div class="modal-backdrop" id="backdrop" onclick="handleBackdropClick(event)">
  <button class="modal-nav modal-prev" onclick="event.stopPropagation(); navigate(-1)">&#8592;</button>
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    <div class="modal-img-wrap">
      <img id="modal-img" src="" alt="">
    </div>
    <div class="modal-body">
      <span class="modal-category" id="modal-cat"></span>
      <div class="modal-name" id="modal-name"></div>
      <div class="modal-tags" id="modal-tags"></div>

      <div class="label-box">
        <div class="label-row">
          <span class="label-key">모델 예측</span>
          <span class="label-val" id="modal-model-season">—</span>
        </div>
        <div class="label-row">
          <span class="label-key">Human Label</span>
          <span class="label-val" id="modal-human-label">—</span>
        </div>
      </div>

      <div class="modal-source"><strong>파일</strong>&nbsp; <span id="modal-source"></span></div>
      <div class="modal-id"><strong>ID</strong>&nbsp; <span id="modal-id"></span></div>
    </div>
  </div>
  <button class="modal-nav modal-next" onclick="event.stopPropagation(); navigate(1)">&#8594;</button>
</div>

<script>
  const ALL_ITEMS = {all_items_js};
  let currentIdx = 0;
  let visibleIndices = [];
  let activeCat = '전체';
  let activeSrc = null;      // null = 전체
  let onlyUnlabeled = false;

  /* ── 카테고리 ── */
  function setCat(cat, btn) {{
    activeCat = cat;
    document.querySelectorAll('.pill:not(.src-pill):not(.unlabeled-pill)').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  }}

  /* ── 소스 파일 ── */
  function setSrc(src, btn) {{
    if (activeSrc === src) {{
      activeSrc = null;
      btn.classList.remove('active');
    }} else {{
      activeSrc = src;
      document.querySelectorAll('.src-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
    }}
    applyFilter();
  }}

  /* ── 미분류 토글 ── */
  function toggleUnlabeled(btn) {{
    onlyUnlabeled = !onlyUnlabeled;
    btn.classList.toggle('active', onlyUnlabeled);
    applyFilter();
  }}

  /* ── 필터 적용 ── */
  function applyFilter() {{
    const q = document.querySelector('.search').value.trim().toLowerCase();
    visibleIndices = [];

    document.querySelectorAll('.cat-section').forEach(sec => {{
      const cat = sec.dataset.cat;
      const showSec = activeCat === '전체' || activeCat === cat;
      if (!showSec) {{ sec.classList.add('hidden'); return; }}
      sec.classList.remove('hidden');

      let visible = 0;
      sec.querySelectorAll('.card').forEach(card => {{
        const text = (card.dataset.name + card.dataset.subcat + card.dataset.season).toLowerCase();
        const matchQ   = !q || text.includes(q);
        const matchSrc = !activeSrc || card.dataset.src === activeSrc;
        const matchUnl = !onlyUnlabeled || card.dataset.unlabeled === '1';
        const match = matchQ && matchSrc && matchUnl;
        card.classList.toggle('hidden', !match);
        if (match) {{ visible++; visibleIndices.push(+card.dataset.idx); }}
      }});

      let msg = sec.querySelector('.empty-msg');
      if (visible === 0) {{
        if (!msg) {{
          msg = document.createElement('p');
          msg.className = 'empty-msg';
          sec.querySelector('.grid').appendChild(msg);
        }}
        msg.textContent = '검색 결과 없음.';
      }} else if (msg) {{ msg.remove(); }}
    }});
  }}

  /* ── 모달 ── */
  function openModal(idx) {{
    currentIdx = idx;
    renderModal(idx);
    document.getElementById('backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }}

  function closeModal() {{
    document.getElementById('backdrop').classList.remove('open');
    document.body.style.overflow = '';
  }}

  function handleBackdropClick(e) {{
    if (e.target === document.getElementById('backdrop')) closeModal();
  }}

  function renderModal(idx) {{
    const it = ALL_ITEMS[idx];
    if (!it) return;
    document.getElementById('modal-img').src  = it.img;
    document.getElementById('modal-img').alt  = it.name;
    document.getElementById('modal-cat').textContent  = it.category;
    document.getElementById('modal-name').textContent = it.name;
    document.getElementById('modal-id').textContent   = it.id;
    document.getElementById('modal-source').textContent = it.source;

    const tags = document.getElementById('modal-tags');
    tags.innerHTML = '';
    [it.subcat, it.season].filter(Boolean).forEach(t => {{
      const span = document.createElement('span');
      span.className = 'tag'; span.textContent = t;
      tags.appendChild(span);
    }});

    const modelEl = document.getElementById('modal-model-season');
    modelEl.textContent = it.model_season || (it.label_loaded ? '—' : '데이터 없음');

    const hlEl = document.getElementById('modal-human-label');
    if (!it.label_loaded) {{
      hlEl.textContent = '데이터 없음';
      hlEl.className = 'label-val';
    }} else if (it.human_label) {{
      hlEl.textContent = it.human_label;
      hlEl.className = 'label-val labeled';
    }} else {{
      hlEl.textContent = '미분류';
      hlEl.className = 'label-val unlabeled';
    }}
  }}

  function navigate(dir) {{
    if (visibleIndices.length === 0) return;
    const pos = visibleIndices.indexOf(currentIdx);
    currentIdx = visibleIndices[(pos + dir + visibleIndices.length) % visibleIndices.length];
    renderModal(currentIdx);
  }}

  document.addEventListener('keydown', e => {{
    if (!document.getElementById('backdrop').classList.contains('open')) return;
    if (e.key === 'Escape')     closeModal();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  }});

  applyFilter();
</script>
</body>
</html>"""

if __name__ == "__main__":
    items = parse_catalog()
    items = load_labels(items)
    html  = build_html(items)
    OUT_HTML.write_text(html, encoding="utf-8")
    print(f"[OK] 생성 완료. {OUT_HTML}")
    print(f"     아이템 {len(items)}개")
    webbrowser.open(OUT_HTML.as_uri())
