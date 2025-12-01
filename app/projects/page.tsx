"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  FolderOpen,
  Plus,
  Search,
  ArrowRight,
  FileText,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Project {
  id: number;
  name: string;
  customerName: string | null;
  rfqNumber: string | null;
  poNumber: string | null;
  productName: string | null;
  status: string;
  comparisonStatus: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  rfq_received: { label: "RFQ Received", color: "bg-slate-100 text-slate-700", icon: <FileText className="h-3 w-3" /> },
  quoted: { label: "Quote Sent", color: "bg-slate-200 text-slate-800", icon: <FileText className="h-3 w-3" /> },
  po_received: { label: "PO Received", color: "bg-amber-100 text-amber-800", icon: <Package className="h-3 w-3" /> },
  in_verification: { label: "In Verification", color: "bg-amber-200 text-amber-900", icon: <Clock className="h-3 w-3" /> },
  verified: { label: "Verified", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  shipped: { label: "Shipped", color: "bg-slate-700 text-white", icon: <Package className="h-3 w-3" /> },
};

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Project ${new Date().toLocaleDateString()}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = `/projects/${data.project.id}`;
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create project",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Delete this project and all related data?")) return;

    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== id));
        toast({ title: "Project deleted" });
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.rfqNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.poNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.rfq_received;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getComparisonBadge = (status: string | null) => {
    if (!status) return null;
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      matched: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
      mismatched: { color: "bg-red-100 text-red-800", icon: <AlertTriangle className="h-3 w-3" /> },
      partial: { color: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3 w-3" /> },
    };
    const c = config[status];
    if (!c) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>
        {c.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-slate-500">Manage RFQs, quotes, and purchase orders</p>
        </div>
        <Button
          onClick={createProject}
          disabled={creating}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          {creating ? "Creating..." : "New Project"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-slate-300"
        />
      </div>

      {/* Projects List */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5 text-slate-600" />
            Projects ({filteredProjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-slate-500 mb-4">Create a project to start tracking RFQs and POs</p>
              <Button
                onClick={createProject}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded">
                      <FolderOpen className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{project.name}</span>
                        {getStatusBadge(project.status)}
                        {getComparisonBadge(project.comparisonStatus)}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {project.customerName && <span>{project.customerName} | </span>}
                        {project.rfqNumber && <span>RFQ: {project.rfqNumber} | </span>}
                        {project.poNumber && <span>PO: {project.poNumber} | </span>}
                        {project.productName && <span>{project.productName}</span>}
                        {!project.customerName && !project.rfqNumber && !project.poNumber && (
                          <span className="italic">No documents uploaded yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => deleteProject(e, project.id)}
                      className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Legend */}
      <div className="mt-6 p-4 bg-slate-50 rounded border border-slate-200">
        <h3 className="font-semibold mb-3 text-slate-700">Workflow</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
              {config.icon}
              {config.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
