"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Home,
  Upload,
  FileText,
  Settings,
  History,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shield,
  Users,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Zap,
  Brain,
  Activity,
  Bell,
  Search,
  Plus,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  gradient?: string;
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { 
      title: "Dashboard", 
      href: "/", 
      icon: Home,
      gradient: "from-blue-500 to-cyan-500",
    },
    { 
      title: "RFQ Pro", 
      href: "/rfq-pro", 
      icon: Upload,
      badge: "AI",
      gradient: "from-purple-500 to-pink-500",
    },
    { 
      title: "Fill RFQ", 
      href: "/rfq-fill", 
      icon: FileText,
      gradient: "from-green-500 to-emerald-500",
    },
    { 
      title: "Analytics", 
      href: "/analytics", 
      icon: BarChart3,
      gradient: "from-orange-500 to-red-500",
    },
    { 
      title: "History", 
      href: "/history", 
      icon: History,
      badge: "12",
      gradient: "from-indigo-500 to-purple-500",
    },
    { 
      title: "Settings", 
      href: "/settings", 
      icon: Settings,
      gradient: "from-gray-500 to-gray-600",
    },
  ];

  const bottomItems: NavItem[] = [
    { 
      title: "Support", 
      href: "/support", 
      icon: HelpCircle,
      gradient: "from-teal-500 to-cyan-500",
    },
  ];

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
          ${isCollapsed ? "w-20" : "w-72"}
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
                <p className="text-xs text-gray-500">RFQ Processing AI</p>
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

        {/* Search Bar */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-200/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100/50 border border-gray-200 focus:border-purple-400 focus:bg-white transition-all"
              />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-4 border-b border-gray-200/50">
          <Button 
            size={isCollapsed ? "icon" : "default"}
            variant="gradient"
            className="w-full group"
          >
            <Plus className={`h-4 w-4 ${!isCollapsed && 'mr-2'} group-hover:rotate-90 transition-transform`} />
            {!isCollapsed && <span>New RFQ</span>}
          </Button>
        </div>

        {/* Navigation Items */}
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
                      ? 'bg-gradient-to-r from-purple-50 to-blue-50 shadow-md' 
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Active Indicator */}
                  {active && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-blue-500" />
                  )}
                  
                  {/* Icon */}
                  <div className={`
                    relative p-2 rounded-lg transition-all duration-200
                    ${active 
                      ? `bg-gradient-to-r ${item.gradient || 'from-purple-500 to-blue-500'} shadow-lg` 
                      : 'bg-gray-100 group-hover:bg-gray-200'
                    }
                  `}>
                    <item.icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  
                  {/* Title & Badge */}
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span className={`font-medium ${active ? 'text-gray-900' : 'text-gray-700'}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className={`
                          px-2 py-0.5 text-xs font-bold rounded-full
                          ${item.badge === 'AI' 
                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                            : 'bg-blue-100 text-blue-700'
                          }
                        `}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 transition-all duration-300" />
                </Link>
              );
            })}
          </div>

          {/* Separator */}
          <div className="my-4 border-t border-gray-200/50" />

          {/* Bottom Items */}
          <div className="space-y-2">
            {bottomItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all group"
              >
                <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                  <item.icon className="h-5 w-5 text-gray-600" />
                </div>
                {!isCollapsed && (
                  <span className="text-gray-700">{item.title}</span>
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200/50">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg">
                JD
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            {!isCollapsed && (
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">John Doe</p>
                <p className="text-xs text-gray-500">Premium Plan</p>
              </div>
            )}
            {!isCollapsed && (
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <LogOut className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* AI Assistant Badge */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200/50">
            <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-purple-600 animate-pulse" />
                <span className="text-sm font-bold text-purple-900">AI Assistant Active</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>98% Accuracy</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>2.3s Avg</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Wrapper - Add margin for sidebar */}
      <div className={`lg:transition-all lg:duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`} />
    </>
  );
}