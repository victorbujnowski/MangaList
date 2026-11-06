import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { AppUser } from '../types';
import styles from './Avatar.module.css';

export function displayNameOf(user: AppUser | null | undefined, fallback: string): string {
  return user?.displayName?.trim() || user?.email?.split('@')[0] || fallback;
}

/** Foto do perfil ou monograma em serifa (quando não há foto ou ela falha). */
export function Avatar({ user, size = 36 }: { user: AppUser; size?: number }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const name = displayNameOf(user, t('user_fallback'));
  const initials = name.slice(0, 2).toUpperCase();
  const dim = { width: size, height: size, fontSize: size * 0.4 };

  if (user.photoURL && !failed) {
    return (
      <img
        className={styles.avatar}
        style={dim}
        src={user.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={`${styles.avatar} ${styles.monogram}`} style={dim} aria-hidden="true">
      {initials}
    </span>
  );
}
