export const COLORS = {
  blue: "#0F62FE",
  blueDark: "#0043CE",
  blueSoft: "#E8F0FF",
  green: "#00873D",
  greenDark: "#006429",
  greenSoft: "#E4F6EC",
  danger: "#DA1E28",
  dangerSoft: "#FFEAEA",
  warning: "#FF832B",
  warningSoft: "#FFF1E5",
  ink: "#0B1A33",
  slate: "#5B6B85",
  faint: "#8895AB",
  border: "rgba(15,98,254,0.12)",
  surface: "#F5F8FD",
};

/** Dark-mode overrides — Heineken deep green palette */
export const DARK = {
  ink: "#E8F9EF",        // near-white mint — headings, big numbers
  body: "#C8EDD8",       // light mint — body text
  slate: "#8DC8A0",      // medium sage — secondary text
  faint: "#52A872",      // muted sage — tertiary / axis labels
  border: "rgba(0,135,61,0.28)",
  surface: "#051409",
  cardBg: "rgba(5,18,10,0.88)",
  green: "#3DD68C",      // brighter green for accents on dark bg
  blue: "#F0C060",       // warm amber-gold — highlight accent on dark bg (replaces blue)
  activeTab: "#F0C060",  // tab / nav active colour in dark mode
  gridLine: "rgba(0,135,61,0.15)",
  gaugeTrack: "#0D2C18",
};

/** Pick the right value depending on dark mode */
export function dc(dark: boolean, darkVal: string, lightVal: string) {
  return dark ? darkVal : lightVal;
}
