"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { initialize } = useAuthStore();
    useEffect(() => { initialize(); }, []);
    return <>{children}</>;
}
