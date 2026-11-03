import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Divider,
  LinearProgress, List, Tooltip,
} from '@mui/material';
import EventIcon          from '@mui/icons-material/Event';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import CancelIcon         from '@mui/icons-material/Cancel';
import HelpOutlineIcon    from '@mui/icons-material/HelpOutlined';
import LocationOnIcon     from '@mui/icons-material/LocationOn';
import BarChartIcon       from '@mui/icons-material/BarChart';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const SESSION_TYPE_COLOR = {
  Training: 'info', Tournament: 'warning', 'Pick-up': 'success', Other: 'default',
};

const STATUSES = ['present', 'absent', 'excused'];

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'success', Icon: CheckCircleIcon },
  absent:  { label: 'Absent',  color: 'error',   Icon: CancelIcon },
  excused: { label: 'Excused', color: 'warning',  Icon: HelpOutlineIcon },
};

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export default function TeamSessionsTab({ teamId, members, profileMap, isTeamAdmin, user }) {
  const navigate = useNavigate();

  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [stats,     setStats]     = useState({});  // userId → { present, total }
  const [error,     setError]     = useState('');

  // Attendance dialog
  const [attOpen,    setAttOpen]    = useState(false);
  const [attSession, setAttSession] = useState(null);
  const [attMarks,   setAttMarks]   = useState({}); // userId → status | ''
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving,  setAttSaving]  = useState(false);
  const [attError,   setAttError]   = useState('');

  useEffect(() => { fetchSessions(); }, [teamId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, type, start_time, end_time, location')
        .eq('hosting_team_id', teamId)
        .order('start_time', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      setSessions(rows);

      // Build attendance stats
      const pastIds = rows.filter(s => new Date(s.end_time) < new Date()).map(s => s.id);
      if (pastIds.length > 0) {
        const { data: marks } = await supabase
          .from('event_attendance_marks')
          .select('user_id, status')
          .eq('team_id', teamId)
          .in('event_id', pastIds);

        const map = {};
        members.forEach(m => { map[m.user_id] = { present: 0, total: pastIds.length }; });
        (marks || []).forEach(mk => {
          if (!map[mk.user_id]) map[mk.user_id] = { present: 0, total: pastIds.length };
          if (mk.status === 'present') map[mk.user_id].present++;
        });
        setStats(map);
      }
    } catch (err) {
      setError(err.message || 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  };

  // ── Attendance dialog ──────────────────────────────────────────────────────
  const openAttendance = async (session) => {
    setAttSession(session);
    setAttError('');
    setAttOpen(true);
    setAttLoading(true);
    try {
      // Existing marks
      const { data: existing } = await supabase
        .from('event_attendance_marks')
        .select('user_id, status')
        .eq('event_id', session.id)
        .eq('team_id', teamId);

      // Confirmed RSVPs from event_attendees (to pre-fill if no marks yet)
      const memberIds = members.map(m => m.user_id);
      const { data: rsvps } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', session.id)
        .eq('status', 'confirmed')
        .in('user_id', memberIds);

      const rsvpSet = new Set((rsvps || []).map(r => r.user_id));
      const marks = {};

      if (existing && existing.length > 0) {
        existing.forEach(m => { marks[m.user_id] = m.status; });
      } else {
        // Pre-fill: confirmed RSVPs → present, rest → unmarked
        members.forEach(m => {
          marks[m.user_id] = rsvpSet.has(m.user_id) ? 'present' : '';
        });
      }
      setAttMarks(marks);
    } catch (err) {
      setAttError(err.message || 'Failed to load attendance data.');
    } finally {
      setAttLoading(false);
    }
  };

  const cycleStatus = (userId) => {
    const current = attMarks[userId] || '';
    const idx     = STATUSES.indexOf(current);
    const next    = idx === -1 ? STATUSES[0] : idx === STATUSES.length - 1 ? '' : STATUSES[idx + 1];
    setAttMarks(prev => ({ ...prev, [userId]: next }));
  };

  const saveAttendance = async () => {
    setAttSaving(true); setAttError('');
    try {
      const rows = members
        .filter(m => attMarks[m.user_id])
        .map(m => ({
          event_id:  attSession.id,
          team_id:   teamId,
          user_id:   m.user_id,
          status:    attMarks[m.user_id],
          marked_by: user.uid,
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('event_attendance_marks')
          .upsert(rows, { onConflict: 'event_id,team_id,user_id' });
        if (error) throw error;
      }

      // Delete marks for members explicitly left as unmarked
      const unmarkedIds = members
        .filter(m => !attMarks[m.user_id])
        .map(m => m.user_id);
      if (unmarkedIds.length > 0) {
        await supabase
          .from('event_attendance_marks')
          .delete()
          .eq('event_id', attSession.id)
          .eq('team_id', teamId)
          .in('user_id', unmarkedIds);
      }

      setAttOpen(false);
      await fetchSessions();
    } catch (err) {
      setAttError(err.message || 'Failed to save attendance.');
    } finally {
      setAttSaving(false);
    }
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('default', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });

  const pastSessions = sessions.filter(s => new Date(s.end_time) < new Date());

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {sessions.length === 0 ? (
        <Card sx={{ boxShadow: 2, textAlign: 'center', py: 7 }}>
          <EventIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No sessions yet.</Typography>
          <Typography variant="body2" color="text.disabled">
            Create an event on the Events page and set this team as the host.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2.5, fontWeight: 'bold' }} onClick={() => navigate('/events')}>
            Go to Events
          </Button>
        </Card>
      ) : (
        <>
          {/* Session list */}
          <Card sx={{ boxShadow: 2 }}>
            <Box sx={{
              px: 3, py: 2.5, bgcolor: 'grey.50',
              borderBottom: '1px solid', borderColor: 'divider',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Typography variant="h6" fontWeight="bold">
                Sessions{' '}
                <Typography component="span" variant="body2" color="text.secondary">
                  ({sessions.length})
                </Typography>
              </Typography>
              <Button variant="outlined" size="small" sx={{ fontWeight: 'bold' }}
                onClick={() => navigate('/events')}>
                + Create Session
              </Button>
            </Box>

            <CardContent sx={{ p: 0 }}>
              {sessions.map((session, idx) => {
                const isPast = new Date(session.end_time) < new Date();
                const d      = new Date(session.start_time);

                return (
                  <React.Fragment key={session.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, gap: 2, flexWrap: 'wrap' }}>
                      {/* Date badge */}
                      <Box sx={{ minWidth: 52, textAlign: 'center', flexShrink: 0 }}>
                        <Typography variant="h5" fontWeight="bold" lineHeight={1}
                          color={isPast ? 'text.disabled' : 'primary.main'}>
                          {d.getDate()}
                        </Typography>
                        <Typography variant="caption" color="text.disabled"
                          sx={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.65rem' }}>
                          {d.toLocaleString('default', { month: 'short' })}
                        </Typography>
                        <Typography variant="caption" color="text.disabled"
                          sx={{ display: 'block', fontSize: '0.6rem' }}>
                          {d.getFullYear()}
                        </Typography>
                      </Box>

                      {/* Details */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
                          <Chip label={session.type} size="small"
                            color={SESSION_TYPE_COLOR[session.type] || 'default'}
                            sx={{ fontWeight: 'bold', height: 20, fontSize: '0.68rem' }} />
                          {isPast && (
                            <Chip label="Past" size="small" variant="outlined"
                              sx={{ height: 20, fontSize: '0.68rem' }} />
                          )}
                        </Box>
                        <Typography variant="subtitle2" fontWeight="bold" noWrap>
                          {session.title}
                        </Typography>
                        {session.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                            <LocationOnIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {session.location}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <Button size="small" variant="outlined"
                          onClick={() => navigate(`/events/${session.id}`)}>
                          Details
                        </Button>
                        {isPast && isTeamAdmin && (
                          <Button size="small" variant="contained"
                            onClick={() => openAttendance(session)}>
                            Attendance
                          </Button>
                        )}
                      </Box>
                    </Box>
                    {idx < sessions.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </CardContent>
          </Card>

          {/* Attendance stats */}
          {pastSessions.length > 0 && (
            <Card sx={{ boxShadow: 2 }}>
              <Box sx={{
                px: 3, py: 2.5, bgcolor: 'grey.50',
                borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
                <BarChartIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Attendance Stats</Typography>
                <Typography variant="caption" color="text.secondary">
                  — {pastSessions.length} past session{pastSessions.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                {[...members]
                  .sort((a, b) => {
                    const ar = stats[a.user_id] ? stats[a.user_id].present / stats[a.user_id].total : 0;
                    const br = stats[b.user_id] ? stats[b.user_id].present / stats[b.user_id].total : 0;
                    return br - ar;
                  })
                  .map((member, idx) => {
                    const profile = profileMap[member.user_id];
                    const s       = stats[member.user_id] || { present: 0, total: pastSessions.length };
                    const rate    = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                    const barColor = rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'error';

                    return (
                      <React.Fragment key={member.user_id}>
                        <Box sx={{ px: 3, py: 1.75, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.200', fontSize: '0.72rem', fontWeight: 'bold', flexShrink: 0 }}>
                            {profile?.avatar_url
                              ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt=""
                                  style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                              : getInitials(profile?.full_name)}
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                              <Typography variant="body2" fontWeight="bold" noWrap>
                                {profile?.full_name || 'Unknown'}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold" color={`${barColor}.main`} sx={{ flexShrink: 0, ml: 1 }}>
                                {rate}%{' '}
                                <Typography component="span" variant="caption" color="text.secondary" fontWeight="normal">
                                  ({s.present}/{s.total})
                                </Typography>
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate" value={rate} color={barColor}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        </Box>
                        {idx < members.length - 1 && <Divider />}
                      </React.Fragment>
                    );
                  })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Attendance Dialog ── */}
      <Dialog
        open={attOpen}
        onClose={() => !attSaving && setAttOpen(false)}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="h6" fontWeight="bold">Mark Attendance</Typography>
          <Typography variant="body2" color="text.secondary">{attSession?.title}</Typography>
          <Typography variant="caption" color="text.disabled">
            {attSession && fmtDate(attSession.start_time)}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {attError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{attError}</Alert>}

          <Box sx={{
            px: 3, py: 1.25, bgcolor: 'grey.50',
            borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
          }}>
            <Typography variant="caption" color="text.secondary">
              Tap a chip to cycle: <strong>Present → Absent → Excused → Unmarked</strong>
            </Typography>
          </Box>

          {attLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <List disablePadding>
              {members.map((member, idx) => {
                const profile = profileMap[member.user_id];
                const status  = attMarks[member.user_id] || '';
                const cfg     = status ? STATUS_CONFIG[status] : null;
                const { Icon: StatusIcon } = cfg || {};

                return (
                  <React.Fragment key={member.user_id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'grey.200', fontSize: '0.78rem', fontWeight: 'bold', flexShrink: 0 }}>
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt=""
                              style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : getInitials(profile?.full_name)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight="bold" noWrap>
                          {profile?.full_name || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{profile?.username || '—'}
                        </Typography>
                      </Box>
                      <Tooltip title="Click to change">
                        <Chip
                          icon={cfg
                            ? <StatusIcon sx={{ fontSize: '14px !important' }} />
                            : <RadioButtonUncheckedIcon sx={{ fontSize: '14px !important' }} />}
                          label={cfg?.label || 'Unmarked'}
                          size="small"
                          color={cfg?.color || 'default'}
                          variant={cfg ? 'filled' : 'outlined'}
                          onClick={() => cycleStatus(member.user_id)}
                          sx={{ fontWeight: 'bold', cursor: 'pointer', minWidth: 96, flexShrink: 0 }}
                        />
                      </Tooltip>
                    </Box>
                    {idx < members.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1.5 }}>
          <Button onClick={() => setAttOpen(false)} disabled={attSaving}>Cancel</Button>
          <Button
            variant="contained" onClick={saveAttendance}
            disabled={attSaving || attLoading}
            startIcon={attSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            {attSaving ? 'Saving…' : 'Save Attendance'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
