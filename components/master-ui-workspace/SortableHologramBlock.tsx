'use client';

import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { type HologramBlock } from '../../lib/master-ui-workspace/model';

type Props = {
  block: HologramBlock;
  selected: boolean;
  dragging?: boolean;
  sortableEnabled: boolean;
  onSelect: (blockId: string) => void;
};

function transformToCss(transform: ReturnType<typeof useSortable>['transform']) {
  if (!transform) return undefined;
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function impactLabel(impact: HologramBlock['impact']) {
  if (impact === 'high') return 'High impact';
  if (impact === 'medium') return 'Medium impact';
  return 'Low impact';
}

export default function SortableHologramBlock({ block, selected, dragging = false, sortableEnabled, onSelect }: Props) {
  const disabled = !sortableEnabled || block.locked;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
    transition: {
      duration: 140,
      easing: 'cubic-bezier(.2, .8, .2, 1)'
    }
  });

  const style: CSSProperties = {
    transform: transformToCss(transform),
    transition
  };

  return <article
    ref={setNodeRef}
    style={style}
    className={`hologram-block ${selected ? 'selected' : ''} ${dragging || isDragging ? 'dragging' : ''}`}
    data-theme-surface="card"
    data-impact={block.impact}
    data-block-id={block.id}
    data-block-region={block.region}
    onClick={() => onSelect(block.id)}
  >
    <div className="hologram-block-main">
      <p>{block.props.eyebrow || block.region}</p>
      <h4>{block.props.title || block.title}</h4>
      <span>{block.props.description || block.description}</span>
      <dl className="hologram-block-meta">
        <div><dt>Density</dt><dd>{block.props.density}</dd></div>
        <div><dt>Columns</dt><dd>{block.props.columns}</dd></div>
        <div><dt>Binding</dt><dd>{block.behavior.dataSource}</dd></div>
      </dl>
    </div>
    <aside>
      <span className="hologram-chip">{impactLabel(block.impact)}</span>
      <span className="hologram-chip">{block.status}</span>
      <span className={`hologram-chip ${block.locked ? 'locked' : ''}`}>{block.locked ? 'locked' : sortableEnabled ? 'drag handle' : 'draft block'}</span>
      <button
        className="hologram-drag-handle"
        type="button"
        disabled={disabled}
        aria-label={`Move ${block.title}`}
        {...attributes}
        {...listeners}
      >
        Move
      </button>
    </aside>
  </article>;
}
