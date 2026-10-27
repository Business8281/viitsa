import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home, Sparkles } from 'lucide-react';
import { clearAllViitsaCaches } from '../lib/cacheCleaner';

interface Props {
  children: ReactNode;
  sectionName?: string;
  fallbackUrl?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SectionErrorBoundary:${this.props.sectionName || 'Section'}] caught error:`, error, errorInfo);
    if (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ) {
      window.location.reload();
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const section = this.props.sectionName || 'This Page';
      const fallbackUrl = this.props.fallbackUrl || '/';

      return (
        <div className="w-full py-10 px-4 flex justify-center">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-red-100 p-6 sm:p-8 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Unable to load {section}
            </h3>
            <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
              An unexpected error occurred while rendering this section. Other parts of the platform remain fully operational.
            </p>
            {this.state.error?.message && (
              <div className="bg-red-50/70 border border-red-100 rounded-lg p-2.5 mb-5 text-left text-xs font-mono text-red-700 max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={this.resetError}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} /> Retry
              </button>
              <button
                onClick={async () => {
                  this.resetError();
                  await clearAllViitsaCaches({ reload: true });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} /> Clear Cache
              </button>
              <button
                onClick={() => {
                  this.resetError();
                  window.location.href = fallbackUrl;
                }}
                className="w-full sm:w-auto px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Home size={13} /> Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
