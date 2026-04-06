const RESPONSIBILITY_COLOR_PALETTE = [
  { icon: "bg-es-green", card: "bg-es-green/10" },
  { icon: "bg-es-yellow", card: "bg-es-yellow/10" },
  { icon: "bg-es-orange", card: "bg-es-orange/10" },
  { icon: "bg-es-blue", card: "bg-es-blue/10" },
  { icon: "bg-es-lilac", card: "bg-es-lilac/10" },
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getResponsibilityColor(value: string) {
  return RESPONSIBILITY_COLOR_PALETTE[
    hashString(value) % RESPONSIBILITY_COLOR_PALETTE.length
  ];
}
