import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button, CircularProgress,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider,
  IconButton, Tooltip, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, InputAdornment, Select, MenuItem,
  InputLabel, FormControl
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import StarIcon from '@mui/icons-material/Star';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';

const TEAM_TYPES = ['Mixed', 'Open', 'Women', 'Masters', 'Youth', 'Club', 'Other'];

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const TEAM_TYPE_COLOR = {
  Mixed: 'primary', Open: 'info', Women: 'secondary',
  Masters: 'warning', Youth: 'success', Club: 'error', Other: 'default',
};

const storagePathFromUrl = (url) => {
  try {
    const match = url.match(/\/o\/(.+?)\?/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
};

function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const logoInputRef = useRef(null);

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [joinRequests, setJoinRequests] = useState([]);
  const [myRequest, setMyRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => { fetchTeam(); }, [id]);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data: teamData, error: teamErr } = await supabase
        .from('teams').select('*').eq('id', id).single();
      if (teamErr || !teamData) { setNotFound(true); return; }
      setTeam(teamData);

      // Members
      const { data: memberData } = await supabase
        .from('team_members').select('user_id, role, joined_at')
        .eq('team_id', id).order('joined_at', { ascending: true });
      setMembers(memberData || []);

      // Profiles for members
      const memberIds = (memberData || []).map(m => m.user_id);

      // Pending join requests
      const { data: requestData } = await supabase
        .from('team_join_requests')
        .select('id, user_id, created_at')
        .eq('team_id', id).eq('status', 'pending');
      setJoinRequests(requestData || []);

      // All unique profile IDs to fetch
      const requesterIds = (requestData || []).map(r => r.user_id);
      const allIds = [...new Set([...memberIds, ...requesterIds])];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, username, avatar_url').in('id', allIds);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p; });
        setProfileMap(map);
      }

      // My request status
      if (user) {
        const { data: myReq } = await supabase
          .from('team_join_requests')
          .select('id, status')
          .eq('team_id', id).eq('user_id', user.uid)
          .maybeSingle();
        setMyRequest(myReq);
      }
    } catch (err) {
      console.error(err); setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // Derived
  const isMember = user && members.some(m => m.user_id === user.uid);
  const myRole = members.find(m => m.user_id === user?.uid)?.role;
  const isCaptain = myRole === 'captain';
  const canManage = isCaptain || isAdmin;
  const isOpenJoin = team?.join_mode !== 'request';

  // ── Logo ──────────────────────────────────────────────────────────────────

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

  // ── Edit team ─────────────────────────────────────────────────────────────

  const handleOpenEdit = () => {
    setEditForm({
      name: team.name || '',
      description: team.description || '',
      type: team.type || 'Mixed',
      join_mode: team.join_mode || 'open',
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

  // ── Delete team ───────────────────────────────────────────────────────────

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

  // ── Membership ────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').insert([{ team_id: id, user_id: user.uid, role: 'player' }]);
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

  const handleApproveRequest = async (request) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').insert([{ team_id: id, user_id: request.user_id, role: 'player' }]);
      await supabase.from('team_join_requests').update({ status: 'approved' }).eq('id', request.id);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to approve request.'); }
    finally { setActionLoading(false); }
  };

  const handleRejectRequest = async (requestId) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_join_requests').update({ status: 'rejected' }).eq('id', requestId);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to reject request.'); }
    finally { setActionLoading(false); }
  };

  const handleLeave = async () => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').delete().eq('team_id', id).eq('user_id', user.uid);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to leave team.'); }
    finally { setActionLoading(false); }
  };

  const handleRemoveMember = async (userId) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').delete().eq('team_id', id).eq('user_id', userId);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to remove member.'); }
    finally { setActionLoading(false); }
  };

  const handlePromoteToCaptain = async (userId) => {
    setActionLoading(true); setError('');
    try {
      await supabase.from('team_members').update({ role: 'captain' }).eq('team_id', id).eq('user_id', userId);
      await fetchTeam();
    } catch (err) { setError(err.message || 'Failed to promote member.'); }
    finally { setActionLoading(false); }
  };

  // ── Member search ─────────────────────────────────────────────────────────

  const handleSearchUsers = async (q) => {
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
      await supabase.from('team_members').insert([{ team_id: id, user_id: profile.id, role: 'player' }]);
      // Remove any pending request from this user
      await supabase.from('team_join_requests').delete().eq('team_id', id).eq('user_id', profile.id);
      setAddOpen(false); setSearchQuery(''); setSearchResults([]);
      await fetchTeam();
    } catch (err) { setAddError(err.message || 'Failed to add member.'); }
  };

  // ── Misc ──────────────────────────────────────────────────────────────────

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: team.name, url }); }
    else { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('default', { month: 'short', year: 'numeric' });

  const ef = (key) => (e) => setEditForm(p => ({ ...p, [key]: e.target.value }));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
  if (notFound) return (
    <Box sx={{ textAlign: 'center', pt: 10 }}>
      <Typography variant="h5" color="text.secondary">Team not found.</Typography>
      <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate('/teams')}>← Back to Teams</Button>
    </Box>
  );

  const hasPendingRequest = myRequest?.status === 'pending';
  const isRequest = team.join_mode === 'request';

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {/* Nav row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/teams')} sx={{ fontWeight: 'bold' }}>
          Back to Teams
        </Button>
        <Tooltip title={copied ? 'Link copied!' : 'Copy shareable link'}>
          <Button
            variant="outlined" size="small"
            startIcon={copied ? <CheckIcon /> : <ShareIcon />}
            onClick={handleShare} color={copied ? 'success' : 'primary'}
            sx={{ fontWeight: 'bold' }}
          >
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
        style={{ display: 'none' }} onChange={handleLogoSelect} />

      <Grid container spacing={3}>
        {/* ── Left: Team info ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ boxShadow: 3, overflow: 'hidden' }}>
            {/* Logo area */}
            <Box sx={{
              position: 'relative', bgcolor: 'grey.100',
              height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {team.logo_url ? (
                <Box component="img" src={team.logo_url} alt={`${team.name} logo`}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 2 }} />
              ) : (
                <Avatar sx={{ width: 90, height: 90, fontSize: '2rem', fontWeight: 'bold', bgcolor: 'primary.main' }}>
                  {getInitials(team.name)}
                </Avatar>
              )}

              {canManage && (
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

            {logoError && <Alert severity="error" sx={{ mx: 2, mt: 1.5 }} onClose={() => setLogoError('')}>{logoError}</Alert>}

            <CardContent sx={{ p: 3 }}>
              {/* Name + type */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Typography variant="h5" fontWeight="bold" sx={{ lineHeight: 1.3, flexGrow: 1 }}>
                  {team.name}
                </Typography>
                <Chip label={team.type} size="small" color={TEAM_TYPE_COLOR[team.type] || 'default'}
                  sx={{ fontWeight: 'bold', ml: 1, flexShrink: 0 }} />
              </Box>

              {/* Join mode badge */}
              <Chip
                icon={isRequest
                  ? <HowToRegIcon sx={{ fontSize: '14px !important' }} />
                  : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                label={isRequest ? 'By Request' : 'Open to join'}
                size="small"
                color={isRequest ? 'warning' : 'success'}
                sx={{ mb: 2, fontWeight: 'bold' }}
              />

              {team.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                  {team.description}
                </Typography>
              )}

              <Divider sx={{ mb: 2 }} />

              {/* Info rows */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GroupsIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>

                {team.session_location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{team.session_location}</Typography>
                  </Box>
                )}

                {team.contact_person && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{team.contact_person}</Typography>
                  </Box>
                )}

                {team.contact_info && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ContactPhoneIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{team.contact_info}</Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
                Created {fmtDate(team.created_at)}
              </Typography>

              {/* Action buttons */}
              <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!user ? (
                  <Button fullWidth variant="contained" onClick={() => navigate('/login')} sx={{ fontWeight: 'bold' }}>
                    Login to Join
                  </Button>
                ) : isMember ? (
                  <>
                    {isCaptain && (
                      <Chip icon={<StarIcon sx={{ fontSize: '16px !important' }} />}
                        label="You are the captain" color="warning"
                        sx={{ fontWeight: 'bold', justifyContent: 'flex-start' }} />
                    )}
                    {canManage && (
                      <Button fullWidth variant="outlined" startIcon={<EditIcon />}
                        onClick={handleOpenEdit} sx={{ fontWeight: 'bold' }}>
                        Edit Team Info
                      </Button>
                    )}
                    {!isCaptain && (
                      <Button fullWidth variant="outlined" color="error"
                        startIcon={actionLoading ? <CircularProgress size={16} /> : <ExitToAppIcon />}
                        onClick={handleLeave} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                        Leave Team
                      </Button>
                    )}
                    {canManage && (
                      <Button fullWidth variant="text" color="error" startIcon={<DeleteIcon />}
                        onClick={() => setDeleteOpen(true)} sx={{ fontWeight: 'bold' }}>
                        Delete Team
                      </Button>
                    )}
                  </>
                ) : hasPendingRequest ? (
                  <>
                    <Chip icon={<SendIcon sx={{ fontSize: '15px !important' }} />}
                      label="Request sent — awaiting approval"
                      color="warning" sx={{ fontWeight: 'bold', justifyContent: 'flex-start' }} />
                    <Button fullWidth variant="outlined" color="error"
                      startIcon={actionLoading ? <CircularProgress size={16} /> : <CancelIcon />}
                      onClick={handleCancelRequest} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                      Cancel Request
                    </Button>
                  </>
                ) : isOpenJoin ? (
                  <Button fullWidth variant="contained"
                    startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
                    onClick={handleJoin} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                    Join Team
                  </Button>
                ) : (
                  <Button fullWidth variant="contained" color="warning"
                    startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <HowToRegIcon />}
                    onClick={handleRequestJoin} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                    Request to Join
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right: Roster + Requests ── */}
        <Grid size={{ xs: 12, md: 4 }}>

          {/* Join Requests — shown to captains/admins when team is by-request */}
          {(() => {
            const manageableRequests = joinRequests.filter(r => r.user_id !== user?.uid);
            return canManage && manageableRequests.length > 0 && (
              <Card sx={{ boxShadow: 3, mb: 3, border: '1px solid', borderColor: 'warning.light' }}>
                <Box sx={{
                  px: 3, py: 2, bgcolor: 'warning.50',
                  borderBottom: '1px solid', borderColor: 'warning.light',
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                  <HowToRegIcon sx={{ color: 'warning.dark' }} />
                  <Typography variant="h6" fontWeight="bold" color="warning.dark">
                    Join Requests
                  </Typography>
                  <Chip label={manageableRequests.length} size="small" color="warning" sx={{ fontWeight: 'bold', height: 20 }} />
                </Box>
                <CardContent sx={{ p: 0 }}>
                  <List disablePadding>
                    {manageableRequests.map((req, idx) => {
                      const profile = profileMap[req.user_id];
                      return (
                        <React.Fragment key={req.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1.5 }}>
                            <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 38, height: 38, fontSize: '0.9rem', flexShrink: 0 }}>
                              {profile?.avatar_url
                                ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt={profile?.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
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
                                  onClick={() => handleApproveRequest(req)} disabled={actionLoading}>
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton size="small" color="error"
                                  onClick={() => handleRejectRequest(req.id)} disabled={actionLoading}>
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
            );
          })()}

          {/* Roster card */}
          <Card sx={{ boxShadow: 3 }}>
            <Box sx={{
              px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
            }}>
              <Typography variant="h6" fontWeight="bold">Roster</Typography>
              {canManage && (
                <Button size="small" variant="outlined" startIcon={<PersonAddIcon />}
                  onClick={() => { setAddOpen(true); setAddError(''); setSearchQuery(''); setSearchResults([]); }}
                  sx={{ fontWeight: 'bold' }}>
                  Add Member
                </Button>
              )}
            </Box>

            <CardContent sx={{ p: 0 }}>
              {members.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 5 }}>
                  No members yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {[...members]
                    .sort((a, b) => (a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : 0))
                    .map((member, idx) => {
                      const profile = profileMap[member.user_id];
                      const isMe = user && member.user_id === user.uid;
                      const isCap = member.role === 'captain';
                      return (
                        <React.Fragment key={member.user_id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 1.5, gap: 1.5 }}>
                            <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 40, height: 40, flexShrink: 0 }}>
                              {profile?.avatar_url
                                ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt={profile?.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                : getInitials(profile?.full_name)}
                            </Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                                  {profile?.full_name || 'Unknown'}
                                </Typography>
                                {isCap && (
                                  <Chip icon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                                    label="Captain" size="small" color="warning"
                                    sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                                )}
                                {isMe && <Chip label="You" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                @{profile?.username || '—'} · Joined {fmtDate(member.joined_at)}
                              </Typography>
                            </Box>
                            {canManage && !isMe && (
                              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                {!isCap && (
                                  <Tooltip title="Make captain">
                                    <IconButton size="small" color="warning"
                                      onClick={() => handlePromoteToCaptain(member.user_id)} disabled={actionLoading}>
                                      <StarIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Remove from team">
                                  <IconButton size="small" color="error"
                                    onClick={() => handleRemoveMember(member.user_id)} disabled={actionLoading}>
                                    <PersonRemoveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </Box>
                          {idx < members.length - 1 && <Divider />}
                        </React.Fragment>
                      );
                    })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
          <TextField fullWidth label="Contact Info" margin="dense"
            placeholder="Email or phone"
            value={editForm.contact_info} onChange={ef('contact_info')} />
          <TextField fullWidth label="Usual Session Location" margin="dense"
            value={editForm.session_location} onChange={ef('session_location')} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
            sx={{ fontWeight: 'bold', px: 4 }}>
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
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
            {deleteLoading ? 'Deleting...' : 'Delete Team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Member Dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add Member</DialogTitle>
        <DialogContent>
          {addError && <Alert severity="error" sx={{ mb: 2 }}>{addError}</Alert>}
          <TextField fullWidth placeholder="Search by name or username..."
            value={searchQuery} onChange={e => handleSearchUsers(e.target.value)}
            autoFocus margin="dense"
            InputProps={{ startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={16} /> : <SearchIcon color="action" />}
              </InputAdornment>
            )}} />
          {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No users found.</Typography>
          )}
          {searchResults.length > 0 && (
            <List disablePadding sx={{ mt: 1 }}>
              {searchResults.map((profile, idx) => (
                <React.Fragment key={profile.id}>
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 36, height: 36, fontSize: '0.85rem' }}>
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt={profile.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : getInitials(profile.full_name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="subtitle2" fontWeight="bold">{profile.full_name}</Typography>}
                      secondary={`@${profile.username || '—'}`}
                    />
                    <Button size="small" variant="contained" onClick={() => handleAddMember(profile)} sx={{ fontWeight: 'bold' }}>
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

export default TeamDetails;
