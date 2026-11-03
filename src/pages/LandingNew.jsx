import React, { useRef, useState, useEffect } from 'react';
import { Box, Grid, Typography, Button, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import SponsorsSection from '../components/SponsorsSection';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { supabase } from '../supabaseClient';

// ── Stitch palette ──────────────────────────────────────────────────────────
const BG       = '#111415';
const BG_LOW   = '#0c0f10';
const SURFACE  = '#1d2021';
const SURF_HI  = '#282a2b';
const ON_SURF  = '#e1e3e4';
const MUTED    = 'rgba(225,227,228,0.58)';
const RED      = '#E63946';
const TEAL     = '#00F5D4';
const GOLD     = '#FFD166';
const OUTLINE  = 'rgba(255,255,255,0.08)';

// ── Stitch image assets (AI-public CDN) ────────────────────────────────────
const IMG_HERO    = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKZst7sjACS7gi0b7UnwLZO7iK4KctO5FqjzwSYeZqXG5P6Pz_S7SAlSVH_gflincISYJ6G7A-a-Elz_KtlGPpGy2z1o7HviBdZkeR701xi_rSukQADAwi91VuGPALZyWg8507ra4qSUaOSycJJ2AUdIYoQ7vW6OvIJxYu81LoOgu8RDK1GCiIdyzcmzKSesbjL5WSfA70HdfCjui5Mj0pMtVm5I0IsNnNNg5YOHXorvrLXAIO4Dfao2ykqKsyOiIw4J9t2PJyia2c';
const IMG_DEEPAK  = 'https://lh3.googleusercontent.com/aida-public/AB6AXuApcVodf8nKvrO_L-8PSQ1_95rQ1vf2_edoQcfqYBWyF5p9wMNOlE08Ex-i_eE09vUuGzNOy44a9HHQ5WEdF9Pt6gOFdcSV9UGRaK5L2WzmhqldBI1Y-weaAIZmLhOHgPOEE3QvdzCjMGQDHTMAFRRXkUiflWbnQDsyRBJ21WchRb_ckxbomhR83iKZFGzs0ahvE7bTQXbdbmd2MnJ7tnvwcYEJpE8bvWj0Arr7Qt4M3TRxy8qpv2htos7x2t1QypoBnD11z5nmAYig';
const IMG_EQUITY  = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNMaRttQVvKNGzHTDX8dEZ-cqWkjDq1rNf8BMkY2JVwnI0_WJOisCH36okjAS1Wp--CW1eleTSwxkMdZdzM4Ql-gYzszyjkvuSnagpcBGT2UwboHDV9BqjvmzaNPy3AdEv3JVMgRZ5kHmgPQjazMxRCIf_wacgtoLL3714ZdzTSuBEk7-K6x2xaB1OZrcT9T2OpTYcEvGnlmLbLaCFb7rwTLNIRlIYDVCaYp_YEyrXRrIAeVnR9oNH6aWLq7bdJesGX4G5Rg9omNVV';

// ── Scroll-reveal hook ──────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref  = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

const revealSx = (visible) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(24px)',
  transition: 'opacity 0.75s cubic-bezier(0.4,0,0.2,1), transform 0.75s cubic-bezier(0.4,0,0.2,1)',
  '@media (prefers-reduced-motion: reduce)': { opacity: 1, transform: 'none', transition: 'none' },
});

// ── Shared heading + body font helpers ─────────────────────────────────────
const archivo = '"Archivo", "Inter", sans-serif';
const hanken  = '"Hanken Grotesk", "Inter", sans-serif';

// ── Shared section outer box: full-bleed within Navigation's padded container
const bleedSx = { mx: { xs: -2, sm: -3, md: -4 } };

// ── Label Caps component ────────────────────────────────────────────────────
function LabelCaps({ children, color = GOLD }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'block',
        fontFamily: hanken,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color,
        mb: 2,
      }}
    >
      {children}
    </Typography>
  );
}

// ── Task category → icon/color map ─────────────────────────────────────────
const CATEGORY_ICON_MAP = {
  volunteer: { icon: 'volunteer_activism', color: TEAL },
  coaching:  { icon: 'school',            color: GOLD },
  content:   { icon: 'photo_camera',      color: RED  },
  design:    { icon: 'palette',           color: GOLD },
  logistics: { icon: 'local_shipping',    color: TEAL },
  admin:     { icon: 'settings',          color: RED  },
};
const ICON_FALLBACKS = [
  { icon: 'volunteer_activism', color: TEAL },
  { icon: 'school',            color: GOLD },
  { icon: 'photo_camera',      color: RED  },
];
function taskMeta(task, idx) {
  const key = (task.category || '').toLowerCase();
  return CATEGORY_ICON_MAP[key] || ICON_FALLBACKS[idx % ICON_FALLBACKS.length];
}

// ── Event type → accent color ───────────────────────────────────────────────
const EVENT_COLOR_MAP = {
  Training:   TEAL,
  Tournament: GOLD,
  'Pick-up':  RED,
};

// ── Task item ───────────────────────────────────────────────────────────────
function TaskItem({ icon, iconColor, label, description, actionLabel, onClick }) {
  return (
    <Box
      sx={{
        p: { xs: 2.5, sm: 3 },
        bgcolor: SURFACE,
        borderRadius: 3,
        border: `1px solid ${OUTLINE}`,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
        gap: 3,
        cursor: 'pointer',
        transition: 'background 0.2s',
        '&:hover': { bgcolor: SURF_HI },
      }}
      onClick={onClick}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box
          sx={{
            width: 52, height: 52, borderRadius: '50%',
            bgcolor: `${iconColor}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor, flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </Box>
        <Box>
          <Typography sx={{ color: ON_SURF, fontFamily: hanken, fontWeight: 700, fontSize: '1rem', mb: 0.25 }}>
            {label}
          </Typography>
          <Typography sx={{ color: MUTED, fontFamily: hanken, fontSize: '0.85rem' }}>
            {description}
          </Typography>
        </Box>
      </Box>
      <Button
        variant="outlined"
        size="small"
        sx={{
          borderColor: OUTLINE, color: ON_SURF, borderRadius: 9999, fontFamily: hanken, fontWeight: 600,
          whiteSpace: 'nowrap', flexShrink: 0,
          '&:hover': { bgcolor: `${iconColor}22`, borderColor: iconColor, color: iconColor },
        }}
      >
        {actionLabel}
      </Button>
    </Box>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
function LandingNew() {
  const { user } = useAuth();
  const { config } = useSiteConfig();
  const navigate = useNavigate();

  const [storiesRef, storiesVisible] = useReveal();
  const [spiritRef,  spiritVisible]  = useReveal();
  const [involvedRef, involvedVisible] = useReveal();
  const [ctaRef, ctaVisible] = useReveal(0.2);

  const [liveTasks,       setLiveTasks]       = useState([]);
  const [liveEvents,      setLiveEvents]      = useState([]);
  const [displayedStories, setDisplayedStories] = useState([]);

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id, title, description, points, is_multi_user, category')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setLiveTasks(data || []));

    supabase
      .from('events')
      .select('id, title, type, start_time, location')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(3)
      .then(({ data }) => setLiveEvents(data || []));

    supabase
      .from('profiles')
      .select('id, full_name, username, story_tagline, story_quote, story_body, story_image_url, avatar_url')
      .eq('show_my_story', true)
      .not('story_approved', 'eq', false)
      .not('story_image_url', 'is', null)
      .or('story_quote.not.is.null,story_body.not.is.null')
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const normalized = data.map(p => ({
          id: p.id,
          name: p.full_name || p.username || 'Player',
          tagline: p.story_tagline,
          quote: p.story_quote,
          body: p.story_body,
          image_url: p.story_image_url || p.avatar_url,
        }));
        const shuffled = [...normalized].sort(() => Math.random() - 0.5);
        setDisplayedStories(shuffled.slice(0, 1));
      });
  }, []);

  return (
    <Box sx={{ bgcolor: BG, ...bleedSx, mt: { xs: -2, sm: -3, md: -4 } }}>

      {/* ══════════════════════════════════════════════════════════════════
          1. NARRATIVE HERO
      ══════════════════════════════════════════════════════════════════ */}
      <Box
        component="section"
        sx={{
          position: 'relative',
          minHeight: { xs: '80vh', md: '88vh' },
          display: 'flex',
          alignItems: 'center',
          px: { xs: 3, sm: 5, md: 8 },
          py: { xs: 10, md: 14 },
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url('${IMG_HERO}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            opacity: 0.28,
            filter: 'grayscale(30%) saturate(80%)',
          }}
        />
        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: `linear-gradient(to top, ${BG} 0%, rgba(17,20,21,0.55) 55%, transparent 100%)`,
          }}
        />

        {/* Content */}
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
          {/* Spirit Gold accent */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 48, height: 1, bgcolor: GOLD }} />
            <LabelCaps>More than just a game</LabelCaps>
          </Box>

          <Typography
            component="h1"
            sx={{
              fontFamily: archivo,
              fontWeight: 800,
              fontSize: { xs: '2.25rem', sm: '3rem', md: '3.75rem' },
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#fff',
              mb: 3,
              textWrap: 'balance',
            }}
          >
            Every huck has a{' '}
            <Box component="em" sx={{ color: RED, fontStyle: 'italic' }}>story</Box>.
            <br />
            Every player has a home.
          </Typography>

          <Typography
            sx={{
              fontFamily: hanken, fontSize: { xs: '1rem', sm: '1.15rem' },
              color: MUTED, lineHeight: 1.7, maxWidth: '52ch', mb: 5,
            }}
          >
            Karnataka Ultimate is a tapestry of athletes, students, and dreamers. We don't
            just keep score — we build community through the lens of Spirit.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/events')}
              sx={{
                fontFamily: archivo, fontWeight: 700, bgcolor: RED, color: '#fff',
                borderRadius: 2, px: 4, py: 1.75, fontSize: '0.95rem',
                '&:hover': { bgcolor: '#c62828', boxShadow: `0 0 40px ${RED}33` },
              }}
            >
              View Public Calendar
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              sx={{
                fontFamily: archivo, fontWeight: 700,
                borderColor: 'rgba(255,255,255,0.2)', color: '#fff',
                borderRadius: 2, px: 4, py: 1.75, fontSize: '0.95rem',
                '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              {user ? 'My Dashboard' : 'Login to myKUPA'}
            </Button>
          </Box>
        </Box>

        {/* Decorative blob */}
        <Box
          sx={{
            display: { xs: 'none', xl: 'block' },
            position: 'absolute', right: -80, top: '50%',
            transform: 'translateY(-50%)',
            width: 480, height: 480,
            bgcolor: `${RED}18`,
            borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
            filter: 'blur(60px)',
            zIndex: 1,
            animation: 'pulse 6s ease-in-out infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 0.7 }, '50%': { opacity: 1 } },
          }}
        />
      </Box>


      {/* ══════════════════════════════════════════════════════════════════
          2. SPIRIT SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <Box
        ref={spiritRef}
        component="section"
        sx={{
          bgcolor: BG_LOW,
          px: { xs: 3, sm: 5, md: 8 },
          py: { xs: 10, md: 14 },
          position: 'relative',
          overflow: 'hidden',
          ...revealSx(spiritVisible),
        }}
      >
        {/* Radial gold glow */}
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `radial-gradient(circle at 50% 40%, ${GOLD}0d 0%, transparent 65%)`,
        }} />

        <Box sx={{ maxWidth: 768, mx: 'auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 56, color: GOLD, marginBottom: 20, display: 'block',
              fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>

          <Typography
            sx={{
              fontFamily: archivo, fontWeight: 700,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              letterSpacing: '-0.01em', color: '#fff', mb: 3,
            }}
          >
            Spirit: The Heartbeat of Our Community
          </Typography>
          <Typography sx={{ fontFamily: hanken, color: MUTED, fontSize: '1.05rem', lineHeight: 1.75, mb: 7 }}>
            We don't have referees. We have self-respect. In Ultimate, the Spirit of the Game (SOTG)
            is the glue that binds us — ensuring every match ends with a high-five and mutual admiration.
          </Typography>

          <Grid container spacing={3}>
            {[
              { value: 'Respect',  text: "Valuing every player's perspective, on and off the field." },
              { value: 'Fairness', text: 'Playing hard, but playing right. No shortcuts to victory.'  },
              { value: 'Joy',      text: 'Celebrating the sport as a gift we share together.'          },
            ].map(({ value, text }) => (
              <Grid key={value} size={{ xs: 12, sm: 4 }}>
                <Box
                  sx={{
                    p: 3.5, bgcolor: SURF_HI, borderRadius: 3,
                    border: `1px solid rgba(255,209,102,0.15)`,
                    height: '100%',
                  }}
                >
                  <Typography sx={{ fontFamily: archivo, fontWeight: 800, fontSize: '1.75rem', color: GOLD, mb: 1 }}>
                    {value}
                  </Typography>
                  <Typography sx={{ fontFamily: hanken, fontSize: '0.875rem', color: MUTED, lineHeight: 1.65 }}>
                    {text}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          3. PLAYER STORIES  (gated on site config)
      ══════════════════════════════════════════════════════════════════ */}
      {config.is_player_stories_enabled !== false && (
        <Box
          ref={storiesRef}
          component="section"
          sx={{
            px: { xs: 3, sm: 5, md: 8 },
            py: { xs: 10, md: 14 },
            bgcolor: BG,
            ...revealSx(storiesVisible),
          }}
        >
          <Box sx={{ maxWidth: 1152, mx: 'auto' }}>
            {/* Render up to 2 stories; fall back to Stitch placeholders when DB is empty */}
            {(displayedStories.length > 0 ? displayedStories : [
              { id: '__s1', image_url: IMG_DEEPAK, tagline: 'Player Story', name: "Deepak's Journey", quote: 'Ultimate gave me a family when I moved to Bangalore.', body: 'Deepak started playing at Cubbon Park three years ago. Today, he captains a league team and mentors new recruits. His story is one of a hundred that define KUPA.', _accent: TEAL, _rotate: '-2deg' },
            ]).map((story, idx) => {
              const accent  = story._accent || TEAL;
              const rotate  = story._rotate || '-2deg';
              return (
                <Grid
                  key={story.id}
                  container
                  spacing={{ xs: 4, md: 8 }}
                  direction={{ xs: 'column', md: 'row' }}
                  sx={{ alignItems: 'center' }}
                >
                  {/* Photo card */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        sx={{
                          aspectRatio: '4/5',
                          borderRadius: '32px',
                          overflow: 'hidden',
                          border: `3px solid ${SURFACE}`,
                          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                          transform: `rotate(${rotate})`,
                          position: 'relative',
                          '&:hover img': { transform: 'scale(1.07)' },
                        }}
                      >
                        <Box
                          component="img"
                          src={story.image_url}
                          alt={story.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.7s ease' }}
                        />
                        <Box
                          sx={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to top, rgba(17,20,21,0.95) 0%, transparent 50%)',
                            display: 'flex', alignItems: 'flex-end', p: 3,
                          }}
                        >
                          <Box>
                            <LabelCaps color={accent}>{story.tagline || 'Player Story'}</LabelCaps>
                            <Typography sx={{ color: '#fff', fontFamily: archivo, fontWeight: 700, fontSize: '1.25rem' }}>
                              {story.name}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{
                        position: 'absolute',
                        bottom: -24, right: -24,
                        width: 120, height: 120,
                        bgcolor: accent,
                        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
                        filter: 'blur(44px)', opacity: 0.35, zIndex: -1,
                      }} />
                    </Box>
                  </Grid>

                  {/* Text */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    {story.quote && (
                      <Typography
                        sx={{
                          fontFamily: archivo, fontWeight: 700,
                          fontSize: { xs: '1.75rem', md: '2.25rem' },
                          lineHeight: 1.2, color: '#fff',
                          letterSpacing: '-0.01em', mb: 3,
                          textWrap: 'balance',
                        }}
                      >
                        "{story.quote}"
                      </Typography>
                    )}
                    {story.body && (
                      <Typography sx={{ fontFamily: hanken, color: MUTED, lineHeight: 1.75, fontSize: '1.05rem', mb: 4 }}>
                        {story.body}
                      </Typography>
                    )}
                    <Box
                      component="button"
                      onClick={() => navigate('/stories')}
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        fontFamily: hanken, fontWeight: 700, color: accent,
                        background: 'none', border: 'none', cursor: 'pointer', p: 0,
                        fontSize: '1rem',
                        transition: 'gap 0.2s',
                        '&:hover': { gap: 2 },
                      }}
                    >
                      Discover more journeys
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>east</span>
                    </Box>
                  </Grid>
                </Grid>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          4. GET INVOLVED + UPCOMING EVENTS
      ══════════════════════════════════════════════════════════════════ */}
      <Box
        ref={involvedRef}
        component="section"
        sx={{
          bgcolor: BG,
          px: { xs: 3, sm: 5, md: 8 },
          py: { xs: 10, md: 14 },
          ...revealSx(involvedVisible),
        }}
      >
        <Box sx={{ maxWidth: 1152, mx: 'auto' }}>
          <Grid container spacing={{ xs: 6, lg: 10 }}>

            {/* Task feed — 2/3 */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 5 }}>
                <Box>
                  <Typography sx={{
                    fontFamily: archivo, fontWeight: 700,
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    color: '#fff', letterSpacing: '-0.01em',
                  }}>
                    Ways to Get Involved
                  </Typography>
                  <Typography sx={{ fontFamily: hanken, color: MUTED, mt: 0.75, fontSize: '0.95rem' }}>
                    Find your place in the KUPA ecosystem.
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: hanken, fontSize: '0.75rem', color: MUTED, flexShrink: 0 }}>
                  Season 2025
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {liveTasks.length > 0 ? liveTasks.map((task, idx) => {
                  const { icon, color } = taskMeta(task, idx);
                  return (
                    <TaskItem
                      key={task.id}
                      icon={icon}
                      iconColor={color}
                      label={task.title}
                      description={task.description}
                      actionLabel={task.is_multi_user ? 'Join Team' : "I'm Interested"}
                      onClick={() => navigate('/tasks')}
                    />
                  );
                }) : (
                  // Placeholders shown while loading or when no tasks exist
                  [
                    { icon: 'volunteer_activism', iconColor: TEAL, label: 'Volunteer for BUO 2024', description: 'Help coordinate logistics for the Bangalore Ultimate Open.', actionLabel: "I'm Interested" },
                    { icon: 'school',            iconColor: GOLD, label: 'Youth Clinic Coaches',   description: 'Pass on your skills to the next generation in Mysore.',  actionLabel: 'Join Team'        },
                    { icon: 'photo_camera',      iconColor: RED,  label: 'Content Creators Wanted', description: 'Capture the stories of our league teams in action.',    actionLabel: 'Apply Now'        },
                  ].map((p) => <TaskItem key={p.label} {...p} onClick={() => navigate('/tasks')} />)
                )}
              </Box>

              {user && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="text"
                    onClick={() => navigate('/tasks')}
                    sx={{ color: TEAL, fontFamily: hanken, fontWeight: 700, textTransform: 'none', p: 0 }}
                  >
                    View all open tasks →
                  </Button>
                </Box>
              )}
            </Grid>

            {/* Calendar sidebar — 1/3 */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Box
                sx={{
                  bgcolor: BG_LOW, borderRadius: 4,
                  border: `1px solid ${OUTLINE}`,
                  p: 4, position: { lg: 'sticky' }, top: { lg: 120 },
                }}
              >
                <Typography sx={{
                  fontFamily: archivo, fontWeight: 700, fontSize: '1.25rem',
                  color: '#fff', mb: 4,
                }}>
                  Upcoming Gathers
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
                  {(liveEvents.length > 0 ? liveEvents.map((ev) => {
                    const d = new Date(ev.start_time);
                    return {
                      key:   ev.id,
                      day:   format(d, 'd'),
                      month: format(d, 'MMM'),
                      color: EVENT_COLOR_MAP[ev.type] || ON_SURF,
                      title: ev.title,
                      sub:   [format(d, 'EEE, h:mm a'), ev.location].filter(Boolean).join(' · '),
                      onClick: () => navigate(`/events/${ev.id}`),
                    };
                  }) : [
                    { key: 'a', day: '—', month: '—', color: MUTED, title: 'No upcoming events', sub: 'Check back soon' },
                  ]).map(({ key, day, month, color, title, sub, onClick }) => (
                    <Box
                      key={key}
                      onClick={onClick}
                      sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', cursor: onClick ? 'pointer' : 'default' }}
                    >
                      <Box
                        sx={{
                          bgcolor: SURF_HI, borderRadius: 1.5,
                          px: 1.5, py: 0.75, textAlign: 'center', minWidth: 60, flexShrink: 0,
                        }}
                      >
                        <Typography sx={{ fontFamily: archivo, fontWeight: 800, fontSize: '1.25rem', color, lineHeight: 1 }}>
                          {day}
                        </Typography>
                        <Typography sx={{ fontFamily: hanken, fontWeight: 700, fontSize: '0.65rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {month}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ color: ON_SURF, fontFamily: hanken, fontWeight: 700, fontSize: '0.9rem' }}>
                          {title}
                        </Typography>
                        <Typography sx={{ color: MUTED, fontFamily: hanken, fontSize: '0.8rem', mt: 0.25 }}>
                          {sub}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate('/events')}
                  sx={{
                    bgcolor: '#fff', color: '#111', fontFamily: archivo, fontWeight: 700,
                    borderRadius: 2, py: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                  }}
                >
                  View Full Calendar
                </Button>
              </Box>
            </Grid>

          </Grid>
        </Box>
      </Box>

      {/* ══════════════════════════════════════════════════════════════════
          6. BOTTOM CTA — non-authenticated only
      ══════════════════════════════════════════════════════════════════ */}
      {!user && (
        <Box
          ref={ctaRef}
          component="section"
          sx={{
            bgcolor: '#0c0f10',
            borderTop: `1px solid ${OUTLINE}`,
            px: { xs: 3, sm: 5, md: 8 },
            py: { xs: 12, md: 18 },
            textAlign: 'center',
            ...revealSx(ctaVisible),
          }}
        >
          <Box sx={{ maxWidth: 640, mx: 'auto' }}>
            <Typography
              sx={{
                fontFamily: archivo, fontWeight: 800,
                fontSize: { xs: '2.25rem', sm: '3rem', md: '3.75rem' },
                lineHeight: 1.1, letterSpacing: '-0.02em',
                color: '#fff', mb: 3,
                textWrap: 'balance',
              }}
            >
              Ready to write your chapter?
            </Typography>
            <Typography sx={{ fontFamily: hanken, color: MUTED, fontSize: '1.1rem', lineHeight: 1.7, mb: 6 }}>
              Whether you're a pro or have never held a disc, there's a spot for you in the Karnataka story.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/login')}
                sx={{
                  bgcolor: RED, color: '#fff', fontFamily: archivo, fontWeight: 700,
                  borderRadius: 2, px: 5, py: 2, fontSize: '1rem',
                  '&:hover': { bgcolor: '#c62828', transform: 'scale(1.03)', transition: 'all 0.2s' },
                }}
              >
                Join the Community
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/events')}
                sx={{
                  borderColor: OUTLINE, color: ON_SURF, fontFamily: archivo, fontWeight: 700,
                  borderRadius: 2, px: 5, py: 2, fontSize: '1rem',
                  '&:hover': { bgcolor: SURFACE, borderColor: 'rgba(255,255,255,0.25)' },
                }}
              >
                Explore the Calendar
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          7. SPONSORS — existing component wrapped for dark bg
      ══════════════════════════════════════════════════════════════════ */}
      <Box sx={{ bgcolor: BG, borderTop: `1px solid ${OUTLINE}` }}>
        <SponsorsSection />
      </Box>

    </Box>
  );
}

export default LandingNew;
