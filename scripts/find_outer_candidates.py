# 기존 카탈로그 데이터에서 아우터로 재분류 가능한 항목을 찾습니다.
import re
from collections import Counter

path = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

# subcategory가 재킷/코트/가디건인 항목 중 category가 상의인 것 찾기
outer_subcats = {'재킷', '코트', '가디건', '케이프'}
reclassifiable = []
for line in lines:
    m_cat = re.search(r'category: "([^"]+)" as const', line)
    m_sub = re.search(r'subcategory: "([^"]+)"', line)
    m_id = re.search(r'catalogItemId: "([^"]+)"', line)
    if m_cat and m_sub and m_id:
        cat = m_cat.group(1)
        sub = m_sub.group(1)
        cid = m_id.group(1)
        if cat == '상의' and sub in outer_subcats:
            reclassifiable.append((cid, sub))

print(f'아우터 재분류 후보: {len(reclassifiable)}개')
for cid, sub in reclassifiable[:10]:
    print(f'  {cid}: {sub}')
