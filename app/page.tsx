"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Plus, CheckCircle, Clock, FolderOpen, FileText, Package } from "lucide-react";

interface Project {
  id: number;
  name: string;
  status: string;
  poNumber: string | null;
  rfqNumber: string | null;
  customerName: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  rfq_received: "RFQ Received",
  quoted: "Quoted",
  po_received: "PO Received",
  in_verification: "Verifying",
  verified: "Verified",
  shipped: "Shipped",
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  const awaitingQuote = projects.filter((p) => p.status === "rfq_received").length;
  const awaitingPO = projects.filter((p) => p.status === "quoted").length;
  const inVerification = projects.filter((p) => ["po_received", "in_verification"].includes(p.status)).length;
  const completed = projects.filter((p) => ["verified", "shipped"].includes(p.status)).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-slate-500">RFQ to Shipment Tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded">
                <FileText className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{awaitingQuote}</p>
                <p className="text-xs text-slate-500">Awaiting Quote</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{awaitingPO}</p>
                <p className="text-xs text-slate-500">Awaiting PO</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-200 rounded">
                <Package className="h-5 w-5 text-amber-800" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inVerification}</p>
                <p className="text-xs text-slate-500">In Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completed}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Project Button */}
      <Link href="/projects">
        <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold mb-8" size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Project
        </Button>
      </Link>

      {/* Recent Projects */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-slate-600" />
            Recent Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No projects yet</p>
              <Link href="/projects">
                <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.slice(0, 8).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded">
                        <FolderOpen className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-slate-500">
                          {project.customerName && `${project.customerName} | `}
                          {project.rfqNumber && `RFQ: ${project.rfqNumber}`}
                          {project.rfqNumber && project.poNumber && " | "}
                          {project.poNumber && `PO: ${project.poNumber}`}
                          {!project.rfqNumber && !project.poNumber && "No documents yet"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        project.status === "verified" || project.status === "shipped"
                          ? "bg-green-100 text-green-800"
                          : project.status === "rfq_received"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {STATUS_LABELS[project.status] || project.status}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow */}
      <div className="mt-6 p-4 bg-slate-50 rounded border border-slate-200">
        <h3 className="font-semibold text-slate-700 mb-3">Workflow</h3>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="px-2 py-1 bg-slate-200 rounded">RFQ</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-slate-200 rounded">Quote</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-amber-100 rounded">PO</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-amber-200 rounded">Verify</span>
          <ArrowRight className="h-4 w-4" />
          <span className="px-2 py-1 bg-green-100 rounded">Ship</span>
        </div>
      </div>
    </div>
  );
}
