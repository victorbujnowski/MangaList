// Roda antes do React: aplica o tema salvo (ou o do sistema) no <html> para o
// primeiro paint já sair com as cores certas. Mesma chave do hook useTheme.
try {
  var t = localStorage.getItem('mangalist:theme');
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  /* localStorage bloqueado: fica o padrão do CSS */
}
