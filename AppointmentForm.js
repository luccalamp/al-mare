import React, { useState } from 'react';
import { useClients, useServices, useProfessionals } from './useSupabase';
import * as supabaseService from './supabaseService';

/**
 * Appointment booking form component
 * Demonstrates how to use the Supabase hooks for salon operations
 */
const AppointmentForm = () => {
  const { clients, loading: clientsLoading } = useClients();
  const { services, loading: servicesLoading } = useServices();
  const { professionals, loading: prosLoading } = useProfessionals();
  
  const [formData, setFormData] = useState({
    clientId: '',
    serviceId: '',
    professionalId: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Combine date and time
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`).toISOString();
      const service = services.find(s => s.id === formData.serviceId);
      const endTime = new Date(new Date(appointmentDateTime).getTime() + service.duration_minutes * 60000).toISOString();
      
      // Create appointment via Supabase service
      await supabaseService.createAppointment({
        clientId: formData.clientId,
        serviceId: formData.serviceId,
        professionalId: formData.professionalId,
        appointmentTime: appointmentDateTime,
        endTime: endTime,
        notes: formData.notes,
        totalPrice: service.price
      });
      
      setSuccess(true);
      // Reset form after successful submission
      setFormData({
        clientId: '',
        serviceId: '',
        professionalId: '',
        appointmentDate: '',
        appointmentTime: '',
        notes: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (clientsLoading || servicesLoading || prosLoading) {
    return <div>Loading data...</div>;
  }

  return (
    <div className="appointment-form">
      <h2>Agendar Atendimento</h2>
      {success && <div className="success-message">Agendamento realizado com sucesso!</div>}
      {error && <div className="error-message">Erro: {error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div>
          <label>Cliente:</label>
          <select 
            value={formData.clientId} 
            onChange={(e) => setFormData({...formData, clientId: e.target.value})}
            required
          >
            <option value="">Selecione um cliente</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label>Serviço:</label>
          <select 
            value={formData.serviceId} 
            onChange={(e) => setFormData({...formData, serviceId: e.target.value})}
            required
          >
            <option value="">Selecione um serviço</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} - R$ {service.price.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label>Profissional:</label>
          <select 
            value={formData.professionalId} 
            onChange={(e) => setFormData({...formData, professionalId: e.target.value})}
            required
          >
            <option value="">Selecione um profissional</option>
            {professionals.map(pro => (
              <option key={pro.id} value={pro.id}>
                {pro.name} ({pro.specialty})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label>Data:</label>
          <input 
            type="date" 
            value={formData.appointmentDate} 
            onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})}
            required
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div>
          <label>Horário:</label>
          <input 
            type="time" 
            value={formData.appointmentTime} 
            onChange={(e) => setFormData({...formData, appointmentTime: e.target.value})}
            required
          />
        </div>
        
        <div>
          <label>Observações:</label>
          <textarea 
            value={formData.notes} 
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows="3"
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Agendando...' : 'Agendar Atendimento'}
        </button>
      </form>
    </div>
  );
};

export default AppointmentForm;