import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ccrorpxyvxzzsoafwbsj.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_cVH_VGTmUOCuEW3zEEBGfg_kCoeWut6'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('Error fetching services:', error); throw error }
  return data
}

export const getServiceById = async (serviceId) => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()
  if (error) { console.error('Error fetching service:', error); throw error }
  return data
}

export const getClients = async () => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) { console.error('Error fetching clients:', error); throw error }
  return data
}

export const createClient = async (clientData) => {
  const { data, error } = await supabase
    .from('clients')
    .insert([{ name: clientData.name, email: clientData.email, phone: clientData.phone, birth_date: clientData.birthDate, address: clientData.address, notes: clientData.notes }])
    .select()
  if (error) { console.error('Error creating client:', error); throw error }
  return data[0]
}

export const updateClient = async (clientId, clientData) => {
  const { data, error } = await supabase
    .from('clients')
    .update({ name: clientData.name, email: clientData.email, phone: clientData.phone, birth_date: clientData.birthDate, address: clientData.address, notes: clientData.notes })
    .eq('id', clientId)
    .select()
  if (error) { console.error('Error updating client:', error); throw error }
  return data[0]
}

export const deleteClient = async (clientId) => {
  const { data, error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', clientId)
    .select()
  if (error) { console.error('Error deleting client:', error); throw error }
  return data[0]
}

export const getAppointmentsByDateRange = async (startDate, endDate) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, clients (*), professionals (*), services (*)`)
    .gte('appointment_time', startDate)
    .lte('appointment_time', endDate)
    .order('appointment_time')
  if (error) { console.error('Error fetching appointments:', error); throw error }
  return data
}

export const createAppointment = async (appointmentData) => {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ client_id: appointmentData.clientId, professional_id: appointmentData.professionalId, service_id: appointmentData.serviceId, appointment_time: appointmentData.appointmentTime, end_time: appointmentData.endTime, status: appointmentData.status || 'scheduled', notes: appointmentData.notes, total_price: appointmentData.totalPrice }])
    .select()
  if (error) { console.error('Error creating appointment:', error); throw error }
  return data[0]
}

export const updateAppointmentStatus = async (appointmentId, status) => {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select()
  if (error) { console.error('Error updating appointment status:', error); throw error }
  return data[0]
}

export const createTechnicalSheet = async (technicalData) => {
  const { data, error } = await supabase
    .from('technical_sheets')
    .insert([{ client_id: technicalData.clientId, service_id: technicalData.serviceId, fundo_clareamento: technicalData.fundoClareamento, mistura_tonalizante: technicalData.misturaTonalizante, volumagem_ox: technicalData.volumagemOx, tempo_pausa: technicalData.tempoPausa, altura_tom_alcançada: technicalData.alturaTomAlcançada, observacoes: technicalData.observacoes }])
    .select()
  if (error) { console.error('Error creating technical sheet:', error); throw error }
  return data[0]
}

export const getTechnicalSheetsByClient = async (clientId) => {
  const { data, error } = await supabase
    .from('technical_sheets')
    .select(`*, services (*)`)
    .eq('client_id', clientId)
    .order('data_aplicacao', { ascending: false })
  if (error) { console.error('Error fetching technical sheets:', error); throw error }
  return data
}

export const createHairDiagnostic = async (diagnosticData) => {
  const { data, error } = await supabase
    .from('hair_diagnostics')
    .insert([{ client_id: diagnosticData.clientId, elasticidade_fio: diagnosticData.elasticidadeFio, porosidade: diagnosticData.porosidade, presenca_metais: diagnosticData.presencaMetais, observacoes: diagnosticData.observacoes }])
    .select()
  if (error) { console.error('Error creating hair diagnostic:', error); throw error }
  return data[0]
}

export const getHairDiagnosticsByClient = async (clientId) => {
  const { data, error } = await supabase
    .from('hair_diagnostics')
    .select('*')
    .eq('client_id', clientId)
    .order('data_diagnostico', { ascending: false })
  if (error) { console.error('Error fetching hair diagnostics:', error); throw error }
  return data
}

export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) { console.error('Error signing up:', error); throw error }
  return data
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { console.error('Error signing in:', error); throw error }
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) { console.error('Error signing out:', error); throw error }
}

export const subscribeToAppointments = (callback) => {
  return supabase
    .channel('appointments-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => { callback(payload) })
    .subscribe()
}

export const subscribeToClients = (callback) => {
  return supabase
    .channel('clients-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => { callback(payload) })
    .subscribe()
}

export default { supabase, getServices, getServiceById, getClients, createClient, updateClient, deleteClient, getAppointmentsByDateRange, createAppointment, updateAppointmentStatus, getTechnicalSheetsByClient, createTechnicalSheet, getHairDiagnosticsByClient, createHairDiagnostic, signUp, signIn, signOut, subscribeToAppointments, subscribeToClients }
