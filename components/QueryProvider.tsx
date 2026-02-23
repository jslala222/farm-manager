"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // [bkit 엔터프라이즈 설계]
                        staleTime: 60 * 1000, // 1분간 데이터 신선도 유지
                        gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
                        retry: 3, // 에러 발생 시 3번 자동 재시도 (1,000개 농장을 위한 안정성)
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 지수 백오프 적용
                        refetchOnWindowFocus: true, // 창을 다시 띄울 때 최신 정보로 갱신
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
