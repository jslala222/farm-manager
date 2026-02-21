"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sprout, ShoppingCart, Users, Calculator } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { href: "/", label: "홈", icon: Home },
        { href: "/finance", label: "결산", icon: Calculator },
        { href: "/harvest", label: "수확", icon: Sprout },
        { href: "/sales", label: "판매", icon: ShoppingCart },
        { href: "/workers", label: "인력", icon: Users },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe-area shadow-lg z-[9999]">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? "text-red-600" : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            <item.icon className={`w-6 h-6 ${isActive ? "fill-current" : ""}`} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
