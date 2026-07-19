import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Button, Divider,
  Chip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Alert, Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StarsIcon from '@mui/icons-material/Stars';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import StarIcon from '@mui/icons-material/Star';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const MEMBERSHIP_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Pending Approval'];

function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit profile dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', username: '', phoneNumber: '' });
  const [upiIds, setUpiIds] = useState([]);
  const [newUpi, setNewUpi] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyTeams();
    }
  }, [user]);

  const fetchMyTeams = async () => {
    try {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.uid);

      if (!memberships || memberships.length === 0) { setMyTeams([]); return; }

      const teamIds = memberships.map(m => m.team_id);
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, type')
        .in('id', teamIds)
        .eq('is_active', true);

      // Merge role info
      const roleMap = {};
      memberships.forEach(m => { roleMap[m.team_id] = m.role; });
      setMyTeams((teamsData || []).map(t => ({ ...t, role: roleMap[t.id] })));
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Edit profile ───────────────────────────────────────────────────────────

  const handleOpenEdit = () => {
    setEditForm({
      fullName: profile?.full_name || '',
      username: profile?.username || '',
      phoneNumber: profile?.phone_number || '',
    });
    setUpiIds(profile?.saved_upi_ids || []);
    setNewUpi('');
    setEditError('');
    setEditSuccess(false);
    setEditOpen(true);
  };

  const handleAddUpi = () => {
    const trimmed = newUpi.trim();
    if (!trimmed) return;
    if (upiIds.length >= 5) { setEditError('Maximum 5 UPI IDs allowed.'); return; }
    if (upiIds.includes(trimmed)) { setEditError('This UPI ID is already saved.'); return; }
    setUpiIds(prev => [...prev, trimmed]);
    setNewUpi('');
    setEditError('');
  };

  const handleRemoveUpi = (idx) =>
    setUpiIds(prev => prev.filter((_, i) => i !== idx));

  const handleSaveProfile = async () => {
    if (!editForm.fullName.trim()) { setEditError('Full name is required.'); return; }
    if (!editForm.username.trim()) { setEditError('Username is required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.fullName.trim(),
          username: editForm.username.trim().toLowerCase().replace(/\s+/g, ''),
          phone_number: editForm.phoneNumber.trim() || null,
          saved_upi_ids: upiIds,
        })
        .eq('id', user.uid);

      if (error) throw error;
      await refreshProfile();
      setEditSuccess(true);
      setTimeout(() => { setEditOpen(false); setEditSuccess(false); }, 1200);
    } catch (err) {
      setEditError(err.message || 'Failed to save profile.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const displayName = profile?.full_name || user?.displayName || 'KUPA Member';
  const displayEmail = user?.email || user?.phoneNumber || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const memberStatus = profile?.membership_status || 'Pending Approval';
  const rewardPoints = profile?.reward_points_total || 0;

  const statusConfig = {
    'Active':           { color: 'success', icon: <CheckCircleIcon /> },
    'Expiring Soon':    { color: 'warning', icon: <HourglassEmptyIcon /> },
    'Expired':          { color: 'error',   icon: <HourglassEmptyIcon /> },
    'Pending Approval': { color: 'default', icon: <HourglassEmptyIcon /> },
  };
  const currentStatus = statusConfig[memberStatus] || statusConfig['Pending Approval'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
        Welcome back, {displayName.split(' ')[0]}!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's your KUPA overview.
      </Typography>

      {/* Row 1: Profile + Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Profile Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2 }}>
            <CardContent sx={{ textAlign: 'center', p: 4, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Avatar sx={{ width: 90, height: 90, mx: 'auto', mb: 2, bgcolor: 'grey.200', fontSize: '2rem', fontWeight: 'bold', color: 'text.secondary' }}>
                {user?.photoURL
                  ? <img src={user.photoURL} alt={displayName} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  : initials
                }
              </Avatar>
              <Typography variant="h5" fontWeight="bold">{displayName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{displayEmail}</Typography>

              <Chip
                icon={currentStatus.icon}
                label={memberStatus}
                color={currentStatus.color}
                variant="outlined"
                sx={{ fontWeight: 'bold', fontSize: '0.9rem', py: 2, px: 1, mx: 'auto', mb: 1 }}
              />
              {profile?.membership_expiry && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Valid until:{' '}
                  {new Date(profile.membership_expiry).toLocaleDateString('default', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </Typography>
              )}

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined" size="small"
                  startIcon={<EditIcon />}
                  sx={{ fontWeight: 'bold' }}
                  onClick={handleOpenEdit}
                >
                  Edit Profile
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Reward Points */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%', boxShadow: 2 }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ p: 1.25, bgcolor: 'grey.100', borderRadius: '50%', display: 'flex', flexShrink: 0, mt: 0.25 }}>
                  <StarsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>Reward Points</Typography>
                  <Typography variant="h4" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {rewardPoints.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    {rewardPoints === 0 ? 'Complete tasks to earn points' : 'total accumulated'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* My Teams count */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: '100%', boxShadow: 2 }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ p: 1.25, bgcolor: 'grey.100', borderRadius: '50%', display: 'flex', flexShrink: 0, mt: 0.25 }}>
                  <GroupsIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>My Teams</Typography>
                  <Typography variant="h4" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {myTeams.length}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    {myTeams.length === 0 ? 'Join a team to get started' : `active team${myTeams.length !== 1 ? 's' : ''}`}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* My Teams — scrollable panel */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">My Teams</Typography>
        <Button variant="text" size="small" sx={{ fontWeight: 'bold' }} onClick={() => navigate('/teams')}>
          Browse All →
        </Button>
      </Box>

      {myTeams.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center', boxShadow: 2 }}>
          <GroupsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">You haven't joined any teams yet.</Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/teams')}>Browse Teams</Button>
        </Card>
      ) : (
        <Card sx={{ boxShadow: 2 }}>
          <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
            {myTeams.map((team, idx) => (
              <React.Fragment key={team.id}>
                <Box
                  onClick={() => navigate(`/teams/${team.id}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 3, py: 2, gap: 2,
                    cursor: 'pointer', transition: '0.15s',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Avatar sx={{ bgcolor: team.role === 'captain' ? 'warning.main' : 'primary.main', width: 44, height: 44, flexShrink: 0 }}>
                    {team.role === 'captain' ? <StarIcon /> : <GroupsIcon />}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>{team.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {team.type} · {team.role === 'captain' ? 'Captain' : 'Player'}
                    </Typography>
                  </Box>
                  {team.role === 'captain' && (
                    <Chip icon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                      label="Captain" size="small" color="warning"
                      sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem', flexShrink: 0 }} />
                  )}
                </Box>
                {idx < myTeams.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Box>
        </Card>
      )}

      {/* ── Edit Profile Dialog ── */}
      <Dialog
        open={editOpen}
        onClose={() => !editSaving && setEditOpen(false)}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.4rem' }}>Edit Profile</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          {editSuccess && <Alert severity="success" sx={{ mb: 2 }}>Profile saved!</Alert>}

          <TextField
            fullWidth label="Full Name" margin="normal" required
            value={editForm.fullName}
            onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))}
          />
          <TextField
            fullWidth label="Username" margin="normal" required
            helperText="Lowercase, no spaces."
            value={editForm.username}
            onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
          />
          <TextField
            fullWidth label="Phone Number" margin="normal"
            placeholder="+91 98765 43210"
            value={editForm.phoneNumber}
            onChange={e => setEditForm(p => ({ ...p, phoneNumber: e.target.value }))}
          />

          {/* UPI IDs */}
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
            Saved UPI IDs
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (used when creating paid events — max 5)
            </Typography>
          </Typography>

          {upiIds.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              {upiIds.map((id, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider',
                    borderRadius: 2, px: 2, py: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">{id}</Typography>
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => handleRemoveUpi(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}

          {upiIds.length < 5 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth size="small"
                placeholder="e.g. yourname@upi"
                value={newUpi}
                onChange={e => setNewUpi(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddUpi()}
              />
              <Button
                variant="outlined" onClick={handleAddUpi}
                startIcon={<AddIcon />}
                sx={{ flexShrink: 0, fontWeight: 'bold' }}
              >
                Add
              </Button>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSaveProfile} disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;
