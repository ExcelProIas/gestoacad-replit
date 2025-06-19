/**
 * Calendar functionality for School Management System
 * Uses FullCalendar.js for event and reservation management
 */

let calendar = null;
let eventsCalendar = null;
let reservationsCalendar = null;

// Initialize calendars when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboardCalendar();
    initializeEventsCalendar();
    initializeReservationsCalendar();
});

/**
 * Initialize dashboard calendar
 */
function initializeDashboardCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        height: 'auto',
        events: fetchCalendarEvents,
        eventClick: handleEventClick,
        eventMouseEnter: handleEventHover,
        eventMouseLeave: handleEventLeave,
        dayMaxEvents: 3,
        moreLinkClick: 'popover',
        eventDisplay: 'block',
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
        },
        loading: function(isLoading) {
            handleCalendarLoading(calendarEl, isLoading);
        },
        eventDidMount: function(info) {
            // Add icons to events based on type
            const iconMap = {
                'event': 'fas fa-calendar-day',
                'reservation': 'fas fa-door-open'
            };
            
            const icon = iconMap[info.event.extendedProps.type] || 'fas fa-circle';
            const iconEl = document.createElement('i');
            iconEl.className = icon + ' me-1';
            
            if (info.el.querySelector('.fc-event-title')) {
                info.el.querySelector('.fc-event-title').prepend(iconEl);
            }
        }
    });

    calendar.render();
}

/**
 * Initialize events page calendar
 */
function initializeEventsCalendar() {
    const calendarEl = document.getElementById('eventsCalendar');
    if (!calendarEl) return;

    eventsCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        height: 'auto',
        events: function(fetchInfo, successCallback, failureCallback) {
            fetchCalendarEvents(fetchInfo, successCallback, failureCallback, 'events');
        },
        eventClick: handleEventClick,
        eventColor: '#007bff',
        loading: function(isLoading) {
            handleCalendarLoading(calendarEl, isLoading);
        },
        eventDidMount: function(info) {
            // Add event icon
            const iconEl = document.createElement('i');
            iconEl.className = 'fas fa-calendar-day me-1';
            
            if (info.el.querySelector('.fc-event-title')) {
                info.el.querySelector('.fc-event-title').prepend(iconEl);
            }
        }
    });

    eventsCalendar.render();
}

/**
 * Initialize reservations page calendar
 */
function initializeReservationsCalendar() {
    const calendarEl = document.getElementById('reservationsCalendar');
    if (!calendarEl) return;

    reservationsCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 'auto',
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        slotDuration: '00:30:00',
        events: function(fetchInfo, successCallback, failureCallback) {
            fetchCalendarEvents(fetchInfo, successCallback, failureCallback, 'reservations');
        },
        eventClick: handleReservationClick,
        eventColor: '#28a745',
        loading: function(isLoading) {
            handleCalendarLoading(calendarEl, isLoading);
        },
        eventDidMount: function(info) {
            // Add reservation icon and room info
            const iconEl = document.createElement('i');
            iconEl.className = 'fas fa-door-open me-1';
            
            if (info.el.querySelector('.fc-event-title')) {
                info.el.querySelector('.fc-event-title').prepend(iconEl);
            }
            
            // Add tooltip with reservation details
            info.el.setAttribute('title', 
                `${info.event.title}\n` +
                `Horário: ${info.event.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} - ` +
                `${info.event.end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}\n` +
                `${info.event.extendedProps.purpose || ''}`
            );
        },
        select: handleDateSelect,
        selectable: true
    });

    reservationsCalendar.render();
}

/**
 * Fetch calendar events from API
 */
async function fetchCalendarEvents(fetchInfo, successCallback, failureCallback, type = 'all') {
    try {
        const response = await fetch('/api/calendar-events');
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        
        const events = await response.json();
        
        // Filter events by type if specified
        let filteredEvents = events;
        if (type === 'events') {
            filteredEvents = events.filter(event => event.type === 'event');
        } else if (type === 'reservations') {
            filteredEvents = events.filter(event => event.type === 'reservation');
        }
        
        successCallback(filteredEvents);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        failureCallback(error);
        
        // Show user-friendly error message
        if (window.SchoolSystem && window.SchoolSystem.showToast) {
            window.SchoolSystem.showToast('Erro ao carregar eventos do calendário', 'danger');
        }
    }
}

/**
 * Handle event click
 */
function handleEventClick(info) {
    const event = info.event;
    const eventType = event.extendedProps.type;
    
    if (eventType === 'event') {
        showEventDetails(event);
    } else if (eventType === 'reservation') {
        showReservationDetails(event);
    }
    
    // Prevent browser navigation
    info.jsEvent.preventDefault();
}

/**
 * Handle reservation click
 */
function handleReservationClick(info) {
    const reservation = info.event;
    showReservationDetails(reservation);
    info.jsEvent.preventDefault();
}

/**
 * Handle event hover
 */
function handleEventHover(info) {
    const event = info.event;
    
    // Create tooltip content
    let tooltipContent = `<strong>${event.title}</strong><br>`;
    
    if (event.start) {
        tooltipContent += `Data: ${event.start.toLocaleDateString('pt-BR')}<br>`;
        if (event.start.getHours() > 0 || event.start.getMinutes() > 0) {
            tooltipContent += `Horário: ${event.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
            if (event.end) {
                tooltipContent += ` - ${event.end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
            }
            tooltipContent += '<br>';
        }
    }
    
    if (event.extendedProps.location) {
        tooltipContent += `Local: ${event.extendedProps.location}`;
    }
    
    // Show tooltip (you can use Bootstrap tooltip or custom implementation)
    info.el.setAttribute('title', tooltipContent.replace(/<br>/g, '\n').replace(/<[^>]*>/g, ''));
}

/**
 * Handle event mouse leave
 */
function handleEventLeave(info) {
    // Remove tooltip if needed
    info.el.removeAttribute('title');
}

/**
 * Handle date selection for creating new reservations
 */
function handleDateSelect(selectionInfo) {
    if (reservationsCalendar && document.getElementById('addReservationModal')) {
        // Pre-fill form with selected date/time
        const startDate = selectionInfo.start;
        const endDate = selectionInfo.end;
        
        // Format dates for form inputs
        const dateStr = startDate.toISOString().split('T')[0];
        const startTimeStr = startDate.toTimeString().substring(0, 5);
        const endTimeStr = endDate.toTimeString().substring(0, 5);
        
        // Fill form fields
        const dateInput = document.getElementById('add_date');
        const startTimeInput = document.getElementById('add_start_time');
        const endTimeInput = document.getElementById('add_end_time');
        
        if (dateInput) dateInput.value = dateStr;
        if (startTimeInput) startTimeInput.value = startTimeStr;
        if (endTimeInput) endTimeInput.value = endTimeStr;
        
        // Show the add reservation modal
        const modal = new bootstrap.Modal(document.getElementById('addReservationModal'));
        modal.show();
    }
    
    // Clear selection
    reservationsCalendar.unselect();
}

/**
 * Show event details in modal or popup
 */
function showEventDetails(event) {
    const details = `
        <div class="event-details">
            <h5>${event.title}</h5>
            <p><strong>Data:</strong> ${event.start.toLocaleDateString('pt-BR')}</p>
            ${event.start.getHours() > 0 || event.start.getMinutes() > 0 ? 
                `<p><strong>Horário:</strong> ${event.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>` : ''
            }
            ${event.extendedProps.location ? `<p><strong>Local:</strong> ${event.extendedProps.location}</p>` : ''}
            ${event.extendedProps.description ? `<p><strong>Descrição:</strong> ${event.extendedProps.description}</p>` : ''}
        </div>
    `;
    
    // Show in modal if available, otherwise use alert
    const modal = document.getElementById('eventDetailsModal');
    if (modal) {
        modal.querySelector('.modal-body').innerHTML = details;
        new bootstrap.Modal(modal).show();
    } else {
        alert(`${event.title}\n${event.start.toLocaleDateString('pt-BR')}`);
    }
}

/**
 * Show reservation details
 */
function showReservationDetails(reservation) {
    const startTime = reservation.start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    const endTime = reservation.end ? reservation.end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
    
    const details = `
        <div class="reservation-details">
            <h5>${reservation.title}</h5>
            <p><strong>Data:</strong> ${reservation.start.toLocaleDateString('pt-BR')}</p>
            <p><strong>Horário:</strong> ${startTime}${endTime ? ` - ${endTime}` : ''}</p>
            ${reservation.extendedProps.purpose ? `<p><strong>Finalidade:</strong> ${reservation.extendedProps.purpose}</p>` : ''}
            ${reservation.extendedProps.reserved_by ? `<p><strong>Reservado por:</strong> ${reservation.extendedProps.reserved_by}</p>` : ''}
        </div>
    `;
    
    // Show in modal if available
    const modal = document.getElementById('reservationDetailsModal');
    if (modal) {
        modal.querySelector('.modal-body').innerHTML = details;
        new bootstrap.Modal(modal).show();
    } else {
        alert(`${reservation.title}\n${reservation.start.toLocaleDateString('pt-BR')} ${startTime}${endTime ? ` - ${endTime}` : ''}`);
    }
}

/**
 * Handle calendar loading state
 */
function handleCalendarLoading(calendarEl, isLoading) {
    const loadingIndicator = calendarEl.querySelector('.calendar-loading');
    
    if (isLoading) {
        if (!loadingIndicator) {
            const loader = document.createElement('div');
            loader.className = 'calendar-loading';
            loader.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin me-2"></i>Carregando eventos...</div>';
            calendarEl.appendChild(loader);
        }
    } else {
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
}

/**
 * Refresh calendar events
 */
function refreshCalendarEvents() {
    if (calendar) calendar.refetchEvents();
    if (eventsCalendar) eventsCalendar.refetchEvents();
    if (reservationsCalendar) reservationsCalendar.refetchEvents();
}

/**
 * Navigate to specific date
 */
function navigateToDate(date) {
    const targetDate = new Date(date);
    
    if (calendar) calendar.gotoDate(targetDate);
    if (eventsCalendar) eventsCalendar.gotoDate(targetDate);
    if (reservationsCalendar) reservationsCalendar.gotoDate(targetDate);
}

/**
 * Change calendar view
 */
function changeCalendarView(viewName) {
    if (calendar) calendar.changeView(viewName);
    if (eventsCalendar) eventsCalendar.changeView(viewName);
    if (reservationsCalendar) reservationsCalendar.changeView(viewName);
}

/**
 * Add new event to calendar
 */
function addEventToCalendar(eventData) {
    const event = {
        title: eventData.name || eventData.title,
        start: eventData.date + 'T' + (eventData.time || '09:00'),
        color: eventData.color || '#007bff',
        extendedProps: {
            type: 'event',
            description: eventData.description,
            location: eventData.location,
            created_by: eventData.created_by
        }
    };
    
    if (calendar) calendar.addEvent(event);
    if (eventsCalendar) eventsCalendar.addEvent(event);
}

/**
 * Add new reservation to calendar
 */
function addReservationToCalendar(reservationData) {
    const reservation = {
        title: `Reserva: ${reservationData.room_name}`,
        start: reservationData.date + 'T' + reservationData.start_time,
        end: reservationData.date + 'T' + reservationData.end_time,
        color: '#28a745',
        extendedProps: {
            type: 'reservation',
            purpose: reservationData.purpose,
            reserved_by: reservationData.reserved_by,
            room_name: reservationData.room_name
        }
    };
    
    if (calendar) calendar.addEvent(reservation);
    if (reservationsCalendar) reservationsCalendar.addEvent(reservation);
}

/**
 * Update calendar locale settings
 */
function updateCalendarLocale() {
    const localeSettings = {
        locale: 'pt-br',
        buttonText: {
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            list: 'Lista'
        },
        allDayText: 'Todo o dia',
        moreLinkText: 'mais',
        noEventsText: 'Nenhum evento para exibir'
    };
    
    if (calendar) calendar.setOption('locale', localeSettings.locale);
    if (eventsCalendar) eventsCalendar.setOption('locale', localeSettings.locale);
    if (reservationsCalendar) reservationsCalendar.setOption('locale', localeSettings.locale);
}

// Export calendar functions for global use
window.CalendarSystem = {
    refreshCalendarEvents,
    navigateToDate,
    changeCalendarView,
    addEventToCalendar,
    addReservationToCalendar
};

// Refresh calendars when window regains focus
window.addEventListener('focus', function() {
    setTimeout(refreshCalendarEvents, 1000);
});
