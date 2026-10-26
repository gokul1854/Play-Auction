// The team sets a room can auction. IPL franchises are the default.
// National teams use short codes; the client draws their crests from these codes.

export const IPL_TEAMS = ["MI", "CSK", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "GT", "LSG"];

export const INTERNATIONAL_TEAMS = ["IND", "AUS", "ENG", "PAK", "SA", "NZ", "WI", "SL", "AFG", "BAN", "NED", "ZIM"];

export const TEAM_SETS = { ipl: IPL_TEAMS, international: INTERNATIONAL_TEAMS };

export const DEFAULT_TEAM_SET = "ipl";

// The list of team codes for a set. An unknown set falls back to the IPL franchises.
export function teamsFor(set) {
  return TEAM_SETS[set] ?? IPL_TEAMS;
}
