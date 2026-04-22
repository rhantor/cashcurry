"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, FileText, Pickaxe, LogOut, User } from "lucide-react";
import Cookies from "js-cookie";
import { auth } from "@/lib/firebase";

export default function StaffLayout({ children }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("user");
    Cookies.remove("isLoggedIn", { path: "/" });
    Cookies.remove("role", { path: "/" });
    Cookies.remove("companyId", { path: "/" });
    Cookies.remove("branchId", { path: "/" });
    window.location.href = "/login";
  };

  const navItems = [
    { label: "Home", href: "/staff-portal", icon: Home },
    { label: "Requests", href: "/requests", icon: FileText },
    { label: "Chat", href: "/chat", icon: MessageCircle },
    { label: "Profile", href: "/profile", icon: User },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="p-6 border-b border-gray-100">
           <div className="font-extrabold text-2xl text-blue-600 tracking-tight">Staff Portal</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(item => {
             const isActive = pathname === item.href;
             const Icon = item.icon;
             return (
               <Link 
                 key={item.href} 
                 href={item.href} 
                 className={`flex items-center gap-3 px-3 py-3 rounded-xl transition ${isActive ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
               >
                 <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                 <span>{item.label}</span>
               </Link>
             )
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
           <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl text-gray-500 font-medium hover:text-red-600 hover:bg-red-50 transition">
             <LogOut size={20}/> <span>Log out</span>
           </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm shrink-0 z-40">
          <div className="font-bold text-xl text-blue-600 tracking-tight">Work Media</div>
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-red-50 transition" title="Logout">
            <LogOut size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto relative w-full scroll-smooth">
          <div className="max-w-lg mx-auto md:max-w-3xl w-full pt-0 md:pt-8 md:px-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center pb-safe z-50 md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center py-3 px-4 w-full transition-all duration-200 ${isActive ? "text-blue-600 translate-y-[-2px]" : "text-gray-400 hover:text-gray-900"}`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "drop-shadow-sm" : ""} />
              <span className="text-[10px] mt-1 font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
