import { TEAM_LOGOS } from "../data/teamLogos.js";
import { TEAM_FLAGS } from "../data/teamFlags.js";
import { IPL_BANDS } from "../data/teamBands.js";
import { TEAM_IMAGES } from "../data/teamImages.js";

// A team crest with the team colour and a dashed ring. Artwork, in order of preference:
// the team's own logo image, then a flag (national teams without an image), then the colour band
// with the original logo (IPL franchises without an image). No names or codes.
// Teams keep their colour before they are claimed; an unclaimed team is shown a little fainter.
export default function TeamBadge({ code, color, owned }) {
  const id = `tb-${code}`;
  const image = TEAM_IMAGES[code];
  const flag = TEAM_FLAGS[code];
  const band = IPL_BANDS[code];
  const logo = TEAM_LOGOS[code] ?? "";
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%" style={{ opacity: owned ? 1 : 0.78 }}>
      <defs>
        <radialGradient id={id} cx="35%" cy="28%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset=".45" stopColor={color} stopOpacity=".15" />
          <stop offset="1" stopColor="#000000" stopOpacity=".45" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><circle cx="50" cy="50" r="49" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        {image ? (
          <image href={image} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
        ) : flag ? (
          <g dangerouslySetInnerHTML={{ __html: flag }} />
        ) : (
          <>
            <circle cx="50" cy="50" r="49" fill={color} />
            <g dangerouslySetInnerHTML={{ __html: band ?? "" }} />
            <g transform="translate(18 18) scale(0.64)" dangerouslySetInnerHTML={{ __html: logo }} />
          </>
        )}
      </g>
      <circle cx="50" cy="50" r="49" fill={`url(#${id})`} />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#ffffff" strokeOpacity=".5" strokeWidth="2.5" strokeDasharray="5 4" />
    </svg>
  );
}
