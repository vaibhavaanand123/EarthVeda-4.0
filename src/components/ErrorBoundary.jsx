import { Component } from 'react';

/** Last-resort fallback. Bilingual on purpose: it renders outside the i18n context. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Hook an error tracker (e.g. Sentry) here.
    console.error('Storefront crashed', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page container empty">
        <h1>Die Seite konnte nicht geladen werden · This page did not load</h1>
        <p>Dein Warenkorb ist gespeichert. · Your bag is saved.</p>
        <button className="btn btn--ink" type="button" onClick={() => window.location.reload()}>
          Neu laden · Reload
        </button>
      </main>
    );
  }
}
