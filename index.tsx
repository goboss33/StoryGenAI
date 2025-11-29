import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    constructor(props: ErrorBoundaryProps) {
        super(props);
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20, color: 'red', fontFamily: 'monospace' }}>
                    <h1>Something went wrong.</h1>
                    <h3 style={{ color: 'black' }}>{this.state.error?.toString()}</h3>
                    <pre style={{ backgroundColor: '#eee', padding: 10, overflow: 'auto' }}>
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }

        // @ts-ignore
        return this.props.children;
    }
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
