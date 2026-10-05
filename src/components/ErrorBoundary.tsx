import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error de interfaz", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal-error"><section className="panel"><p className="eyebrow">La aplicación sigue disponible</p><h1>No se pudo mostrar esta pantalla</h1><p>Se ha producido un error al representar los datos. Recarga la vista; los cambios ya guardados no se perderán.</p><details><summary>Detalle técnico</summary><code>{this.state.error.message}</code></details><button className="primary" onClick={() => window.location.reload()}>Recargar aplicación</button></section></main>;
  }
}
