"use client";

import React from "react";

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-lg font-semibold text-red-700 mb-2">오류가 발생했습니다</h2>
                        <p className="text-sm text-red-600 mb-4">
                            {this.state.error?.message || "알 수 없는 오류"}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                        >
                            다시 시도
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
