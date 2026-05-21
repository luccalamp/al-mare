"use client";

import React from "react";
import Link from "next/link";
import { useOrganizations } from "@/components/OrganizationProvider";

export default function OrganizationSwitcher() {
  const { organizations, activeOrgId, setActiveOrgId, loading } = useOrganizations();

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-gray-700">Organização:</div>
      <div className="relative">
        <select
          className="input-light"
          value={activeOrgId ?? ""}
          onChange={(e) => setActiveOrgId(e.target.value || null)}
          disabled={loading}
        >
          <option value="">(nenhuma)</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </div>
      <Link href="/organizations" className="text-xs font-semibold px-3 py-1 rounded-full bg-white/60 hover:bg-white">
        Gerenciar
      </Link>
    </div>
  );
}
