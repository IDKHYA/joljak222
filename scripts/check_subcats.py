# 카탈로그 소분류 분포를 확인합니다.
import re
from collections import Counter

path = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

cat_subcat = []
for line in lines:
    m_cat = re.search(r'category: "([^"]+)" as const', line)
    m_sub = re.search(r'subcategory: "([^"]+)"', line)
    if m_cat and m_sub:
        cat_subcat.append((m_cat.group(1), m_sub.group(1)))

from collections import defaultdict
by_cat = defaultdict(Counter)
for cat, sub in cat_subcat:
    by_cat[cat][sub] += 1

for cat, counter in sorted(by_cat.items()):
    print(f'\n[{cat}] 총 {sum(counter.values())}개')
    for sub, cnt in counter.most_common():
        print(f'  {sub}: {cnt}개')
