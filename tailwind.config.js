/** @type {import('tailwindcss').Config} */
// Electronics palette: deep navy, electric blue, ion cyan and metallic silver.
// Semantic red/amber/green remain unchanged for simulator warnings and status.
const steel = {
  50:'#f5faff', 100:'#e9f4ff', 200:'#c9dff2', 300:'#acc4dc',
  400:'#91aac7', 500:'#738ca9', 600:'#506784', 700:'#344965',
  800:'#1b2d49', 900:'#0c1b34', 950:'#040d1d',
};
const electric = {
  50:'#e9faff', 100:'#c7f4ff', 200:'#9ceaff', 300:'#65dcff',
  400:'#36caff', 500:'#0caff6', 600:'#057fe2', 700:'#075fad',
  800:'#104579', 900:'#0b2b51', 950:'#061b37',
};
const ion = {
  50:'#e9ffff', 100:'#c7fcff', 200:'#97f5ff', 300:'#5cecff',
  400:'#28dfff', 500:'#00c9ee', 600:'#009cbd', 700:'#087b95',
  800:'#0b516a', 900:'#092e43', 950:'#05202f',
};
// One consistent navy family for UI utility classes, including legacy
// `purple-*`/`violet-*` Tailwind classes used in older ElectroLab views.
// Semantic resistor band and LED colors are defined separately in circuit data.
const cobalt = {
  50:'#f1f7fe', 100:'#e4f0fb', 200:'#c9e0f6', 300:'#9bc5ef',
  400:'#72a9dd', 500:'#427ebd', 600:'#2a639f', 700:'#1d4d85',
  800:'#173c6b', 900:'#102d53', 950:'#091b37',
};

export default {
  content:['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  darkMode:'class',
  theme:{
    extend:{
      colors:{
        slate:steel,
        blue:electric,
        cyan:ion,
        sky:ion,
        indigo:cobalt,
        violet:cobalt,
        purple:cobalt,
        neon:{ cyan:'#2be9ff', blue:'#0b91ff', ice:'#d9f5ff', metal:'#9db9d5' },
        el:{
          bg:'var(--app-bg)', panel:'var(--app-sidebar)',
          card:'var(--app-surface)', border:'var(--app-border)',
          accent:'var(--app-primary)',
        },
        navy:'#051127',
        'navy-deep':'#030919',
        paper:'#e4f3ff',
        accent:'#2be9ff',
        'accent-fg':'#04152c',
      },
      fontFamily:{ sans:['Inter','system-ui','sans-serif'] },
    },
  },
  plugins:[],
};
