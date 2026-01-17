// Theme definitions for Koe
// Each theme defines CSS custom properties that override :root

export type ThemeName = 'dark' | 'light' | 'midnight-blue' | 'forest-green' | 'sunset-orange';

export interface Theme {
  name: ThemeName;
  label: string;
  variables: Record<string, string>;
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    label: 'Dark Terminal',
    variables: {
      '--bg-primary': '#0a0a0f',
      '--bg-secondary': '#12121a',
      '--bg-tertiary': '#1a1a24',
      '--bg-highlight': '#22222e',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#8888aa',
      '--text-muted': '#555566',
      '--border-color': '#2a2a3a',
      '--border-glow': '#4a4a6a',
      '--accent-color': '#06d6a0',
      '--accent-glow': 'rgba(6, 214, 160, 0.3)',
      '--voice-listening': '#06d6a0',
      '--voice-processing': '#f59e0b',
      '--voice-idle': '#555566',
    },
  },
  light: {
    name: 'light',
    label: 'Light',
    variables: {
      '--bg-primary': '#f5f5f7',
      '--bg-secondary': '#ffffff',
      '--bg-tertiary': '#e8e8ec',
      '--bg-highlight': '#d8d8e0',
      '--text-primary': '#1a1a2e',
      '--text-secondary': '#4a4a6a',
      '--text-muted': '#8888aa',
      '--border-color': '#c8c8d8',
      '--border-glow': '#a8a8c0',
      '--accent-color': '#059669',
      '--accent-glow': 'rgba(5, 150, 105, 0.2)',
      '--voice-listening': '#059669',
      '--voice-processing': '#d97706',
      '--voice-idle': '#9ca3af',
    },
  },
  'midnight-blue': {
    name: 'midnight-blue',
    label: 'Midnight Blue',
    variables: {
      '--bg-primary': '#0a0e14',
      '--bg-secondary': '#0d1117',
      '--bg-tertiary': '#161b22',
      '--bg-highlight': '#21262d',
      '--text-primary': '#c9d1d9',
      '--text-secondary': '#8b949e',
      '--text-muted': '#484f58',
      '--border-color': '#30363d',
      '--border-glow': '#58a6ff',
      '--accent-color': '#58a6ff',
      '--accent-glow': 'rgba(88, 166, 255, 0.3)',
      '--voice-listening': '#58a6ff',
      '--voice-processing': '#f0883e',
      '--voice-idle': '#484f58',
    },
  },
  'forest-green': {
    name: 'forest-green',
    label: 'Forest Green',
    variables: {
      '--bg-primary': '#0c1410',
      '--bg-secondary': '#101a14',
      '--bg-tertiary': '#162018',
      '--bg-highlight': '#1e2a20',
      '--text-primary': '#d0e0d4',
      '--text-secondary': '#88a090',
      '--text-muted': '#506858',
      '--border-color': '#2a3a30',
      '--border-glow': '#4a8a5a',
      '--accent-color': '#34d399',
      '--accent-glow': 'rgba(52, 211, 153, 0.3)',
      '--voice-listening': '#34d399',
      '--voice-processing': '#fbbf24',
      '--voice-idle': '#506858',
    },
  },
  'sunset-orange': {
    name: 'sunset-orange',
    label: 'Sunset Orange',
    variables: {
      '--bg-primary': '#140a0a',
      '--bg-secondary': '#1a1010',
      '--bg-tertiary': '#241616',
      '--bg-highlight': '#2e1e1e',
      '--text-primary': '#e0d4d0',
      '--text-secondary': '#a09088',
      '--text-muted': '#685850',
      '--border-color': '#3a2a2a',
      '--border-glow': '#8a5a4a',
      '--accent-color': '#fb923c',
      '--accent-glow': 'rgba(251, 146, 60, 0.3)',
      '--voice-listening': '#fb923c',
      '--voice-processing': '#fbbf24',
      '--voice-idle': '#685850',
    },
  },
};

export const themeNames = Object.keys(themes) as ThemeName[];

/**
 * Apply a theme to the document root
 */
export function applyTheme(themeName: ThemeName): void {
  const theme = themes[themeName];
  if (!theme) {
    console.warn(`Theme "${themeName}" not found, falling back to dark`);
    applyTheme('dark');
    return;
  }

  const root = document.documentElement;

  // Apply each CSS variable
  for (const [property, value] of Object.entries(theme.variables)) {
    root.style.setProperty(property, value);
  }

  // Store current theme as data attribute for CSS selectors if needed
  root.setAttribute('data-theme', themeName);
}

/**
 * Get the current applied theme from the document
 */
export function getCurrentTheme(): ThemeName {
  const themeName = document.documentElement.getAttribute('data-theme');
  return (themeName as ThemeName) || 'dark';
}
