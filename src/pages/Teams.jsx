import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActionArea, Chip,
  Button, CircularProgress, Avatar, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, InputLabel, FormControl, Alert, Tooltip, IconButton
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CloseIcon from '@mui/icons-material/Close';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';

const TEAM_TYPES = ['Mixed', 'Open', 'Women', 'Masters', 'Youth', 'Club', 'Other'];

const EMPTY_FORM = {
  name: '', description: '', type: 'Mixed', join_mode: 'open',
  contact_person: '', contact_info: '', session_location: '',
};

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const TYPE_COLOR = {
  Mixed: 'primary', Open: 'info', Women: 'secondary',
  Masters: 'warning', Youth: 'success', Club: 'error', Other: 'default',
};

function Teams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id, name, description, type, logo_url, join_mode,
          session_location, is_active, created_at,
          team_members(user_id, role)
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 400, 400);
      setLogoFile(resized);
      setLogoPreview(URL.createObjectURL(resized));
    } catch {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenCreate = () => {
    setCreateForm(EMPTY_FORM);
    clearLogo();
    setCreateError('');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!createForm.name.trim()) return setCreateError('Team name is required.');
    setCreateSaving(true);
    try {
      let logoUrl = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `team-logos/${Date.now()}-${createForm.name.trim().replace(/\s+/g, '-').toLowerCase()}.${ext}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const { data, error } = await supabase
        .from('teams')
        .insert([{
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          type: createForm.type,
          join_mode: createForm.join_mode,
          contact_person: createForm.contact_person.trim() || null,
          contact_info: createForm.contact_info.trim() || null,
          session_location: createForm.session_location.trim() || null,
          logo_url: logoUrl,
          created_by: user.uid,
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('team_members').insert([{ team_id: data.id, user_id: user.uid, role: 'captain' }]);

      setCreateOpen(false);
      await fetchTeams();
      navigate(`/teams/${data.id}`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create team.');
    } finally {
      setCreateSaving(false);
    }
  };

  const f = (key) => (e) => setCreateForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <Box>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', md: 'flex-start' },
        gap: { xs: 1.5, md: 0 },
        mb: { xs: 2, md: 4 },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <GroupsIcon sx={{ fontSize: { xs: 28, md: 36 }, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Teams</Typography>
            <Typography variant="body1" color="text.secondary">Browse KUPA teams and rosters.</Typography>
          </Box>
        </Box>
        {user && (
          <Button
            variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}
            sx={{ fontWeight: 'bold', alignSelf: { xs: 'stretch', md: 'auto' } }}
          >
            Create Team
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : teams.length === 0 ? (
        <Card sx={{ textAlign: 'center', p: 6, boxShadow: 2 }}>
          <SportsSoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No teams yet.</Typography>
          {user && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ mt: 1, fontWeight: 'bold' }}>
              Create the first team
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={3}>
          {teams.map((team) => {
            const memberCount = team.team_members?.length || 0;
            const isMember = user && team.team_members?.some(m => m.user_id === user.uid);
            const isRequest = team.join_mode === 'request';

            return (
              <Grid size={{ xs: 12, md: 6 }} key={team.id}>
                <Card sx={{
                  height: '100%', boxShadow: 3,
                  transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
                }}>
                  <CardActionArea
                    onClick={() => navigate(`/teams/${team.id}`)}
                    sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    {/* Logo / header area */}
                    <Box sx={{
                      height: 140, bgcolor: 'grey.100',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative', flexShrink: 0,
                    }}>
                      {team.logo_url ? (
                        <Box
                          component="img"
                          src={team.logo_url}
                          alt={`${team.name} logo`}
                          sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 2 }}
                        />
                      ) : (
                        <Avatar sx={{ width: 80, height: 80, fontSize: '1.8rem', fontWeight: 'bold', bgcolor: 'primary.main' }}>
                          {getInitials(team.name)}
                        </Avatar>
                      )}

                      {/* Overlaid chips */}
                      <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 0.75 }}>
                        <Chip
                          label={team.type}
                          size="small"
                          color={TYPE_COLOR[team.type] || 'default'}
                          sx={{ fontWeight: 'bold', opacity: 0.93 }}
                        />
                        <Chip
                          icon={isRequest
                            ? <HowToRegIcon sx={{ fontSize: '14px !important' }} />
                            : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                          label={isRequest ? 'By Request' : 'Open'}
                          size="small"
                          color={isRequest ? 'warning' : 'success'}
                          variant="filled"
                          sx={{ fontWeight: 'bold', opacity: 0.93 }}
                        />
                      </Box>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.3 }}>
                        {team.name}
                      </Typography>

                      {team.description && (
                        <Typography variant="body2" color="text.secondary" sx={{
                          mb: 1.5, display: '-webkit-box',
                          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {team.description}
                        </Typography>
                      )}

                      {team.session_location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                          <LocationOnIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {team.session_location}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 1.5 }} />

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <GroupsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        {isMember && (
                          <Chip label="Member" size="small" color="success" sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Create Team Dialog ── */}
      <Dialog
        open={createOpen}
        onClose={() => !createSaving && setCreateOpen(false)}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.4rem' }}>Create Team</DialogTitle>
        <DialogContent>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

          {/* Logo upload */}
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, mt: 0.5 }}>
            Team Logo{' '}
            <Typography component="span" variant="caption" color="text.secondary">(optional)</Typography>
          </Typography>
          {logoPreview ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                component="img" src={logoPreview} alt="Preview"
                sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              />
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom noWrap sx={{ maxWidth: 240 }}>
                  {logoFile?.name}
                </Typography>
                <Button size="small" color="error" startIcon={<CloseIcon />} onClick={clearLogo} sx={{ fontWeight: 'bold' }}>
                  Remove
                </Button>
              </Box>
            </Box>
          ) : (
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed', borderColor: 'divider', borderRadius: 2,
                p: 2.5, mb: 2, textAlign: 'center', cursor: 'pointer',
                transition: '0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
              }}
            >
              <AddPhotoAlternateIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">Click to upload a logo</Typography>
              <Typography variant="caption" color="text.disabled">PNG, JPG, SVG · Recommended: 400×400 px</Typography>
            </Box>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
            style={{ display: 'none' }} onChange={handleLogoChange} />

          {/* Core fields */}
          <TextField fullWidth label="Team Name *" margin="normal"
            value={createForm.name} onChange={f('name')} />
          <TextField fullWidth label="Description" margin="normal" multiline minRows={2}
            placeholder="What is this team about? (optional)"
            value={createForm.description} onChange={f('description')} />

          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Team Type</InputLabel>
                <Select label="Team Type" value={createForm.type} onChange={f('type')}>
                  {TEAM_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="dense">
                <InputLabel>Joining</InputLabel>
                <Select label="Joining" value={createForm.join_mode} onChange={f('join_mode')}>
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
            placeholder="e.g. Rahul Sharma"
            value={createForm.contact_person} onChange={f('contact_person')} />
          <TextField fullWidth label="Contact Info" margin="dense"
            placeholder="e.g. rahul@email.com or +91 98765 43210"
            value={createForm.contact_info} onChange={f('contact_info')} />
          <TextField fullWidth label="Usual Session Location" margin="dense"
            placeholder="e.g. Koramangala Indoor Stadium"
            value={createForm.session_location} onChange={f('session_location')} />
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={createSaving}>Cancel</Button>
          <Button
            variant="contained" onClick={handleCreate} disabled={createSaving}
            startIcon={createSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            {createSaving ? 'Creating...' : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Teams;
