/*
 * separator.tsx
 *
 * 화면 안에서 관련 정보 그룹을 시각적으로 구분하는 공용 Separator 컴포넌트입니다.
 * 카드 내부의 섹션, 설정 항목, 상세 정보 블록을 나눌 때 일관된 구분선을 제공하기 위한 UI 보조 파일입니다.
 */
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
