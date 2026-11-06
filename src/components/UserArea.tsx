import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Link2, LogOut } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LANGS, LANG_LABELS } from '../i18n/translations';
import type { ChangePasswordResult } from '../hooks/useAuth';
import type { AppUser } from '../types';
import { Button, cx } from './ui/Button';
import { Field, Input } from './ui/Field';
import { Avatar, displayNameOf } from './Avatar';
import { Wordmark } from './Wordmark';
import styles from './UserArea.module.css';

interface UserAreaProps {
  user: AppUser;
  isLocal: boolean;
  obrasCount: number;
  isDark: boolean;
  onToggleTheme: () => void;
  sharing: boolean;
  shareLink: string;
  shareBusy: boolean;
  onEnableShare: () => void;
  onDisableShare: () => void;
  onUpdateName: (name: string) => Promise<boolean>;
  onChangePassword: (pwd: string) => Promise<ChangePasswordResult>;
  onResetPassword: (email: string) => Promise<boolean>;
  onLogout: () => void;
  onClose: () => void;
}

function Section({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description && <p className={styles.sectionDesc}>{description}</p>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

/** Controle segmentado (idioma, tema). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cx(styles.segment, value === o.value && styles.segmentActive)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Msg = { tone: 'ok' | 'err' | 'reauth'; text: string } | null;

export default function UserArea(props: UserAreaProps) {
  const { user, isLocal, obrasCount, isDark, onToggleTheme, sharing, shareLink, shareBusy } = props;
  const { t, lang, setLang } = useI18n();

  const name = displayNameOf(user, t('user_fallback'));
  const isPasswordUser = Boolean(user.providerData?.some((p) => p.providerId === 'password'));
  const isGoogleUser = Boolean(user.providerData?.some((p) => p.providerId === 'google.com'));

  // Apelido
  const [apelido, setApelido] = useState(user.displayName ?? '');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const nameChanged = apelido.trim() !== (user.displayName ?? '').trim();

  async function saveApelido(e: FormEvent) {
    e.preventDefault();
    if (!apelido.trim() || !nameChanged || nameStatus === 'saving') return;
    setNameStatus('saving');
    const ok = await props.onUpdateName(apelido);
    setNameStatus(ok ? 'saved' : 'idle');
    if (ok) window.setTimeout(() => setNameStatus('idle'), 2000);
  }

  // Link
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem clipboard: o campo é selecionável */
    }
  }

  // Senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  async function changePwd(e: FormEvent) {
    e.preventDefault();
    if (pwdBusy) return;
    if (novaSenha.length < 6) return setPwdMsg({ tone: 'err', text: t('ua_pwd_min6_err') });
    if (novaSenha !== confirma) return setPwdMsg({ tone: 'err', text: t('ua_pwd_mismatch') });
    setPwdBusy(true);
    setPwdMsg(null);
    const res = await props.onChangePassword(novaSenha);
    setPwdBusy(false);
    if (res.ok) {
      setPwdMsg({ tone: 'ok', text: t('ua_pwd_ok') });
      setNovaSenha('');
      setConfirma('');
    } else if (res.reauth) {
      setPwdMsg({ tone: 'reauth', text: t('ua_pwd_reauth') });
    } else {
      setPwdMsg({ tone: 'err', text: t(res.messageKey) || t('ua_pwd_fail') });
    }
  }

  async function sendResetEmail() {
    if (!user.email) return;
    const ok = await props.onResetPassword(user.email);
    setPwdMsg({ tone: ok ? 'ok' : 'err', text: ok ? t('ua_reset_sent') : t('ua_reset_fail') });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Button variant="ghost" onClick={props.onClose} icon={<ArrowLeft />}>
            {t('ua_back')}
          </Button>
          <Wordmark />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.profile}>
          <Avatar user={user} size={72} />
          <div className={styles.profileText}>
            <p className={styles.eyebrow}>{t('ua_title')}</p>
            <h1 className={styles.name}>{isLocal ? t('local_mode') : name}</h1>
            <p className={styles.meta}>
              {user.email && <span>{user.email}</span>}
              <span className={styles.mono}>
                {obrasCount === 1 ? t('ua_stat_one', { n: 1 }) : t('ua_stat_many', { n: obrasCount })}
              </span>
            </p>
          </div>
        </div>

        {isLocal && <p className={styles.notice}>{t('ua_local_note')}</p>}

        {!isLocal && (
          <Section title={t('ua_personal_data')}>
            <form className={styles.inline} onSubmit={saveApelido}>
              <Field label={t('ua_nickname_label')} hint={t('ua_nickname_hint')} className={styles.grow}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={apelido}
                    onChange={(e) => setApelido(e.target.value)}
                    placeholder={t('ua_nickname_placeholder')}
                    maxLength={40}
                    autoComplete="nickname"
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="primary"
                className={styles.inlineBtn}
                loading={nameStatus === 'saving'}
                disabled={!apelido.trim() || (!nameChanged && nameStatus !== 'saved')}
                icon={nameStatus === 'saved' ? <Check /> : undefined}
              >
                {nameStatus === 'saved' ? t('saved') : t('save')}
              </Button>
            </form>
          </Section>
        )}

        {!isLocal && (
          <Section title={t('ua_share_title')} description={sharing ? t('ua_share_active') : t('ua_share_off')}>
            {sharing ? (
              <div className={styles.stack}>
                <Field label={t('ua_share_link_label')}>
                  {({ id }) => (
                    <div className={styles.linkRow}>
                      <Input id={id} value={shareLink} readOnly onFocus={(e) => e.target.select()} className={styles.mono} />
                      <Button variant="primary" onClick={copyLink} icon={copied ? <Check /> : <Copy />}>
                        {copied ? t('copied') : t('copy')}
                      </Button>
                    </div>
                  )}
                </Field>
                <div className={styles.row}>
                  <a className={styles.textLink} href={shareLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" />
                    {t('ua_open_link')}
                  </a>
                  <Button variant="danger" size="sm" onClick={props.onDisableShare} loading={shareBusy}>
                    {t('ua_stop_sharing')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" onClick={props.onEnableShare} loading={shareBusy} icon={<Link2 />}>
                {shareBusy ? t('ua_generating') : t('ua_generate_link')}
              </Button>
            )}
          </Section>
        )}

        {isPasswordUser && (
          <Section title={t('ua_security')}>
            <form className={styles.stack} onSubmit={changePwd}>
              <div className={styles.grid2}>
                <Field label={t('ua_new_password')} hint={t('password_hint')}>
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      autoComplete="new-password"
                    />
                  )}
                </Field>
                <Field label={t('ua_confirm_password')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      type="password"
                      value={confirma}
                      onChange={(e) => setConfirma(e.target.value)}
                      autoComplete="new-password"
                    />
                  )}
                </Field>
              </div>
              <div>
                <Button type="submit" variant="secondary" loading={pwdBusy} disabled={!novaSenha}>
                  {pwdBusy ? t('ua_changing') : t('ua_change_password')}
                </Button>
              </div>
              {pwdMsg && (
                <div className={cx(styles.msg, pwdMsg.tone === 'err' ? styles.msgErr : styles.msgOk)} role={pwdMsg.tone === 'err' ? 'alert' : 'status'}>
                  <p>{pwdMsg.text}</p>
                  {pwdMsg.tone === 'reauth' && (
                    <Button variant="secondary" size="sm" onClick={sendResetEmail}>
                      {t('ua_send_reset')}
                    </Button>
                  )}
                </div>
              )}
            </form>
          </Section>
        )}

        {isGoogleUser && !isPasswordUser && (
          <Section title={t('ua_security')} description={t('ua_google_security')}>
            {null}
          </Section>
        )}

        <Section title={t('ua_language')}>
          <Segmented
            label={t('ua_language')}
            value={lang}
            onChange={setLang}
            options={LANGS.map((l) => ({ value: l, label: LANG_LABELS[l].name }))}
          />
        </Section>

        <Section title={t('ua_appearance')}>
          <Segmented
            label={t('ua_appearance')}
            value={isDark ? 'dark' : 'light'}
            onChange={(v) => {
              if ((v === 'dark') !== isDark) onToggleTheme();
            }}
            options={[
              { value: 'light', label: t('ua_theme_light') },
              { value: 'dark', label: t('ua_theme_dark') },
            ]}
          />
        </Section>

        {!isLocal && (
          <div className={styles.logout}>
            <Button variant="ghost" onClick={props.onLogout} icon={<LogOut />}>
              {t('ua_logout')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
