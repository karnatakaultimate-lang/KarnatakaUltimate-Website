import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button, CircularProgress,
  Avatar, IconButton, Tooltip, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, InputLabel, FormControl,
  Divider, Tabs, Tab,
} from '@mui/material';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import ShareIcon          from '@mui/icons-material/Share';
import CheckIcon          from '@mui/icons-material/Check';
import CameraAltIcon      from '@mui/icons-material/CameraAlt';
import DeleteIcon         from '@mui/icons-material/Delete';
import LockOpenIcon       from '@mui/icons-material/LockOpen';
import HowToRegIcon       from '@mui/icons-material/HowToReg';
import LockIcon           from '@mui/icons-material/Lock';
import GroupsIcon         from '@mui/icons-material/Groups';
import DashboardIcon      from '@mui/icons-material/Dashboard';
import CalendarMonthIcon  from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import InfoIcon           from '@mui/icons-material/Info';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';

import TeamOverviewTab   from './team/TeamOverviewTab';
import TeamRosterTab     from './team/TeamRosterTab';
import TeamSessionsTab   from './team/TeamSessionsTab';
import TeamFinancialsTab from './team/TeamFinancialsTab';

const TEAM_TYPES = ['Mixed', 'Open', 'Women', 'Masters', 'Youth', 'Club', 'Other'];

const TEAM_TYPE_COLOR = {
  Mixed: 'primary', Open: 'info', Women: 'secondary',
  Masters: 'warning', Youth: 'success', Club: 'error', Other: 'default',
};

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const storagePathFromUrl = (url) => {
  try {
    const match = url.match(/\/o\/(.+?)\?/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
};

function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin: isSiteAdmin } = useAuth();
  const logoInputRef = useRef(null);

  // Core data
  const [team,       setTeam]       = useState(null);
  const [members,    setMembers]    = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [joinRequests, setJoinRequests] = useState([]);
  const [myRequest,  setMyRequest]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);

  // UI state
  const [tab,          setTab]          = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState('');
  const [copied,        setCopied]        = useState(false);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError,     setLogoError]     = useState('');

  // Edit dialog
  const [editOpen,  setEditOpen]  = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState('');

  // Delete dialog
  const [deleteOpen,    setDeleteOpen]    = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchTeam(); }, [id]);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data: teamData, error: teamErr } = await supabase
        .from('teams').select('*').eq('id', id).single();
      if (teamErr || !teamData) { setNotFound(true); return; }
      setTeam(teamData);

      const { data: memberData } = await supabase
        .from('team_members').select('user_id, role, joined_at')
        .eq('team_id', id).order('joined_at', { ascending: true });
      setMembers(memberData || []);

      const memberIds = (memberData || []).map(m => m.user_id);

      const { data: requestData } = await supabase
        .from('team_join_requests').select('id, user_id, created_at')
        .eq('team_id', id).eq('status', 'pending');
      setJoinRequests(requestData || []);

      const requesterIds = (requestData || []).map(r => r.user_id);
      const allIds = [...new Set([...memberIds, ...requesterIds])];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, username, avatar_url').in('id', allIds);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p; });
        setProfileMap(map);
      }

      if (user) {
        const { data: myReq } = await supabase
          .from('team_join_requests').select('id, status')
          .eq('team_id', id).eq('user_id', user.uid).maybeSingle();
        setMyRequest(myReq);
      }
    } catch (err) {
      console.error(err); setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived permissions ──────────────────────────────────────────────────────
  const myRole      = members.find(m => m.user_id === user?.uid)?.role;
  const isMember    = user && members.some(m => m.user_id === user.uid);
  const isTeamAdmin = myRole === 'admin' || isSiteAdmin;
  const canFinance  = myRole === 'admin' || myRole === 'treasurer' || isSiteAdmin;
  const hasPendingRequest = myRequest?.status === 'pending';

  // ── Membership actions ───────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').insert([{ team_id: id, user_id: user.uid, role: 'member' }]);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to join team.'); }
    finally { setActionLoading(false); }
  };

  const handleRequestJoin = async () => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_join_requests').insert([{ team_id: id, user_id: user.uid, status: 'pending' }]);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to send request.'); }
    finally { setActionLoading(false); }
  };

  const handleCancelRequest = async () => {
    if (!myRequest) return;
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_join_requests').delete().eq('id', myRequest.id);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to cancel request.'); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    const adminCount = members.filter(m => m.role === 'admin').length;
    if (myRole === 'admin' && adminCount <= 1) {
      setError('You are the last admin. Assign another admin before leaving.');
      return;
    }
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').delete().eq('team_id', id).eq('user_id', user.uid);
      navigate('/teams');
    } catch (err) { setError(err.message || 'Failed to leave team.'); }
    finally { setActionLoading(false); }
  };

  // ── Logo ─────────────────────────────────────────────────────────────────────
  const handleLogoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = '';
    setLogoUploading(true); setLogoError('');
    try {
      if (team.logo_url) {
        const oldPath = storagePathFromUrl(team.logo_url);
        if (oldPath) { try { await deleteObject(ref(storage, oldPath)); } catch (_) {} }
      }
      const resized = await resizeImage(file, 400, 400);
      const ext = resized.name.split('.').pop();
      const storageRef = ref(storage, `team-logos/${id}-${Date.now()}.${ext}`);
      await uploadBytes(storageRef, resized);
      const logoUrl = await getDownloadURL(storageRef);
      await supabase.from('teams').update({ logo_url: logoUrl }).eq('id', id);
      setTeam(prev => ({ ...prev, logo_url: logoUrl }));
    } catch (err) { setLogoError(err.message || 'Failed to upload logo.'); }
    finally { setLogoUploading(false); }
  };

  const handleRemoveLogo = async () => {
    if (!team.logo_url) return;
    setLogoUploading(true); setLogoError('');
    try {
      const oldPath = storagePathFromUrl(team.logo_url);
      if (oldPath) { try { await deleteObject(ref(storage, oldPath)); } catch (_) {} }
      await supabase.from('teams').update({ logo_url: null }).eq('id', id);
      setTeam(prev => ({ ...prev, logo_url: null }));
    } catch (err) { setLogoError(err.message || 'Failed to remove logo.'); }
    finally { setLogoUploading(false); }
  };

  // ── Edit team ─────────────────────────────────────────────────────────────────
  const handleOpenEdit = () => {
    setEditForm({
      name: team.name || '', description: team.description || '',
      type: team.type || 'Mixed', join_mode: team.join_mode || 'open',
      contact_person: team.contact_person || '',
      contact_info: team.contact_info || '',
      session_location: team.session_location || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setEditError('');
    if (!editForm.name.trim()) return setEditError('Team name is required.');
    setEditSaving(true);
    try {
      const { error } = await supabase.from('teams').update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        type: editForm.type,
        join_mode: editForm.join_mode,
        contact_person: editForm.contact_person.trim() || null,
        contact_info: editForm.contact_info.trim() || null,
        session_location: editForm.session_location.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      setTeam(prev => ({ ...prev, ...editForm }));
      setEditOpen(false);
    } catch (err) { setEditError(err.message || 'Failed to save changes.'); }
    finally { setEditSaving(false); }
  };

  // ── Delete team ───────────────────────────────────────────────────────────────
  const handleDeleteTeam = async () => {
    setDeleteLoading(true);
    try {
      if (team.logo_url) {
        const oldPath = storagePathFromUrl(team.logo_url);
        if (oldPath) { try { await deleteObject(ref(storage, oldPath)); } catch (_) {} }
      }
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
      navigate('/teams');
    } catch (err) {
      setError(err.message || 'Failed to delete team.');
      setDeleteOpen(false);
    } finally { setDeleteLoading(false); }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: team?.name, url }); }
    else { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('default', { month: 'short', year: 'numeric' });

  const ef = (key) => (e) => setEditForm(p => ({ ...p, [key]: e.target.value }));

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
  );

  if (notFound) return (
    <Box sx={{ textAlign: 'center', pt: 10 }}>
      <Typography variant="h5" color="text.secondary">Team not found.</Typography>
      <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate('/teams')}>← Back to Teams</Button>
    </Box>
  );

  // ── Tab definitions ───────────────────────────────────────────────────────────
  const TABS = [
    { label: 'Overview',   icon: <InfoIcon sx={{ fontSize: 16 }} /> },
    { label: 'Roster',     icon: <GroupsIcon sx={{ fontSize: 16 }} />, count: members.length },
    { label: 'Sessions',   icon: <CalendarMonthIcon sx={{ fontSize: 16 }} />, membersOnly: true },
    { label: 'Financials', icon: <AccountBalanceWalletIcon sx={{ fontSize: 16 }} />, membersOnly: true },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Nav row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/teams')} sx={{ fontWeight: 'bold' }}>
          Back to Teams
        </Button>
        <Tooltip title="Switch to board view">
          <Button variant="outlined" size="small" startIcon={<DashboardIcon />}
            onClick={() => navigate(`/teams/${id}/board`)} sx={{ fontWeight: 'bold' }}>
            Board
          </Button>
        </Tooltip>
        <Tooltip title={copied ? 'Link copied!' : 'Copy shareable link'}>
          <Button variant="outlined" size="small"
            startIcon={copied ? <CheckIcon /> : <ShareIcon />}
            onClick={handleShare} color={copied ? 'success' : 'primary'}
            sx={{ fontWeight: 'bold' }}>
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
        style={{ display: 'none' }} onChange={handleLogoSelect} />

      {/* ── Team header ── */}
      <Card sx={{ boxShadow: 3, overflow: 'hidden', mb: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        {/* Logo / banner area */}
        <Box sx={{
          position: 'relative', bgcolor: 'grey.100', height: 160,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {team.logo_url ? (
            <Box component="img" src={team.logo_url} alt={`${team.name} logo`}
              sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 2 }} />
          ) : (
            <Avatar sx={{ width: 88, height: 88, fontSize: '2rem', fontWeight: 'bold', bgcolor: 'primary.main' }}>
              {getInitials(team.name)}
            </Avatar>
          )}
          {isTeamAdmin && (
            <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 0.5 }}>
              {logoUploading ? (
                <Box sx={{ bgcolor: 'rgba(0,0,0,0.55)', borderRadius: 1, px: 1, py: 0.5, display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={18} sx={{ color: 'white' }} />
                </Box>
              ) : (
                <>
                  <Tooltip title={team.logo_url ? 'Change logo' : 'Upload logo'}>
                    <IconButton size="small" onClick={() => logoInputRef.current?.click()}
                      sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}>
                      <CameraAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {team.logo_url && (
                    <Tooltip title="Remove logo">
                      <IconButton size="small" onClick={handleRemoveLogo}
                        sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(211,47,47,0.85)' } }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
            </Box>
          )}
        </Box>

        {logoError && (
          <Alert severity="error" sx={{ mx: 2, mt: 1.5 }} onClose={() => setLogoError('')}>{logoError}</Alert>
        )}

        {/* Name + chips */}
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                {team.name}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip label={team.type} size="small"
                color={TEAM_TYPE_COLOR[team.type] || 'default'} sx={{ fontWeight: 'bold' }} />
              <Chip
                icon={team.join_mode === 'request'
                  ? <HowToRegIcon sx={{ fontSize: '13px !important' }} />
                  : <LockOpenIcon sx={{ fontSize: '13px !important' }} />}
                label={team.join_mode === 'request' ? 'By Request' : 'Open'}
                size="small"
                color={team.join_mode === 'request' ? 'warning' : 'success'}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </Box>
        </CardContent>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderTop: '1px solid', borderColor: 'divider', px: 1 }}
        >
          {TABS.map((t, i) => (
            <Tab
              key={i}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {t.icon}
                  <span>{t.label}</span>
                  {t.count !== undefined && (
                    <Chip label={t.count} size="small"
                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', pointerEvents: 'none' }} />
                  )}
                  {t.membersOnly && !isMember && (
                    <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  )}
                </Box>
              }
              sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Card>

      {/* Tab content */}
      <Box sx={{
        border: '1px solid', borderColor: 'divider',
        borderTop: 'none', borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
        bgcolor: 'background.paper', p: { xs: 2, md: 3 },
      }}>
        {tab === 0 && (
          <TeamOverviewTab
            team={team}
            members={members}
            myRole={myRole}
            isTeamAdmin={isTeamAdmin}
            isMember={isMember}
            hasPendingRequest={hasPendingRequest}
            user={user}
            navigate={navigate}
            onJoin={handleJoin}
            onRequestJoin={handleRequestJoin}
            onCancelRequest={handleCancelRequest}
            onLeave={handleLeave}
            onOpenEdit={handleOpenEdit}
            onOpenDelete={() => setDeleteOpen(true)}
            actionLoading={actionLoading}
            fmtDate={fmtDate}
          />
        )}

        {tab === 1 && (
          <TeamRosterTab
            teamId={id}
            members={members}
            profileMap={profileMap}
            joinRequests={joinRequests}
            isTeamAdmin={isTeamAdmin}
            user={user}
            onRefresh={fetchTeam}
            fmtDate={fmtDate}
          />
        )}

        {tab === 2 && (
          isMember || isSiteAdmin ? (
            <TeamSessionsTab
              teamId={id}
              members={members}
              profileMap={profileMap}
              isTeamAdmin={isTeamAdmin}
              user={user}
            />
          ) : (
            <MembersOnlyPlaceholder label="Sessions" onJoin={hasPendingRequest ? null : handleJoin} />
          )
        )}

        {tab === 3 && (
          isMember || isSiteAdmin ? (
            <TeamFinancialsTab
              teamId={id}
              members={members}
              profileMap={profileMap}
              isTeamAdmin={isTeamAdmin}
              canFinance={canFinance}
              user={user}
            />
          ) : (
            <MembersOnlyPlaceholder label="Financials" onJoin={hasPendingRequest ? null : handleJoin} />
          )
        )}
      </Box>

      {/* ── Edit Team Dialog ── */}
      <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.3rem' }}>Edit Team Info</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <TextField fullWidth label="Team Name *" margin="normal"
            value={editForm.name} onChange={ef('name')} />
          <TextField fullWidth label="Description" margin="normal" multiline minRows={2}
            value={editForm.description} onChange={ef('description')} />
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Team Type</InputLabel>
                <Select label="Team Type" value={editForm.type || 'Mixed'} onChange={ef('type')}>
                  {TEAM_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Joining</InputLabel>
                <Select label="Joining" value={editForm.join_mode || 'open'} onChange={ef('join_mode')}>
                  <MenuItem value="open">Open — anyone can join</MenuItem>
                  <MenuItem value="request">By request — admin approval</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">Contact & Location</Typography>
          </Divider>
          <TextField fullWidth label="Contact Person" margin="dense"
            value={editForm.contact_person} onChange={ef('contact_person')} />
          <TextField fullWidth label="Contact Info" margin="dense" placeholder="Email or phone"
            value={editForm.contact_info} onChange={ef('contact_info')} />
          <TextField fullWidth label="Usual Session Location" margin="dense"
            value={editForm.session_location} onChange={ef('session_location')} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
            sx={{ fontWeight: 'bold', px: 4 }}>
            {editSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteOpen} onClose={() => !deleteLoading && setDeleteOpen(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Delete Team?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            This will permanently delete <strong>{team.name}</strong> and remove all members.
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTeam} disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {deleteLoading ? 'Deleting…' : 'Delete Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Members-only placeholder ───────────────────────────────────────────────────
function MembersOnlyPlaceholder({ label, onJoin }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <LockIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {label} are visible to members only.
      </Typography>
      {onJoin && (
        <Button variant="contained" onClick={onJoin} sx={{ mt: 1, fontWeight: 'bold' }}>
          Join to View
        </Button>
      )}
    </Box>
  );
}

export default TeamDetails;
