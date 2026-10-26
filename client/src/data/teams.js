// IPL franchises. Codes match the server. Colours are the usual team shades, not logos.
export const IPL_TEAM_LIST = [
  { code: "MI", city: "Mumbai",   name: "Mumbai Indians",              color: "#0b4ea2", site: "https://www.mumbaiindians.com" },
  { code: "CSK", city: "Chennai",  name: "Chennai Super Kings",         color: "#f9cd05", site: "https://www.chennaisuperkings.com" },
  { code: "RCB", city: "Bangalore",  name: "Royal Challengers Bengaluru", color: "#d71920", site: "https://www.royalchallengers.com" },
  { code: "KKR", city: "Kolkata",  name: "Kolkata Knight Riders",       color: "#3a225d", site: "https://www.kkr.in" },
  { code: "DC", city: "Delhi",   name: "Delhi Capitals",              color: "#0078bc", site: "https://www.delhicapitals.in" },
  { code: "PBKS", city: "Mohali", name: "Punjab Kings",                color: "#b8242a", site: "https://www.punjabkingsipl.in" },
  { code: "RR", city: "Jaipur",   name: "Rajasthan Royals",            color: "#ea1a85", site: "https://www.rajasthanroyals.com" },
  { code: "SRH", city: "Hyderabad",  name: "Sunrisers Hyderabad",         color: "#f7751e", site: "https://www.sunrisershyderabad.in" },
  { code: "GT", city: "Ahmedabad",   name: "Gujarat Titans",              color: "#1c3b64", site: "https://www.gujarattitansipl.com" },
  { code: "LSG", city: "Lucknow",  name: "Lucknow Super Giants",        color: "#a72056", site: "https://www.lucknowsupergiants.in" },
];

// National teams. Colours are plain shades, not flags or kit logos.
export const INTERNATIONAL_TEAM_LIST = [
  { code: "IND", city: "India",        name: "India",         color: "#1d4ed8", site: "https://www.bcci.tv" },
  { code: "AUS", city: "Australia",    name: "Australia",     color: "#facc15", site: "https://www.cricket.com.au" },
  { code: "ENG", city: "England",      name: "England",       color: "#1e3a8a", site: "https://www.ecb.co.uk" },
  { code: "PAK", city: "Pakistan",     name: "Pakistan",      color: "#15803d", site: "https://www.pcb.com.pk" },
  { code: "SA",  city: "South Africa", name: "South Africa",  color: "#166534", site: "https://www.cricket.co.za" },
  { code: "NZ",  city: "New Zealand",  name: "New Zealand",   color: "#111827", site: "https://www.blackcaps.co.nz" },
  { code: "WI",  city: "West Indies",  name: "West Indies",   color: "#7f1d1d", site: "https://www.windiescricket.com" },
  { code: "SL",  city: "Sri Lanka",    name: "Sri Lanka",     color: "#312e81", site: "https://www.slc.lk" },
  { code: "AFG", city: "Afghanistan",  name: "Afghanistan",   color: "#0284c7", site: "https://www.acb.af" },
  { code: "BAN", city: "Bangladesh",   name: "Bangladesh",    color: "#047857", site: "https://www.tigercricket.com.bd" },
  { code: "NED", city: "Netherlands",  name: "Netherlands",   color: "#ea580c", site: "https://www.knkb.nl" },
  { code: "ZIM", city: "Zimbabwe",     name: "Zimbabwe",      color: "#a16207", site: "https://www.zimcricket.org" },
];

// The team list for each set, as the lobby shows it.
export const TEAM_SET_LISTS = { ipl: IPL_TEAM_LIST, international: INTERNATIONAL_TEAM_LIST };
export const teamsForSet = (set) => TEAM_SET_LISTS[set] ?? IPL_TEAM_LIST;

// The team list for the default set. Kept under this name for the Home screen.
export const TEAMS = IPL_TEAM_LIST;

export const TEAM_BY_CODE = Object.fromEntries([...IPL_TEAM_LIST, ...INTERNATIONAL_TEAM_LIST].map((t) => [t.code, t]));
export const teamName = (code) => TEAM_BY_CODE[code]?.name ?? code;
export const teamCity = (code) => TEAM_BY_CODE[code]?.city ?? code;

// The team's official site, where its logo can be taken from.
export const teamSite = (code) => TEAM_BY_CODE[code]?.site;
