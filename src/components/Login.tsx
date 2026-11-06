import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Globe } from 'lucide-react';
import { fetchPopularCovers } from '../lib/cover';
import { useI18n } from '../i18n/I18nContext';
import { LANGS, LANG_LABELS } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';
import { Button, cx } from './ui/Button';
import { Field, Input } from './ui/Field';
import { Wordmark } from './Wordmark';
import styles from './Login.module.css';

const MOSAIC = 24;

type Mode = 'login' | 'register' | 'reset';

interface LoginProps {
  onGoogle: () => Promise<boolean>;
  onEmailLogin: (email: string, password: string) => Promise<boolean>;
  onEmailRegister: (email: string, password: string, name: string) => Promise<boolean>;
  onResetPassword: (email: string) => Promise<boolean>;
  error: TranslationKey | null;
  clearError: () => void;
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.83.86-3.06.86a5.34 5.34 0 0 1-5.02-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.02 2.33A5.34 5.34 0 0 1 9 3.58z" />
    </svg>
  );
}

/** Mosaico de capas populares do MangaDex, atrás da manchete. */
function Mosaic({ covers }: { covers: string[] }) {
  return (
    <div className={styles.mosaic} aria-hidden="true">
      {Array.from({ length: MOSAIC }, (_, i) => (
        <MosaicCell key={i} url={covers.length ? covers[i % covers.length] : undefined} index={i} />
      ))}
    </div>
  );
}

function MosaicCell({ url, index }: { url?: string; index: number }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={styles.cell} style={{ animationDelay: `${(index % 6) * 70}ms` }}>
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={cx(styles.cellImg, loaded && styles.cellLoaded)}
          onLoad={() => setLoaded(true)}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
    </div>
  );
}

export default function Login({ onGoogle, onEmailLogin, onEmailRegister, onResetPassword, error, clearError }: LoginProps) {
  const { t, lang, setLang } = useI18n();
  const [covers, setCovers] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPopularCovers(MOSAIC).then((urls) => alive && setCovers(urls));
    return () => {
      alive = false;
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setInfo('');
    clearError();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setInfo('');
    setBusy('email');
    try {
      if (mode === 'login') await onEmailLogin(email, senha);
      else if (mode === 'register') await onEmailRegister(email, senha, nome);
      else if (await onResetPassword(email)) setInfo(t('login_reset_info'));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setBusy('google');
    try {
      await onGoogle();
    } finally {
      setBusy(null);
    }
  }

  function cycleLang() {
    const i = LANGS.indexOf(lang);
    setLang(LANGS[(i + 1) % LANGS.length] ?? 'en');
  }

  return (
    <div className={styles.page}>
      {/* Vitrine: manchete sobre o mosaico de capas */}
      <section className={styles.showcase}>
        <Mosaic covers={covers} />
        <div className={styles.showcaseShade} aria-hidden="true" />
        <div className={styles.showcaseTop}>
          <Wordmark size="lg" />
        </div>
        <div className={styles.showcaseCopy}>
          <p className={styles.eyebrow}>{t('login_eyebrow')}</p>
          <h1 className={styles.headline}>
            <span className={styles.headlineLine}>{t('login_title_pre')}</span>{' '}
            <span className={styles.headlineLine}>
              <em>{t('login_title_em')}</em>
              {t('login_title_post')}
            </span>
          </h1>
          <p className={styles.sub}>{t('login_sub')}</p>
          <ol className={styles.points}>
            {(['login_bullet_1', 'login_bullet_2', 'login_bullet_3'] as const).map((k, i) => (
              <li key={k}>
                <span className={styles.pointNum}>{String(i + 1).padStart(2, '0')}</span>
                {t(k)}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Formulário */}
      <section className={styles.formSide}>
        <div className={styles.formTop}>
          <button type="button" className={styles.lang} onClick={cycleLang} aria-label={`${t('ua_language')}: ${LANG_LABELS[lang].name}`}>
            <Globe aria-hidden="true" />
            {LANG_LABELS[lang].short}
          </button>
        </div>

        <div className={styles.formWrap} key={mode}>
          <header className={styles.formHead}>
            <h2>{t(`login_head_${mode}_h`)}</h2>
            <p>{t(`login_head_${mode}_p`)}</p>
          </header>

          {mode !== 'reset' && (
            <>
              <Button variant="secondary" size="lg" block onClick={handleGoogle} loading={busy === 'google'} disabled={busy === 'email'} icon={<GoogleLogo />}>
                {t('login_google')}
              </Button>
              <div className={styles.divider}>
                <span>{t('login_divider')}</span>
              </div>
            </>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <Field label={t('field_name')}>
                {({ id }) => <Input id={id} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />}
              </Field>
            )}

            <Field label={t('field_email')}>
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              )}
            </Field>

            {mode !== 'reset' && (
              <Field
                label={t('field_password')}
                hint={mode === 'register' ? t('password_hint') : undefined}
                aside={
                  mode === 'login' ? (
                    <button type="button" className={styles.link} onClick={() => switchMode('reset')}>
                      {t('forgot_password')}
                    </button>
                  ) : undefined
                }
              >
                {({ id, describedBy }) => (
                  <div className={styles.pwdWrap}>
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      type={showPwd ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className={styles.eye}
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label={showPwd ? t('hide_password') : t('show_password')}
                      aria-pressed={showPwd}
                    >
                      {showPwd ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                )}
              </Field>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {t(error)}
              </p>
            )}
            {info && (
              <p className={styles.info} role="status">
                {info}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={busy === 'email'}
              disabled={busy === 'google'}
              iconRight={<ArrowRight />}
            >
              {t(`login_submit_${mode}`)}
            </Button>
          </form>

          <p className={styles.switch}>
            {mode === 'login' && (
              <>
                {t('no_account')}{' '}
                <button type="button" className={styles.linkStrong} onClick={() => switchMode('register')}>
                  {t('create_account_free')}
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                {t('have_account')}{' '}
                <button type="button" className={styles.linkStrong} onClick={() => switchMode('login')}>
                  {t('sign_in')}
                </button>
              </>
            )}
            {mode === 'reset' && (
              <button type="button" className={styles.linkStrong} onClick={() => switchMode('login')}>
                <ArrowLeft aria-hidden="true" />
                {t('back_to_login')}
              </button>
            )}
          </p>
        </div>

        <footer className={styles.foot}>© {new Date().getFullYear()} MangaList</footer>
      </section>
    </div>
  );
}
