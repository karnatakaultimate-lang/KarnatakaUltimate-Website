import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton, Paper,
  ToggleButtonGroup, ToggleButton, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, Alert, Divider,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import GroupIcon from '@mui/icons-material/Group';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// react-big-calendar
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// ── date-fns localizer ─────────────────────────────────────────────────────────
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ── Event type colours ─────────────────────────────────────────────────────────
const EVENT_COLOR = {
  Training:   '#0288d1',
  'Pick-up':  '#2e7d32',
  Tournament: '#ed6c02',
  Other:      '#7b1fa2',
};
const getEventColor  = (type) => EVENT_COLOR[type] || '#7b1fa2';
const getEventColorMui = (type) => ({
  Training: 'info.main', 'Pick-up': 'success.main',
  Tournament: 'warning.main',
}[type] || 'secondary.main');

// ── Custom RBC Toolbar (MUI-styled) ────────────────────────────────────────────
// Defined outside Events so the component reference is stable (avoids remounts)
function RBCToolbar({ label, onNavigate, onView, view }) {
  const views = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 1.5, mb: 2,
    }}>
      {/* Left: nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton size="small" onClick={() => onNavigate('PREV')}><ChevronLeftIcon /></IconButton>
        <Button variant="outlined" size="small" onClick={() => onNavigate('TODAY')}
          sx={{ fontWeight: 'bold', minWidth: 64 }}>
          Today
        </Button>
        <IconButton size="small" onClick={() => onNavigate('NEXT')}><ChevronRightIcon /></IconButton>
        <Typography variant="h6" fontWeight="bold" color="primary.main"
          sx={{ ml: 1, fontSize: { xs: '1rem', md: '1.25rem' } }}>
          {label}
        </Typography>
      </Box>

      {/* Right: view switcher — use onChange on the group, not onClick on children */}
      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_, newView) => { if (newView !== null) onView(newView); }}
      >
        {views.map(v => (
          <ToggleButton key={v} value={v}
            sx={{ textTransform: 'capitalize', fontWeight: 'bold', px: { xs: 1, sm: 2 }, fontSize: { xs: '0.7rem', sm: '0.8125rem' } }}>
            {v}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const EVENT_TYPES = ['Pick-up', 'Training', 'Tournament', 'Other'];
// Only these types may be flagged as team-vs-team events (whole teams RSVP)
const TEAM_ATTENDANCE_TYPES = ['Training', 'Tournament'];
const INITIAL_FORM = {
  title: '', type: 'Pick-up', description: '',
  start_time: '', end_time: '', location: '',
  is_public: true, is_open: true, is_paid: false,
  fee_amount: '', event_upi_id: '',
  attendance_mode: 'individual', hosting_team_id: '',
};

// ── Component ──────────────────────────────────────────────────────────────────
function Events() {
  const navigate  = useNavigate();
  const { user, profile } = useAuth();

  const [viewMode, setViewMode]   = useState('calendar');
  const [events,   setEvents]     = useState([]);
  const [loading,  setLoading]    = useState(true);

  // Controlled RBC state — must own view + date externally so toolbar stays in sync
  const [calView, setCalView] = useState(Views.MONTH);
  const [calDate, setCalDate] = useState(new Date());

  // Create Event dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [formData,   setFormData]   = useState(INITIAL_FORM);
  const [formError,  setFormError]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [customUpi,  setCustomUpi]  = useState('');
  const [myTeams,    setMyTeams]    = useState([]);

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { if (user) fetchMyTeams(); }, [user]);

  const fetchMyTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, logo_url)')
        .eq('user_id', user.uid);
      if (error) throw error;
      setMyTeams((data || []).map(m => m.teams).filter(Boolean));
    } catch (err) {
      console.error('Error fetching my teams:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events').select('*').order('start_time', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const handleViewChange = (_e, v) => { if (v) setViewMode(v); };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return {
      day: d.getDate(),
      monthStr: d.toLocaleString('default', { month: 'short' }),
      fullStr:
        d.toLocaleString('default', { weekday: 'short', month: 'short', day: '2-digit' }) +
        ' • ' + d.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Map Supabase events → RBC shape
  const rbcEvents = events.map(ev => ({
    id:       ev.id,
    title:    ev.title,
    start:    new Date(ev.start_time),
    end:      new Date(ev.end_time),
    resource: ev,           // full row for colour lookup etc.
  }));

  // RBC: colour each event bar by type
  const eventPropGetter = (ev) => ({
    style: {
      backgroundColor: getEventColor(ev.resource?.type),
      border: 'none',
      borderRadius: '4px',
      color: 'white',
      fontSize: '0.78rem',
      fontWeight: 'bold',
      padding: '2px 6px',
    },
  });

  // Today at midnight for list-view filter
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const upcomingEvents = events.filter(ev => new Date(ev.start_time) >= startOfToday);

  // ── Create Event handlers ─────────────────────────────────────────────────────

  const handleOpenDialog = () => {
    if (!user) { navigate('/login'); return; }
    setFormData(INITIAL_FORM);
    setCustomUpi('');
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => { setOpenDialog(false); setFormError(''); setCustomUpi(''); };
  const handleFormChange  = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  // Changing event type may invalidate a previously-chosen 'team' attendance mode
  const handleTypeChange = (e) => {
    const type = e.target.value;
    setFormData(prev => ({
      ...prev,
      type,
      attendance_mode: TEAM_ATTENDANCE_TYPES.includes(type) ? prev.attendance_mode : 'individual',
    }));
  };

  const handleSelectUpi = (upi) => {
    setFormData(prev => ({ ...prev, event_upi_id: upi }));
    setCustomUpi('');
  };

  const handleCustomUpiChange = (e) => {
    setCustomUpi(e.target.value);
    setFormData(prev => ({ ...prev, event_upi_id: e.target.value }));
  };

  const savedUpiIds = profile?.saved_upi_ids || [];

  const handleCreateEvent = async () => {
    setFormError('');
    if (!formData.title.trim())   return setFormError('Event title is required.');
    if (!formData.start_time)     return setFormError('Start time is required.');
    if (!formData.end_time)       return setFormError('End time is required.');
    if (new Date(formData.end_time) <= new Date(formData.start_time))
      return setFormError('End time must be after start time.');
    if (!formData.location.trim()) return setFormError('Location is required.');
    if (formData.is_paid && (!formData.fee_amount || Number(formData.fee_amount) <= 0))
      return setFormError('Fee amount must be greater than 0 for paid events.');

    setSaving(true);
    try {
      const { error } = await supabase.from('events').insert([{
        creator_id:   user.uid,
        title:        formData.title.trim(),
        type:         formData.type,
        description:  formData.description.trim() || null,
        start_time:   new Date(formData.start_time).toISOString(),
        end_time:     new Date(formData.end_time).toISOString(),
        location:     formData.location.trim(),
        is_public:    formData.is_public,
        is_open:      formData.is_open,
        is_paid:      formData.is_paid,
        fee_amount:   formData.is_paid ? Number(formData.fee_amount) : 0,
        event_upi_ids: formData.is_paid && formData.event_upi_id.trim()
          ? [formData.event_upi_id.trim()] : [],
        attendance_mode: TEAM_ATTENDANCE_TYPES.includes(formData.type) ? formData.attendance_mode : 'individual',
        hosting_team_id: formData.hosting_team_id || null,
      }]);
      if (error) throw error;
      handleCloseDialog();
      await fetchEvents();
    } catch (err) {
      setFormError(err.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', md: 'center' },
        mb: { xs: 2, md: 4 },
        gap: { xs: 1.5, md: 2 },
      }}>
        <Typography variant="h3" fontWeight="bold" sx={{ fontSize: { xs: '1.75rem', md: '3rem' } }}>Events</Typography>
        <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 } }}>
          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange} size="small"
            sx={{ bgcolor: 'white', flexGrow: { xs: 1, md: 0 } }}>
            <ToggleButton value="calendar" sx={{ flexGrow: 1, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
              <CalendarMonthIcon sx={{ mr: 1, fontSize: { xs: 18, md: 24 } }} /> Calendar
            </ToggleButton>
            <ToggleButton value="list" sx={{ flexGrow: 1, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
              <ViewListIcon sx={{ mr: 1, fontSize: { xs: 18, md: 24 } }} /> List
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" color="primary" startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{
              px: { xs: 2, md: 3 }, py: { xs: 1, md: 1.5 },
              fontSize: { xs: '0.8rem', md: '1rem' },
              flexGrow: { xs: 1, md: 0 }, whiteSpace: 'nowrap',
            }}>
            Create Event
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>

      ) : viewMode === 'calendar' ? (

        /* ══════════════ CALENDAR VIEW (react-big-calendar) ══════════════ */
        <Paper sx={{ p: { xs: 1, md: 3 }, borderRadius: 3, boxShadow: 2 }}>
          <Box sx={{
            height: { xs: 520, md: 700 },

            // ── RBC theme overrides ──────────────────────────────────────
            '& .rbc-today': {
              backgroundColor: 'rgba(211, 47, 47, 0.07)',
            },
            '& .rbc-header': {
              padding: { xs: '6px 2px', md: '10px 4px' },
              fontWeight: 700,
              fontSize: { xs: '0.7rem', md: '0.82rem' },
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#616161',
              borderBottom: '2px solid #e0e0e0',
            },
            '& .rbc-month-view, & .rbc-time-view, & .rbc-agenda-view': {
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
            },
            '& .rbc-off-range-bg': {
              backgroundColor: '#fafafa',
            },
            '& .rbc-show-more': {
              color: '#d32f2f',
              fontWeight: 700,
              fontSize: '0.72rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
            },
            '& .rbc-event:focus, & .rbc-event.rbc-selected': {
              outline: '2px solid rgba(211,47,47,0.5)',
            },
            '& .rbc-toolbar': {
              display: 'none',   // we use our own RBCToolbar via components prop
            },
            '& .rbc-agenda-table thead': {
              backgroundColor: '#f5f5f5',
            },
            '& .rbc-agenda-event-cell': {
              cursor: 'pointer',
            },
            '& .rbc-time-header-gutter, & .rbc-time-gutter': {
              fontSize: '0.75rem',
              color: '#9e9e9e',
            },
            '& .rbc-current-time-indicator': {
              backgroundColor: '#d32f2f',
            },
          }}>
            <Calendar
              localizer={localizer}
              events={rbcEvents}
              // Controlled — RBC view/date driven by our own state
              view={calView}
              onView={setCalView}
              date={calDate}
              onNavigate={setCalDate}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              components={{ toolbar: RBCToolbar }}
              eventPropGetter={eventPropGetter}
              // Click an event → go to event detail page
              onSelectEvent={(ev) => navigate(`/events/${ev.id}`)}
              // Click an empty day slot → open Create Event dialog
              selectable
              onSelectSlot={() => handleOpenDialog()}
              // Click a date number → drill down to Day view
              drilldownView={Views.DAY}
              style={{ height: '100%' }}
              popup
              tooltipAccessor={(ev) => ev.title}
            />
          </Box>
        </Paper>

      ) : (

        /* ══════════════ LIST VIEW — today + future only ══════════════ */
        upcomingEvents.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3 }}>
            <Typography variant="h5" color="text.secondary">No upcoming events.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Create one to get started!</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {upcomingEvents.map((event) => {
              const dateObj = formatDate(event.start_time);
              return (
                <Card key={event.id} sx={{
                  display: 'flex', flexDirection: { xs: 'column', md: 'row' },
                  transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                }}>
                  <Box sx={{
                    minWidth: 180, bgcolor: 'grey.100',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    p: 3, borderRight: { md: '1px solid' }, borderBottom: { xs: '1px solid', md: 'none' },
                    borderColor: 'divider',
                  }}>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">{dateObj.day}</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="text.secondary"
                      sx={{ textTransform: 'uppercase' }}>{dateObj.monthStr}</Typography>
                  </Box>
                  <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box>
                        <Chip label={event.type} size="small"
                          sx={{ mb: 1, fontWeight: 'bold', bgcolor: getEventColorMui(event.type), color: 'white' }} />
                        <Typography variant="h6" fontWeight="bold">{event.title}</Typography>
                        {event.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                            {event.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={event.is_paid ? `₹${event.fee_amount}` : 'Free'}
                        color={event.is_paid ? 'warning' : 'success'}
                        variant="outlined" sx={{ fontWeight: 'bold', ml: 2, flexShrink: 0 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, color: 'text.secondary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarTodayIcon sx={{ fontSize: 18, mr: 0.75 }} />
                        <Typography variant="body2">{dateObj.fullStr}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationOnIcon sx={{ fontSize: 18, mr: 0.75 }} />
                        <Typography variant="body2">{event.location}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: { md: '1px solid' }, borderColor: 'divider' }}>
                    <Button variant="contained" onClick={() => navigate(`/events/${event.id}`)}>View Details</Button>
                  </Box>
                </Card>
              );
            })}
          </Box>
        )
      )}

      {/* ══════════════ CREATE EVENT DIALOG ══════════════ */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.5rem', pb: 1 }}>Create New Event</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          <TextField fullWidth label="Event Title" margin="normal" required
            placeholder="e.g. Saturday Morning Pick-up"
            value={formData.title} onChange={handleFormChange('title')} />

          <TextField fullWidth select label="Event Type" margin="normal" required
            value={formData.type} onChange={handleTypeChange}>
            {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>

          <TextField fullWidth label="Description" margin="normal" multiline minRows={3}
            placeholder="Tell people what to expect, what to bring, any other details… (optional)"
            value={formData.description} onChange={handleFormChange('description')} />

          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Start Time *</Typography>
              <TextField fullWidth type="datetime-local" size="small" required
                value={formData.start_time} onChange={handleFormChange('start_time')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>End Time *</Typography>
              <TextField fullWidth type="datetime-local" size="small" required
                value={formData.end_time} onChange={handleFormChange('end_time')} />
            </Grid>
          </Grid>

          <TextField fullWidth label="Location" margin="normal" required
            placeholder="e.g. Cubbon Park, Bangalore"
            value={formData.location} onChange={handleFormChange('location')} />

          {/* Attendance (only for Training/Tournament) */}
          {TEAM_ATTENDANCE_TYPES.includes(formData.type) && (
            <>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 0.5 }}>Attendance</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {formData.attendance_mode === 'team'
                  ? 'A team-vs-team event — only team captains can RSVP, on behalf of their whole team.'
                  : 'Anyone can RSVP individually.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Chip icon={<PersonIcon />} label="Individual"
                  variant={formData.attendance_mode === 'individual' ? 'filled' : 'outlined'}
                  color={formData.attendance_mode === 'individual' ? 'primary' : 'default'}
                  onClick={() => setFormData(p => ({ ...p, attendance_mode: 'individual' }))}
                  sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
                <Chip icon={<GroupsIcon />} label="Team Event"
                  variant={formData.attendance_mode === 'team' ? 'filled' : 'outlined'}
                  color={formData.attendance_mode === 'team' ? 'primary' : 'default'}
                  onClick={() => setFormData(p => ({ ...p, attendance_mode: 'team' }))}
                  sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
              </Box>
            </>
          )}

          {/* Hosting */}
          {myTeams.length > 0 && (
            <>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>Hosting</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {formData.hosting_team_id
                  ? "The event will show your team's logo and name as the host."
                  : 'You will be listed as the host.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: formData.hosting_team_id ? 1.5 : 2, flexWrap: 'wrap' }}>
                <Chip icon={<PersonIcon />} label="Hosted by Me"
                  variant={!formData.hosting_team_id ? 'filled' : 'outlined'}
                  color={!formData.hosting_team_id ? 'primary' : 'default'}
                  onClick={() => setFormData(p => ({ ...p, hosting_team_id: '' }))}
                  sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
                <Chip icon={<GroupsIcon />} label="Hosted by My Team"
                  variant={formData.hosting_team_id ? 'filled' : 'outlined'}
                  color={formData.hosting_team_id ? 'primary' : 'default'}
                  onClick={() => setFormData(p => ({ ...p, hosting_team_id: p.hosting_team_id || myTeams[0].id }))}
                  sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
              </Box>
              {formData.hosting_team_id && (
                <TextField fullWidth select size="small" label="Team" sx={{ mb: 2 }}
                  value={formData.hosting_team_id} onChange={handleFormChange('hosting_team_id')}>
                  {myTeams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </TextField>
              )}
            </>
          )}

          {/* Visibility */}
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 0.5 }}>Visibility</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {formData.is_public ? 'Appears on the public calendar.' : 'Hidden — only accessible via direct link.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            {[{ label: 'Public', val: true, icon: <PublicIcon /> }, { label: 'Private', val: false, icon: <LockIcon /> }]
              .map(({ label, val, icon }) => (
                <Chip key={label} icon={icon} label={label}
                  variant={formData.is_public === val ? 'filled' : 'outlined'}
                  color={formData.is_public === val ? 'primary' : 'default'}
                  onClick={() => setFormData(p => ({ ...p, is_public: val }))}
                  sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
              ))}
          </Box>

          {/* Access */}
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>Access</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {formData.is_open ? 'Anyone can RSVP instantly.' : 'RSVPs require your approval.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Chip icon={<GroupIcon />} label="Open RSVP"
              variant={formData.is_open ? 'filled' : 'outlined'}
              color={formData.is_open ? 'success' : 'default'}
              onClick={() => setFormData(p => ({ ...p, is_open: true }))}
              sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
            <Chip icon={<PersonAddIcon />} label="Invite Only"
              variant={!formData.is_open ? 'filled' : 'outlined'}
              color={!formData.is_open ? 'warning' : 'default'}
              onClick={() => setFormData(p => ({ ...p, is_open: false }))}
              sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
          </Box>

          {/* Pricing */}
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>Pricing</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {formData.is_paid ? 'Attendees pay a fee and submit a payment reference.' : 'Free for everyone.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
            <Chip icon={<MoneyOffIcon />} label="Free"
              variant={!formData.is_paid ? 'filled' : 'outlined'}
              color={!formData.is_paid ? 'success' : 'default'}
              onClick={() => setFormData(p => ({ ...p, is_paid: false }))}
              sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
            <Chip icon={<AttachMoneyIcon />} label="Paid"
              variant={formData.is_paid ? 'filled' : 'outlined'}
              color={formData.is_paid ? 'warning' : 'default'}
              onClick={() => setFormData(p => ({ ...p, is_paid: true }))}
              sx={{ fontWeight: 'bold', px: 1, cursor: 'pointer' }} />
          </Box>

          {/* Paid fields */}
          {formData.is_paid && (
            <Box sx={{ mt: 2, p: 2.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>Payment Details</Typography>
              <TextField fullWidth label="Fee Amount (₹)" type="number" margin="dense"
                placeholder="e.g. 200" value={formData.fee_amount} onChange={handleFormChange('fee_amount')}
                InputProps={{ inputProps: { min: 1 } }} />

              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>UPI ID for Payments</Typography>

              {savedUpiIds.length > 0 ? (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Select from your saved UPI IDs:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {savedUpiIds.map((upi, idx) => {
                      const isSelected = formData.event_upi_id === upi && !customUpi;
                      return (
                        <Chip key={idx} label={upi}
                          icon={isSelected ? <CheckIcon /> : undefined}
                          variant={isSelected ? 'filled' : 'outlined'}
                          color={isSelected ? 'primary' : 'default'}
                          onClick={() => handleSelectUpi(upi)}
                          sx={{ fontWeight: 'bold', cursor: 'pointer' }} />
                      );
                    })}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Or enter a different UPI ID:
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  No saved UPI IDs — add them in Edit Profile, or enter one below:
                </Typography>
              )}

              <TextField fullWidth size="small" placeholder="e.g. yourname@upi"
                value={customUpi} onChange={handleCustomUpiChange}
                helperText="Attendees will see this UPI ID to send the event fee." />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateEvent} disabled={saving} sx={{ px: 4 }}>
            {saving ? 'Creating…' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Events;
