import { useEffect, useState } from 'react';
import { Moon, Plus, Sun } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { AppUser } from '../types';
import { Button, cx } from './ui/Button';
import { Wordmark } from './Wordmark';
import { Avatar } from './Avatar';
import styles from './Header.module.css';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onAdd: () => void;
  onOpenAccount: () => void;
  user: AppUser | null;
  isLocal: boolean;
}

export default function Header({ isDark, onToggleTheme, onAdd, onOpenAccount, user, isLocal }: HeaderProps) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  // O filete inferior só aparece depois que a página rola.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cx(styles.header, scrolled && styles.scrolled)}>
      <div className={styles.inner}>
        <a
          href="/"
          className={styles.brand}
          aria-label="MangaList"
          onClick={(e) => {
            // Sem recarregar: no modo local isso apagaria os dados em memória.
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Wordmark />
        </a>

        <div className={styles.actions}>
          {isLocal && <span className={styles.badge}>{t('local_mode')}</span>}

          <Button
            variant="ghost"
            iconOnly
            onClick={onToggleTheme}
            aria-label={isDark ? t('theme_light') : t('theme_dark')}
            title={isDark ? t('theme_light') : t('theme_dark')}
            icon={isDark ? <Sun /> : <Moon />}
          />

          <Button variant="primary" onClick={onAdd} icon={<Plus />} className={styles.add}>
            {t('header_add')}
          </Button>

          {user && (
            <button type="button" className={styles.avatarBtn} onClick={onOpenAccount} aria-label={t('account')} title={t('account')}>
              <Avatar user={user} size={36} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
