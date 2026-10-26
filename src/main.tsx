import React, { StrictMode, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RootErrorBoundary pegou um erro:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
          padding: "24px",
          boxSizing: "border-box"
        }}>
          <div style={{
            maxWidth: "700px",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ margin: "0 0 12px 0", color: "#b91c1c", fontSize: "18px", fontWeight: "bold" }}>
              ⚠️ Erro de Renderização na Aplicação
            </h2>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#475569" }}>
              Ocorreu uma falha inesperada ao exibir esta tela. Os detalhes do diagnóstico estão abaixo:
            </p>
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "4px",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#991b1b",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              maxHeight: "200px",
              overflowY: "auto",
              marginBottom: "16px"
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("cont_ai_default_workspace_v1");
                  window.location.reload();
                }}
                style={{
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#334155"
                }}
              >
                Voltar ao Início (Launcher)
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#005a9e",
                  border: "1px solid #004578",
                  color: "#ffffff",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Recarregar Aplicação
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
