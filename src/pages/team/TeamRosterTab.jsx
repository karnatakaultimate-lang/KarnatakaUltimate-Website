import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, List, ListItem, ListItemAvatar,
  ListItemText, Avatar, Chip, Button, IconButton, Tooltip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  InputAdornment, Alert, Menu, MenuItem, CircularProgress,
} from '@mui/material';
import PersonAddIcon              from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon           from '@mui/icons-material/PersonRemove';
import SearchIcon                 from '@mui/icons-material/Search';
import CheckCircleIcon            from '@mui/icons-material/CheckCircle';
import CancelIcon                 from '@mui/icons-material/Cancel';
import HowToRegIcon               from '@mui/icons-material/HowToReg';
import AdminPanelSettingsIcon     from '@mui/icons-material/AdminPanelSettings';
import AccountBalanceWalletIcon   from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon                 from '@mui/icons-material/Person';
import ExpandMoreIcon             from '@mui/icons-material/ExpandMore';
import { supabase } from '../../supabaseClient';

const ROLE_CONFIG = {
  admin:     { label: 'Admin',     color: 'warning', Icon: AdminPanelSettingsIcon },
  treasurer: { label: 'Treasurer', color: 'info',    Icon: AccountBalanceWalletIcon },
  member:    { label: 'Member',    color: 'default', Icon: PersonIcon },
};

const ROLE_ORDER = { admin: 0, treasurer: 1, member: 2 };

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export default function TeamRosterTab({
  teamId, members, profileMap, joinRequests, isTeamAdmin, user, onRefresh, fmtDate,
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]                 = useState('');

  // Role menu
  const [menuAnchor,  setMenuAnchor]  = useState(null);
  const [menuMember,  setMenuMember]  = useState(null);

  // Add member dialog
  const [addOpen,       setAddOpen]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [addError,      setAddError]      = useState('');

  const adminCount = members.filter(m => m.role === 'admin').length;

  // ── Role menu ──────────────────────────────────────────────────────────────
  const openRoleMenu = (e, member) => {
    setMenuAnchor(e.currentTarget);
    setMenuMember(member);
  };
  const closeRoleMenu = () => { setMenuAnchor(null); setMenuMember(null); };

  const handleChangeRole = async (newRole) => {
    const member = menuMember;
    closeRoleMenu();
    if (!member || member.role === newRole) return;
    // Guard: last admin demotion
    if (member.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      setError('Cannot demote the last admin. Assign another admin first.');
      return;
    }
    setActionLoading(true); setError('');
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', teamId)
        .eq('user_id', member.user_id);
      if (error) throw error;
      await onRefresh();
    } catch (err) { setError(err.message || 'Failed to change role.'); }
    finally { setActionLoading(false); }
  };

  // ── Join requests ──────────────────────────────────────────────────────────
  const handleApprove = async (req) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').insert([{ team_id: teamId, user_id: req.user_id, role: 'member' }]);
      await supabase.from('team_join_requests').update({ status: 'approved' }).eq('id', req.id);
      await onRefresh();
    } catch (err) { setError(err.message || 'Failed to approve.'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async (reqId) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_join_requests').update({ status: 'rejected' }).eq('id', reqId);
      await onRefresh();
    } catch (err) { setError(err.message || 'Failed to reject.'); }
    finally { setActionLoading(false); }
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemove = async (userId) => {
    const member = members.find(m => m.user_id === userId);
    if (member?.role === 'admin' && adminCount <= 1) {
      setError('Cannot remove the last admin. Assign another admin first.');
      return;
    }
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
      await onRefresh();
    } catch (err) { setError(err.message || 'Failed to remove member.'); }
    finally { setActionLoading(false); }
  };

  // ── Add member search ──────────────────────────────────────────────────────
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles').select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`).limit(8);
      const existing = new Set(members.map(m => m.user_id));
      setSearchResults((data || []).filter(p => !existing.has(p.id)));
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  const handleAddMember = async (profile) => {
    setAddError('');
    try {
      await supabase.from('team_members').insert([{ team_id: teamId, user_id: profile.id, role: 'member' }]);
      await supabase.from('team_join_requests').delete().eq('team_id', teamId).eq('user_id', profile.id);
      setAddOpen(false); setSearchQuery(''); setSearchResults([]);
      await onRefresh();
    } catch (err) { setAddError(err.message || 'Failed to add member.'); }
  };

  const manageableRequests = joinRequests.filter(r => r.user_id !== user?.uid);
  const sortedMembers = [...members].sort((a, b) =>
    (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* ── Join Requests ── */}
      {isTeamAdmin && manageableRequests.length > 0 && (
        <Card sx={{ boxShadow: 2, border: '1px solid', borderColor: 'warning.light' }}>
          <Box sx={{
            px: 3, py: 2, bgcolor: 'warning.50',
            borderBottom: '1px solid', borderColor: 'warning.light',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <HowToRegIcon sx={{ color: 'warning.dark' }} />
            <Typography variant="h6" fontWeight="bold" color="warning.dark">Join Requests</Typography>
            <Chip label={manageableRequests.length} size="small" color="warning"
              sx={{ fontWeight: 'bold', height: 20 }} />
          </Box>
          <CardContent sx={{ p: 0 }}>
            <List disablePadding>
              {manageableRequests.map((req, idx) => {
                const profile = profileMap[req.user_id];
                return (
                  <React.Fragment key={req.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1.5 }}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: 'grey.200', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
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
                          @{profile?.username || '—'} · {fmtDate(req.created_at)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title="Approve">
                          <IconButton size="small" color="success"
                            onClick={() => handleApprove(req)} disabled={actionLoading}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton size="small" color="error"
                            onClick={() => handleReject(req.id)} disabled={actionLoading}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {idx < manageableRequests.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}

      {/* ── Roster ── */}
      <Card sx={{ boxShadow: 2 }}>
        <Box sx={{
          px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <Typography variant="h6" fontWeight="bold">
            Roster{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              ({members.length})
            </Typography>
          </Typography>
          {isTeamAdmin && (
            <Button size="small" variant="outlined" startIcon={<PersonAddIcon />}
              onClick={() => { setAddOpen(true); setAddError(''); setSearchQuery(''); setSearchResults([]); }}
              sx={{ fontWeight: 'bold' }}>
              Add Member
            </Button>
          )}
        </Box>

        {isTeamAdmin && (
          <Box sx={{ px: 3, py: 1, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Click a member's role chip to change it.
            </Typography>
          </Box>
        )}

        <CardContent sx={{ p: 0 }}>
          <List disablePadding>
            {sortedMembers.map((member, idx) => {
              const profile   = profileMap[member.user_id];
              const isMe      = user && member.user_id === user.uid;
              const cfg       = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
              const { Icon }  = cfg;
              const isLastAdm = member.role === 'admin' && adminCount <= 1;
              const canClick  = isTeamAdmin && !isMe;

              return (
                <React.Fragment key={member.user_id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1.5 }}>
                    {/* Avatar */}
                    <Avatar sx={{ width: 40, height: 40, bgcolor: 'grey.200', fontWeight: 'bold', flexShrink: 0 }}>
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt=""
                            style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        : getInitials(profile?.full_name)}
                    </Avatar>

                    {/* Name */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" fontWeight="bold" noWrap>
                          {profile?.full_name || 'Unknown'}
                        </Typography>
                        {isMe && (
                          <Chip label="You" size="small" variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        @{profile?.username || '—'} · Joined {fmtDate(member.joined_at)}
                      </Typography>
                    </Box>

                    {/* Role chip */}
                    <Tooltip title={canClick ? 'Click to change role' : ''}>
                      <Chip
                        icon={<Icon sx={{ fontSize: '13px !important' }} />}
                        label={cfg.label}
                        deleteIcon={canClick ? <ExpandMoreIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                        onDelete={canClick ? (e) => openRoleMenu(e, member) : undefined}
                        onClick={canClick ? (e) => openRoleMenu(e, member) : undefined}
                        size="small"
                        color={cfg.color}
                        sx={{
                          fontWeight: 'bold', height: 24, flexShrink: 0,
                          cursor: canClick ? 'pointer' : 'default',
                        }}
                      />
                    </Tooltip>

                    {/* Remove */}
                    {isTeamAdmin && !isMe && (
                      <Tooltip title={isLastAdm ? 'Cannot remove last admin' : 'Remove from team'}>
                        <span>
                          <IconButton size="small" color="error"
                            onClick={() => handleRemove(member.user_id)}
                            disabled={actionLoading || isLastAdm}>
                            <PersonRemoveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                  {idx < sortedMembers.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        </CardContent>
      </Card>

      {/* Role assignment menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeRoleMenu}
        PaperProps={{ sx: { minWidth: 180, borderRadius: 2 } }}
      >
        <Typography variant="caption" color="text.secondary"
          sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Change Role
        </Typography>
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const { Icon } = cfg;
          const isCurrent    = menuMember?.role === role;
          const wouldOrphan  = menuMember?.role === 'admin' && role !== 'admin' && adminCount <= 1;
          return (
            <MenuItem
              key={role}
              selected={isCurrent}
              disabled={isCurrent || wouldOrphan}
              onClick={() => handleChangeRole(role)}
              sx={{ gap: 1.5, py: 1 }}
            >
              <Chip
                icon={<Icon sx={{ fontSize: '13px !important' }} />}
                label={cfg.label}
                size="small"
                color={cfg.color}
                sx={{ fontWeight: 'bold', pointerEvents: 'none' }}
              />
              {wouldOrphan && (
                <Typography variant="caption" color="error.main">Last admin</Typography>
              )}
            </MenuItem>
          );
        })}
      </Menu>

      {/* Add Member dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add Member</DialogTitle>
        <DialogContent>
          {addError && <Alert severity="error" sx={{ mb: 2 }}>{addError}</Alert>}
          <TextField
            fullWidth autoFocus margin="dense"
            placeholder="Search by name or username…"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            InputProps={{ startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={16} /> : <SearchIcon color="action" />}
              </InputAdornment>
            )}}
          />
          {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No users found.
            </Typography>
          )}
          {searchResults.length > 0 && (
            <List disablePadding sx={{ mt: 1 }}>
              {searchResults.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 36, height: 36, fontSize: '0.85rem' }}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} referrerPolicy="no-referrer" alt=""
                              style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : getInitials(p.full_name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="subtitle2" fontWeight="bold">{p.full_name}</Typography>}
                      secondary={`@${p.username || '—'}`}
                    />
                    <Button size="small" variant="contained"
                      onClick={() => handleAddMember(p)} sx={{ fontWeight: 'bold' }}>
                      Add
                    </Button>
                  </ListItem>
                  {idx < searchResults.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => setAddOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
