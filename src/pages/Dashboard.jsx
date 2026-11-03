import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Avatar, Button, Divider,
  Chip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Alert, Tooltip,
  FormControlLabel, Switch,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { storage } from '../firebaseClient';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StarsIcon from '@mui/icons-material/Stars';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import StarIcon from '@mui/icons-material/Star';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CancelIcon from '@mui/icons-material/Cancel';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { REDEMPTION_CATEGORIES, getRedemptionCategoryStyle } from '../constants/redemptionCategories';

const MEMBERSHIP_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Pending Approval'];

const REDEEM_STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'warning', Icon: HourglassEmptyIcon },
  fulfilled: { label: 'Fulfilled', color: 'success', Icon: CheckCircleIcon    },
  rejected:  { label: 'Rejected',  color: 'error',   Icon: CancelIcon         },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Redemption state
  const [redeemItems, setRedeemItems] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [redeemDialog, setRedeemDialog] = useState({ open: false, item: null });
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [livePoints, setLivePoints] = useState(null);

  // Edit profile dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', username: '', phoneNumber: '' });
  const [upiIds, setUpiIds] = useState([]);
  const [newUpi, setNewUpi] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // My Player Story
  const [storyForm, setStoryForm] = useState({ tagline: '', quote: '', body: '', showMyStory: false });
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [storySaving, setStorySaving] = useState(false);
  const [storyError, setStoryError] = useState('');
  const [storySuccess, setStorySuccess] = useState(false);
  const storyFileRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchMyTeams();
      fetchRedeemItems();
      fetchMyRedemptions();
      fetchLivePoints();
    }
  }, [user]);

  // Seed story form whenever the profile identity loads/changes
  useEffect(() => {
    if (!profile) return;
    setStoryForm({
      tagline:     profile.story_tagline  || '',
      quote:       profile.story_quote    || '',
      body:        profile.story_body     || '',
      showMyStory: profile.show_my_story  || false,
    });
    setStoryPreview(profile.story_image_url || null);
    setStoryFile(null);
  }, [profile?.id]);

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

  // ── Redemption ─────────────────────────────────────────────────────────────

  const fetchLivePoints = async () => {
    const { data } = await supabase
      .from('profiles').select('reward_points').eq('id', user.uid).single();
    if (data) setLivePoints(data.reward_points ?? 0);
  };

  const fetchRedeemItems = async () => {
    const { data } = await supabase
      .from('redemption_items').select('*').eq('is_active', true)
      .order('points_cost', { ascending: true });
    setRedeemItems(data || []);
  };

  const fetchMyRedemptions = async () => {
    const { data } = await supabase
      .from('redemptions')
      .select('*, redemption_items(title, category, points_cost)')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false });
    setMyRedemptions(data || []);
  };

  const openRedeemDialog = (item) => {
    setRedeemError(''); setRedeemSuccess('');
    setRedeemDialog({ open: true, item });
  };

  const handleRedeem = async () => {
    const item = redeemDialog.item;
    setRedeemLoading(true); setRedeemError('');
    try {
      const { data, error } = await supabase.rpc('request_redemption', {
        p_user_id: user.uid, p_item_id: item.id,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const autoFulfilled = data?.status === 'fulfilled';
      setRedeemSuccess(autoFulfilled
        ? 'Redemption confirmed!'
        : 'Request submitted! An admin will review and fulfil it shortly.');
      await fetchLivePoints();
      await fetchMyRedemptions();
    } catch (err) {
      setRedeemError(err.message || 'Failed to submit redemption.');
    } finally {
      setRedeemLoading(false);
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

  // ── My Player Story ────────────────────────────────────────────────────────

  const handleStoryImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 1200, 1500, 0.88);
      setStoryFile(resized);
    } catch {
      setStoryFile(file);
    }
    setStoryPreview(URL.createObjectURL(file));
  };

  const handleSaveStory = async () => {
    setStoryError('');
    setStorySaving(true);
    try {
      let imageUrl = profile?.story_image_url || null;
      if (storyFile) {
        const ext = (storyFile.name || 'photo.jpg').split('.').pop();
        const path = `player-stories/${user.uid}-${Date.now()}.${ext}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, storyFile);
        imageUrl = await getDownloadURL(sRef);
      }
      const { error } = await supabase.from('profiles').update({
        story_tagline:   storyForm.tagline.trim()  || null,
        story_quote:     storyForm.quote.trim()    || null,
        story_body:      storyForm.body.trim()     || null,
        story_image_url: imageUrl,
        show_my_story:   storyForm.showMyStory,
      }).eq('id', user.uid);
      if (error) throw error;
      await refreshProfile();
      setStorySuccess(true);
      setStoryFile(null);
      setTimeout(() => setStorySuccess(false), 3000);
    } catch (err) {
      setStoryError(err.message || 'Failed to save story.');
    } finally {
      setStorySaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const displayName = profile?.full_name || user?.displayName || 'KUPA Member';
  const displayEmail = user?.email || user?.phoneNumber || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const memberStatus = profile?.membership_status || 'Pending Approval';
  const rewardPoints = livePoints ?? profile?.reward_points ?? profile?.reward_points_total ?? 0;

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

        {/* Rewards Hub */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%', boxShadow: 2 }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
              {/* Balance row */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: redeemItems.length > 0 ? 2.5 : 0 }}>
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

              {/* Redemption items */}
              {redeemItems.length > 0 && (
                <>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Redeem your points
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 260 }}>
                    {redeemItems.map(item => {
                      const canAfford = rewardPoints >= item.points_cost;
                      const catStyle = getRedemptionCategoryStyle(item.category);
                      return (
                        <Box key={item.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1.5, borderRadius: 2, border: '1px solid',
                          borderColor: 'divider', opacity: canAfford ? 1 : 0.55,
                        }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" fontWeight="bold" noWrap>{item.title}</Typography>
                              <Chip label={item.category} size="small" variant="outlined"
                                sx={{ ...catStyle, height: 18, fontSize: '0.65rem' }} />
                            </Box>
                            {item.description && (
                              <Typography variant="caption" color="text.secondary" noWrap display="block">
                                {item.description}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <StarIcon sx={{ color: 'warning.main', fontSize: 15 }} />
                              <Typography variant="caption" fontWeight="bold" color="warning.dark" noWrap>
                                {item.points_cost.toLocaleString()} pts
                              </Typography>
                            </Box>
                            <Button size="small"
                              variant={canAfford ? 'contained' : 'outlined'}
                              disabled={!canAfford}
                              onClick={() => openRedeemDialog(item)}
                              sx={{ fontWeight: 'bold', minWidth: 72 }}>
                              {canAfford ? 'Redeem' : 'Need more'}
                            </Button>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
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

      {/* ── My Redemptions ── */}
      {myRedemptions.length > 0 && (
        <>
          <Typography variant="h5" fontWeight="bold" sx={{ mt: 5, mb: 2 }}>My Redemptions</Typography>
          <Card sx={{ boxShadow: 2 }}>
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {myRedemptions.map((r, idx) => {
                const sc = REDEEM_STATUS_CONFIG[r.status] ?? REDEEM_STATUS_CONFIG.pending;
                const catStyle = getRedemptionCategoryStyle(r.redemption_items?.category);
                return (
                  <React.Fragment key={r.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {r.redemption_items?.title ?? 'Unknown item'}
                          </Typography>
                          {r.redemption_items?.category && (
                            <Chip label={r.redemption_items.category} size="small" variant="outlined"
                              sx={{ ...catStyle, height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarIcon sx={{ color: 'warning.main', fontSize: 14 }} />
                            <Typography variant="caption" fontWeight="bold" color="warning.dark">
                              {r.redemption_items?.points_cost?.toLocaleString()} pts
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.disabled">· {fmtDate(r.created_at)}</Typography>
                        </Box>
                        {r.admin_notes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Note: {r.admin_notes}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        icon={<sc.Icon sx={{ fontSize: '14px !important' }} />}
                        label={sc.label} size="small" color={sc.color}
                        sx={{ fontWeight: 'bold', flexShrink: 0 }}
                      />
                    </Box>
                    {idx < myRedemptions.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </Box>
          </Card>
        </>
      )}

      {/* ── My Player Story ── */}
      {(() => {
        const hasImage  = !!(storyPreview);
        const hasText   = !!(storyForm.quote.trim() || storyForm.body.trim());
        const isComplete = hasImage && hasText;
        const isLive     = isComplete && storyForm.showMyStory;
        return (
          <Box sx={{ mt: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoStoriesIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
                <Typography variant="h5" fontWeight="bold">My Player Story</Typography>
              </Box>
              <Chip
                size="small"
                label={isLive ? 'Live on site' : isComplete ? 'Ready — toggle to publish' : 'Incomplete'}
                color={isLive ? 'success' : isComplete ? 'warning' : 'default'}
                variant={isLive ? 'filled' : 'outlined'}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>

            <Card sx={{ boxShadow: 2 }}>
              <CardContent sx={{ p: 3 }}>
                {storyError  && <Alert severity="error"   sx={{ mb: 2 }}>{storyError}</Alert>}
                {storySuccess && <Alert severity="success" sx={{ mb: 2 }}>Story saved!</Alert>}

                <Grid container spacing={3}>
                  {/* Photo column */}
                  <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1 }}>
                      Story Photo *
                    </Typography>
                    {storyPreview ? (
                      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '3/4' }}>
                        <Box component="img" src={storyPreview} alt="Story photo"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <Tooltip title="Change photo">
                          <IconButton size="small"
                            onClick={() => storyFileRef.current?.click()}
                            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}>
                            <AddPhotoAlternateIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Box onClick={() => storyFileRef.current?.click()}
                        sx={{
                          border: '2px dashed', borderColor: 'divider', borderRadius: 2,
                          aspectRatio: '3/4', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: '0.2s',
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                        }}>
                        <AddPhotoAlternateIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
                        <Typography variant="caption" color="text.secondary" textAlign="center" px={1}>
                          Click to upload a photo
                        </Typography>
                        <Typography variant="caption" color="text.disabled" textAlign="center">
                          Portrait works best
                        </Typography>
                      </Box>
                    )}
                    <input ref={storyFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }} onChange={handleStoryImageChange} />
                  </Grid>

                  {/* Fields column */}
                  <Grid size={{ xs: 12, sm: 8, md: 9 }}>
                    <TextField
                      fullWidth label="Story Title" margin="dense"
                      placeholder="e.g. Deepak's Journey"
                      helperText="A short label shown with your photo (optional)"
                      value={storyForm.tagline}
                      onChange={e => setStoryForm(p => ({ ...p, tagline: e.target.value }))}
                    />
                    <TextField
                      fullWidth multiline rows={2} label="Pull Quote *" margin="dense"
                      placeholder={`e.g. "Ultimate gave me a family when I moved to Bangalore."`}
                      helperText="Shown large on the landing page — make it memorable"
                      value={storyForm.quote}
                      onChange={e => setStoryForm(p => ({ ...p, quote: e.target.value }))}
                    />
                    <TextField
                      fullWidth multiline rows={4} label="Your Story *" margin="dense"
                      placeholder="A few sentences about your journey with Ultimate Frisbee and what KUPA means to you..."
                      helperText="1–3 sentences works best"
                      value={storyForm.body}
                      onChange={e => setStoryForm(p => ({ ...p, body: e.target.value }))}
                    />

                    <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={storyForm.showMyStory}
                            onChange={e => setStoryForm(p => ({ ...p, showMyStory: e.target.checked }))}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight="bold">Share my story on the KUPA website</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {isComplete
                                ? 'Your story will appear on the landing page and /stories'
                                : 'Add a photo and some text to enable this'}
                            </Typography>
                          </Box>
                        }
                      />
                      <Button
                        variant="contained" onClick={handleSaveStory} disabled={storySaving}
                        startIcon={storySaving ? <CircularProgress size={16} color="inherit" /> : null}
                        sx={{ fontWeight: 'bold', flexShrink: 0 }}
                      >
                        {storySaving ? 'Saving...' : 'Save Story'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        );
      })()}

      {/* ── Redeem Confirm Dialog ── */}
      <Dialog
        open={redeemDialog.open}
        onClose={() => !redeemLoading && setRedeemDialog({ open: false, item: null })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirm Redemption</DialogTitle>
        <DialogContent>
          {redeemError && <Alert severity="error" sx={{ mb: 2 }}>{redeemError}</Alert>}
          {redeemSuccess ? (
            <Alert severity="success">{redeemSuccess}</Alert>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                You're about to redeem <strong>{redeemDialog.item?.title}</strong>.
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Cost</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StarIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                    <Typography variant="body2" fontWeight="bold" color="warning.dark">
                      {redeemDialog.item?.points_cost?.toLocaleString()} pts
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Balance after</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {redeemDialog.item ? (rewardPoints - redeemDialog.item.points_cost).toLocaleString() : '—'} pts
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Points are deducted immediately. An admin will review and fulfil your request.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          {redeemSuccess ? (
            <Button variant="contained" onClick={() => setRedeemDialog({ open: false, item: null })}
              sx={{ fontWeight: 'bold' }}>Done</Button>
          ) : (
            <>
              <Button onClick={() => setRedeemDialog({ open: false, item: null })} disabled={redeemLoading}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleRedeem} disabled={redeemLoading}
                startIcon={redeemLoading ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ fontWeight: 'bold', px: 3 }}>
                {redeemLoading ? 'Submitting...' : 'Confirm'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

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
