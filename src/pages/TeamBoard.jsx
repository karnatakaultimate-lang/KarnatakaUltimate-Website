/**
 * TeamBoard.jsx — Kanban-style team dashboard
 * Route: /teams/:id/board
 * Four side-by-side columns: Overview · Sessions · Roster · Financials
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Avatar, CircularProgress, Alert, Button,
  LinearProgress, Tooltip, Divider, IconButton, Card, Badge,
} from '@mui/material';
import ArrowBackIcon          from '@mui/icons-material/ArrowBack';
import ViewListIcon           from '@mui/icons-material/ViewList';
import AddCircleOutlineIcon   from '@mui/icons-material/AddCircleOutlined';
import LocationOnIcon         from '@mui/icons-material/LocationOn';
import PersonIcon             from '@mui/icons-material/Person';
import ContactPhoneIcon       from '@mui/icons-material/ContactPhone';
import GroupsIcon             from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon        from '@mui/icons-material/CheckCircle';
import PendingIcon            from '@mui/icons-material/Pending';
import HowToRegIcon           from '@mui/icons-material/HowToReg';
import LockOpenIcon           from '@mui/icons-material/LockOpen';
import SportsSoccerIcon       from '@mui/icons-material/SportsSoccer';
import EmojiEventsIcon        from '@mui/icons-material/EmojiEvents';
import FitnessCenterIcon      from '@mui/icons-material/FitnessCenter';
import InfoOutlinedIcon       from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon          from '@mui/icons-material/OpenInNew';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

// ── helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const fmt = (n) => `₹${Number(n || 0).toFixed(0)}`;

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });

const isUpcoming = (iso) => new Date(iso) > new Date();
const isPast     = (iso) => new Date(iso) < new Date();

const SESSION_TYPES = { Training: FitnessCenterIcon, Tournament: EmojiEventsIcon };

const ROLE_CONFIG = {
  admin:     { label: 'Admin',     color: 'warning', Icon: AdminPanelSettingsIcon },
  treasurer: { label: 'Treasurer', color: 'info',    Icon: AccountBalanceWalletIcon },
  member:    { label: 'Member',    color: 'default', Icon: PersonIcon },
};

const TEAM_TYPE_COLOR = {
  Mixed: 'primary', Open: 'info', Women: 'secondary',
  Masters: 'warning', Youth: 'success', Club: 'error', Other: 'default',
};

const ATT_COLOR = (pct) => pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'error';

// ── column shell ─────────────────────────────────────────────────────────────
function Column({ title, icon, color = 'primary', count, children, action }) {
  return (
    <Box sx={{
      flex: '0 0 300px',
      display: 'flex', flexDirection: 'column',
      bgcolor: 'background.default',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* column header */}
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: `${color}.main`,
        color: `${color}.contrastText`,
        flexShrink: 0,
      }}>
        {icon}
        <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1, letterSpacing: 0.3 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Chip label={count} size="small"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold',
              bgcolor: 'rgba(255,255,255,0.25)', color: 'inherit' }} />
        )}
        {action}
      </Box>

      {/* scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {children}
      </Box>
    </Box>
  );
}

// ── mini card ─────────────────────────────────────────────────────────────────
function KCard({ children, sx = {} }) {
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      border: '1px solid', borderColor: 'divider',
      borderRadius: 1.5, p: 1.5,
      ...sx,
    }}>
      {children}
    </Box>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function TeamBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin: isSiteAdmin } = useAuth();

  const [team,       setTeam]       = useState(null);
  const [members,    setMembers]    = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [sessions,   setSessions]   = useState([]);
  const [expenses,   setExpenses]   = useState([]);
  const [splits,     setSplits]     = useState([]);
  const [attStats,   setAttStats]   = useState({});   // { userId: { present, total } }
  const [joinReqs,   setJoinReqs]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => { load(); }, [id]);

  // ── load all columns in parallel ───────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [teamRes, memberRes, sessionRes, expenseRes, splitRes, reqRes] = await Promise.all([
        supabase.from('teams').select('*').eq('id', id).single(),
        supabase.from('team_members').select('user_id, role, joined_at').eq('team_id', id),
        supabase.from('events').select('id, title, type, start_time, end_time, location')
          .eq('hosting_team_id', id).order('start_time', { ascending: false }).limit(20),
        supabase.from('team_expenses').select('*').eq('team_id', id).order('date', { ascending: false }),
        supabase.from('expense_splits').select('*').eq('team_id', id),
        supabase.from('team_join_requests').select('id, user_id, created_at').eq('team_id', id).eq('status', 'pending'),
      ]);

      if (teamRes.error) { setError('Team not found'); return; }
      setTeam(teamRes.data);
      setMembers(memberRes.data || []);
      setSessions(sessionRes.data || []);
      setExpenses(expenseRes.data || []);
      setSplits(splitRes.data || []);
      setJoinReqs(reqRes.data || []);

      // profiles
      const ids = [...new Set([
        ...(memberRes.data || []).map(m => m.user_id),
        ...(reqRes.data    || []).map(r => r.user_id),
      ])];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, username, avatar_url').in('id', ids);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p; });
        setProfileMap(map);
      }

      // attendance stats — past sessions only
      const pastIds = (sessionRes.data || []).filter(s => isPast(s.end_time)).map(s => s.id);
      if (pastIds.length && memberRes.data?.length) {
        const { data: marks } = await supabase
          .from('event_attendance_marks')
          .select('event_id, user_id, status')
          .in('event_id', pastIds);

        const stats = {};
        (memberRes.data || []).forEach(m => { stats[m.user_id] = { present: 0, total: pastIds.length }; });
        (marks || []).forEach(mk => {
          if (mk.status === 'present' && stats[mk.user_id]) stats[mk.user_id].present++;
        });
        setAttStats(stats);
      }
    } catch (err) {
      setError(err.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const myRole      = members.find(m => m.user_id === user?.uid)?.role;
  const isMember    = !!myRole;
  const isTeamAdmin = myRole === 'admin' || isSiteAdmin;
  const canFinance  = myRole === 'admin' || myRole === 'treasurer' || isSiteAdmin;

  const upcomingSessions = sessions.filter(s => isUpcoming(s.start_time)).reverse();
  const pastSessions     = sessions.filter(s => isPast(s.end_time));

  const totalExpenses    = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCollected   = splits.filter(sp => sp.paid).reduce((s, sp) => s + Number(sp.amount), 0);
  const totalOutstanding = totalExpenses - totalCollected;

  const mySplits = splits.filter(sp => sp.user_id === user?.uid && !sp.paid);
  const myBalance = mySplits.reduce((s, sp) => s + Number(sp.amount), 0);

  const roleOrder = { admin: 0, treasurer: 1, member: 2 };
  const sortedMembers = [...members].sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));

  // ── loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
  );
  if (error || !team) return (
    <Box sx={{ textAlign: 'center', pt: 10 }}>
      <Typography color="text.secondary">{error || 'Team not found.'}</Typography>
      <Button sx={{ mt: 2 }} onClick={() => navigate('/teams')}>← Back</Button>
    </Box>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>

      {/* top bar */}
      <Box sx={{
        px: { xs: 2, md: 3 }, py: 1.25,
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <IconButton size="small" onClick={() => navigate('/teams')}><ArrowBackIcon /></IconButton>

        {team.logo_url
          ? <Box component="img" src={team.logo_url} alt=""
              sx={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 1 }} />
          : <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', fontWeight: 'bold', bgcolor: 'primary.main' }}>
              {getInitials(team.name)}
            </Avatar>
        }

        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1, fontSize: '1rem' }}>
          {team.name}
        </Typography>

        <Chip label={team.type} size="small" color={TEAM_TYPE_COLOR[team.type] || 'default'}
          sx={{ fontWeight: 'bold' }} />

        {myRole && (
          <Chip label={ROLE_CONFIG[myRole]?.label || myRole} size="small"
            color={ROLE_CONFIG[myRole]?.color || 'default'} sx={{ fontWeight: 'bold' }} />
        )}

        <Tooltip title="Switch to tabbed view">
          <Button size="small" variant="outlined" startIcon={<ViewListIcon />}
            onClick={() => navigate(`/teams/${id}`)} sx={{ fontWeight: 'bold', ml: 'auto' }}>
            Tab View
          </Button>
        </Tooltip>
      </Box>

      {/* kanban columns — horizontal scroll */}
      <Box sx={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: 2,
        p: { xs: 1.5, md: 2 },
        alignItems: 'stretch',
      }}>

        {/* ══ COLUMN 1: Overview ══════════════════════════════════════════════ */}
        <Column
          title="Overview"
          icon={<InfoOutlinedIcon sx={{ fontSize: 17 }} />}
          color="primary"
        >
          {/* team info card */}
          <KCard>
            {team.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                {team.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GroupsIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {team.join_mode === 'request'
                  ? <HowToRegIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  : <LockOpenIcon sx={{ fontSize: 15, color: 'text.disabled' }} />}
                <Typography variant="caption" color="text.secondary">
                  {team.join_mode === 'request' ? 'By request' : 'Open to join'}
                </Typography>
              </Box>
              {team.session_location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">{team.session_location}</Typography>
                </Box>
              )}
              {team.contact_person && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">{team.contact_person}</Typography>
                </Box>
              )}
              {team.contact_info && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ContactPhoneIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">{team.contact_info}</Typography>
                </Box>
              )}
            </Box>
          </KCard>

          {/* quick stats */}
          <KCard sx={{ display: 'flex', gap: 1 }}>
            {[
              { label: 'Sessions', value: sessions.length, color: 'info.main' },
              { label: 'Members',  value: members.length,  color: 'success.main' },
              { label: 'Expenses', value: expenses.length, color: 'warning.main' },
            ].map(s => (
              <Box key={s.label} sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="h6" fontWeight="bold" sx={{ color: s.color, lineHeight: 1.2 }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" color="text.disabled">{s.label}</Typography>
              </Box>
            ))}
          </KCard>

          {/* pending join requests (admin only) */}
          {isTeamAdmin && joinReqs.length > 0 && (
            <KCard sx={{ borderColor: 'warning.main', bgcolor: 'warning.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HowToRegIcon sx={{ fontSize: 15, color: 'warning.main' }} />
                <Typography variant="caption" fontWeight="bold" color="warning.main">
                  {joinReqs.length} join request{joinReqs.length !== 1 ? 's' : ''} pending
                </Typography>
              </Box>
              {joinReqs.slice(0, 3).map(r => {
                const p = profileMap[r.user_id];
                return (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Avatar sx={{ width: 22, height: 22, fontSize: '0.6rem', bgcolor: 'grey.400' }}>
                      {getInitials(p?.full_name || p?.username)}
                    </Avatar>
                    <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                      {p?.full_name || p?.username || 'Unknown'}
                    </Typography>
                  </Box>
                );
              })}
              {joinReqs.length > 3 && (
                <Typography variant="caption" color="text.disabled">
                  +{joinReqs.length - 3} more
                </Typography>
              )}
              <Button size="small" fullWidth variant="outlined" color="warning"
                sx={{ mt: 1, fontWeight: 'bold', fontSize: '0.7rem' }}
                onClick={() => navigate(`/teams/${id}`)}>
                Manage in Roster tab
              </Button>
            </KCard>
          )}

          {/* my balance */}
          {isMember && myBalance > 0 && (
            <KCard sx={{ borderColor: 'error.main' }}>
              <Typography variant="caption" color="text.secondary">My outstanding balance</Typography>
              <Typography variant="h6" fontWeight="bold" color="error.main">{fmt(myBalance)}</Typography>
              <Button size="small" fullWidth variant="text" color="error"
                sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}
                onClick={() => navigate(`/teams/${id}`)}>
                View in Financials tab
              </Button>
            </KCard>
          )}

          <Button fullWidth variant="outlined" size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            onClick={() => navigate(`/teams/${id}`)}
            sx={{ fontWeight: 'bold', fontSize: '0.72rem' }}>
            Full Dashboard
          </Button>
        </Column>

        {/* ══ COLUMN 2: Sessions ══════════════════════════════════════════════ */}
        <Column
          title="Sessions"
          icon={<CalendarMonthIcon sx={{ fontSize: 17 }} />}
          color="info"
          count={sessions.length}
          action={
            isTeamAdmin && (
              <Tooltip title="Schedule a session via Events">
                <IconButton size="small" sx={{ color: 'inherit' }}
                  onClick={() => navigate('/events')}>
                  <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )
          }
        >
          {upcomingSessions.length > 0 && (
            <>
              <Typography variant="caption" color="text.disabled" fontWeight="bold"
                sx={{ px: 0.5, letterSpacing: 0.5 }}>
                UPCOMING
              </Typography>
              {upcomingSessions.map(s => (
                <SessionCard key={s.id} session={s} upcoming />
              ))}
            </>
          )}

          {pastSessions.length > 0 && (
            <>
              <Typography variant="caption" color="text.disabled" fontWeight="bold"
                sx={{ px: 0.5, mt: 0.5, letterSpacing: 0.5 }}>
                PAST
              </Typography>
              {pastSessions.slice(0, 8).map(s => (
                <SessionCard key={s.id} session={s} navigate={navigate} />
              ))}
              {pastSessions.length > 8 && (
                <Typography variant="caption" color="text.disabled" sx={{ px: 0.5 }}>
                  +{pastSessions.length - 8} earlier sessions
                </Typography>
              )}
            </>
          )}

          {sessions.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CalendarMonthIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.disabled">No sessions yet</Typography>
              {isTeamAdmin && (
                <Button size="small" sx={{ mt: 1, fontWeight: 'bold' }}
                  onClick={() => navigate('/events')}>
                  Schedule one
                </Button>
              )}
            </Box>
          )}
        </Column>

        {/* ══ COLUMN 3: Roster ════════════════════════════════════════════════ */}
        <Column
          title="Roster"
          icon={<GroupsIcon sx={{ fontSize: 17 }} />}
          color="success"
          count={members.length}
        >
          {['admin', 'treasurer', 'member'].map(role => {
            const roleMembers = sortedMembers.filter(m => m.role === role);
            if (!roleMembers.length) return null;
            const cfg = ROLE_CONFIG[role];
            return (
              <Box key={role}>
                <Chip
                  icon={<cfg.Icon sx={{ fontSize: '13px !important' }} />}
                  label={`${cfg.label}s (${roleMembers.length})`}
                  size="small" color={cfg.color}
                  sx={{ mb: 0.75, fontWeight: 'bold', fontSize: '0.68rem' }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {roleMembers.map(m => {
                    const p = profileMap[m.user_id];
                    const stat = attStats[m.user_id];
                    const pct = stat?.total > 0 ? Math.round((stat.present / stat.total) * 100) : null;
                    const isMe = m.user_id === user?.uid;
                    return (
                      <KCard key={m.user_id} sx={isMe ? { borderColor: 'primary.main' } : {}}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar src={p?.avatar_url} sx={{ width: 28, height: 28, fontSize: '0.7rem', bgcolor: 'grey.400' }}>
                            {getInitials(p?.full_name || p?.username)}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" fontWeight="bold" noWrap>
                              {p?.full_name || p?.username || 'Unknown'}
                              {isMe && <Typography component="span" variant="caption" color="primary.main"> (me)</Typography>}
                            </Typography>
                            {p?.username && p?.full_name && (
                              <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }} noWrap>
                                @{p.username}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        {pct !== null && (
                          <Box sx={{ mt: 0.75 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                                Attendance
                              </Typography>
                              <Typography variant="caption" color={`${ATT_COLOR(pct)}.main`}
                                fontWeight="bold" sx={{ fontSize: '0.62rem' }}>
                                {pct}%
                              </Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={pct}
                              color={ATT_COLOR(pct)} sx={{ height: 3, borderRadius: 2 }} />
                          </Box>
                        )}
                      </KCard>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Column>

        {/* ══ COLUMN 4: Financials ════════════════════════════════════════════ */}
        <Column
          title="Financials"
          icon={<AccountBalanceWalletIcon sx={{ fontSize: 17 }} />}
          color="warning"
          action={
            canFinance && (
              <Tooltip title="Add expense in full dashboard">
                <IconButton size="small" sx={{ color: 'inherit' }}
                  onClick={() => navigate(`/teams/${id}`)}>
                  <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )
          }
        >
          {/* summary bar */}
          <KCard>
            {[
              { label: 'Total',       value: fmt(totalExpenses),    color: 'text.primary' },
              { label: 'Collected',   value: fmt(totalCollected),   color: 'success.main' },
              { label: 'Outstanding', value: fmt(totalOutstanding), color: totalOutstanding > 0 ? 'error.main' : 'text.disabled' },
            ].map(s => (
              <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="caption" fontWeight="bold" sx={{ color: s.color }}>{s.value}</Typography>
              </Box>
            ))}
            {totalExpenses > 0 && (
              <>
                <Divider sx={{ my: 0.75 }} />
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (totalCollected / totalExpenses) * 100)}
                  color="success" sx={{ height: 5, borderRadius: 2 }} />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                  {Math.round((totalCollected / totalExpenses) * 100)}% collected
                </Typography>
              </>
            )}
          </KCard>

          {expenses.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AccountBalanceWalletIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.disabled">No expenses logged</Typography>
            </Box>
          )}

          {expenses.map(exp => {
            const expSplits = splits.filter(sp => sp.expense_id === exp.id);
            const paid      = expSplits.filter(sp => sp.paid).reduce((s, sp) => s + Number(sp.amount), 0);
            const total     = expSplits.reduce((s, sp) => s + Number(sp.amount), 0);
            const pct       = total > 0 ? Math.round((paid / total) * 100) : 0;
            const fullyPaid = pct === 100;

            return (
              <KCard key={exp.id} sx={fullyPaid ? { opacity: 0.6 } : {}}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight="bold" sx={{ flex: 1 }} noWrap>
                    {exp.title}
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="primary.main">
                    {fmt(exp.amount)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <Chip label={exp.category} size="small"
                    sx={{ height: 16, fontSize: '0.6rem', textTransform: 'capitalize' }} />
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                    {fmtDate(exp.date)}
                  </Typography>
                  {fullyPaid
                    ? <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main', ml: 'auto' }} />
                    : <PendingIcon     sx={{ fontSize: 13, color: 'warning.main', ml: 'auto' }} />}
                </Box>
                {expSplits.length > 0 && (
                  <>
                    <LinearProgress variant="determinate" value={pct}
                      color={fullyPaid ? 'success' : 'warning'}
                      sx={{ height: 3, borderRadius: 2, mb: 0.25 }} />
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                      {fmt(paid)} / {fmt(total)} collected · {expSplits.length} splits
                    </Typography>
                  </>
                )}
              </KCard>
            );
          })}

          {(isMember || isSiteAdmin) && (
            <Button fullWidth variant="outlined" size="small" color="warning"
              sx={{ fontWeight: 'bold', fontSize: '0.72rem', mt: 0.5 }}
              onClick={() => navigate(`/teams/${id}`)}>
              Manage in Financials tab
            </Button>
          )}
        </Column>

      </Box>
    </Box>
  );
}

// ── session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, upcoming = false, navigate }) {
  const TypeIcon = SESSION_TYPES[session.type] || SportsSoccerIcon;
  const daysUntil = upcoming
    ? Math.ceil((new Date(session.start_time) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <KCard sx={upcoming ? { borderColor: 'info.main', bgcolor: 'info.50' } : {}}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{
          bgcolor: upcoming ? 'info.main' : 'grey.200',
          color: upcoming ? 'white' : 'text.secondary',
          borderRadius: 1, px: 0.75, py: 0.5, textAlign: 'center', flexShrink: 0, minWidth: 36,
        }}>
          <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', lineHeight: 1, fontSize: '0.75rem' }}>
            {new Date(session.start_time).toLocaleDateString('default', { day: 'numeric' })}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.58rem', lineHeight: 1 }}>
            {new Date(session.start_time).toLocaleDateString('default', { month: 'short' })}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" fontWeight="bold" noWrap>{session.title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Chip label={session.type} size="small"
              sx={{ height: 15, fontSize: '0.58rem', fontWeight: 'bold' }} />
            {upcoming && daysUntil === 0 && (
              <Chip label="Today" size="small" color="error"
                sx={{ height: 15, fontSize: '0.58rem', fontWeight: 'bold' }} />
            )}
            {upcoming && daysUntil === 1 && (
              <Chip label="Tomorrow" size="small" color="warning"
                sx={{ height: 15, fontSize: '0.58rem', fontWeight: 'bold' }} />
            )}
          </Box>
          {session.location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <LocationOnIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled" noWrap sx={{ fontSize: '0.62rem' }}>
                {session.location}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </KCard>
  );
}
