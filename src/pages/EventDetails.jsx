import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button, Divider, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress,
  Alert, List, ListItem, ListItemAvatar, ListItemText, IconButton, Tooltip
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import GroupsIcon from '@mui/icons-material/Groups';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [event,     setEvent]     = useState(null);
  const [creator,   setCreator]   = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Hosting team (if event.hosting_team_id is set)
  const [hostingTeam, setHostingTeam] = useState(null);
  const [isHostingTeamCaptain, setIsHostingTeamCaptain] = useState(false);

  // RSVP
  const [openRsvp,    setOpenRsvp]    = useState(false);
  const [paymentRef,  setPaymentRef]  = useState('');
  const [rsvpComment, setRsvpComment] = useState('');
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpError,   setRsvpError]   = useState('');
  // Set when RSVPing on behalf of a team (attendance_mode === 'team'); null = individual RSVP
  const [rsvpTeam,    setRsvpTeam]    = useState(null);

  // Team RSVPs (attendance_mode === 'team')
  const [teamAttendees,  setTeamAttendees]  = useState([]);
  const [myCaptainTeams, setMyCaptainTeams] = useState([]);

  // Delete event
  const [openDelete,    setOpenDelete]    = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Share
  const [copied, setCopied] = useState(false);

  // Current user's own attendance row
  const [myAttendance, setMyAttendance] = useState(null);

  useEffect(() => { fetchEventData(); }, [id]);

  const fetchEventData = async () => {
    try {
      const { data: eventData, error: eventErr } = await supabase
        .from('events').select('*').eq('id', id).single();
      if (eventErr) throw eventErr;
      setEvent(eventData);

      const { data: creatorData } = await supabase
        .from('profiles').select('id, full_name, username, avatar_url')
        .eq('id', eventData.creator_id).single();
      setCreator(creatorData);

      if (eventData.hosting_team_id) {
        const { data: teamData } = await supabase
          .from('teams').select('id, name, logo_url')
          .eq('id', eventData.hosting_team_id).single();
        setHostingTeam(teamData || null);

        if (user) {
          const { data: memberRow } = await supabase
            .from('team_members').select('role')
            .eq('team_id', eventData.hosting_team_id)
            .eq('user_id', user.uid)
            .maybeSingle();
          setIsHostingTeamCaptain(memberRow?.role === 'captain');
        }
      } else {
        setHostingTeam(null);
        setIsHostingTeamCaptain(false);
      }

      if (eventData.attendance_mode === 'team') {
        const { data: teamAttendeesData } = await supabase
          .from('event_team_attendees')
          .select('*, teams(id, name, logo_url)')
          .eq('event_id', id)
          .order('created_at', { ascending: true });
        setTeamAttendees(teamAttendeesData || []);
        setAttendees([]);
        setMyAttendance(null);

        if (user) {
          const { data: captainRows } = await supabase
            .from('team_members')
            .select('teams(id, name, logo_url)')
            .eq('user_id', user.uid)
            .eq('role', 'captain');
          setMyCaptainTeams((captainRows || []).map(r => r.teams).filter(Boolean));
        } else {
          setMyCaptainTeams([]);
        }
      } else {
        const { data: attendeesData } = await supabase
          .from('event_attendees')
          .select('*, profiles(full_name, username, avatar_url)')
          .eq('event_id', id)
          .order('created_at', { ascending: true });
        setAttendees(attendeesData || []);
        setTeamAttendees([]);
        setMyCaptainTeams([]);

        if (user) {
          const mine = (attendeesData || []).find(a => a.user_id === user.uid);
          setMyAttendance(mine || null);
        }
      }
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── RSVP (dialog — paid or invite-only) ──────────────────────────────────────
  const handleRsvp = async () => {
    setRsvpLoading(true);
    setRsvpError('');
    try {
      let status = 'confirmed';
      if (!event.is_open) status = 'pending';
      if (event.is_paid) {
        status = 'pending';
        if (!paymentRef.trim()) {
          setRsvpError('Please enter the UPI transaction reference.');
          setRsvpLoading(false);
          return;
        }
      }
      const { error } = await supabase.from('event_attendees').insert([{
        event_id: id, user_id: user.uid, status,
        payment_reference_id: event.is_paid ? paymentRef.trim() : null,
        rsvp_comment: rsvpComment.trim() || null,
      }]);
      if (error) {
        if (error.code === '23505') setRsvpError('You have already RSVP\'d to this event.');
        else throw error;
      } else {
        setOpenRsvp(false);
        setPaymentRef('');
        setRsvpComment('');
        await fetchEventData();
      }
    } catch (err) {
      setRsvpError(err.message || 'Failed to RSVP.');
    } finally {
      setRsvpLoading(false);
    }
  };

  // ── Direct RSVP (free + open) — now opens dialog to allow optional comment ───
  const handleRsvpDirect = () => {
    if (!user) { navigate('/login'); return; }
    setOpenRsvp(true);
  };

  // ── Cancel own RSVP ───────────────────────────────────────────────────────────
  const handleCancelRsvp = async () => {
    try {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', id)
        .eq('user_id', user.uid);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Cancel RSVP error:', err);
    }
  };

  // ── Approve / Decline attendee (moderator) ────────────────────────────────────
  const handleUpdateAttendee = async (userId, newStatus) => {
    try {
      const { error } = await supabase
        .from('event_attendees')
        .update({ status: newStatus })
        .eq('event_id', id).eq('user_id', userId);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Error updating attendee:', err);
    }
  };

  // ── Remove attendee (moderator) ───────────────────────────────────────────────
  const handleRemoveAttendee = async (userId) => {
    try {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', id).eq('user_id', userId);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Remove attendee error:', err);
    }
  };

  // ── Team RSVP (attendance_mode === 'team') ───────────────────────────────────
  const handleRsvpTeamClick = (team) => {
    handleRsvpTeamDirect(team);
  };

  // Direct team RSVP (free + open) — now opens dialog to allow optional comment
  const handleRsvpTeamDirect = (team) => {
    setRsvpTeam(team);
    setOpenRsvp(true);
  };

  // Team RSVP via dialog (paid or invite-only)
  const handleRsvpTeam = async () => {
    setRsvpLoading(true);
    setRsvpError('');
    try {
      let status = 'confirmed';
      if (!event.is_open) status = 'pending';
      if (event.is_paid) {
        status = 'pending';
        if (!paymentRef.trim()) {
          setRsvpError('Please enter the UPI transaction reference.');
          setRsvpLoading(false);
          return;
        }
      }
      const { error } = await supabase.from('event_team_attendees').insert([{
        event_id: id, team_id: rsvpTeam.id, rsvp_by: user.uid, status,
        payment_reference_id: event.is_paid ? paymentRef.trim() : null,
        rsvp_comment: rsvpComment.trim() || null,
      }]);
      if (error) {
        if (error.code === '23505') setRsvpError('This team has already RSVP\'d to this event.');
        else throw error;
      } else {
        setOpenRsvp(false);
        setPaymentRef('');
        setRsvpComment('');
        setRsvpTeam(null);
        await fetchEventData();
      }
    } catch (err) {
      setRsvpError(err.message || 'Failed to RSVP.');
    } finally {
      setRsvpLoading(false);
    }
  };

  // Withdraw a team's RSVP (captain of that team)
  const handleCancelTeamRsvp = async (teamId) => {
    try {
      const { error } = await supabase
        .from('event_team_attendees')
        .delete()
        .eq('event_id', id).eq('team_id', teamId);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Cancel team RSVP error:', err);
    }
  };

  // Approve / decline a team's RSVP (moderator)
  const handleUpdateTeamAttendee = async (teamId, newStatus) => {
    try {
      const { error } = await supabase
        .from('event_team_attendees')
        .update({ status: newStatus })
        .eq('event_id', id).eq('team_id', teamId);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Error updating team attendee:', err);
    }
  };

  // Remove a team from the event (moderator)
  const handleRemoveTeamAttendee = async (teamId) => {
    try {
      const { error } = await supabase
        .from('event_team_attendees')
        .delete()
        .eq('event_id', id).eq('team_id', teamId);
      if (error) throw error;
      await fetchEventData();
    } catch (err) {
      console.error('Remove team attendee error:', err);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────────
  const handleDeleteEvent = async () => {
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      navigate('/events');
    } catch (err) {
      alert('Failed to delete event: ' + err.message);
    } finally {
      setDeleteLoading(false);
      setOpenDelete(false);
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────────
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUpi = (upiId) => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString('default', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getEventColor = (type) => ({
    Training: 'info', 'Pick-up': 'success', Tournament: 'warning',
  }[type] || 'secondary');

  const statusIcon = (status) => ({
    confirmed: <CheckCircleIcon color="success" fontSize="small" />,
    pending:   <HourglassEmptyIcon color="warning" fontSize="small" />,
    declined:  <CancelIcon color="error" fontSize="small" />,
  }[status] || null);

  const getInitials = (name) =>
    (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const isPastEvent  = event ? new Date(event.end_time) < new Date() : false;
  const isCreator    = user && event && user.uid === event.creator_id;
  const canModerate  = isCreator || isAdmin || isHostingTeamCaptain;
  const deleteLabel  = isCreator ? 'Delete Event'
    : isAdmin ? 'Remove Event (Admin)'
    : isHostingTeamCaptain ? 'Remove Event (Team Captain)'
    : 'Delete Event';
  const rosterForCounts = event?.attendance_mode === 'team' ? teamAttendees : attendees;
  const confirmedCount = rosterForCounts.filter(a => a.status === 'confirmed').length;
  const pendingCount   = rosterForCounts.filter(a => a.status === 'pending').length;

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
  );

  if (!event) return (
    <Box sx={{ textAlign: 'center', pt: 10 }}>
      <Typography variant="h5" color="text.secondary">Event not found.</Typography>
      <Button variant="text" onClick={() => navigate('/events')} sx={{ mt: 2 }}>← Back to Events</Button>
    </Box>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ pb: { xs: event?.attendance_mode !== 'team' && !isPastEvent ? 10 : 0, sm: 0 } }}>
      {/* Top bar: back + delete — icon-only on mobile */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/events')}
          sx={{ fontWeight: 'bold', minWidth: 'unset', '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } } }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Back to Events</Box>
        </Button>
        {canModerate && (
          <Button startIcon={<DeleteIcon />} color="error" variant="outlined" onClick={() => setOpenDelete(true)}
            sx={{ minWidth: 'unset', '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{deleteLabel}</Box>
          </Button>
        )}
      </Box>

      <Card sx={{ mb: 4, overflow: 'hidden', boxShadow: 3 }}>

        {/* ── Compact header — replaces gradient ── */}
        <Box sx={{
          borderTop: '6px solid', borderColor: 'primary.main',
          px: { xs: 3, md: 5 }, pt: 3, pb: 2.5, bgcolor: 'grey.50',
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-start' },
            gap: { xs: 1, sm: 2 },
          }}>
            <Box>
              <Typography variant="h3" fontWeight="bold"
                sx={{ lineHeight: 1.25, fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' } }}>
                {event.title}
              </Typography>
              {isPastEvent && (
                <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.5, fontWeight: 500 }}>
                  Past Event
                </Typography>
              )}
            </Box>
            <Chip
              label={event.type}
              color={getEventColor(event.type)}
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0, mt: { xs: 0, sm: 0.5 } }}
            />
          </Box>
        </Box>

        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Grid container spacing={4}>

            {/* ── Left column: meta + about ── */}
            <Grid size={{ xs: 12, md: 6 }}>
              {/* Status chips — horizontal scroll on mobile */}
              <Box sx={{
                display: 'flex', gap: 1, mb: 3,
                flexWrap: { xs: 'nowrap', sm: 'wrap' },
                overflowX: { xs: 'auto', sm: 'visible' },
                pb: { xs: 0.5, sm: 0 },
                '&::-webkit-scrollbar': { display: 'none' },
              }}>
                <Chip
                  icon={event.is_public ? <PublicIcon /> : <LockIcon />}
                  label={event.is_public ? 'Public' : 'Private'}
                  variant="outlined" size="small" sx={{ flexShrink: 0 }}
                />
                <Chip
                  label={event.is_open ? 'Open RSVP' : 'Invite Only'}
                  variant="outlined" size="small"
                  color={event.is_open ? 'success' : 'warning'}
                  sx={{ flexShrink: 0 }}
                />
                <Chip
                  label={event.is_paid ? `₹${event.fee_amount}` : 'Free'}
                  color={event.is_paid ? 'warning' : 'success'}
                  size="small" sx={{ fontWeight: 'bold', flexShrink: 0 }}
                />
                {isPastEvent && <Chip label="Past Event" color="default" size="small" sx={{ flexShrink: 0, display: { xs: 'none', sm: 'flex' } }} />}
              </Box>

              {/* Date & Location */}
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 2 }}>
                <CalendarTodayIcon sx={{ fontSize: 22, mr: 1.5, color: 'primary.main' }} />
                <Typography variant="body1" fontWeight={500}>
                  {formatDateTime(event.start_time)} — {formatDateTime(event.end_time)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 3 }}>
                <LocationOnIcon sx={{ fontSize: 22, mr: 1.5, color: 'primary.main' }} />
                <Typography variant="body1" fontWeight={500}>{event.location}</Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Share */}
              <Button startIcon={<ShareIcon />} variant="outlined" size="small"
                onClick={handleShare} sx={{ mb: 3 }}>
                {copied ? 'Link Copied!' : 'Share Event'}
              </Button>

              {/* About */}
              <Typography variant="h5" fontWeight="bold" gutterBottom>About</Typography>
              {event.description ? (
                <Typography variant="body1" color="text.secondary"
                  sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {event.description}
                </Typography>
              ) : (
                <Typography variant="body1" color="text.secondary"
                  sx={{ lineHeight: 1.8, fontStyle: 'italic' }}>
                  No description provided.
                </Typography>
              )}
            </Grid>

            {/* ── Card 1 — Hosted By + RSVP ── */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%', boxShadow: 0, border: '2px solid', borderColor: 'divider', borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight="bold"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5, display: { xs: 'none', sm: 'block' } }}>
                    Hosted By
                  </Typography>
                  {hostingTeam ? (
                    <Box
                      onClick={() => navigate(`/teams/${hostingTeam.id}`)}
                      sx={{ display: 'flex', alignItems: 'center', mb: { xs: 0, sm: 3 }, cursor: 'pointer' }}
                    >
                      <Avatar src={hostingTeam.logo_url || undefined}
                        sx={{ width: 44, height: 44, mr: 1.5, bgcolor: 'grey.200', fontWeight: 'bold' }}>
                        {!hostingTeam.logo_url && getInitials(hostingTeam.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="bold">{hostingTeam.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Organized by {creator?.full_name || 'a member'}
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 0, sm: 3 } }}>
                      <Avatar sx={{ width: 44, height: 44, mr: 1.5, bgcolor: 'grey.200', fontWeight: 'bold' }}>
                        {creator?.avatar_url
                          ? <img src={creator.avatar_url} alt={creator?.full_name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : (creator?.full_name?.[0]?.toUpperCase() || '?')}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="bold">{creator?.full_name || 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary">@{creator?.username || 'user'}</Typography>
                      </Box>
                    </Box>
                  )}

                  <Divider sx={{ mb: 2, display: { xs: 'none', sm: 'block' } }} />

                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {isPastEvent ? (
                    <Button fullWidth variant="outlined" disabled sx={{ py: 1.5 }}>Event Ended</Button>
                  ) : event.attendance_mode === 'team' ? (
                    myCaptainTeams.length === 0 ? (
                      <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                        Only team captains can RSVP for this team event.
                      </Alert>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {myCaptainTeams.map(team => {
                          const teamRsvp = teamAttendees.find(a => a.team_id === team.id);
                          return teamRsvp ? (
                            <Box key={team.id}>
                              <Chip
                                icon={statusIcon(teamRsvp.status)}
                                label={`${team.name}: ${
                                  teamRsvp.status === 'confirmed' ? 'You\'re In!' :
                                  teamRsvp.status === 'pending'   ? 'Awaiting Approval' : 'Declined'
                                }`}
                                color={
                                  teamRsvp.status === 'confirmed' ? 'success' :
                                  teamRsvp.status === 'pending'   ? 'warning' : 'error'
                                }
                                sx={{ fontWeight: 'bold', fontSize: '0.85rem', py: 2.5, px: 1, width: '100%' }}
                              />
                              <Button fullWidth size="small" color="error" variant="text"
                                onClick={() => handleCancelTeamRsvp(team.id)} sx={{ mt: 0.5, fontWeight: 'bold' }}>
                                Withdraw {team.name}
                              </Button>
                            </Box>
                          ) : (
                            <Button key={team.id}
                              variant="contained" color="primary" fullWidth
                              disabled={rsvpLoading}
                              onClick={() => handleRsvpTeamClick(team)}
                              sx={{ py: 1.5, fontSize: '1rem', borderRadius: 2, fontWeight: 'bold' }}
                            >
                              RSVP {team.name}
                            </Button>
                          );
                        })}
                      </Box>
                    )
                  ) : myAttendance ? (
                    <Box>
                      <Chip
                        icon={statusIcon(myAttendance.status)}
                        label={
                          myAttendance.status === 'confirmed' ? 'You\'re In!' :
                          myAttendance.status === 'pending'   ? 'Awaiting Approval' : 'Declined'
                        }
                        color={
                          myAttendance.status === 'confirmed' ? 'success' :
                          myAttendance.status === 'pending'   ? 'warning' : 'error'
                        }
                        sx={{ fontWeight: 'bold', fontSize: '0.95rem', py: 2.5, px: 1, width: '100%' }}
                      />
                      <Button fullWidth size="small" color="error" variant="text"
                        onClick={handleCancelRsvp} sx={{ mt: 1, fontWeight: 'bold' }}>
                        Cancel RSVP
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      variant="contained" color="primary" size="large" fullWidth
                      disabled={rsvpLoading}
                      onClick={() => {
                        if (!user) { navigate('/login'); return; }
                        handleRsvpDirect();
                      }}
                      sx={{ py: 1.5, fontSize: '1.1rem', borderRadius: 2, fontWeight: 'bold' }}
                    >
                      {rsvpLoading ? <CircularProgress size={22} color="inherit" /> : 'RSVP Now'}
                    </Button>
                  )}
                  </Box>
                </CardContent>
              </Card>

            </Grid>

            {/* ── Card 2 — Attendees ── */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%', boxShadow: 0, border: '2px solid', borderColor: 'divider', borderRadius: 3 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <GroupsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                      {event.attendance_mode === 'team' ? 'Teams' : 'Attendees'}
                    </Typography>
                    <Chip label={`${confirmedCount} ${event.attendance_mode === 'team' ? 'confirmed' : 'going'}`}
                      size="small" color="success" sx={{ fontWeight: 'bold' }} />
                    {pendingCount > 0 && (
                      <Chip label={`${pendingCount} pending`} size="small" color="warning"
                        sx={{ fontWeight: 'bold' }} />
                    )}
                  </Box>

                  {event.attendance_mode === 'team' ? (
                    teamAttendees.length === 0 ? (
                      <Typography variant="body2" color="text.secondary"
                        sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}>
                        No teams have RSVP'd yet.
                      </Typography>
                    ) : (
                      <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                        <List dense disablePadding>
                          {teamAttendees.map((ta, idx) => {
                            const team = ta.teams;
                            const isMyTeam = myCaptainTeams.some(t => t.id === ta.team_id);
                            return (
                              <ListItem
                                key={ta.team_id}
                                disableGutters
                                divider={idx < teamAttendees.length - 1}
                                sx={{ py: 0.75 }}
                                secondaryAction={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                    {canModerate && !isMyTeam && ta.status === 'pending' && (
                                      <>
                                        <Tooltip title="Approve">
                                          <IconButton size="small" color="success"
                                            onClick={() => handleUpdateTeamAttendee(ta.team_id, 'confirmed')}>
                                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Decline">
                                          <IconButton size="small" color="warning"
                                            onClick={() => handleUpdateTeamAttendee(ta.team_id, 'declined')}>
                                            <CancelIcon sx={{ fontSize: 18 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </>
                                    )}
                                    {canModerate && !isMyTeam && (
                                      <Tooltip title="Remove team">
                                        <IconButton size="small" color="error"
                                          onClick={() => handleRemoveTeamAttendee(ta.team_id)}>
                                          <PersonRemoveIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {(!canModerate || isMyTeam) && statusIcon(ta.status)}
                                  </Box>
                                }
                              >
                                <ListItemAvatar sx={{ minWidth: 38 }}>
                                  <Avatar src={team?.logo_url || undefined} sx={{
                                    width: 28, height: 28,
                                    bgcolor: 'grey.200',
                                    fontSize: '0.75rem', fontWeight: 'bold',
                                  }}>
                                    {!team?.logo_url && getInitials(team?.name)}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" fontWeight="bold" noWrap>
                                      {team?.name || 'Unknown Team'}
                                      {isMyTeam && (
                                        <Typography component="span" variant="caption"
                                          color="primary.main" sx={{ ml: 0.75 }}>
                                          (your team)
                                        </Typography>
                                      )}
                                    </Typography>
                                  }
                                  secondary={
                                    (ta.payment_reference_id && canModerate) || ta.rsvp_comment ? (
                                      <>
                                        {ta.payment_reference_id && canModerate && (
                                          <Typography component="span" variant="caption" color="info.main" display="block">
                                            Ref: {ta.payment_reference_id}
                                          </Typography>
                                        )}
                                        {ta.rsvp_comment && (
                                          <Typography component="span" variant="caption" color="text.secondary"
                                            display="block" sx={{ fontStyle: 'italic', mt: 0.25 }}>
                                            "{ta.rsvp_comment}"
                                          </Typography>
                                        )}
                                      </>
                                    ) : null
                                  }
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </Box>
                    )
                  ) : attendees.length === 0 ? (
                    <Typography variant="body2" color="text.secondary"
                      sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}>
                      No RSVPs yet. Be the first!
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                      <List dense disablePadding>
                        {attendees.map((attendee, idx) => {
                          const isMe = user && attendee.user_id === user.uid;
                          return (
                            <ListItem
                              key={attendee.user_id}
                              disableGutters
                              divider={idx < attendees.length - 1}
                              sx={{ py: { xs: 0.5, sm: 0.75 } }}
                              secondaryAction={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                  {canModerate && !isMe && attendee.status === 'pending' && (
                                    <>
                                      <Tooltip title="Approve">
                                        <IconButton size="small" color="success"
                                          onClick={() => handleUpdateAttendee(attendee.user_id, 'confirmed')}>
                                          <CheckCircleIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Decline">
                                        <IconButton size="small" color="warning"
                                          onClick={() => handleUpdateAttendee(attendee.user_id, 'declined')}>
                                          <CancelIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                  {canModerate && !isMe && (
                                    <Tooltip title="Remove attendee">
                                      <IconButton size="small" color="error"
                                        onClick={() => handleRemoveAttendee(attendee.user_id)}>
                                        <PersonRemoveIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {(!canModerate || isMe) && statusIcon(attendee.status)}
                                </Box>
                              }
                            >
                              <ListItemAvatar sx={{ minWidth: 38 }}>
                                <Avatar sx={{
                                  width: { xs: 24, sm: 28 }, height: { xs: 24, sm: 28 },
                                  bgcolor: 'grey.200',
                                  fontSize: '0.7rem', fontWeight: 'bold',
                                }}>
                                  {attendee.profiles?.avatar_url
                                    ? <img src={attendee.profiles.avatar_url} alt={attendee.profiles?.full_name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                    : (attendee.profiles?.full_name?.[0]?.toUpperCase() || '?')}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" fontWeight="bold" noWrap>
                                    {attendee.profiles?.full_name || 'Unknown'}
                                    {isMe && (
                                      <Typography component="span" variant="caption"
                                        color="primary.main" sx={{ ml: 0.75 }}>
                                        (you)
                                      </Typography>
                                    )}
                                  </Typography>
                                }
                                secondary={
                                  <>
                                    <Typography component="span" variant="caption" color="text.secondary" display="block">
                                      @{attendee.profiles?.username || 'user'}
                                      {attendee.payment_reference_id && canModerate && (
                                        <> · <Typography component="span" variant="caption" color="info.main">
                                          Ref: {attendee.payment_reference_id}
                                        </Typography></>
                                      )}
                                    </Typography>
                                    {attendee.rsvp_comment && (
                                      <Typography component="span" variant="caption" color="text.secondary"
                                        display="block" sx={{ fontStyle: 'italic', mt: 0.25 }}>
                                        "{attendee.rsvp_comment}"
                                      </Typography>
                                    )}
                                  </>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    </Box>
                  )}
                </CardContent>
              </Card>

            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ══ STICKY BOTTOM RSVP BAR — mobile only, individual mode ══ */}
      {event.attendance_mode !== 'team' && (
        <Box sx={{
          display: { xs: 'block', sm: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
          bgcolor: 'background.paper',
          borderTop: '1px solid', borderColor: 'divider',
          px: 2, py: 1.5,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
        }}>
          {isPastEvent ? (
            <Button fullWidth variant="outlined" disabled sx={{ py: 1.25, fontWeight: 'bold' }}>Event Ended</Button>
          ) : myAttendance ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={statusIcon(myAttendance.status)}
                label={
                  myAttendance.status === 'confirmed' ? "You're In!" :
                  myAttendance.status === 'pending'   ? 'Awaiting Approval' : 'Declined'
                }
                color={
                  myAttendance.status === 'confirmed' ? 'success' :
                  myAttendance.status === 'pending'   ? 'warning' : 'error'
                }
                sx={{ fontWeight: 'bold', flexGrow: 1, justifyContent: 'flex-start', fontSize: '0.85rem' }}
              />
              <Button size="small" color="error" variant="outlined" onClick={handleCancelRsvp}
                sx={{ fontWeight: 'bold', flexShrink: 0 }}>
                Cancel
              </Button>
            </Box>
          ) : (
            <Button
              variant="contained" color="primary" fullWidth
              disabled={rsvpLoading}
              onClick={() => {
                if (!user) { navigate('/login'); return; }
                if (!event.is_paid && event.is_open) handleRsvpDirect();
                else setOpenRsvp(true);
              }}
              sx={{ py: 1.25, fontSize: '1rem', fontWeight: 'bold', borderRadius: 2 }}
            >
              {rsvpLoading ? <CircularProgress size={20} color="inherit" /> : 'RSVP Now'}
            </Button>
          )}
        </Box>
      )}

      {/* ══ RSVP DIALOG ══ */}
      <Dialog open={openRsvp} onClose={() => { setOpenRsvp(false); setRsvpTeam(null); setRsvpComment(''); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.4rem' }}>
          Confirm RSVP{rsvpTeam ? ` — ${rsvpTeam.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {rsvpError && <Alert severity="error" sx={{ mb: 2 }}>{rsvpError}</Alert>}
          {!event.is_open && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This is an <strong>invite-only</strong> event. Your RSVP will be sent to the host for approval.
            </Alert>
          )}
          {event.is_paid && (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Please pay <strong>₹{event.fee_amount}</strong> to the UPI ID below and enter the transaction reference.
              </Typography>
              {event.event_upi_ids?.map((upiId, idx) => (
                <Box key={idx} sx={{
                  bgcolor: 'grey.100', p: 2, borderRadius: 2, mb: 2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: '1px dashed', borderColor: 'divider',
                }}>
                  <Typography variant="body1" fontWeight="bold">{upiId}</Typography>
                  <IconButton size="small" onClick={() => handleCopyUpi(upiId)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <TextField fullWidth label="Transaction Reference / UTR" margin="normal" required
                placeholder="e.g. 123456789012"
                value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            </>
          )}
          {!event.is_paid && !event.is_open && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Click confirm to send your RSVP request. The host will review and approve it.
            </Typography>
          )}
          {!event.is_paid && event.is_open && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Free, open event — RSVP instantly. Leave a note for the host if you'd like.
            </Typography>
          )}
          <TextField
            fullWidth
            label="Comment (optional)"
            placeholder="e.g. Bringing a guest, dietary restriction, question for the host…"
            multiline
            minRows={2}
            margin="normal"
            inputProps={{ maxLength: 280 }}
            value={rsvpComment}
            onChange={(e) => setRsvpComment(e.target.value)}
            helperText={`${rsvpComment.length}/280`}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => { setOpenRsvp(false); setRsvpTeam(null); setRsvpComment(''); }} disabled={rsvpLoading}>Cancel</Button>
          <Button variant="contained" onClick={rsvpTeam ? handleRsvpTeam : handleRsvp} disabled={rsvpLoading} sx={{ px: 4 }}>
            {rsvpLoading ? 'Submitting…' : 'Confirm RSVP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ DELETE DIALOG ══ */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Delete Event?</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>This action is <strong>permanent</strong> and cannot be undone.</Alert>
          <Typography variant="body1" color="text.secondary">
            "<strong>{event?.title}</strong>" and all its RSVPs will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setOpenDelete(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteEvent}
            disabled={deleteLoading} sx={{ px: 4 }}>
            {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EventDetails;
