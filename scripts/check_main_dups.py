# 메인 프로젝트 trainingCatalog.ts 중복 ID 확인 및 제거
import re

path = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\src\data\trainingCatalog.ts'

with open(path, encoding='utf-8') as f:
    lines = f.readlines()

seen = {}
for line in lines:
    m = re.search(r'catalogItemId: "([^"]+)"', line)
    if m:
        cid = m.group(1)
        seen[cid] = seen.get(cid, 0) + 1

dups = {k: v for k, v in seen.items() if v > 1}
print(f'총 항목: {len(seen)}, 중복: {len(dups)}')
for k, v in list(dups.items())[:10]:
    print(f'  {k}: {v}번')

if dups:
    seen_ids = set()
    deduped = []
    removed = 0
    for line in lines:
        m = re.search(r'catalogItemId: "([^"]+)"', line)
        if m:
            cid = m.group(1)
            if cid in seen_ids:
                removed += 1
                continue
            seen_ids.add(cid)
        deduped.append(line)
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(deduped)
    print(f'중복 {removed}개 제거 완료.')
