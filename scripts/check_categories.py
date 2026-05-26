# 카탈로그 카테고리 분포를 출력합니다.
import re
from collections import Counter

path = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'
with open(path, encoding='utf-8') as f:
    content = f.read()

cats = re.findall(r'category: "([^"]+)" as const', content)
print('카테고리 분포:', dict(Counter(cats)))

subcats = re.findall(r'subcategory: "([^"]+)"', content)
from itertools import islice
outer_items = [m for m in re.finditer(r'category: "아우터" as const.*?subcategory: "([^"]+)"', content)]
print(f'아우터 총합: {len(outer_items)}개')
