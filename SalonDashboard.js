import React, { useState, useEffect } from 'react';
import { useAppointments, useClients, useServices, useProfessionals } from './useSupabase';
import AppointmentForm from './AppointmentForm';

/**
 * Main Salon Dashboard for Iluminare Studio
 * Shows today's appointments and allows booking new ones
 */
const SalonDashboard = () => {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = 
    useAppointments(today, today);
    
  const { clients, loading: clientsLoading } = useClients();
  const { services, loading: servicesLoading } = useServices();
  const { professionals, loading: prosLoading } = useProfessionals();
  
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

  // Handle date change
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  // Handle form close
  const handleFormClose = () => {
    setShowForm(false);
  };

  // Handle form submit (refresh appointments)
  const handleFormSubmit = () => {
    setShowForm(false);
    // The useAppointments hook will automatically refresh when selectedDate changes
  };

  // Calculate stats
  const totalAppointments = appointments?.length || 0;
  const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0;
  const revenueToday = appointments?.reduce((sum, a) => sum + (a.total_price || 0), 0) || 0;

  if (appointmentsLoading || clientsLoading || servicesLoading || prosLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loader"></div>
        <p>Carregando dados do salão...</p>
      </div>
    );
  }

  if (appointmentsError) {
    return (
      <div className="dashboard-error">
        <h2>Erro ao carregar dados</h2>
        <p>{appointmentsError}</p>
        <button onClick={() => window.location.reload()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="salon-dashboard">
      <header className="dashboard-header">
        <h1>Iluminare Studio</h1>
        <div className="dashboard-date">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => handleDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <span>{new Date(selectedDate).toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
      </header>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Hoje</h3>
          <p className="stat-value">{totalAppointments}</p>
          <p>Atendimentos</p>
        </div>
        <div className="stat-card">
          <h3>Concluídos</h3>
          <p className="stat-value">{completedAppointments}</p>
          <p>Atendimentos</p>
        </div>
        <div className="stat-card">
          <h3>Receita</h3>
          <p className="stat-value">R$ {revenueToday.toFixed(2)}</p>
          <p>Hoje</p>
        </div>
      </div>

      <div className="dashboard-actions">
        <button 
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          + Novo Agendamento
        </button>
      </div>

      <div className="appointments-section">
        <h2>Agendamentos de Hoje</h2>
        
        {appointments.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum agendamento para hoje</p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn-secondary"
            >
                Agendar Primeiro Atendimento
            </button>
          </div>
        ) : (
          <div className="appointments-list">
            {appointments.map(appointment => (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-header">
                  <div className="appointment-time">
                    {new Date(appointment.appointment_time).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} - {new Date(appointment.end_time).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <span className={`status-badge status-${appointment.status}`}>
                    {appointment.status === 'scheduled' ? 'Agendado' :
                     appointment.status === 'completed' ? 'Concluído' :
                     appointment.status === 'cancelled' ? 'Cancelado' : 'Não Compareceu'}
                  </span>
                </div>
                
                <div className="appointment-details">
                  <h3>{appointment.clients?.name || 'Cliente não encontrado'}</h3>
                  <p><strong>Serviço:</strong> {appointment.services?.name || 'Serviço não encontrado'}</p>
                  <p><strong>Profissional:</strong> {appointment.professionals?.name || 'Profissional não encontrado'}</p>
                  {appointment.notes && (
                    <p className="appointment-notes"><strong>Observações:</strong> {appointment.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Form Modal */}
      {showForm && (
        <div className="form-modal-backdrop" onClick={handleFormClose}>
          <div className="form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="form-modal-header">
              <h2>Novo Agendamento</h2>
              <button onClick={handleFormClose} className="modal-close-btn">
                ×
              </button>
            </div>
            <AppointmentForm 
              onClose={handleFormClose}
              onSubmit={handleFormSubmit}
              initialDate={selectedDate}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SalonDashboard;