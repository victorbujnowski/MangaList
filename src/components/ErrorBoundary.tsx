import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate, detectInitialLang } from '../i18n/I18nContext';

interface State {
  hasError: boolean;
}

/**
 * Captura erros de render para não deixar a tela em branco. Fica FORA do
 * I18nProvider (para pegar erros dele também), então resolve o idioma sozinho.
 * Usa só estilos inline e tokens: não depende de nenhum módulo que possa ter falhado.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MangaList] Erro de render:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const lang = detectInitialLang();
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          minHeight: '100dvh',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          MangaList
        </p>
        <h1 style={{ fontSize: 28, maxWidth: 420 }}>{translate(lang, 'error_generic')}</h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: 44,
            padding: '0 20px',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--paper)',
            background: 'var(--ink)',
            borderRadius: 4,
          }}
        >
          {translate(lang, 'reload')}
        </button>
      </div>
    );
  }
}
