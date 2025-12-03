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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded bg-white shadow-md"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-slate-900 text-white z-40
          transition-all duration-200
          ${isCollapsed ? "w-16" : "w-56"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Senmurv.svg"
              alt="Simurgh"
              className="w-8 h-8 invert"
            />
            {!isCollapsed && (
              <div>
                <h1 className="font-bold text-white">Simurgh</h1>
                <p className="text-xs text-slate-400">Gov Verification</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block p-1 rounded hover:bg-slate-800"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Quick Action */}
        <div className="p-3 border-b border-slate-700">
          <Link href="/projects">
            <Button
              size={isCollapsed ? "icon" : "default"}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            >
              <Plus className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
              {!isCollapsed && <span>New Project</span>}
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded mb-1 transition-colors
                  ${active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-slate-700">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-sm font-bold">
              AC
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1">
                  <p className="text-sm font-medium">Alliance Chemical</p>
                  <p className="text-xs text-slate-500">Admin</p>
                </div>
                <button className="p-1.5 rounded hover:bg-slate-800">
                  <LogOut className="h-4 w-4 text-slate-400" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Spacer */}
      <div className={`hidden lg:block transition-all duration-200 ${isCollapsed ? "lg:w-16" : "lg:w-56"}`} />
    </>
  );
}
