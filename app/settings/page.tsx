"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Building2 } from "lucide-react";
import Link from "next/link";

// Form-specific type that uses empty strings instead of null for form inputs
interface CompanyProfileForm {
  id?: number;
  companyName: string;
  cageCode: string;
  samUei: string;
  samRegistered: boolean;
  naicsCode: string;
  naicsSize: string;
  employeeCount: string;
  businessType: string;
  smallDisadvantaged: boolean;
  womanOwned: boolean;
  veteranOwned: boolean;
  serviceDisabledVetOwned: boolean;
  hubZone: boolean;
  historicallyUnderutilized: boolean;
  alaskaNativeCorp: boolean;
  defaultPaymentTerms: string;
  defaultPaymentTermsOther: string;
  defaultFob: string;
  defaultPurchaseOrderMin: string;
  noFreightAdder: boolean;
  defaultComplimentaryFreight: boolean;
  defaultPpaByVendor: boolean;
  countryOfOrigin: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

const defaultProfile: CompanyProfileForm = {
  companyName: "",
  cageCode: "",
  samUei: "",
  samRegistered: true,
  naicsCode: "",
  naicsSize: "",
  employeeCount: "<500",
  businessType: "Small",
  smallDisadvantaged: false,
  womanOwned: false,
  veteranOwned: false,
  serviceDisabledVetOwned: false,
  hubZone: false,
  historicallyUnderutilized: false,
  alaskaNativeCorp: false,
  defaultPaymentTerms: "Net 30",
  defaultPaymentTermsOther: "",
  defaultFob: "Origin",
  defaultPurchaseOrderMin: "",
  noFreightAdder: true,
  defaultComplimentaryFreight: true,
  defaultPpaByVendor: false,
  countryOfOrigin: "USA",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
};

// Helper to convert API response (with nulls) to form data (with empty strings)
function toFormData(data: Record<string, unknown>): CompanyProfileForm {
  return {
    ...defaultProfile,
    ...Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value ?? (typeof defaultProfile[key as keyof CompanyProfileForm] === 'boolean' ? false : "")])
    ),
  } as CompanyProfileForm;
}

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CompanyProfileForm>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/company-profile");
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setProfile(data);
        }
      } else if (response.status !== 404) {
        throw new Error("Failed to fetch profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load company profile",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = profile.id ? "PUT" : "POST";
      const response = await fetch("/api/company-profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      const savedProfile = await response.json();
      setProfile(savedProfile);
      
      toast({
        title: "Success",
        description: "Company profile saved successfully",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save company profile",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type, value } = e.target;
    
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setProfile(prev => ({ ...prev, [name]: checked }));
    } else {
      setProfile(prev => ({ ...prev, [name]: value }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex gap-4 mb-6">
          <Button variant="outline" asChild>
            <Link href="/projects">Projects</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workflow">Workflow</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/orders">Orders</Link>
          </Button>
        </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Company Profile Settings
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Configure your company&apos;s default information for RFQ submissions. This information will be used to auto-fill RFQ forms.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={profile.companyName}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cageCode" className="block text-sm font-medium text-gray-700 mb-1">
                    CAGE Code *
                  </label>
                  <input
                    type="text"
                    id="cageCode"
                    name="cageCode"
                    value={profile.cageCode}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="samUei" className="block text-sm font-medium text-gray-700 mb-1">
                    SAM UEI
                  </label>
                  <input
                    type="text"
                    id="samUei"
                    name="samUei"
                    value={profile.samUei}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SAM Registered
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="samRegistered"
                        checked={profile.samRegistered}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="naicsCode" className="block text-sm font-medium text-gray-700 mb-1">
                    NAICS Code
                  </label>
                  <input
                    type="text"
                    id="naicsCode"
                    name="naicsCode"
                    value={profile.naicsCode}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g., 424690"
                  />
                </div>
                <div>
                  <label htmlFor="naicsSize" className="block text-sm font-medium text-gray-700 mb-1">
                    NAICS Size ($M / Employees)
                  </label>
                  <input
                    type="text"
                    id="naicsSize"
                    name="naicsSize"
                    value={profile.naicsSize}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g., 150"
                  />
                </div>
                <div>
                  <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-1">
                    Business Type
                  </label>
                  <select
                    id="businessType"
                    name="businessType"
                    value={profile.businessType}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="Small">Small</option>
                    <option value="Large">Large</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 mb-1">
                    Employee Count
                  </label>
                  <select
                    id="employeeCount"
                    name="employeeCount"
                    value={profile.employeeCount}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="<500">&lt;500</option>
                    <option value="501-750">501-750</option>
                    <option value="751-1000">751-1000</option>
                    <option value="1001-1500">1001-1500</option>
                    <option value=">1500">&gt;1500</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="countryOfOrigin" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Country of Origin
                  </label>
                  <select
                    id="countryOfOrigin"
                    name="countryOfOrigin"
                    value={profile.countryOfOrigin}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="USA">USA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Business Classifications */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Business Classifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="smallDisadvantaged"
                    checked={profile.smallDisadvantaged}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Small Disadvantaged Business</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="womanOwned"
                    checked={profile.womanOwned}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Woman-Owned Business</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="veteranOwned"
                    checked={profile.veteranOwned}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Veteran-Owned Business</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="serviceDisabledVetOwned"
                    checked={profile.serviceDisabledVetOwned}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Service-Disabled Veteran-Owned</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="hubZone"
                    checked={profile.hubZone}
                    onChange={handleChange}
                  />
                  <span className="text-sm">HUBZone Business</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="historicallyUnderutilized"
                    checked={profile.historicallyUnderutilized}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Historically Underutilized Business</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="alaskaNativeCorp"
                    checked={profile.alaskaNativeCorp}
                    onChange={handleChange}
                  />
                  <span className="text-sm">Alaska Native Corporation</span>
                </label>
              </div>
            </section>

            {/* Default Quote Settings */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Default Quote Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="defaultPaymentTerms" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Payment Terms
                  </label>
                  <select
                    id="defaultPaymentTerms"
                    name="defaultPaymentTerms"
                    value={profile.defaultPaymentTerms}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="Net 30">Net 30</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {profile.defaultPaymentTerms === "Other" && (
                  <div>
                    <label htmlFor="defaultPaymentTermsOther" className="block text-sm font-medium text-gray-700 mb-1">
                      Specify Other Terms
                    </label>
                    <input
                      type="text"
                      id="defaultPaymentTermsOther"
                      name="defaultPaymentTermsOther"
                      value={profile.defaultPaymentTermsOther}
                      onChange={handleChange}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="defaultFob" className="block text-sm font-medium text-gray-700 mb-1">
                    Default FOB
                  </label>
                  <select
                    id="defaultFob"
                    name="defaultFob"
                    value={profile.defaultFob}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="Origin">Origin</option>
                    <option value="Destination">Destination</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="defaultPurchaseOrderMin" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Purchase Order Minimum ($)
                  </label>
                  <input
                    type="number"
                    id="defaultPurchaseOrderMin"
                    name="defaultPurchaseOrderMin"
                    value={profile.defaultPurchaseOrderMin}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g., 100"
                    step="0.01"
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Shipping Cost Options</p>
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="noFreightAdder"
                        checked={profile.noFreightAdder}
                        onChange={handleChange}
                      />
                      <span className="text-sm">No Freight Adder (Complimentary)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="defaultPpaByVendor"
                        checked={profile.defaultPpaByVendor}
                        onChange={handleChange}
                      />
                      <span className="text-sm">Prepay & Add by Vendor</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact Information */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    id="contactPerson"
                    name="contactPerson"
                    value={profile.contactPerson}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    name="contactEmail"
                    value={profile.contactEmail}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    id="contactPhone"
                    name="contactPhone"
                    value={profile.contactPhone}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={profile.address}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Company Profile
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
