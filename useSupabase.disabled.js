// Disabled copy of the legacy useSupabase.js
// The original implementation was moved here to avoid accidental client-side writes.

// Custom React Hook for Supabase Operations
// Provides easy-to-use hooks for salon management operations

import { useState, useEffect, useCallback } from 'react';
import * as supabaseService from './supabaseService';

/**
 * Hook for managing services
 * @returns {Object} Services data and loading state
 */
export const useServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getServices();
      setServices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const refreshServices = useCallback(() => {
    loadServices();
  }, [loadServices]);

  return { services, loading, error, refreshServices };
};

/**
 * Hook for managing clients
 * @returns {Object} Clients data and loading state
 */
export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const refreshClients = useCallback(() => {
    loadClients();
  }, [loadClients]);

  return { clients, loading, error, refreshClients };
};

/**
 * Hook for managing appointments
 * @param {string} startDate - Start date for filtering (ISO string)
 * @param {string} endDate - End date for filtering (ISO string)
 * @returns {Object} Appointments data and loading state
 */
export const useAppointments = (startDate, endDate) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getAppointmentsByDateRange(startDate, endDate);
      setAppointments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate) {
      loadAppointments();
    }
  }, [loadAppointments, startDate, endDate]);

  const refreshAppointments = useCallback(() => {
    loadAppointments();
  }, [loadAppointments]);

  return { appointments, loading, error, refreshAppointments };
};

/**
 * Hook for managing technical sheets (color treatments)
 * @param {string} clientId - Client ID to filter by
 * @returns {Object} Technical sheets data and loading state
 */
export const useTechnicalSheets = (clientId) => {
  const [technicalSheets, setTechnicalSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTechnicalSheets = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const data = await supabaseService.getTechnicalSheetsByClient(clientId);
      setTechnicalSheets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadTechnicalSheets();
    }
  }, [loadTechnicalSheets, clientId]);

  const refreshTechnicalSheets = useCallback(() => {
    loadTechnicalSheets();
  }, [loadTechnicalSheets]);

  return { technicalSheets, loading, error, refreshTechnicalSheets };
};

/**
 * Hook for managing hair diagnostics
 * @param {string} clientId - Client ID to filter by
 * @returns {Object} Diagnostics data and loading state
 */
export const useHairDiagnostics = (clientId) => {
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDiagnostics = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const data = await supabaseService.getHairDiagnosticsByClient(clientId);
      setDiagnostics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      loadDiagnostics();
    }
  }, [loadDiagnostics, clientId]);

  const refreshDiagnostics = useCallback(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  return { diagnostics, loading, error, refreshDiagnostics };
};

// Authentication hooks
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabaseService.supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseService.supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      await supabaseService.signIn(email, password);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email, password) => {
    try {
      await supabaseService.signUp(email, password);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabaseService.signOut();
    } catch (error) {
      throw error;
    }
  };

  return { user, loading, signIn, signUp, signOut };
};

export default {
  useServices,
  useClients,
  useAppointments,
  useTechnicalSheets,
  useHairDiagnostics,
  useAuth
};
