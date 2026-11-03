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
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import GavelIcon from '@mui/icons-material/Gavel';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
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
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../supabaseClient';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { resizeImage } from '../utils/resizeImage';
import { TASK_CATEGORIES, getCategoryStyle } from '../constants/taskCategories';
import { REDEMPTION_CATEGORIES, getRedemptionCategoryStyle } from '../constants/redemptionCategories';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

// ── Constants ──────────────────────────────────────────────────────────────

const MODULE_CONFIG = [
  { key: 'is_store_enabled',            label: 'Merchandise Store', description: 'Shows or hides the Merchandise module in the navigation and disables direct URL access.', icon: <StorefrontIcon /> },
  { key: 'is_taskboard_enabled',        label: 'Task Board',        description: 'Shows or hides the Task Board module. Members will not be able to claim tasks when disabled.', icon: <TaskAltIcon /> },
  { key: 'is_teams_enabled',            label: 'Teams',             description: 'Shows or hides the Teams module. Members will not be able to browse or join teams when disabled.', icon: <GroupsIcon /> },
  { key: 'is_player_stories_enabled',   label: 'Player Stories',    description: 'Shows or hides the Player Stories section on the landing page and the /stories page.', icon: <PeopleIcon /> },
];

const GRIEVANCE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const GRIEVANCE_STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const TEAM_TYPES = ['Mixed', 'Open', 'Women', 'Masters', 'Youth', 'Club', 'Other'];
const EMPTY_TEAM_FORM = { name: '', description: '', type: 'Mixed' };

const MEMBERSHIP_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Pending Approval'];
const EMPTY_SLIDE_FORM = { title: '', description: '' };
const EMPTY_PARTNER_FORM = { name: '', type: 'Sponsor' };
const PARTNER_TYPES = ['Sponsor', 'Partner'];
const EMPTY_ANN_FORM = { title: '', description: '', date: new Date().toISOString().slice(0, 10) };
const EMPTY_TASK_FORM = { title: '', description: '', points: '', category: '', requires_photo_proof: false, is_multi_user: false };
const EMPTY_ITEM_FORM = { title: '', description: '', category: 'Membership', points_cost: '', requires_approval: true, quantity_limit: '', is_active: true };

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

// ── CSV helpers ────────────────────────────────────────────────────────────

const CSV_HEADERS = 'title,description,points,category,requires_photo_proof,is_multi_user';
const CSV_EXAMPLE = [
  'Field Setup — Koramangala,"Set up cones, discs, and goals before the match.",50,Field Setup,false,false',
  'Event Photography,Take photos during the tournament for social media.,75,Media & Photography,true,true',
].join('\n');

const downloadTaskTemplate = () => {
  const blob = new Blob([CSV_HEADERS + '\n' + CSV_EXAMPLE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tasks_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

const parseCSVLine = (line) => {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
};

const parseBool = (v) => ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase().trim());

const parseTaskCSV = (text) => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line, i) => {
    if (!line.trim()) return null;
    const vals = parseCSVLine(line);
    const raw = {};
    headers.forEach((h, j) => { raw[h] = vals[j] ?? ''; });
    const errors = [];
    const title = (raw.title || '').trim();
    if (!title) errors.push('Title is required');
    const points = parseInt(raw.points, 10);
    if (isNaN(points) || points < 1) errors.push('Points must be a positive integer');
    const category = (raw.category || '').trim();
    const validCat = TASK_CATEGORIES.find(c => c.label.toLowerCase() === category.toLowerCase());
    if (!validCat) errors.push(`Unknown category "${category}"`);
    return {
      _row: i + 2,
      title,
      description: (raw.description || '').trim() || null,
      points: isNaN(points) ? 0 : points,
      category: validCat?.label ?? category,
      requires_photo_proof: parseBool(raw.requires_photo_proof),
      is_multi_user: parseBool(raw.is_multi_user),
      errors,
    };
  }).filter(Boolean);
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
  // Bulk CSV upload
  const [csvDialog, setCsvDialog] = useState({ open: false, step: 'upload' });
  const [csvRows, setCsvRows] = useState([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const csvFileRef = useRef(null);

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

  // ── Redemption items state ─────────────────────────────────────────────────
  const [redemptionItems, setRedemptionItems] = useState([]);
  const [redemptionItemsLoading, setRedemptionItemsLoading] = useState(true);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [itemFormError, setItemFormError] = useState('');
  const [itemFormSaving, setItemFormSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [togglingItemId, setTogglingItemId] = useState(null);

  // ── Redemption requests state ──────────────────────────────────────────────
  const [redemptionRequests, setRedemptionRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({ open: false, id: null, note: '' });
  const [rejectSaving, setRejectSaving] = useState(false);

  // ── Announcements state ────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [annFormOpen, setAnnFormOpen] = useState(false);
  const [annForm, setAnnForm] = useState(EMPTY_ANN_FORM);
  const [annPreview, setAnnPreview] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [annFormError, setAnnFormError] = useState('');
  const [annFormSaving, setAnnFormSaving] = useState(false);
  const [deletingAnnId, setDeletingAnnId] = useState(null);
  const [editingAnnId, setEditingAnnId] = useState(null);   // null = create, id = edit
  const [existingImageUrl, setExistingImageUrl] = useState(null); // current saved image on edit
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

  // ── Player story profiles state ────────────────────────────────────────────
  const [storyProfiles, setStoryProfiles] = useState([]);
  const [storyProfilesLoading, setStoryProfilesLoading] = useState(false);
  const [togglingStoryApprovalId, setTogglingStoryApprovalId] = useState(null);

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
    fetchRedemptionItems();
    fetchRedemptionRequests();
    fetchStoryProfiles();
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
      // Single-user tasks pending review
      const { data: singleTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'pending_review')
        .eq('is_multi_user', false)
        .order('claimed_at', { ascending: true });

      // Multi-user claims pending review (join task metadata)
      const { data: multiClaims } = await supabase
        .from('task_claims')
        .select('*, tasks(id, title, points, description)')
        .eq('status', 'pending_review')
        .order('claimed_at', { ascending: true });

      const normalizedSingle = (singleTasks || []).map(t => ({ ...t, _type: 'task' }));
      const normalizedClaims = (multiClaims || []).map(c => ({
        _type: 'claim',
        id: c.id,
        task_id: c.task_id,
        user_id: c.user_id,
        status: c.status,
        proof_text: c.proof_text,
        proof_image_url: c.proof_image_url,
        claimed_at: c.claimed_at,
        title: c.tasks?.title,
        points: c.tasks?.points,
        description: c.tasks?.description,
      }));

      const allPending = [...normalizedSingle, ...normalizedClaims]
        .sort((a, b) => new Date(a.claimed_at) - new Date(b.claimed_at));
      setPendingTasks(allPending);

      // Fetch profiles for all claimers
      const ids = [...new Set([
        ...normalizedSingle.map(t => t.claimed_by),
        ...normalizedClaims.map(c => c.user_id),
      ].filter(Boolean))];
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
    if (!taskForm.category) return setTaskFormError('Please select a category.');
    if (!taskForm.points || Number(taskForm.points) <= 0) return setTaskFormError('Points must be greater than 0.');
    setTaskFormSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        points: Number(taskForm.points),
        category: taskForm.category,
        status: 'available',
        requires_photo_proof: taskForm.requires_photo_proof,
        is_multi_user: taskForm.is_multi_user,
      }]);
      if (error) throw error;
      setTaskForm(EMPTY_TASK_FORM);
      setTaskFormOpen(false);
    } catch (err) { setTaskFormError(err.message || 'Failed to create task.'); }
    finally { setTaskFormSaving(false); }
  };

  const handleCSVFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseTaskCSV(e.target.result);
      setCsvRows(rows);
      setCsvDialog(p => ({ ...p, step: 'preview' }));
    };
    reader.readAsText(file);
  };

  const handleBulkInsert = async () => {
    const valid = csvRows.filter(r => r.errors.length === 0);
    if (!valid.length) return;
    setCsvUploading(true);
    try {
      const { error } = await supabase.from('tasks').insert(
        valid.map(r => ({
          title: r.title,
          description: r.description,
          points: r.points,
          category: r.category,
          requires_photo_proof: r.requires_photo_proof,
          is_multi_user: r.is_multi_user,
          status: 'available',
        }))
      );
      if (error) throw error;
      setCsvResult({ inserted: valid.length, skipped: csvRows.length - valid.length });
      await fetchAllTasks();
    } catch (err) {
      setCsvResult({ error: err.message || 'Import failed.' });
    } finally {
      setCsvUploading(false);
      setCsvDialog(p => ({ ...p, step: 'result' }));
    }
  };

  const handleValidateTask = async (item, approve) => {
    setValidatingId(item.id); setValidationError('');
    const isMultiClaim = item._type === 'claim';
    const claimerId = isMultiClaim ? item.user_id : item.claimed_by;
    try {
      if (approve) {
        const { error: pointsErr } = await supabase
          .rpc('increment_reward_points', { user_id: claimerId, points: item.points });
        if (pointsErr) throw pointsErr;
        if (isMultiClaim) {
          await supabase.from('task_claims').update({ status: 'completed' }).eq('id', item.id);
        } else {
          await supabase.from('tasks').update({ status: 'completed' }).eq('id', item.id);
        }
      } else {
        if (isMultiClaim) {
          // Delete the claim so the user can try again
          await supabase.from('task_claims').delete().eq('id', item.id);
        } else {
          await supabase.from('tasks').update({
            status: 'available',
            claimed_by: null,
            proof_text: null,
            proof_image_url: null,
            claimed_at: null,
          }).eq('id', item.id);
        }
      }
      setPendingTasks(prev => prev.filter(t => t.id !== item.id));
    } catch (err) { setValidationError(err.message || 'Failed to validate task.'); }
    finally { setValidatingId(null); }
  };

  const fetchAllTasks = async () => {
    setAllTasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, points, status, is_multi_user, category')
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

  // ── Player Story Profiles ──────────────────────────────────────────────────

  const fetchStoryProfiles = async () => {
    setStoryProfilesLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, story_tagline, story_quote, story_body, story_image_url, show_my_story, story_approved')
        .eq('show_my_story', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      setStoryProfiles(data || []);
    } catch (err) { console.error(err); }
    finally { setStoryProfilesLoading(false); }
  };

  const handleToggleStoryApproval = async (p) => {
    setTogglingStoryApprovalId(p.id);
    try {
      const newVal = p.story_approved === false ? true : false;
      const { error } = await supabase.from('profiles')
        .update({ story_approved: newVal }).eq('id', p.id);
      if (error) throw error;
      setStoryProfiles(prev => prev.map(s => s.id === p.id ? { ...s, story_approved: newVal } : s));
    } catch (err) { console.error(err); }
    finally { setTogglingStoryApprovalId(null); }
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
    setImageFile(null); setImagePreview(null); setAnnFormError(''); setAnnPreview(false);
    setEditingAnnId(null); setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditAnn = (ann) => {
    setEditingAnnId(ann.id);
    setAnnForm({
      title: ann.title || '',
      description: ann.description || '',
      date: ann.date ? ann.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setExistingImageUrl(ann.image_url || null);
    setImageFile(null);
    setImagePreview(ann.image_url || null);
    setAnnPreview(false);
    setAnnFormError('');
    setAnnFormOpen(true);
  };

  const handleUpdateAnn = async () => {
    setAnnFormError('');
    if (!annForm.title.trim()) return setAnnFormError('Title is required.');
    if (!annForm.description.trim()) return setAnnFormError('Body is required.');
    if (!annForm.date) return setAnnFormError('Date is required.');
    setAnnFormSaving(true);
    try {
      let imageUrl = existingImageUrl; // keep existing by default

      // New file selected — upload it and delete old
      if (imageFile) {
        if (existingImageUrl) {
          const oldPath = storagePathFromUrl(existingImageUrl);
          if (oldPath) try { await deleteObject(ref(storage, oldPath)); } catch (_) {}
        }
        const ext = imageFile.name.split('.').pop();
        const filePath = `announcement-images/${Date.now()}.${ext}`;
        const sRef = ref(storage, filePath);
        await uploadBytes(sRef, imageFile);
        imageUrl = await getDownloadURL(sRef);
      }

      // Image explicitly removed (preview cleared, no new file)
      if (!imageFile && !imagePreview && existingImageUrl) {
        const oldPath = storagePathFromUrl(existingImageUrl);
        if (oldPath) try { await deleteObject(ref(storage, oldPath)); } catch (_) {}
        imageUrl = null;
      }

      const { error } = await supabase.from('announcements').update({
        title: annForm.title.trim(),
        description: annForm.description.trim(),
        date: new Date(annForm.date).toISOString(),
        image_url: imageUrl,
      }).eq('id', editingAnnId);
      if (error) throw error;

      resetAnnForm(); setAnnFormOpen(false);
      setAnnSuccess('Announcement updated.');
      setTimeout(() => setAnnSuccess(''), 3000);
      await fetchAnnouncements();
    } catch (err) { setAnnFormError(err.message || 'Failed to update.'); }
    finally { setAnnFormSaving(false); }
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
        const ext = imageFile.name.split('.').pop();
        const filePath = `announcement-images/${Date.now()}.${ext}`;
        const sRef = ref(storage, filePath);
        await uploadBytes(sRef, imageFile);
        imageUrl = await getDownloadURL(sRef);
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
      const ann = announcements.find(a => a.id === id);
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      // Clean up Firebase Storage image if present
      if (ann?.image_url) {
        const path = storagePathFromUrl(ann.image_url);
        if (path) try { await deleteObject(ref(storage, path)); } catch (_) {}
      }
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

  const fetchRedemptionItems = async () => {
    setRedemptionItemsLoading(true);
    try {
      const { data, error } = await supabase
        .from('redemption_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRedemptionItems(data || []);
    } catch (err) { console.error(err); }
    finally { setRedemptionItemsLoading(false); }
  };

  const fetchRedemptionRequests = async () => {
    setRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('redemptions')
        .select('*, redemption_items(title, category, points_cost), profiles(full_name, username, avatar_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRedemptionRequests(data || []);
    } catch (err) { console.error(err); }
    finally { setRequestsLoading(false); }
  };

  const handleSaveItem = async () => {
    if (!itemForm.title.trim()) { setItemFormError('Title is required.'); return; }
    const cost = Number(itemForm.points_cost);
    if (!itemForm.points_cost || isNaN(cost) || cost <= 0) {
      setItemFormError('Points cost must be a positive number.'); return;
    }
    const qlimit = itemForm.quantity_limit ? Number(itemForm.quantity_limit) : null;
    if (qlimit !== null && (isNaN(qlimit) || qlimit < 1)) {
      setItemFormError('Quantity limit must be a positive number.'); return;
    }
    setItemFormSaving(true); setItemFormError('');
    try {
      const { error } = await supabase.from('redemption_items').insert({
        title: itemForm.title.trim(),
        description: itemForm.description.trim() || null,
        category: itemForm.category,
        points_cost: cost,
        requires_approval: itemForm.requires_approval,
        quantity_limit: qlimit,
        is_active: itemForm.is_active,
      });
      if (error) throw error;
      setItemFormOpen(false);
      setItemForm(EMPTY_ITEM_FORM);
      await fetchRedemptionItems();
    } catch (err) { setItemFormError(err.message || 'Failed to save item.'); }
    finally { setItemFormSaving(false); }
  };

  const handleDeleteItem = async (id) => {
    setDeletingItemId(id);
    try {
      const { error } = await supabase.from('redemption_items').delete().eq('id', id);
      if (error) throw error;
      setRedemptionItems(prev => prev.filter(i => i.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeletingItemId(null); }
  };

  const handleToggleItem = async (item) => {
    setTogglingItemId(item.id);
    try {
      const { error } = await supabase.from('redemption_items')
        .update({ is_active: !item.is_active }).eq('id', item.id);
      if (error) throw error;
      setRedemptionItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !item.is_active } : i));
    } catch (err) { console.error(err); }
    finally { setTogglingItemId(null); }
  };

  const handleApproveRequest = async (id) => {
    setProcessingRequestId(id);
    try {
      const { error } = await supabase.from('redemptions')
        .update({ status: 'fulfilled' }).eq('id', id);
      if (error) throw error;
      setRedemptionRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'fulfilled' } : r));
    } catch (err) { console.error(err); }
    finally { setProcessingRequestId(null); }
  };

  const handleRejectRequest = async () => {
    setRejectSaving(true);
    try {
      const { error } = await supabase.rpc('refund_redemption', {
        p_redemption_id: rejectDialog.id,
        p_notes: rejectDialog.note.trim() || null,
      });
      if (error) throw error;
      setRejectDialog({ open: false, id: null, note: '' });
      await fetchRedemptionRequests();
    } catch (err) { console.error(err); }
    finally { setRejectSaving(false); }
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
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Redemption Items
              {redemptionItems.length > 0 && (
                <Chip label={redemptionItems.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Redemption Requests
              {redemptionRequests.filter(r => r.status === 'pending').length > 0 && (
                <Chip label={redemptionRequests.filter(r => r.status === 'pending').length} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Player Stories
              {storyProfiles.length > 0 && (
                <Chip label={storyProfiles.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" startIcon={<UploadFileIcon />}
                    onClick={() => { setCsvDialog({ open: true, step: 'upload' }); setCsvRows([]); setCsvResult(null); }}
                    sx={{ fontWeight: 'bold' }}>
                    Bulk Upload
                  </Button>
                  <Button variant="contained" size="small" startIcon={<AddIcon />}
                    onClick={() => { setTaskFormOpen(true); setTaskFormError(''); }} sx={{ fontWeight: 'bold' }}>
                    New Task
                  </Button>
                </Box>
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
                <FormControl fullWidth margin="dense" required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={taskForm.category}
                    label="Category"
                    onChange={e => setTaskForm(p => ({ ...p, category: e.target.value }))}
                    renderValue={(val) => {
                      const cat = TASK_CATEGORIES.find(c => c.label === val);
                      return cat ? (
                        <Chip label={cat.label} size="small" sx={{ ...getCategoryStyle(val), fontWeight: 'bold' }} />
                      ) : val;
                    }}
                  >
                    {TASK_CATEGORIES.map(cat => (
                      <MenuItem key={cat.label} value={cat.label}>
                        <Chip label={cat.label} size="small" sx={{ ...getCategoryStyle(cat.label), fontWeight: 'bold', mr: 1 }} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Reward Points" type="number" margin="dense" required
                  placeholder="e.g. 50"
                  value={taskForm.points} onChange={e => setTaskForm(p => ({ ...p, points: e.target.value }))}
                  InputProps={{ inputProps: { min: 1 } }} />
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Switch
                      checked={taskForm.requires_photo_proof}
                      onChange={e => setTaskForm(p => ({ ...p, requires_photo_proof: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">Require photo proof</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Members must upload a screenshot when submitting proof
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Switch
                      checked={taskForm.is_multi_user}
                      onChange={e => setTaskForm(p => ({ ...p, is_multi_user: e.target.checked }))}
                      color="secondary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">Multi-user task</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Multiple members can claim and complete this task independently
                      </Typography>
                    </Box>
                  }
                />
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
                  const claimerId = task._type === 'claim' ? task.user_id : task.claimed_by;
                  const claimer = claimerMap[claimerId];
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
                              {task.category && (
                                <Chip label={task.category} size="small"
                                  sx={{ ...getCategoryStyle(task.category), fontWeight: 'bold' }} />
                              )}
                              <Chip icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                                label={`${task.points} pts`} color="warning" size="small" sx={{ fontWeight: 'bold' }} />
                              {task._type === 'claim' && (
                                <Chip icon={<GroupsIcon sx={{ fontSize: '14px !important' }} />}
                                  label="Multi-user" color="secondary" size="small" variant="outlined" />
                              )}
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
                                {task.proof_image_url && (
                                  <Box
                                    component="a" href={task.proof_image_url} target="_blank" rel="noopener noreferrer"
                                    sx={{ display: 'block', mb: task.proof_text ? 1 : 0 }}
                                  >
                                    <Box
                                      component="img" src={task.proof_image_url} alt="Proof screenshot"
                                      sx={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
                                    />
                                  </Box>
                                )}
                                <Typography variant="body2">{task.proof_text || (!task.proof_image_url && '(no proof provided)')}</Typography>
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
                            {task.category && (
                              <Chip label={task.category} size="small"
                                sx={{ ...getCategoryStyle(task.category), fontWeight: 'bold', height: 20, fontSize: '0.65rem' }} />
                            )}
                            <Chip icon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                              label={`${task.points} pts`} size="small" color="warning"
                              sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                            <Chip label={STATUS_LABEL[task.status] || task.status} size="small"
                              color={STATUS_COLOR[task.status] || 'default'} variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                            {task.is_multi_user && (
                              <Chip icon={<GroupsIcon sx={{ fontSize: '13px !important' }} />}
                                label="Multi-user" size="small" color="secondary" variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }} />
                            )}
                            {task.requires_photo_proof && (
                              <Chip icon={<CameraAltIcon sx={{ fontSize: '13px !important' }} />}
                                label="Photo" size="small" color="info" variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }} />
                            )}
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
                  <Typography variant="subtitle1" fontWeight="bold">
                    {editingAnnId ? 'Edit Announcement' : 'Compose Announcement'}
                  </Typography>
                  <IconButton size="small" onClick={() => { setAnnFormOpen(false); resetAnnForm(); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
                {annFormError && <Alert severity="error" sx={{ mb: 2 }}>{annFormError}</Alert>}
                <TextField fullWidth label="Title" placeholder="e.g. Season Registration Now Open"
                  margin="dense" required value={annForm.title}
                  onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))} />
                {/* Body — write / preview tabs */}
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Body <Typography component="span" variant="caption" color="text.disabled">— supports **bold**, *italic*, [links](url), - lists</Typography>
                    </Typography>
                    <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                      {['Write', 'Preview'].map(tab => (
                        <Box key={tab} component="button" onClick={() => setAnnPreview(tab === 'Preview')}
                          sx={{
                            px: 1.5, py: 0.4, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            bgcolor: (tab === 'Preview') === annPreview ? 'primary.main' : 'transparent',
                            color: (tab === 'Preview') === annPreview ? 'primary.contrastText' : 'text.secondary',
                            transition: '0.15s',
                          }}>
                          {tab}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  {annPreview ? (
                    <Box sx={{
                      minHeight: 120, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                      bgcolor: 'background.paper', fontSize: '0.9rem', lineHeight: 1.8,
                      color: annForm.description.trim() ? 'text.primary' : 'text.disabled',
                      '& p': { mt: 0, mb: 1 }, '& strong': { fontWeight: 700 },
                      '& ul,& ol': { pl: 2.5, mb: 1 }, '& li': { mb: 0.25 },
                      '& a': { color: 'primary.main' },
                      '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', ml: 0, pl: 1.5, color: 'text.disabled', fontStyle: 'italic' },
                      '& code': { fontFamily: 'monospace', fontSize: '0.85em', bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 },
                    }}>
                      {annForm.description.trim()
                        ? <ReactMarkdown>{annForm.description}</ReactMarkdown>
                        : 'Nothing to preview yet.'}
                    </Box>
                  ) : (
                    <TextField fullWidth placeholder="Write the full announcement here..." required
                      multiline minRows={4} value={annForm.description}
                      onChange={e => setAnnForm(p => ({ ...p, description: e.target.value }))}
                      sx={{ mt: 0 }} />
                  )}
                </Box>
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
                  <Button variant="contained"
                    onClick={editingAnnId ? handleUpdateAnn : handlePublish}
                    disabled={annFormSaving}
                    startIcon={annFormSaving ? <CircularProgress size={16} color="inherit" /> : <CampaignIcon />}
                    sx={{ fontWeight: 'bold', px: 3 }}>
                    {annFormSaving
                      ? (editingAnnId ? 'Saving...' : 'Publishing...')
                      : (editingAnnId ? 'Save Changes' : 'Publish')}
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
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary"
                              onClick={() => handleEditAnn(a)}
                              disabled={deletingAnnId === a.id}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <span>
                              <IconButton edge="end" color="error" size="small"
                                onClick={() => handleDeleteAnn(a.id)} disabled={deletingAnnId === a.id}>
                                {deletingAnnId === a.id ? <CircularProgress size={18} color="error" /> : <DeleteIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
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

      {/* ══════════════ TAB 8: REDEMPTION ITEMS ══════════════ */}
      <TabPanel value={activeTab} index={8}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <CardGiftcardIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">Redemption Items</Typography>
              <Box sx={{ ml: 'auto' }}>
                <Button variant="contained" startIcon={<AddIcon />} size="small"
                  onClick={() => { setItemForm(EMPTY_ITEM_FORM); setItemFormError(''); setItemFormOpen(true); }}
                  sx={{ fontWeight: 'bold' }}>
                  Add Item
                </Button>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create and manage items members can redeem their points for.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {redemptionItemsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : redemptionItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No redemption items yet. Add one to get started.
              </Typography>
            ) : (
              <List disablePadding>
                {redemptionItems.map((item, idx) => {
                  const catStyle = getRedemptionCategoryStyle(item.category);
                  const isDeleting = deletingItemId === item.id;
                  const isToggling = togglingItemId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <ListItem disableGutters sx={{ alignItems: 'center', py: 1.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={item.is_active ? 'Deactivate' : 'Activate'}>
                              <span>
                                <Switch
                                  checked={Boolean(item.is_active)}
                                  onChange={() => handleToggleItem(item)}
                                  disabled={isToggling || isDeleting}
                                  color="success" size="small"
                                />
                              </span>
                            </Tooltip>
                            <Tooltip title="Delete item">
                              <span>
                                <IconButton size="small" color="error"
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={isDeleting || isToggling}>
                                  {isDeleting ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: catStyle.bgcolor ?? 'action.hover', color: catStyle.color ?? 'text.primary', width: 40, height: 40 }}>
                            <CardGiftcardIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 14, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight="bold">{item.title}</Typography>
                              <Chip label={item.category} size="small" variant="outlined"
                                sx={{ ...catStyle, height: 18, fontSize: '0.65rem' }} />
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <StarIcon sx={{ color: 'warning.main', fontSize: 14 }} />
                                <Typography variant="caption" fontWeight="bold" color="warning.dark">
                                  {item.points_cost?.toLocaleString()} pts
                                </Typography>
                              </Box>
                              {!item.is_active && (
                                <Chip label="Inactive" size="small" color="default" sx={{ height: 18, fontSize: '0.65rem' }} />
                              )}
                            </Box>
                          }
                          secondary={item.description || null}
                        />
                      </ListItem>
                      {idx < redemptionItems.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 9: REDEMPTION REQUESTS ══════════════ */}
      <TabPanel value={activeTab} index={9}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight="bold">Redemption Requests</Typography>
              {redemptionRequests.filter(r => r.status === 'pending').length > 0 && (
                <Chip label={`${redemptionRequests.filter(r => r.status === 'pending').length} pending`}
                  color="warning" size="small" sx={{ fontWeight: 'bold' }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review and process member redemption requests. Approving marks the item as fulfilled; rejecting refunds the points.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {requestsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : redemptionRequests.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No redemption requests yet.
              </Typography>
            ) : (
              <List disablePadding>
                {redemptionRequests.map((r, idx) => {
                  const catStyle = getRedemptionCategoryStyle(r.redemption_items?.category);
                  const isPending = r.status === 'pending';
                  const isProcessing = processingRequestId === r.id;
                  const profile = r.profiles;
                  return (
                    <React.Fragment key={r.id}>
                      <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 1.5 }}
                        secondaryAction={isPending ? (
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            {isProcessing && <CircularProgress size={16} sx={{ mt: 1 }} />}
                            <Tooltip title="Approve — mark as fulfilled">
                              <span>
                                <IconButton size="small" color="success"
                                  onClick={() => handleApproveRequest(r.id)}
                                  disabled={isProcessing}>
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Reject — refund points">
                              <span>
                                <IconButton size="small" color="error"
                                  onClick={() => setRejectDialog({ open: true, id: r.id, note: '' })}
                                  disabled={isProcessing}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Chip
                            label={r.status === 'fulfilled' ? 'Fulfilled' : 'Rejected'}
                            size="small"
                            color={r.status === 'fulfilled' ? 'success' : 'error'}
                            sx={{ fontWeight: 'bold', mt: 0.5 }}
                          />
                        )}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 'bold' }}>
                            {getInitials(profile?.full_name)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 14, flexWrap: 'wrap', mb: 0.25 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {r.redemption_items?.title ?? 'Unknown item'}
                              </Typography>
                              {r.redemption_items?.category && (
                                <Chip label={r.redemption_items.category} size="small" variant="outlined"
                                  sx={{ ...catStyle, height: 18, fontSize: '0.65rem' }} />
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <StarIcon sx={{ color: 'warning.main', fontSize: 14 }} />
                                <Typography variant="caption" fontWeight="bold" color="warning.dark">
                                  {r.redemption_items?.points_cost?.toLocaleString()} pts
                                </Typography>
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box component="span">
                              <Typography variant="caption" component="span" fontWeight="bold">
                                {profile?.full_name ?? profile?.username ?? 'Unknown user'}
                              </Typography>
                              <Typography variant="caption" component="span" color="text.disabled">
                                {' · '}{fmtDate(r.created_at)}
                              </Typography>
                              {r.admin_notes && (
                                <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.5 }}>
                                  Note: {r.admin_notes}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {idx < redemptionRequests.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ TAB 10: PLAYER STORIES ══════════════ */}
      <TabPanel value={activeTab} index={10}>
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <PeopleIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">Player Story Profiles</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Players who have opted to share their story appear here. You can block any profile from appearing on the landing page and /stories page. Players manage their own content from their Dashboard.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {storyProfilesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : storyProfiles.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <PeopleIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No players have opted in yet.</Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                  Players can share their story from their Dashboard profile page.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {storyProfiles.map((p) => {
                  const isToggling = togglingStoryApprovalId === p.id;
                  const isComplete = !!(p.story_image_url) && !!(p.story_quote || p.story_body);
                  const isBlocked  = p.story_approved === false;
                  const isLive     = isComplete && !isBlocked;
                  return (
                    <Box key={p.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      border: '1px solid', borderColor: isBlocked ? 'error.light' : 'divider',
                      borderRadius: 2, p: 1.5,
                      bgcolor: isBlocked ? 'error.50' : 'background.paper',
                      opacity: isBlocked ? 0.75 : 1,
                    }}>
                      {/* Avatar / story thumbnail */}
                      <Box component="img"
                        src={p.story_image_url || p.avatar_url || ''}
                        alt={p.full_name || p.username}
                        sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0, bgcolor: 'grey.200' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />

                      {/* Info */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {p.full_name || p.username || 'Unknown player'}
                          </Typography>
                          {p.username && p.full_name && (
                            <Typography variant="caption" color="text.disabled">@{p.username}</Typography>
                          )}
                          <Chip
                            label={isBlocked ? 'Blocked' : isLive ? 'Live' : 'Incomplete'}
                            size="small"
                            color={isBlocked ? 'error' : isLive ? 'success' : 'default'}
                            variant={isLive ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold', height: 18, fontSize: '0.62rem' }}
                          />
                          {!isComplete && !isBlocked && (
                            <Chip label="Missing photo or text" size="small" variant="outlined"
                              sx={{ height: 18, fontSize: '0.62rem', color: 'warning.main', borderColor: 'warning.main' }} />
                          )}
                        </Box>
                        {p.story_tagline && (
                          <Typography variant="caption" color="text.secondary" noWrap display="block">{p.story_tagline}</Typography>
                        )}
                        {p.story_quote && (
                          <Typography variant="caption" color="text.disabled" noWrap display="block" sx={{ fontStyle: 'italic' }}>
                            "{p.story_quote}"
                          </Typography>
                        )}
                      </Box>

                      {/* Block / unblock */}
                      <Tooltip title={isBlocked ? 'Unblock — allow on site' : 'Block — remove from site'}>
                        <span>
                          <IconButton
                            size="small"
                            color={isBlocked ? 'default' : 'primary'}
                            onClick={() => handleToggleStoryApproval(p)}
                            disabled={isToggling}
                          >
                            {isToggling
                              ? <CircularProgress size={16} />
                              : isBlocked
                                ? <VisibilityOffIcon fontSize="small" />
                                : <VisibilityIcon fontSize="small" />
                            }
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* ══════════════ BULK CSV UPLOAD DIALOG ══════════════ */}
      <Dialog
        open={csvDialog.open}
        onClose={() => !csvUploading && setCsvDialog({ open: false, step: 'upload' })}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {csvDialog.step === 'result' ? 'Import Complete' : 'Bulk Upload Tasks'}
        </DialogTitle>
        <DialogContent>

          {/* ── Step 1: Upload ─────────────────────────────────────── */}
          {csvDialog.step === 'upload' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a CSV file to create multiple tasks at once. Download the template to get started.
              </Typography>
              <Button
                variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={downloadTaskTemplate} sx={{ mb: 3, fontWeight: 'bold' }}
              >
                Download Template
              </Button>

              <Box
                onDragOver={e => { e.preventDefault(); setCsvDragOver(true); }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setCsvDragOver(false);
                  handleCSVFile(e.dataTransfer.files[0]);
                }}
                onClick={() => csvFileRef.current?.click()}
                sx={{
                  border: '2px dashed',
                  borderColor: csvDragOver ? 'primary.main' : 'divider',
                  borderRadius: 2, p: 5,
                  textAlign: 'center', cursor: 'pointer',
                  bgcolor: csvDragOver ? 'action.hover' : 'grey.50',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <UploadFileIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" fontWeight="medium">Drop your CSV here</Typography>
                <Typography variant="body2" color="text.secondary">or click to browse</Typography>
              </Box>
              <input
                ref={csvFileRef} type="file" accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleCSVFile(e.target.files?.[0])}
              />

              <Box sx={{ mt: 2.5, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                  Required columns
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  title, description, points, category, requires_photo_proof, is_multi_user
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Valid categories: {TASK_CATEGORIES.map(c => c.label).join(', ')}
                </Typography>
              </Box>
            </Box>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────── */}
          {csvDialog.step === 'preview' && (() => {
            const validRows = csvRows.filter(r => r.errors.length === 0);
            const invalidRows = csvRows.filter(r => r.errors.length > 0);
            return (
              <Box>
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                  <Chip icon={<CheckCircleIcon />} label={`${validRows.length} ready to import`}
                    color="success" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
                  {invalidRows.length > 0 && (
                    <Chip icon={<CancelIcon />} label={`${invalidRows.length} will be skipped`}
                      color="error" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
                  )}
                </Box>

                <Box sx={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {csvRows.map(row => {
                    const isValid = row.errors.length === 0;
                    return (
                      <Box key={row._row} sx={{
                        display: 'flex', gap: 1.5, alignItems: 'flex-start',
                        p: 1.5, borderRadius: 1.5,
                        bgcolor: isValid ? 'rgba(46,125,50,0.07)' : 'rgba(211,47,47,0.07)',
                        border: '1px solid',
                        borderColor: isValid ? 'rgba(46,125,50,0.25)' : 'rgba(211,47,47,0.25)',
                      }}>
                        {isValid
                          ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                          : <CancelIcon sx={{ color: 'error.main', fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                        }
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.disabled">Row {row._row}</Typography>
                            {isValid && (
                              <>
                                <Typography variant="body2" fontWeight="bold" noWrap>{row.title}</Typography>
                                <Chip label={row.category} size="small" variant="outlined"
                                  sx={{ ...getCategoryStyle(row.category), height: 18, fontSize: '0.65rem' }} />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <StarIcon sx={{ color: 'warning.main', fontSize: 14 }} />
                                  <Typography variant="caption" fontWeight="bold" color="warning.dark">
                                    {row.points} pts
                                  </Typography>
                                </Box>
                              </>
                            )}
                          </Box>
                          {!isValid && row.errors.map((e, i) => (
                            <Typography key={i} variant="caption" color="error.main" display="block">
                              {e}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>

                {validRows.length === 0 && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    No valid rows found. Fix the errors and re-upload.
                  </Alert>
                )}
              </Box>
            );
          })()}

          {/* ── Step 3: Result ─────────────────────────────────────── */}
          {csvDialog.step === 'result' && csvResult && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {csvResult.error ? (
                <Alert severity="error">{csvResult.error}</Alert>
              ) : (
                <>
                  <CheckCircleIcon sx={{ fontSize: 52, color: 'success.main', mb: 1.5 }} />
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {csvResult.inserted} task{csvResult.inserted !== 1 ? 's' : ''} created
                  </Typography>
                  {csvResult.skipped > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {csvResult.skipped} row{csvResult.skipped !== 1 ? 's' : ''} skipped due to validation errors.
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}

        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          {csvDialog.step === 'upload' && (
            <Button onClick={() => setCsvDialog({ open: false, step: 'upload' })}>Cancel</Button>
          )}
          {csvDialog.step === 'preview' && (
            <>
              <Button onClick={() => setCsvDialog(p => ({ ...p, step: 'upload' }))} disabled={csvUploading}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleBulkInsert}
                disabled={csvUploading || csvRows.filter(r => r.errors.length === 0).length === 0}
                startIcon={csvUploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                sx={{ fontWeight: 'bold', px: 3 }}
              >
                {csvUploading
                  ? 'Importing...'
                  : `Import ${csvRows.filter(r => r.errors.length === 0).length} Task${csvRows.filter(r => r.errors.length === 0).length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
          {csvDialog.step === 'result' && (
            <Button
              variant="contained"
              onClick={() => setCsvDialog({ open: false, step: 'upload' })}
              sx={{ fontWeight: 'bold' }}
            >
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ══════════════ REDEMPTION ITEM DIALOG ══════════════ */}
      <Dialog open={itemFormOpen} onClose={() => !itemFormSaving && setItemFormOpen(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add Redemption Item</DialogTitle>
        <DialogContent>
          {itemFormError && <Alert severity="error" sx={{ mb: 2 }}>{itemFormError}</Alert>}
          <TextField
            fullWidth label="Title" margin="normal" required
            value={itemForm.title}
            onChange={e => setItemForm(p => ({ ...p, title: e.target.value }))}
          />
          <TextField
            fullWidth label="Description" margin="normal" multiline rows={2}
            helperText="Optional — shown to members on the catalog."
            value={itemForm.description}
            onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={itemForm.category}
              onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))}
            >
              {REDEMPTION_CATEGORIES.map(c => (
                <MenuItem key={c.label} value={c.label}>{c.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth label="Points Cost" margin="normal" required type="number"
            inputProps={{ min: 1 }}
            value={itemForm.points_cost}
            onChange={e => setItemForm(p => ({ ...p, points_cost: e.target.value }))}
          />
          <TextField
            fullWidth label="Quantity Limit" margin="normal" type="number"
            helperText="Leave blank for unlimited."
            inputProps={{ min: 1 }}
            value={itemForm.quantity_limit}
            onChange={e => setItemForm(p => ({ ...p, quantity_limit: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                checked={itemForm.requires_approval}
                onChange={e => setItemForm(p => ({ ...p, requires_approval: e.target.checked }))}
                color="warning"
              />
            }
            label="Requires admin approval before fulfilment"
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={itemForm.is_active}
                onChange={e => setItemForm(p => ({ ...p, is_active: e.target.checked }))}
                color="success"
              />
            }
            label="Active (visible to members)"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setItemFormOpen(false)} disabled={itemFormSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem} disabled={itemFormSaving}
            startIcon={itemFormSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {itemFormSaving ? 'Saving...' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════ REJECT DIALOG ══════════════ */}
      <Dialog open={rejectDialog.open}
        onClose={() => !rejectSaving && setRejectDialog({ open: false, id: null, note: '' })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Reject Redemption</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            The member's points will be refunded. You can optionally add a note explaining the reason.
          </Typography>
          <TextField
            fullWidth label="Note (optional)" margin="normal" multiline rows={2}
            placeholder="e.g. Out of stock, please try again later."
            value={rejectDialog.note}
            onChange={e => setRejectDialog(p => ({ ...p, note: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setRejectDialog({ open: false, id: null, note: '' })} disabled={rejectSaving}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleRejectRequest} disabled={rejectSaving}
            startIcon={rejectSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {rejectSaving ? 'Rejecting...' : 'Reject & Refund'}
          </Button>
        </DialogActions>
      </Dialog>

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
