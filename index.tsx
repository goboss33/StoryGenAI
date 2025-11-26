import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
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

        return this.props.children;
    }
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
