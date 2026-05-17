"use client";

import React from "react";

export default function OrganizationsPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-lg font-semibold mb-4">Escopo por usuário</h2>
      <div className="rounded-xl border border-[#d8c2ab] bg-white/70 p-5 text-sm text-[#4f2f19]">
        Este ambiente não usa mais gerenciamento manual de organizações. O isolamento agora acontece
        automaticamente pelo usuário autenticado.
      </div>
    </div>
  );
}
