import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, FormControlLabel,
  Divider, Alert, Chip, CircularProgress, TextField, Button,
  IconButton, List, ListItem, ListItemText, ListItemAvatar,
  Avatar, Tooltip, InputAdornment, Tabs, Tab, Dialog,
  DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  InputLabel, FormControl
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import GavelIcon from '@mui/icons-material/Gavel';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import StarIcon from '@mui/icons-material/Star';
import BadgeIcon from '@mui/icons-material/Badge';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { supabase } from '../supabaseClient';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';

// ── Constants ──────────────────────────────────────────────────────────────

const MODULE_CONFIG = [
  { key: 'is_store_enabled',     label: 'Merchandise Store', description: 'Shows or hides the Merchandise module in the navigation and disables direct URL access.', icon: <StorefrontIcon /> },
  { key: 'is_taskboard_enabled', label: 'Task Board',        description: 'Shows or hides the Task Board module. Members will not be able to claim tasks when disabled.', icon: <TaskAltIcon /> },
  { key: 'is_teams_enabled',     label: 'Teams',             description: 'Shows or hides the Teams module. Members will not be able to browse or join teams when disabled.', icon: <GroupsIcon /> },
];

const GRIEVANCE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const GRIEVANCE_STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const TEAM_TYPES = ['Mixed', 'Open', 'Women', 'Masters', 'Youth', 'Club', 'Other'];
const EMPTY_TEAM_FORM = { name: '', description: '', type: 'Mixed' };

const MEMBERSHIP_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Pending Approval'];
const EMPTY_SLIDE_FORM = { title: '', description: '' };
const EMPTY_PARTNER_FORM = { name: '', type: 'Sponsor' };
const PARTNER_TYPES = ['Sponsor', 'Partner'];
const IMAGE_BUCKET = 'announcement-images';
const EMPTY_ANN_FORM = { title: '', description: '', date: new Date().toISOString().slice(0, 10) };
const EMPTY_TASK_FORM = { title: '', description: '', points: '' };

// ── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const membershipColor = (status) => {
  switch (status) {
    case 'Active':        return 'success';
    case 'Expiring Soon': return 'warning';
    case 'Expired':       return 'error';
    default:              return 'default';
  }
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

const storagePathFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/\/o\/(.+?)\?/);
  return match ? decodeURIComponent(match[1]) : null;
};

// ── Tab panel helper ───────────────────────────────────────────────────────

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

// ══════════════════════════════════════════════════════════════════════════════

function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const { config, loading: configLoading, updateConfig } = useSiteConfig();
  const [activeTab, setActiveTab] = useState(0);

  // ── Site settings state ────────────────────────────────────────────────────
  const [saving, setSaving] = useState(null);
  const [toggleError, setToggleError] = useState('');
  const [successKey, setSuccessKey] = useState(null);

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [userError, setUserError] = useState('');
  // Membership dialog
  const [memberDialog, setMemberDialog] = useState({ open: false, targetUser: null });
  const [memberForm, setMemberForm] = useState({ status: '', expiry: '' });
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  // ── Tasks state ────────────────────────────────────────────────────────────
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskFormError, setTaskFormError] = useState('');
  const [taskFormSaving, setTaskFormSaving] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [validatingId, setValidatingId] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [claimerMap, setClaimerMap] = useState({});
  const [allTasks, setAllTasks] = useState([]);
  const [allTasksLoading, setAllTasksLoading] = useState(true);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  // ── Teams state ────────────────────────────────────────────────────────────
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM_FORM);
  const [teamFormError, setTeamFormError] = useState('');
  const [teamFormSaving, setTeamFormSaving] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);

  // ── Grievances state ───────────────────────────────────────────────────────
  const [grievances, setGrievances] = useState([]);
  const [grievancesLoading, setGrievancesLoading] = useState(true);
  const [updatingGrievanceId, setUpdatingGrievanceId] = useState(null);

  // ── Announcements state ────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [annFormOpen, setAnnFormOpen] = useState(false);
  const [annForm, setAnnForm] = useState(EMPTY_ANN_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [annFormError, setAnnFormError] = useState('');
  const [annFormSaving, setAnnFormSaving] = useState(false);
  const [deletingAnnId, setDeletingAnnId] = useState(null);
  const [annSuccess, setAnnSuccess] = useState('');
  const fileInputRef = useRef(null);

  // ── Carousel state ─────────────────────────────────────────────────────────
  const [slides, setSlides] = useState([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [slideFormOpen, setSlideFormOpen] = useState(false);
  const [slideForm, setSlideForm] = useState(EMPTY_SLIDE_FORM);
  const [slideFile, setSlideFile] = useState(null);
  const [slidePreview, setSlidePreview] = useState(null);
  const [slideFormError, setSlideFormError] = useState('');
  const [slideFormSaving, setSlideFormSaving] = useState(false);
  const [deletingSlideId, setDeletingSlideId] = useState(null);
  const [togglingSlideId, setTogglingSlideId] = useState(null);
  const [reorderingSlideId, setReorderingSlideId] = useState(null);
  const slideFileRef = useRef(null);

  // ── Partners state ─────────────────────────────────────────────────────────
  const [partnersList, setPartnersList] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER_FORM);
  const [partnerFile, setPartnerFile] = useState(null);
  const [partnerPreview, setPartnerPreview] = useState(null);
  const [partnerFormError, setPartnerFormError] = useState('');
  const [partnerFormSaving, setPartnerFormSaving] = useState(false);
  const [deletingPartnerId, setDeletingPartnerId] = useState(null);
  const [togglingPartnerId, setTogglingPartnerId] = useState(null);
  const [reorderingPartnerId, setReorderingPartnerId] = useState(null);
  const partnerFileRef = useRef(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
    fetchPendingTasks();
    fetchAllTasks();
    fetchAnnouncements();
    fetchSlides();
    fetchPartners();
    fetchTeams();
    fetchGrievances();
  }, [isAdmin]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, membership_status, membership_expiry, is_admin, avatar_url')
        .order('full_name', { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); }
    finally { setUsersLoading(false); }
  };

  const fetchPendingTasks = async () => {
    setPendingLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'pending_review')
        .order('claimed_at', { ascending: true });
      if (error) throw error;
      const taskData = data || [];
      setPendingTasks(taskData);

      // Fetch profiles for all unique claimed_by IDs
      const ids = [...new Set(taskData.map(t => t.claimed_by).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', ids);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p; });
        setClaimerMap(map);
      }
    } catch (err) { console.error(err); }
    finally { setPendingLoading(false); }
  };

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements').select('*').order('date', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) { console.error(err); }
    finally { setAnnouncementsLoading(false); }
  };

  // ── Site settings ──────────────────────────────────────────────────────────

  const handleToggle = async (key, currentValue) => {
    setSaving(key); setToggleError(''); setSuccessKey(null);
    try {
      await updateConfig(key, !currentValue);
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 2000);
    } catch (err) { setToggleError(`Failed to update ${key}: ${err.message}`); }
    finally { setSaving(null); }
  };

  // ── User management ────────────────────────────────────────────────────────

  const handleAdminToggle = async (targetId, currentIsAdmin) => {
    setTogglingUserId(targetId); setUserError('');
    try {
      const { error } = await supabase.from('profiles')
        .update({ is_admin: !currentIsAdmin }).eq('id', targetId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_admin: !currentIsAdmin } : u));
    } catch (err) { setUserError(`Failed to update admin status: ${err.message}`); }
    finally { setTogglingUserId(null); }
  };

  const openMemberDialog = (targetUser) => {
    setMemberForm({
      status: targetUser.membership_status || 'Pending Approval',
      expiry: targetUser.membership_expiry
        ? new Date(targetUser.membership_expiry).toISOString().slice(0, 10)
        : '',
    });
    setMemberError(''); setMemberSuccess('');
    setMemberDialog({ open: true, targetUser });
  };

  const handleSaveMembership = async () => {
    setMemberSaving(true); setMemberError(''); setMemberSuccess('');
    try {
      const { error } = await supabase.from('profiles').update({
        membership_status: memberForm.status,
        membership_expiry: memberForm.expiry
          ? new Date(memberForm.expiry).toISOString()
          : null,
      }).eq('id', memberDialog.targetUser.id);
      if (error) throw error;
      setUsers(prev => prev.map(u =>
        u.id === memberDialog.targetUser.id
          ? { ...u, membership_status: memberForm.status, membership_expiry: memberForm.expiry || null }
          : u
      ));
      setMemberSuccess('Membership updated.');
      setTimeout(() => setMemberDialog({ open: false, targetUser: null }), 1200);
    } catch (err) { setMemberError(err.message || 'Failed to update membership.'); }
    finally { setMemberSaving(false); }
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    setTaskFormError('');
    if (!taskForm.title.trim()) return setTaskFormError('Title is required.');
    if (!taskForm.description.trim()) return setTaskFormError('Description is required.');
    if (!taskForm.points || Number(taskForm.points) <= 0) return setTaskFormError('Points must be greater than 0.');
    setTaskFormSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        points: Number(taskForm.points),
        status: 'available',
      }]);
      if (error) throw error;
      setTaskForm(EMPTY_TASK_FORM);
      setTaskFormOpen(false);
    } catch (err) { setTaskFormError(err.message || 'Failed to create task.'); }
    finally { setTaskFormSaving(false); }
  };

  const handleValidateTask = async (task, approve) => {
    setValidatingId(task.id); setValidationError('');
    try {
      if (approve) {
        // Fetch current points, then increment
        const { data: profileData } = await supabase
          .from('profiles').select('reward_points_total').eq('id', task.claimed_by).single();
        const current = profileData?.reward_points_total || 0;
        const { error: pointsErr } = await supabase.from('profiles')
          .update({ reward_points_total: current + task.points }).eq('id', task.claimed_by);
        if (pointsErr) throw pointsErr;
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id);
      } else {
        // Reject: reset task to available
        await supabase.from('tasks').update({
          status: 'available',
          claimed_by: null,
          proof_text: null,
          claimed_at: null,
        }).eq('id', task.id);
      }
      setPendingTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err) { setValidationError(err.message || 'Failed to validate task.'); }
    finally { setValidatingId(null); }
  };

  const fetchAllTasks = async () => {
    setAllTasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, points, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllTasks(data || []);
    } catch (err) { console.error(err); }
    finally { setAllTasksLoading(false); }
  };

  const handleDeleteTask = async (taskId) => {
    setDeletingTaskId(taskId);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
      setPendingTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) { console.error(err); }
    finally { setDeletingTaskId(null); }
  };

  // ── Carousel ───────────────────────────────────────────────────────────────

  const fetchSlides = async () => {
    setSlidesLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_slides')
        .select('id, title, description, image_url, sort_order, is_active')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSlides(data || []);
    } catch (err) { console.error(err); }
    finally { setSlidesLoading(false); }
  };

  const handleSlideImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 1920, 1080, 0.88);
      setSlideFile(resized);
      setSlidePreview(URL.createObjectURL(resized));
    } catch {
      setSlideFile(file);
      setSlidePreview(URL.createObjectURL(file));
    }
  };

  const handleAddSlide = async () => {
    setSlideFormError('');
    if (!slideFile) return setSlideFormError('Please select an image.');
    setSlideFormSaving(true);
    try {
      const ext = slideFile.name.split('.').pop();
      const path = `carousel-slides/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, slideFile);
      const imageUrl = await getDownloadURL(storageRef);

      const maxOrder = slides.reduce((m, s) => Math.max(m, s.sort_order), -1);
      const { error } = await supabase.from('carousel_slides').insert([{
        title: slideForm.title.trim() || null,
        description: slideForm.description.trim() || null,
        image_url: imageUrl,
        sort_order: maxOrder + 1,
        is_active: true,
      }]);
      if (error) throw error;

      setSlideForm(EMPTY_SLIDE_FORM);
      setSlideFile(null);
      setSlidePreview(null);
      if (slideFileRef.current) slideFileRef.current.value = '';
      setSlideFormOpen(false);
      await fetchSlides();
    } catch (err) { setSlideFormError(err.message || 'Failed to add slide.'); }
    finally { setSlideFormSaving(false); }
  };

  const handleDeleteSlide = async (slide) => {
    setDeletingSlideId(slide.id);
    try {
      const path = storagePathFromUrl(slide.image_url);
      if (path) { try { await deleteObject(ref(storage, path)); } catch (_) {} }
      const { error } = await supabase.from('carousel_slides').delete().eq('id', slide.id);
      if (error) throw error;
      setSlides(prev => prev.filter(s => s.id !== slide.id));
    } catch (err) { console.error(err); }
    finally { setDeletingSlideId(null); }
  };

  const handleToggleSlide = async (slide) => {
    setTogglingSlideId(slide.id);
    try {
      const { error } = await supabase.from('carousel_slides')
        .update({ is_active: !slide.is_active }).eq('id', slide.id);
      if (error) throw error;
      setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, is_active: !s.is_active } : s));
    } catch (err) { console.error(err); }
    finally { setTogglingSlideId(null); }
  };

  const handleReorderSlide = async (idx, direction) => {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;
    const a = slides[idx];
    const b = slides[swapIdx];
    setReorderingSlideId(a.id);
    try {
      await supabase.from('carousel_slides').update({ sort_order: b.sort_order }).eq('id', a.id);
      await supabase.from('carousel_slides').update({ sort_order: a.sort_order }).eq('id', b.id);
      await fetchSlides();
    } catch (err) { console.error(err); }
    finally { setReorderingSlideId(null); }
  };

  // ── Partners ───────────────────────────────────────────────────────────────

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, type, logo_url, sort_order, is_active')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPartnersList(data || []);
    } catch (err) { console.error(err); }
    finally { setPartnersLoading(false); }
  };

  const handlePartnerLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 400, 400, 0.9);
      setPartnerFile(resized);
      setPartnerPreview(URL.createObjectURL(resized));
    } catch {
      setPartnerFile(file);
      setPartnerPreview(URL.createObjectURL(file));
    }
  };

  const handleAddPartner = async () => {
    setPartnerFormError('');
    if (!partnerForm.name.trim()) return setPartnerFormError('Name is required.');
    if (!partnerFile) return setPartnerFormError('Logo image is required.');
    setPartnerFormSaving(true);
    try {
      const ext = partnerFile.name.split('.').pop();
      const path = `partner-logos/${Date.now()}-${partnerForm.name.trim().replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, partnerFile);
      const logoUrl = await getDownloadURL(storageRef);

      const maxOrder = partnersList.reduce((m, p) => Math.max(m, p.sort_order), -1);
      const { error } = await supabase.from('partners').insert([{
        name: partnerForm.name.trim(),
        type: partnerForm.type,
        logo_url: logoUrl,
        sort_order: maxOrder + 1,
        is_active: true,
      }]);
      if (error) throw error;

      setPartnerForm(EMPTY_PARTNER_FORM);
      setPartnerFile(null);
      setPartnerPreview(null);
      if (partnerFileRef.current) partnerFileRef.current.value = '';
      setPartnerFormOpen(false);
      await fetchPartners();
    } catch (err) { setPartnerFormError(err.message || 'Failed to add partner.'); }
    finally { setPartnerFormSaving(false); }
  };

  const handleDeletePartner = async (partner) => {
    setDeletingPartnerId(partner.id);
    try {
      const path = storagePathFromUrl(partner.logo_url);
      if (path) { try { await deleteObject(ref(storage, path)); } catch (_) {} }
      const { error } = await supabase.from('partners').delete().eq('id', partner.id);
      if (error) throw error;
      setPartnersList(prev => prev.filter(p => p.id !== partner.id));
    } catch (err) { console.error(err); }
    finally { setDeletingPartnerId(null); }
  };

  const handleTogglePartner = async (partner) => {
    setTogglingPartnerId(partner.id);
    try {
      const { error } = await supabase.from('partners')
        .update({ is_active: !partner.is_active }).eq('id', partner.id);
      if (error) throw error;
      setPartnersList(prev => prev.map(p => p.id === partner.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err) { console.error(err); }
    finally { setTogglingPartnerId(null); }
  };

  const handleReorderPartner = async (idx, direction) => {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= partnersList.length) return;
    const a = partnersList[idx];
    const b = partnersList[swapIdx];
    setReorderingPartnerId(a.id);
    try {
      await supabase.from('partners').update({ sort_order: b.sort_order }).eq('id', a.id);
      await supabase.from('partners').update({ sort_order: a.sort_order }).eq('id', b.id);
      await fetchPartners();
    } catch (err) { console.error(err); }
    finally { setReorderingPartnerId(null); }
  };

  // ── Announcements ──────────────────────────────────────────────────────────

  const resetAnnForm = () => {
    setAnnForm(EMPTY_ANN_FORM);
    setImageFile(null); setImagePreview(null); setAnnFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    setAnnFormError('');
    if (!annForm.title.trim()) return setAnnFormError('Title is required.');
    if (!annForm.description.trim()) return setAnnFormError('Body is required.');
    if (!annForm.date) return setAnnFormError('Date is required.');
    setAnnFormSaving(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const filePath = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const { data: up, error: upErr } = await supabase.storage
          .from(IMAGE_BUCKET).upload(filePath, imageFile, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(up.path);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from('announcements').insert([{
        title: annForm.title.trim(), description: annForm.description.trim(),
        date: new Date(annForm.date).toISOString(), image_url: imageUrl,
      }]);
      if (error) throw error;
      resetAnnForm(); setAnnFormOpen(false);
      setAnnSuccess('Announcement published.');
      setTimeout(() => setAnnSuccess(''), 3000);
      await fetchAnnouncements();
    } catch (err) { setAnnFormError(err.message || 'Failed to publish.'); }
    finally { setAnnFormSaving(false); }
  };

  const handleDeleteAnn = async (id) => {
    setDeletingAnnId(id);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeletingAnnId(null); }
  };

  // ── Teams ──────────────────────────────────────────────────────────────────

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, type, is_active, created_at, team_members(user_id, role)')
        .order('name', { ascending: true });
      if (error) throw error;
      setTeams(data || []);
    } catch (err) { console.error(err); }
    finally { setTeamsLoading(false); }
  };

  const handleCreateTeam = async () => {
    setTeamFormError('');
    if (!teamForm.name.trim()) return setTeamFormError('Team name is required.');
    setTeamFormSaving(true);
    try {
      const { data, error } = await supabase.from('teams').insert([{
        name: teamForm.name.trim(),
        description: teamForm.description.trim() || null,
        type: teamForm.type,
        created_by: user.uid,
        is_active: true,
      }]).select().single();
      if (error) throw error;
      // Add creator as captain
      await supabase.from('team_members').insert([{ team_id: data.id, user_id: user.uid, role: 'captain' }]);
      setTeamForm(EMPTY_TEAM_FORM);
      setTeamFormOpen(false);
      await fetchTeams();
    } catch (err) { setTeamFormError(err.message || 'Failed to create team.'); }
    finally { setTeamFormSaving(false); }
  };

  const handleToggleTeamActive = async (team) => {
    setDeletingTeamId(team.id);
    try {
      const { error } = await supabase.from('teams')
        .update({ is_active: !team.is_active }).eq('id', team.id);
      if (error) throw error;
      setTeams(prev => prev.map(t => t.id === team.id ? { ...t, is_active: !t.is_active } : t));
    } catch (err) { console.error(err); }
    finally { setDeletingTeamId(null); }
  };

  // ── Grievances ─────────────────────────────────────────────────────────────

  const fetchGrievances = async () => {
    setGrievancesLoading(true);
    try {
      const { data, error } = await supabase
        .from('grievances')
        .select('id, title, category, status, is_anonymous, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGrievances(data || []);
    } catch (err) { console.error(err); }
    finally { setGrievancesLoading(false); }
  };

  const handleUpdateGrievanceStatus = async (grievanceId, newStatus) => {
    setUpdatingGrievanceId(grievanceId);
    try {
      const { error } = await supabase.from('grievances')
        .update({ status: newStatus }).eq('id', grievanceId);
      if (error) throw error;
      setGrievances(prev => prev.map(g => g.id === grievanceId ? { ...g, status: newStatus } : g));
    } catch (err) { console.error(err); }
    finally { setUpdatingGrievanceId(null); }
  };

  // ── Access guard ───────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <Typography variant="h5" color="error">Access Denied</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This page is only accessible to site administrators.
        </Typography>
      </Box>
    );
  }

  if (configLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <AdminPanelSettingsIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Admin Panel</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage site settings, users, tasks, announcements, teams, and grievances.
      </Typography>

      {/* Tab bar */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Site Settings" />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Carousel
              {slides.length > 0 && (
                <Chip label={slides.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Partners
              {partnersList.length > 0 && (
                <Chip label={partnersList.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Users
              {users.length > 0 && (
                <Chip label={users.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Tasks
              {pendingTasks.length > 0 && (
                <Chip label={pendingTasks.length} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label="Announcements" />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Teams
              {teams.length > 0 && (
                <Chip label={teams.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Grievances
              {grievances.filter(g => g.status === 'open').length > 0 && (
                <Chip label={grievances.filter(g => g.status === 'open').length} size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
        </Tabs>
      </Box>

      {/* ══════════════ TAB 0: SITE SETTINGS ══════════════ */}
      <TabPanel value={activeTab} index={0}>
        {toggleError && <Alert severity="error" sx={{ mb: 3 }}>{toggleError}</Alert>}
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Module Toggles</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Disabled modules are hidden from navigation and direct URL access redirects to a "Coming Soon" page.
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {MODULE_CONFIG.map((mod, idx) => {
              const isEnabled = Boolean(config[mod.key]);
              return (
                <Box key={mod.key}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', py: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ color: isEnabled ? 'primary.main' : 'text.disabled', mt: 0.5 }}>{mod.icon}</Box>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                          <Typography variant="subtitle1" fontWeight="bold">{mod.label}</Typography>
                          <Chip label={isEnabled ? 'Enabled' : 'Disabled'} size="small"
                            color={isEnabled ? 'success' : 'default'} variant={isEnabled ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold' }}
                          />
                          {successKey === mod.key && <Chip label="Saved!" size="small" color="success" />}
                        </Box>
                        <Typography variant="body2" color="text.secondary">{mod.description}</Typography>
                      </Box>
                    </Box>
                    <FormControlLabel
                      control={<Switch checked={isEnabled} onChange={() => handleToggle(mod.key, isEnabled)} disabled={saving === mod.key} color="primary" />}
                      label="" sx={{ ml: 2, mr: 0 }}
                    />
                  </Box>
                  {idx < MODULE_CONFIG.length - 1 && <Divider />}
                </Box>
              );
            })}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 1: CAROUSEL ══════════════ */}
      <TabPanel value={activeTab} index={1}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SlideshowIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Hero Carousel</Typography>
              </Box>
              {!slideFormOpen && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => { setSlideFormOpen(true); setSlideFormError(''); setSlideForm(EMPTY_SLIDE_FORM); setSlideFile(null); setSlidePreview(null); }}
                  sx={{ fontWeight: 'bold' }}>
                  Add Slide
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage the images shown in the homepage hero carousel. Drag to reorder using the arrow buttons.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {/* Add slide form */}
            {slideFormOpen && (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">New Slide</Typography>
                  <IconButton size="small" onClick={() => { setSlideFormOpen(false); setSlideFile(null); setSlidePreview(null); if (slideFileRef.current) slideFileRef.current.value = ''; }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {slideFormError && <Alert severity="error" sx={{ mb: 2 }}>{slideFormError}</Alert>}

                {/* Image picker */}
                {slidePreview ? (
                  <Box sx={{ position: 'relative', mb: 2, borderRadius: 2, overflow: 'hidden', maxHeight: 200 }}>
                    <Box component="img" src={slidePreview} alt="Preview"
                      sx={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                    <Tooltip title="Remove image">
                      <IconButton size="small"
                        onClick={() => { setSlideFile(null); setSlidePreview(null); if (slideFileRef.current) slideFileRef.current.value = ''; }}
                        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : (
                  <Box onClick={() => slideFileRef.current?.click()}
                    sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer', mb: 2, transition: '0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}>
                    <AddPhotoAlternateIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">Click to upload slide image</Typography>
                    <Typography variant="caption" color="text.disabled">JPG, PNG, WebP · Recommended: 1920×1080</Typography>
                  </Box>
                )}
                <input ref={slideFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }} onChange={handleSlideImageChange} />

                <TextField fullWidth label="Title" placeholder="e.g. Catch the Action" margin="dense"
                  value={slideForm.title} onChange={e => setSlideForm(p => ({ ...p, title: e.target.value }))} />
                <TextField fullWidth label="Description" placeholder="e.g. Experience the thrill of Ultimate Frisbee" margin="dense"
                  value={slideForm.description} onChange={e => setSlideForm(p => ({ ...p, description: e.target.value }))} />

                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setSlideFormOpen(false); setSlideFile(null); setSlidePreview(null); }} disabled={slideFormSaving}>Cancel</Button>
                  <Button variant="contained" onClick={handleAddSlide} disabled={slideFormSaving}
                    startIcon={slideFormSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {slideFormSaving ? 'Uploading...' : 'Add Slide'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Slides list */}
            {slidesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : slides.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <SlideshowIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No slides yet. Add one above to get started.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {slides.map((slide, idx) => {
                  const isDeleting = deletingSlideId === slide.id;
                  const isToggling = togglingSlideId === slide.id;
                  const isReordering = reorderingSlideId === slide.id;
                  return (
                    <Box key={slide.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      border: '1px solid', borderColor: 'divider', borderRadius: 2,
                      p: 1.5, bgcolor: slide.is_active ? 'background.paper' : 'grey.50',
                      opacity: slide.is_active ? 1 : 0.6,
                    }}>
                      {/* Thumbnail */}
                      <Box
                        component="img"
                        src={slide.image_url}
                        alt={slide.title || `Slide ${idx + 1}`}
                        sx={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0, bgcolor: 'grey.200' }}
                      />

                      {/* Info */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {slide.title || <span style={{ color: '#aaa', fontStyle: 'italic' }}>No title</span>}
                          </Typography>
                          <Chip
                            label={slide.is_active ? 'Visible' : 'Hidden'}
                            size="small"
                            color={slide.is_active ? 'success' : 'default'}
                            variant={slide.is_active ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold', height: 18, fontSize: '0.62rem' }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {slide.description || <span style={{ fontStyle: 'italic' }}>No description</span>}
                        </Typography>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        {/* Reorder */}
                        <Tooltip title="Move up">
                          <span>
                            <IconButton size="small" onClick={() => handleReorderSlide(idx, 'up')}
                              disabled={idx === 0 || isReordering}>
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Move down">
                          <span>
                            <IconButton size="small" onClick={() => handleReorderSlide(idx, 'down')}
                              disabled={idx === slides.length - 1 || isReordering}>
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        {/* Visibility toggle */}
                        <Tooltip title={slide.is_active ? 'Hide from carousel' : 'Show in carousel'}>
                          <span>
                            <IconButton size="small" color={slide.is_active ? 'primary' : 'default'}
                              onClick={() => handleToggleSlide(slide)} disabled={isToggling}>
                              {isToggling ? <CircularProgress size={16} /> : slide.is_active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>

                        {/* Delete */}
                        <Tooltip title="Delete slide">
                          <span>
                            <IconButton size="small" color="error"
                              onClick={() => handleDeleteSlide(slide)} disabled={isDeleting}>
                              {isDeleting ? <CircularProgress size={16} color="error" /> : <DeleteIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 2: PARTNERS ══════════════ */}
      <TabPanel value={activeTab} index={2}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ImageIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Partners &amp; Sponsors</Typography>
              </Box>
              {!partnerFormOpen && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => { setPartnerFormOpen(true); setPartnerFormError(''); setPartnerForm(EMPTY_PARTNER_FORM); setPartnerFile(null); setPartnerPreview(null); }}
                  sx={{ fontWeight: 'bold' }}>
                  Add Entry
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Logos are shown on the homepage. Use the arrows to reorder, and the eye icon to show or hide without deleting.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {/* Add partner form */}
            {partnerFormOpen && (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">New Entry</Typography>
                  <IconButton size="small" onClick={() => { setPartnerFormOpen(false); setPartnerFile(null); setPartnerPreview(null); if (partnerFileRef.current) partnerFileRef.current.value = ''; }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {partnerFormError && <Alert severity="error" sx={{ mb: 2 }}>{partnerFormError}</Alert>}

                <FormControl fullWidth margin="dense">
                  <InputLabel>Type</InputLabel>
                  <Select label="Type" value={partnerForm.type}
                    onChange={e => setPartnerForm(p => ({ ...p, type: e.target.value }))}>
                    {PARTNER_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>

                <TextField fullWidth label="Name *" margin="dense" placeholder="e.g. Acme Corp"
                  value={partnerForm.name} onChange={e => setPartnerForm(p => ({ ...p, name: e.target.value }))} />

                {/* Logo picker */}
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                  Logo <Typography component="span" variant="caption" color="error">*</Typography>
                </Typography>
                {partnerPreview ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Box component="img" src={partnerPreview} alt="Preview"
                      sx={{ height: 56, maxWidth: 140, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider', p: 0.5 }} />
                    <Button size="small" color="error" startIcon={<CloseIcon />}
                      onClick={() => { setPartnerFile(null); setPartnerPreview(null); if (partnerFileRef.current) partnerFileRef.current.value = ''; }}
                      sx={{ fontWeight: 'bold' }}>
                      Remove
                    </Button>
                  </Box>
                ) : (
                  <Box onClick={() => partnerFileRef.current?.click()}
                    sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 2.5, textAlign: 'center', cursor: 'pointer', mb: 1, transition: '0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}>
                    <AddPhotoAlternateIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">Click to upload logo</Typography>
                    <Typography variant="caption" color="text.disabled">PNG, JPG, SVG · Transparent background recommended</Typography>
                  </Box>
                )}
                <input ref={partnerFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  style={{ display: 'none' }} onChange={handlePartnerLogoChange} />

                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setPartnerFormOpen(false); setPartnerFile(null); setPartnerPreview(null); }} disabled={partnerFormSaving}>Cancel</Button>
                  <Button variant="contained" onClick={handleAddPartner} disabled={partnerFormSaving}
                    startIcon={partnerFormSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {partnerFormSaving ? 'Uploading...' : 'Add'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Partners list */}
            {partnersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : partnersList.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ImageIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No partners or sponsors yet.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {partnersList.map((partner, idx) => {
                  const isDeleting = deletingPartnerId === partner.id;
                  const isToggling = togglingPartnerId === partner.id;
                  const isReordering = reorderingPartnerId === partner.id;
                  return (
                    <Box key={partner.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      border: '1px solid', borderColor: 'divider', borderRadius: 2,
                      p: 1.5, bgcolor: partner.is_active ? 'background.paper' : 'grey.50',
                      opacity: partner.is_active ? 1 : 0.6,
                    }}>
                      {/* Logo thumbnail */}
                      <Box sx={{
                        width: 80, height: 50, flexShrink: 0, borderRadius: 1,
                        border: '1px solid', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'white', p: 0.5,
                      }}>
                        <Box component="img" src={partner.logo_url} alt={partner.name}
                          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </Box>

                      {/* Info */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>{partner.name}</Typography>
                          <Chip label={partner.type} size="small"
                            color={partner.type === 'Sponsor' ? 'warning' : 'info'}
                            sx={{ fontWeight: 'bold', height: 18, fontSize: '0.62rem' }} />
                          {!partner.is_active && (
                            <Chip label="Hidden" size="small" variant="outlined"
                              sx={{ height: 18, fontSize: '0.62rem' }} />
                          )}
                        </Box>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Tooltip title="Move up"><span>
                          <IconButton size="small" onClick={() => handleReorderPartner(idx, 'up')}
                            disabled={idx === 0 || isReordering}>
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title="Move down"><span>
                          <IconButton size="small" onClick={() => handleReorderPartner(idx, 'down')}
                            disabled={idx === partnersList.length - 1 || isReordering}>
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title={partner.is_active ? 'Hide' : 'Show'}><span>
                          <IconButton size="small" color={partner.is_active ? 'primary' : 'default'}
                            onClick={() => handleTogglePartner(partner)} disabled={isToggling}>
                            {isToggling ? <CircularProgress size={16} /> : partner.is_active ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                          </IconButton>
                        </span></Tooltip>
                        <Tooltip title="Delete"><span>
                          <IconButton size="small" color="error"
                            onClick={() => handleDeletePartner(partner)} disabled={isDeleting}>
                            {isDeleting ? <CircularProgress size={16} color="error" /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </span></Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 3: USERS ══════════════ */}
      <TabPanel value={activeTab} index={3}>
        {userError && <Alert severity="error" sx={{ mb: 2 }}>{userError}</Alert>}
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <PeopleIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">User Management</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Grant admin access, manage membership status and expiry for any registered user.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {/* Search */}
            <TextField
              fullWidth size="small" placeholder="Search by name or username..."
              value={userSearch} onChange={e => setUserSearch(e.target.value)} sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
                endAdornment: userSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setUserSearch('')}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            {usersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : filteredUsers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                {userSearch ? 'No users match your search.' : 'No users found.'}
              </Typography>
            ) : (
              <List disablePadding>
                {filteredUsers.map((u, idx) => {
                  const isSelf = u.id === user?.uid;
                  const isToggling = togglingUserId === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <ListItem
                        disableGutters sx={{ py: 1.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* Membership button */}
                            <Tooltip title="Manage membership">
                              <IconButton size="small" color="primary" onClick={() => openMemberDialog(u)}>
                                <BadgeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {/* Admin toggle */}
                            <Tooltip title={isSelf ? 'Cannot change your own status' : u.is_admin ? 'Revoke admin' : 'Grant admin'}>
                              <span>
                                <Switch
                                  checked={Boolean(u.is_admin)}
                                  onChange={() => handleAdminToggle(u.id, u.is_admin)}
                                  disabled={isSelf || isToggling}
                                  color="warning" size="small"
                                />
                              </span>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 40, height: 40 }}>
                            {isToggling
                              ? <CircularProgress size={18} color="action" />
                              : u.avatar_url
                                ? <img src={u.avatar_url} referrerPolicy="no-referrer" alt={u.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                : getInitials(u.full_name)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight="bold">{u.full_name || 'Unnamed'}</Typography>
                              {u.is_admin && (
                                <Chip icon={<ShieldIcon sx={{ fontSize: '13px !important' }} />} label="Admin"
                                  size="small" color="warning" sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                              )}
                              {isSelf && <Chip label="You" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">@{u.username || 'unknown'}</Typography>
                              {u.membership_status && (
                                <>
                                  <Typography variant="caption" color="text.disabled">·</Typography>
                                  <Chip label={u.membership_status} size="small" color={membershipColor(u.membership_status)}
                                    variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }} />
                                </>
                              )}
                              {u.membership_expiry && (
                                <>
                                  <Typography variant="caption" color="text.disabled">·</Typography>
                                  <Typography variant="caption" color="text.disabled">expires {fmtDate(u.membership_expiry)}</Typography>
                                </>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {idx < filteredUsers.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
              {users.length} registered user{users.length !== 1 ? 's' : ''} total
            </Typography>
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 4: TASKS ══════════════ */}
      <TabPanel value={activeTab} index={4}>
        {/* Create task */}
        <Card sx={{ boxShadow: 3, mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AssignmentIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Create Task</Typography>
              </Box>
              {!taskFormOpen && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => { setTaskFormOpen(true); setTaskFormError(''); }} sx={{ fontWeight: 'bold' }}>
                  New Task
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Draft volunteer tasks that members can claim and complete to earn reward points.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {taskFormOpen && (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">New Task</Typography>
                  <IconButton size="small" onClick={() => { setTaskFormOpen(false); setTaskForm(EMPTY_TASK_FORM); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {taskFormError && <Alert severity="error" sx={{ mb: 2 }}>{taskFormError}</Alert>}
                <TextField fullWidth label="Task Title" placeholder="e.g. Field Setup — Koramangala" margin="dense" required
                  value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
                <TextField fullWidth label="Description" placeholder="Describe exactly what needs to be done..."
                  margin="dense" required multiline minRows={3}
                  value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
                <TextField label="Reward Points" type="number" margin="dense" required
                  placeholder="e.g. 50"
                  value={taskForm.points} onChange={e => setTaskForm(p => ({ ...p, points: e.target.value }))}
                  InputProps={{ inputProps: { min: 1 } }} />
                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setTaskFormOpen(false); setTaskForm(EMPTY_TASK_FORM); }} disabled={taskFormSaving}>Cancel</Button>
                  <Button variant="contained" onClick={handleCreateTask} disabled={taskFormSaving}
                    startIcon={taskFormSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {taskFormSaving ? 'Creating...' : 'Create Task'}
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Validation queue */}
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <TaskAltIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight="bold">Validation Queue</Typography>
              {pendingTasks.length > 0 && (
                <Chip label={`${pendingTasks.length} pending`} color="warning" size="small" sx={{ fontWeight: 'bold' }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review proof submissions from members. Approving a task awards the member their points immediately.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {validationError && <Alert severity="error" sx={{ mb: 2 }}>{validationError}</Alert>}

            {pendingLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : pendingTasks.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: 'success.light', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">All caught up! No pending submissions.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {pendingTasks.map((task, idx) => {
                  const claimer = claimerMap[task.claimed_by];
                  const isValidating = validatingId === task.id;
                  return (
                    <React.Fragment key={task.id}>
                      <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 2.5 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold' }}>
                            {claimer?.avatar_url
                              ? <img src={claimer.avatar_url} referrerPolicy="no-referrer" alt={claimer?.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                              : getInitials(claimer?.full_name)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          sx={{ pr: 0 }}
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
                              <Typography variant="subtitle1" fontWeight="bold">{task.title}</Typography>
                              <Chip icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                                label={`${task.points} pts`} color="warning" size="small" sx={{ fontWeight: 'bold' }} />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Submitted by:</strong> {claimer?.full_name || 'Unknown'} (@{claimer?.username || '?'})
                                {task.claimed_at && ` · ${fmtDate(task.claimed_at)}`}
                              </Typography>
                              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5, mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                  Proof:
                                </Typography>
                                <Typography variant="body2">{task.proof_text || '(no text provided)'}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button
                                  variant="contained" color="success" size="small"
                                  startIcon={isValidating ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                                  disabled={isValidating}
                                  onClick={() => handleValidateTask(task, true)}
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  Approve (+{task.points} pts)
                                </Button>
                                <Button
                                  variant="outlined" color="error" size="small"
                                  startIcon={isValidating ? <CircularProgress size={14} color="inherit" /> : <CancelIcon />}
                                  disabled={isValidating}
                                  onClick={() => handleValidateTask(task, false)}
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  Reject
                                </Button>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {idx < pendingTasks.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>

        {/* All tasks list */}
        <Card sx={{ boxShadow: 3, mt: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <AssignmentIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">All Tasks</Typography>
              {allTasks.length > 0 && (
                <Chip label={allTasks.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              View and delete all tasks regardless of status. Deleting a task removes it permanently.
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {allTasksLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : allTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>No tasks created yet.</Typography>
            ) : (
              <List disablePadding>
                {allTasks.map((task, idx) => {
                  const STATUS_COLOR = { available: 'success', pending_review: 'warning', completed: 'default' };
                  const STATUS_LABEL = { available: 'Available', pending_review: 'Pending Review', completed: 'Completed' };
                  const isDeleting = deletingTaskId === task.id;
                  return (
                    <React.Fragment key={task.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: 'primary.light', width: 38, height: 38, flexShrink: 0 }}>
                          <AssignmentIcon fontSize="small" />
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" fontWeight="bold" noWrap>{task.title}</Typography>
                            <Chip icon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                              label={`${task.points} pts`} size="small" color="warning"
                              sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                            <Chip label={STATUS_LABEL[task.status] || task.status} size="small"
                              color={STATUS_COLOR[task.status] || 'default'} variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap>{task.description}</Typography>
                        </Box>
                        <Tooltip title="Delete task">
                          <span>
                            <IconButton size="small" color="error" onClick={() => handleDeleteTask(task.id)} disabled={isDeleting}>
                              {isDeleting ? <CircularProgress size={16} color="error" /> : <DeleteIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                      {idx < allTasks.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 5: ANNOUNCEMENTS ══════════════ */}
      <TabPanel value={activeTab} index={5}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CampaignIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Announcements</Typography>
              </Box>
              {!annFormOpen && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => { setAnnFormOpen(true); setAnnFormError(''); }} sx={{ fontWeight: 'bold' }}>
                  New Announcement
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Publish announcements to the landing page and Notice Board. Images display only in the full announcement view.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {annSuccess && <Alert severity="success" sx={{ mb: 3 }}>{annSuccess}</Alert>}

            {/* Compose form */}
            {annFormOpen && (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">Compose Announcement</Typography>
                  <IconButton size="small" onClick={() => { setAnnFormOpen(false); resetAnnForm(); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {annFormError && <Alert severity="error" sx={{ mb: 2 }}>{annFormError}</Alert>}
                <TextField fullWidth label="Title" placeholder="e.g. Season Registration Now Open"
                  margin="dense" required value={annForm.title}
                  onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))} />
                <TextField fullWidth label="Body" placeholder="Write the full announcement here..."
                  margin="dense" required multiline minRows={4} value={annForm.description}
                  onChange={e => setAnnForm(p => ({ ...p, description: e.target.value }))} />
                <TextField label="Date" type="date" margin="dense" required value={annForm.date}
                  onChange={e => setAnnForm(p => ({ ...p, date: e.target.value }))}
                  sx={{ mt: 1 }} InputLabelProps={{ shrink: true }} />

                {/* Image upload */}
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Image{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      (optional — shown only in the full announcement view)
                    </Typography>
                  </Typography>
                  {imagePreview ? (
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <Box component="img" src={imagePreview} alt="Preview"
                        sx={{ display: 'block', maxHeight: 200, maxWidth: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                      <Tooltip title="Remove image">
                        <IconButton size="small" onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.55)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{imageFile?.name}</Typography>
                    </Box>
                  ) : (
                    <Box onClick={() => fileInputRef.current?.click()}
                      sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer', transition: '0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}>
                      <ImageIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">Click to upload an image</Typography>
                      <Typography variant="caption" color="text.disabled">JPG, PNG, WEBP — max 5 MB</Typography>
                    </Box>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }} onChange={handleImageChange} />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setAnnFormOpen(false); resetAnnForm(); }} disabled={annFormSaving}>Cancel</Button>
                  <Button variant="contained" onClick={handlePublish} disabled={annFormSaving}
                    startIcon={annFormSaving ? <CircularProgress size={16} color="inherit" /> : <CampaignIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {annFormSaving ? 'Publishing...' : 'Publish'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Published list */}
            {announcementsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : announcements.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>No announcements published yet.</Typography>
            ) : (
              <List disablePadding>
                {announcements.map((a, idx) => (
                  <React.Fragment key={a.id}>
                    <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 2 }}
                      secondaryAction={
                        <Tooltip title="Delete">
                          <span>
                            <IconButton edge="end" color="error" size="small"
                              onClick={() => handleDeleteAnn(a.id)} disabled={deletingAnnId === a.id}>
                              {deletingAnnId === a.id ? <CircularProgress size={18} color="error" /> : <DeleteIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 4, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" fontWeight="bold">{a.title}</Typography>
                            <Chip label={fmtDate(a.date)} size="small" variant="outlined" />
                            {a.image_url && (
                              <Chip icon={<ImageIcon sx={{ fontSize: '14px !important' }} />}
                                label="Has image" size="small" variant="outlined" color="info" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pr: 4 }}>
                            {a.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {idx < announcements.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 6: TEAMS ══════════════ */}
      <TabPanel value={activeTab} index={6}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <GroupsIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Teams</Typography>
              </Box>
              {!teamFormOpen && (
                <Button variant="contained" size="small" startIcon={<AddIcon />}
                  onClick={() => { setTeamFormOpen(true); setTeamFormError(''); setTeamForm(EMPTY_TEAM_FORM); }}
                  sx={{ fontWeight: 'bold' }}>
                  New Team
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create and manage KUPA teams. Captains manage their own rosters.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {teamFormOpen && (
              <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">New Team</Typography>
                  <IconButton size="small" onClick={() => { setTeamFormOpen(false); setTeamForm(EMPTY_TEAM_FORM); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {teamFormError && <Alert severity="error" sx={{ mb: 2 }}>{teamFormError}</Alert>}
                <TextField fullWidth label="Team Name" margin="dense" required
                  value={teamForm.name} onChange={e => setTeamForm(p => ({ ...p, name: e.target.value }))} />
                <TextField fullWidth label="Description" margin="dense" multiline minRows={2}
                  value={teamForm.description} onChange={e => setTeamForm(p => ({ ...p, description: e.target.value }))} />
                <FormControl fullWidth margin="dense">
                  <InputLabel>Type</InputLabel>
                  <Select label="Type" value={teamForm.type} onChange={e => setTeamForm(p => ({ ...p, type: e.target.value }))}>
                    {TEAM_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setTeamFormOpen(false); setTeamForm(EMPTY_TEAM_FORM); }} disabled={teamFormSaving}>Cancel</Button>
                  <Button variant="contained" onClick={handleCreateTeam} disabled={teamFormSaving}
                    startIcon={teamFormSaving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {teamFormSaving ? 'Creating...' : 'Create Team'}
                  </Button>
                </Box>
              </Box>
            )}

            {teamsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : teams.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>No teams yet.</Typography>
            ) : (
              <List disablePadding>
                {teams.map((team, idx) => {
                  const memberCount = team.team_members?.length || 0;
                  const isDeactivating = deletingTeamId === team.id;
                  return (
                    <React.Fragment key={team.id}>
                      <ListItem disableGutters sx={{ py: 1.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={team.type}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                            />
                            <Tooltip title={team.is_active ? 'Deactivate team' : 'Activate team'}>
                              <span>
                                <Switch
                                  checked={Boolean(team.is_active)}
                                  onChange={() => handleToggleTeamActive(team)}
                                  disabled={isDeactivating}
                                  color="success" size="small"
                                />
                              </span>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: team.is_active ? 'primary.main' : 'text.disabled', fontWeight: 'bold', width: 40, height: 40 }}>
                            {isDeactivating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SportsSoccerIcon />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" fontWeight="bold">{team.name}</Typography>
                              {!team.is_active && <Chip label="Inactive" size="small" color="default" sx={{ height: 18, fontSize: '0.65rem' }} />}
                            </Box>
                          }
                          secondary={`${memberCount} member${memberCount !== 1 ? 's' : ''}`}
                        />
                      </ListItem>
                      {idx < teams.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 7: GRIEVANCES ══════════════ */}
      <TabPanel value={activeTab} index={7}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <GavelIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">Grievances</Typography>
              {grievances.filter(g => g.status === 'open').length > 0 && (
                <Chip label={`${grievances.filter(g => g.status === 'open').length} open`} color="error" size="small" sx={{ fontWeight: 'bold' }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review and update the status of submitted grievances. Respond to each via the public grievance detail page.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {grievancesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : grievances.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>No grievances submitted yet.</Typography>
            ) : (
              <List disablePadding>
                {grievances.map((g, idx) => {
                  const isUpdating = updatingGrievanceId === g.id;
                  return (
                    <React.Fragment key={g.id}>
                      <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 2 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            {isUpdating && <CircularProgress size={16} />}
                            <Select
                              size="small"
                              value={g.status}
                              onChange={e => handleUpdateGrievanceStatus(g.id, e.target.value)}
                              disabled={isUpdating}
                              sx={{ fontSize: '0.8rem', minWidth: 130 }}
                            >
                              {GRIEVANCE_STATUSES.map(s => (
                                <MenuItem key={s} value={s} sx={{ fontSize: '0.85rem' }}>
                                  {GRIEVANCE_STATUS_LABELS[s]}
                                </MenuItem>
                              ))}
                            </Select>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 20, flexWrap: 'wrap', mb: 0.5 }}>
                              <Typography variant="subtitle2" fontWeight="bold">{g.title}</Typography>
                              <Chip label={g.category} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                              {g.is_anonymous && <Chip label="Anon" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.disabled">
                              {fmtDate(g.created_at)}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < grievances.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ MEMBERSHIP DIALOG ══════════════ */}
      <Dialog open={memberDialog.open} onClose={() => !memberSaving && setMemberDialog({ open: false, targetUser: null })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Manage Membership
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {memberDialog.targetUser?.full_name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {memberError && <Alert severity="error" sx={{ mb: 2 }}>{memberError}</Alert>}
          {memberSuccess && <Alert severity="success" sx={{ mb: 2 }}>{memberSuccess}</Alert>}

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Membership Status</InputLabel>
            <Select
              label="Membership Status"
              value={memberForm.status}
              onChange={e => setMemberForm(p => ({ ...p, status: e.target.value }))}
            >
              {MEMBERSHIP_STATUSES.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth label="Expiry Date" type="date" margin="normal"
            helperText="Leave blank if no expiry applies."
            value={memberForm.expiry}
            onChange={e => setMemberForm(p => ({ ...p, expiry: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setMemberDialog({ open: false, targetUser: null })} disabled={memberSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveMembership} disabled={memberSaving}
            startIcon={memberSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {memberSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminPanel;
