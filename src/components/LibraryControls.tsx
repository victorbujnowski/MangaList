import { useRef, type CSSProperties } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Button, cx } from './ui/Button';
import styles from './LibraryControls.module.css';

export interface FilterOption {
  key: string;
  label: string;
  count: number;
  /** Cor do marcador (status). */
  color?: string;
}

/**
 * Abas de status: texto com contagem e um filete sob a ativa, como as seções
 * de uma revista. São filtros (aria-pressed), não abas de conteúdo.
 */
export function StatusTabs({
  items,
  active,
  onChange,
  label,
}: {
  items: FilterOption[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div className={styles.tabsScroller}>
      <div className={styles.tabs} role="group" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx(styles.tab, active === item.key && styles.tabActive)}
            aria-pressed={active === item.key}
            onClick={() => onChange(item.key)}
            style={item.color ? ({ '--dot': item.color } as CSSProperties) : undefined}
          >
            {item.color && <span className={styles.tabDot} aria-hidden="true" />}
            {item.label}
            <span className={styles.tabCount}>{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.search}>
      <Search className={styles.searchIcon} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder={t('search_placeholder')}
        aria-label={t('search_aria')}
        enterKeyHint="search"
      />
      {value && (
        <button
          type="button"
          className={styles.searchClear}
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
          aria-label={t('search_clear')}
        >
          <X />
        </button>
      )}
    </div>
  );
}

export function FiltersButton({
  open,
  activeCount,
  onClick,
  controls,
}: {
  open: boolean;
  activeCount: number;
  onClick: () => void;
  controls: string;
}) {
  const { t } = useI18n();
  return (
    <Button
      variant={open || activeCount > 0 ? 'primary' : 'secondary'}
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      icon={<SlidersHorizontal />}
      className={styles.filtersBtn}
    >
      <span className={styles.filtersLabel}>{t('filters')}</span>
      {activeCount > 0 && <span className={styles.filtersCount}>{activeCount}</span>}
    </Button>
  );
}

/** Grupo de chips de filtro (tipo, site). Some quando só há uma opção real. */
export function ChipGroup({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: FilterOption[];
  active: string;
  onChange: (key: string) => void;
}) {
  const visible = items.filter((i) => i.key === 'todos' || i.count > 0 || i.key === active);
  if (visible.length <= 2 && active === 'todos') return null;
  return (
    <fieldset className={styles.chipGroup}>
      <legend className={styles.chipLegend}>{label}</legend>
      <div className={styles.chips}>
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx(styles.chip, active === item.key && styles.chipActive)}
            aria-pressed={active === item.key}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            <span className={styles.chipCount}>{item.count}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
