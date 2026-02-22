"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { RefreshCcw } from "lucide-react";

export default function DbStatus() {
    const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
    const [lastChecked, setLastChecked] = useState<Date>(new Date());
    const [isChecking, setIsChecking] = useState(false);

    const checkStatus = async () => {
        setIsChecking(true);
        try {
            // 간단한 하트비트 쿼리 (가장 가벼운 테이블 조회)
            const { error } = await supabase.from('farms').select('id').limit(1);
            if (error) throw error;
            setStatus('online');
        } catch (err) {
            console.error("[DB Status Check Failed]:", err);
            setStatus('offline');
        } finally {
            setLastChecked(new Date());
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 60000); // 1분마다 체크
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-gray-50 border border-gray-100 shadow-inner">
            <div className="relative flex h-2 w-2">
                {status === 'online' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-gray-300'
                    }`}></span>
            </div>

            <span className={`text-[9px] font-black uppercase tracking-tighter ${status === 'online' ? 'text-green-600' : status === 'offline' ? 'text-red-600' : 'text-gray-400'
                }`}>
                {status === 'online' ? 'Connected' : status === 'offline' ? 'Disconnected' : 'Checking...'}
            </span>

            <button
                onClick={checkStatus}
                disabled={isChecking}
                className={`p-1 hover:bg-white rounded-full transition-all ${isChecking ? 'animate-spin text-gray-400' : 'text-gray-300 hover:text-gray-600'}`}
                title={`Last checked: ${lastChecked.toLocaleTimeString()}`}
            >
                <RefreshCcw size={10} />
            </button>
        </div>
    );
}
