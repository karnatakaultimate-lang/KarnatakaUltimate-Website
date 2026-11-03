import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, CircularProgress } from '@mui/material';
import { supabase } from '../supabaseClient';

const BG      = '#111415';
const BG_LOW  = '#0c0f10';
const SURFACE = '#1d2021';
const ON_SURF = '#e1e3e4';
const MUTED   = 'rgba(225,227,228,0.58)';
const RED     = '#E63946';
const TEAL    = '#00F5D4';
const GOLD    = '#FFD166';
const OUTLINE = 'rgba(255,255,255,0.08)';
const archivo = '"Archivo", "Inter", sans-serif';
const hanken  = '"Hanken Grotesk", "Inter", sans-serif';
const bleedSx = { mx: { xs: -2, sm: -3, md: -4 } };
const ACCENTS = [TEAL, GOLD, RED];

function PlayerStories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, username, story_tagline, story_quote, story_body, story_image_url, avatar_url')
      .eq('show_my_story', true)
      .not('story_approved', 'eq', false)
      .not('story_image_url', 'is', null)
      .or('story_quote.not.is.null,story_body.not.is.null')
      .then(({ data }) => {
        const shuffled = [...(data || [])].sort(() => Math.random() - 0.5);
        setStories(shuffled);
        setLoading(false);
      });
  }, []);

  return (
    <Box sx={{ bgcolor: BG, ...bleedSx, mt: { xs: -2, sm: -3, md: -4 } }}>

      {/* Hero header */}
      <Box sx={{
        px: { xs: 3, sm: 5, md: 8 },
        pt: { xs: 10, md: 14 },
        pb: { xs: 6, md: 8 },
        bgcolor: BG_LOW,
        borderBottom: `1px solid ${OUTLINE}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{ width: 48, height: 1, bgcolor: GOLD }} />
          <Typography sx={{
            fontFamily: hanken, fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD,
          }}>
            Community
          </Typography>
        </Box>
        <Typography sx={{
          fontFamily: archivo, fontWeight: 800,
          fontSize: { xs: '2rem', md: '3rem' },
          letterSpacing: '-0.02em', color: '#fff', mb: 2,
        }}>
          Player Stories
        </Typography>
        <Typography sx={{ fontFamily: hanken, color: MUTED, fontSize: '1.05rem', maxWidth: '52ch', lineHeight: 1.7 }}>
          Every player has a journey. These are the stories behind the people who make Karnataka Ultimate what it is.
        </Typography>
      </Box>

      {/* Grid */}
      <Box sx={{ px: { xs: 3, sm: 5, md: 8 }, py: { xs: 8, md: 12 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress sx={{ color: TEAL }} />
          </Box>
        ) : stories.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography sx={{ color: MUTED, fontFamily: hanken, fontSize: '1.05rem' }}>
              No stories yet — check back soon.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {stories.map((story, idx) => {
              const accent = ACCENTS[idx % ACCENTS.length];
              const name = story.full_name || story.username || 'Player';
              const photo = story.story_image_url || story.avatar_url;
              return (
                <Grid key={story.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{
                    bgcolor: SURFACE,
                    borderRadius: 3,
                    border: `1px solid ${OUTLINE}`,
                    overflow: 'hidden',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px ${accent}33`,
                    },
                  }}>
                    {photo && (
                      <Box sx={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                        <Box
                          component="img"
                          src={photo}
                          alt={name}
                          loading="lazy"
                          sx={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            transition: 'transform 0.5s ease',
                            '&:hover': { transform: 'scale(1.05)' },
                          }}
                        />
                      </Box>
                    )}
                    <Box sx={{ p: 3.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography sx={{
                        fontFamily: hanken, fontWeight: 700, fontSize: '0.68rem',
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: accent, mb: 1.5,
                      }}>
                        {story.story_tagline || 'Player Story'}
                      </Typography>
                      <Typography sx={{ fontFamily: archivo, fontWeight: 700, fontSize: '1.2rem', color: ON_SURF, mb: 2 }}>
                        {name}
                      </Typography>
                      {story.story_quote && (
                        <Typography sx={{
                          fontFamily: hanken, fontStyle: 'italic', color: MUTED,
                          fontSize: '0.9rem', lineHeight: 1.65, mb: 2,
                        }}>
                          "{story.story_quote}"
                        </Typography>
                      )}
                      {story.story_body && (
                        <Typography sx={{
                          fontFamily: hanken, color: MUTED,
                          fontSize: '0.875rem', lineHeight: 1.7, flexGrow: 1,
                        }}>
                          {story.story_body}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

export default PlayerStories;
