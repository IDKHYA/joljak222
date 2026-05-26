# trainingCatalog.ts에서 중복 catalogItemId 항목을 제거합니다.
import re

path = r'C:\Users\dheod\Downloads\lastbose\통합_퍼컬_옷장\.claude\worktrees\priceless-lamarr-895d68\src\data\trainingCatalog.ts'

with open(path, encoding='utf-8') as f:
    lines = f.readlines()

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

print(f'제거된 중복: {removed}개')
print(f'총 항목 수: {len(seen_ids)}')
print('완료.')
