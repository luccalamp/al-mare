"use client";

import { Client, EvolutionPlanWeek } from "@/types";
import EvolutionPlanModule from "./EvolutionPlanModule";

interface ClientEvolutionTabProps {
  client: Client;
  onUpdate: (client: Client) => Promise<void> | void;
}

export default function ClientEvolutionTab({ client, onUpdate }: ClientEvolutionTabProps) {
  const handleSaveEvolution = async (therapeuticPlan: string, evolutionWeeks: EvolutionPlanWeek[]) => {
    try {
      const updatedClient: Client = {
        ...client,
        profile: {
          ...client.profile,
          therapeuticPlan,
          evolutionWeeks,
        },
        updatedAt: new Date().toISOString(),
      };
      await Promise.resolve(onUpdate(updatedClient));
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <EvolutionPlanModule
        initialTherapeuticPlan={client.profile.therapeuticPlan}
        initialEvolutionWeeks={client.profile.evolutionWeeks}
        onSave={handleSaveEvolution}
      />
    </div>
  );
}
