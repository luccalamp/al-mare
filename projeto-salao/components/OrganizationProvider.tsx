"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

type Org = {
  id: string;
  nome: string;
  slug: string;
  metadata?: Record<string, unknown>;
};

type OrgContext = {
  organizations: Org[];
  loading: boolean;
  activeOrgId: string | null;
  setActiveOrgId: (id: string | null) => void;
  refresh: () => Promise<void>;
  createOrganization: (payload: { nome: string; slug?: string; metadata?: Record<string, unknown> }) => Promise<Org>;
};

const ctx = createContext<OrgContext | null>(null);

function buildScopedOrganization(userId: string): Org {
  return {
    id: userId,
    nome: "Minha conta",
    slug: userId,
  };
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const scopedUserId = sessionData?.session?.user?.id ?? null;
      setActiveOrgIdState(scopedUserId);
      setOrganizations(scopedUserId ? [buildScopedOrganization(scopedUserId)] : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrgs();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const scopedUserId = session?.user?.id ?? null;
      setActiveOrgIdState(scopedUserId);
      setOrganizations(scopedUserId ? [buildScopedOrganization(scopedUserId)] : []);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [fetchOrgs]);

  const setActiveOrgId = (_id: string | null) => {
    // O escopo ativo agora segue o user.id autenticado.
  };

  const createOrganization = useCallback(
    async (_payload: { nome: string; slug?: string; metadata?: Record<string, unknown> }) => {
      throw new Error("O fluxo de organizações foi desativado neste ambiente.");
    },
    []
  );

  const value = useMemo(
    () => ({ organizations, loading, activeOrgId, setActiveOrgId, refresh: fetchOrgs, createOrganization }),
    [organizations, loading, activeOrgId, fetchOrgs, createOrganization]
  );

  return <ctx.Provider value={value}>{children}</ctx.Provider>;
}

export function useOrganizations() {
  const context = useContext(ctx);
  if (!context) throw new Error("useOrganizations must be used within OrganizationProvider");
  return context;
}

export default OrganizationProvider;
