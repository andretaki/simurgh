"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Home,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Menu,
  X,
  Plus,
  Package,
  FolderOpen,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Projects", href: "/projects", icon: FolderOpen },
  { title: "Orders", href: "/orders", icon: Package },
  { title: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/80 backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
      >
        {isMobileOpen ? (
          <X className="h-6 w-6 text-gray-700" />
        ) : (
          <Menu className="h-6 w-6 text-gray-700" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white/90 backdrop-blur-xl border-r border-gray-200/50 shadow-2xl z-40
          transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-20" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Simurgh
                </h1>
                <p className="text-xs text-gray-500">Gov Order Verification</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Quick Action */}
        <div className="p-4 border-b border-gray-200/50">
          <Link href="/orders">
            <Button
              size={isCollapsed ? "icon" : "default"}
              variant="gradient"
              className="w-full group"
            >
              <Plus className={`h-4 w-4 ${!isCollapsed && "mr-2"} group-hover:rotate-90 transition-transform`} />
              {!isCollapsed && <span>New Order</span>}
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden
                    ${active
                      ? "bg-gradient-to-r from-purple-50 to-blue-50 shadow-md"
                      : "hover:bg-gray-50"
                    }
                  `}
                >
                  {active && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-blue-500" />
                  )}

                  <div
                    className={`
                    relative p-2 rounded-lg transition-all duration-200
                    ${active
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg"
                      : "bg-gray-100 group-hover:bg-gray-200"
                    }
                  `}
                  >
                    <item.icon className={`h-5 w-5 ${active ? "text-white" : "text-gray-600"}`} />
                  </div>

                  {!isCollapsed && (
                    <span className={`font-medium ${active ? "text-gray-900" : "text-gray-700"}`}>
                      {item.title}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200/50">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg">
                AC
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Alliance Chemical</p>
                  <p className="text-xs text-gray-500">Admin</p>
                </div>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <LogOut className="h-4 w-4 text-gray-600" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Spacer */}
      <div className={`hidden lg:block transition-all duration-300 ${isCollapsed ? "lg:w-20" : "lg:w-64"}`} />
    </>
  );
}
