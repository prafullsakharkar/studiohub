import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/core/logging/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackRender?: (error: Error, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
  isModuleLevel?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary', `Uncaught exception in React component tree: ${error.message}`, {
      error,
      componentStack: errorInfo.componentStack,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKeys) {
      if (prevProps.resetKeys !== this.props.resetKeys) {
        this.handleReset();
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(this.state.error, this.handleReset);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.isModuleLevel) {
        return (
          <div
            id="module-error-boundary"
            className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-center max-w-lg mx-auto space-y-4 my-6 shadow-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Module Render Error</h3>
              <p className="text-xs text-slate-400">
                This component encountered a rendering error and could not be displayed.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95"
                onClick={this.handleReset}
              >
                Try Again
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="inline-block text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
                APPLICATION ERROR
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white pt-1">Something went wrong</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                StudioHub encountered an unexpected render issue. You can try recovering or reloading the studio interface.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95"
                onClick={this.handleReset}
              >
                Try Recovering
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 rounded-lg px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50 active:scale-95"
                onClick={this.handleReload}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Studio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
