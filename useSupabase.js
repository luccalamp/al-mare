import { useState, useEffect, useCallback } from 'react';
import * as supabaseService from './supabaseService';

export const useProfessionals = () => {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfessionals = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseService.supabase
        .from('professionals')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setProfessionals(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfessionals(); }, [loadProfessionals]);

  const refreshProfessionals = useCallback(() => { loadProfessionals(); }, [loadProfessionals]);

  return { professionals, loading, error, refreshProfessionals };
};

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

  useEffect(() => { loadServices(); }, [loadServices]);

  const refreshServices = useCallback(() => { loadServices(); }, [loadServices]);

  return { services, loading, error, refreshServices };
};

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

  useEffect(() => { loadClients(); }, [loadClients]);

  const refreshClients = useCallback(() => { loadClients(); }, [loadClients]);

  return { clients, loading, error, refreshClients };
};

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

  useEffect(() => { if (startDate && endDate) loadAppointments(); }, [loadAppointments, startDate, endDate]);

  const refreshAppointments = useCallback(() => { loadAppointments(); }, [loadAppointments]);

  return { appointments, loading, error, refreshAppointments };
};

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

  useEffect(() => { if (clientId) loadTechnicalSheets(); }, [loadTechnicalSheets, clientId]);

  const refreshTechnicalSheets = useCallback(() => { loadTechnicalSheets(); }, [loadTechnicalSheets]);

  return { technicalSheets, loading, error, refreshTechnicalSheets };
};

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

  useEffect(() => { if (clientId) loadDiagnostics(); }, [loadDiagnostics, clientId]);

  const refreshDiagnostics = useCallback(() => { loadDiagnostics(); }, [loadDiagnostics]);

  return { diagnostics, loading, error, refreshDiagnostics };
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseService.supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabaseService.supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => { await supabaseService.signIn(email, password); };
  const signUp = async (email, password) => { await supabaseService.signUp(email, password); };
  const signOut = async () => { await supabaseService.signOut(); };

  return { user, loading, signIn, signUp, signOut };
};

export default { useServices, useClients, useAppointments, useTechnicalSheets, useHairDiagnostics, useAuth, useProfessionals };
