// 여러 화면이 공유하는 작은 표시용 UI 컴포넌트 모음
/*
 * common.tsx
 *
 * 제목 헤더, 통계 카드, 정보 박스, 색상 칩처럼 도메인 로직 없이 props만 받아 표시하는
 * 재사용 UI 컴포넌트를 모아둡니다. 홈/옷장/추천/퍼스널/가상착용 화면이 공통으로 import합니다.
 */
import React from 'react';
import { ArrowLeft } from 'lucide-react';

// 각 화면 상단의 제목 + 설명 + 아이콘 헤더입니다.
export function PageTitle({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return <div className="section-title">{icon}<div><h1>{title}</h1><p>{description}</p></div></div>;
}

// 라벨/값 한 쌍을 작은 통계 카드로 보여줍니다.
export function StatCard({ label, value }: { label: string; value: string }) {
  return <section className="stat-card"><span>{label}</span><strong>{value}</strong></section>;
}

// 뒤로가기 버튼이 있는 상세 화면 제목입니다. 우측에 추가 액션을 둘 수 있습니다.
export function BackTitle({ title, description, onBack, right }: { title: string; description: string; onBack: () => void; right?: React.ReactNode }) {
  return <div className="back-title"><button className="round-back" type="button" onClick={onBack}><ArrowLeft size={18} /></button><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{right && <div className="back-title-right">{right}</div>}</div>;
}

// 패널 영역의 소제목입니다.
export function PanelTitle({ title }: { title: string }) {
  return <h2 className="panel-title">{title}</h2>;
}

// 설명 문장, 태그, 색상칩을 한 박스에 묶어 보여주는 정보 컴포넌트입니다.
export function InfoBox({ title, body, chips, colors }: { title: string; body: string; chips?: string[]; colors?: string[] }) {
  return (
    <section className="info-box">
      <h3>{title}</h3>
      {body.split('\n').map((line) => <p key={line}>{line}</p>)}
      {chips && <div className="result-pill-row">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>}
      {colors && <ColorTileGrid colors={colors} compact />}
    </section>
  );
}

// 점수/개수 같은 핵심 수치를 한 줄로 강조하는 컴포넌트입니다.
export function MetricBox({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <section className="metric-box">
      <small>{title}</small>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </section>
  );
}

// HEX 팔레트를 색상 타일 그리드로 표시합니다.
export function ColorTileGrid({ colors, compact }: { colors: string[]; compact?: boolean }) {
  return (
    <div className={compact ? 'color-tile-grid compact' : 'color-tile-grid'}>
      {colors.map((hex, idx) => <span key={`${hex}-${idx}`}><i style={{ backgroundColor: hex }} /><small>{hex}</small></span>)}
    </div>
  );
}

// 데이터가 없을 때 안내 문구와 액션 버튼을 보여주는 빈 상태 컴포넌트입니다.
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <section className="panel empty-state"><h2>{title}</h2><p>{description}</p>{action}</section>;
}

// HEX 색상을 작은 원형 칩으로 보여주는 컴포넌트입니다.
export function Chip({ hex, label, large }: { key?: React.Key; hex: string; label?: string; large?: boolean }) {
  return <span className={large ? 'color-chip large' : 'color-chip'} title={label} style={{ backgroundColor: hex }}>{label && <small>{label}</small>}</span>;
}
