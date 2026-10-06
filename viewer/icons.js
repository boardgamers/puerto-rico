const paths = {
  corn: '<path fill="#f5ca4f" stroke="#95661d" stroke-width="1" d="M12 1C7 1 6 6 6 12c0 5 2 8 6 9 4-1 6-4 6-9 0-6-1-11-6-11Z"/><path stroke="#b88726" stroke-width="1" d="M10 3v13m4-13v13M7 6h10M6 10h12M7 14h10"/><path fill="#6d9954" stroke="#395d38" stroke-width="1" d="M12 22C5 21 2 16 2 10c5 2 9 6 10 12ZM12 22c7-1 10-6 10-12-5 2-9 6-10 12Z"/><path stroke="#bad28a" stroke-width="1" d="m5 14 7 8 7-8"/>',
  fruit:
    '<path fill="#79a965" d="M12 7C3 2 1 18 10 21c2 1 2-1 4 0 9-3 7-19-2-14Z"/><path d="M12 7V3m0 2c4 0 5-2 5-3"/>',
  sugar:
    '<path fill="#f2ede0" d="m5 7 7-4 7 4v11l-7 4-7-4Z"/><path d="m5 7 7 4 7-4m-7 4v11"/>',
  tobacco:
    '<path fill="#b78665" d="M4 19C2 9 10 3 21 3c0 12-7 18-17 16Z"/><path d="M4 19 18 6m-8 6V8m3 1h4"/>',
  coffee:
    '<path fill="#806959" d="M17 3c6 4 4 12-2 17S3 21 3 15 10-2 17 3Z"/><path stroke="#f8ead4" d="M17 4c-1 7-8 6-10 15"/>',
  quarry:
    '<path fill="#abbac0" d="m2 18 5-9 6 1 3-6 6 14-5 3H6Z"/><path d="m7 9 4 12m2-11 4 11"/>',
  forest:
    '<path fill="#64957c" d="m12 2-8 11h4l-5 6h18l-5-6h4Z"/><path d="M12 19v4"/>',
  worker:
    '<circle cx="12" cy="5" r="3" fill="#dec594"/><path fill="#dec594" d="M8 10h8l4 11H4Z"/>',
  citizen:
    '<circle cx="12" cy="7" r="3" fill="#d19c48"/><path fill="#d19c48" d="M7 12h10l3 10H4ZM7 2h10v3H7Z"/>',
  coin: '<circle fill="#e7be63" cx="12" cy="12" r="10"/><path d="M12 6v12m3-10c-6-4-8 4-3 4s3 8-3 4"/>',
  building:
    '<path fill="#d6b994" d="M4 10h16v12H4Z"/><path fill="#b16b4e" d="m2 10 10-8 10 8Z"/><path d="M10 22v-7h4v7M7 13v3m10-3v3"/>',
  storage:
    '<path fill="#b6b69a" d="M3 9h18v13H3Z"/><path fill="#9b7555" d="m1 9 11-7 11 7Z"/><rect x="8" y="13" width="8" height="9" fill="#d4b989"/><path d="M8 17h8"/>',
  estate:
    '<path fill="#78965c" d="m1 15 11-7 11 7-11 8Z"/><path stroke="#d7e2ad" d="m5 15 7 5m-4-7 7 5m-4-7 7 5"/><path d="M12 12V5"/><path fill="#a8c478" d="M12 8C7 8 6 5 6 2c4 0 6 2 6 6Zm0-2c5 0 7-2 7-5-4 0-7 2-7 5Z"/>',
  space:
    '<rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  citySpace:
    '<rect x="2" y="5" width="9" height="15" rx="2"/><rect x="13" y="5" width="9" height="15" rx="2"/>',
  scoring:
    '<path d="M5 22V2m0 1h15v11H5"/><path d="m5 3 5 5 5-5 5 5m-15 0 5 6 5-6 5 6"/>',
  noWorker:
    '<circle cx="12" cy="5" r="3" fill="#dec594"/><path fill="#dec594" d="M8 10h8l4 11H4Z"/><path stroke-width="3" d="m2 22 20-20"/>',
  autoAssign:
    '<path d="m4 21 12-12m-2-6 1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1ZM4 9l1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1m16 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1"/>',
  planter:
    '<path d="M12 22V10"/><path fill="#72a47b" d="M12 12C3 12 2 7 3 4c6 0 9 3 9 8Zm0-2c7 0 10-4 9-8-6 0-9 3-9 8Z"/>',
  recruiter:
    '<circle cx="8" cy="6" r="3" fill="#d6b994"/><path fill="#d6b994" d="M4 11h8l3 10H1Z"/><path d="M19 7v10m-5-5h10"/>',
  builder:
    '<path fill="#b87955" d="m4 18 10-11 3 3L7 21Z"/><path fill="#abbac0" d="m10 5 4-4 9 8-5 4Z"/>',
  craftsman:
    '<path fill="#9ca9b0" d="m14 2 3 1-1 5-3 2-3-1-6 11-3-2 7-10-1-3 2-3 1 4 3 1Z"/><path fill="#cfa474" d="m13 14 3-3 7 9-3 2Z"/>',
  trader:
    '<path fill="#d6b994" d="M5 9h14v13H5Z"/><path fill="#c27952" d="M2 3h20v6H2Z"/><path d="M8 3v6m8-6v6M10 22v-8h4v8"/>',
  captain:
    '<path fill="#bb8d60" d="m2 16 4 6h13l3-6Z"/><path fill="#f3e6c9" d="M12 2v13H3Zm2 2v11h7Z"/>',
  adventurer:
    '<circle fill="#e7be63" cx="12" cy="13" r="8"/><path d="m12 9 1 3 3 1-3 1-1 3-1-3-3-1 3-1ZM5 3h14"/>',
  smuggler:
    '<path fill="#738896" d="M3 7c3-7 15-7 18 0l-4 12H7Z"/><path d="m7 10 3 2m7-2-3 2m-4 5h4"/>',
  ship: '<path fill="#bb8d60" d="m2 16 4 6h13l3-6Z"/><path fill="#f3e6c9" d="M12 2v13H3Zm2 2v11h7Z"/>',
  governor:
    '<path fill="#d8ba65" d="m2 6 5 4 5-8 5 8 5-4-3 13H5Z"/><path d="M5 22h14"/>',
  help: '<path d="M8 8a4 4 0 1 1 7 3c-2 1-3 2-3 5"/><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none"/>',
  warning:
    '<path fill="#ddb568" stroke="#614625" d="M12 2 23 21H1Z"/><path stroke="#49351e" stroke-width="2" d="M12 8v6m0 3v.5"/>',
  rules:
    '<path d="M12 5C8 2 4 2 1 4v17c3-2 7-2 11 1 4-3 8-3 11-1V4c-3-2-7-2-11 1Zm0 0v17"/>',
  journal: '<path d="M5 2h16v20H5ZM1 6h7M1 12h7M1 18h7m2-10h8m-8 5h8m-8 5h5"/>',
  chat: '<path d="M3 3h18v14H9l-6 5Zm4 5h10M7 12h7"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  check: '<path d="m3 12 6 6L21 4"/>',
  pass: '<path d="m7 5 9 7-9 7m12-14v14"/>',
  plus: '<path d="M12 3v18M3 12h18"/>',
  minus: '<path d="M3 12h18"/>',
  undo: '<path d="M4 9h10a7 7 0 1 1 0 14M4 9l6-6M4 9l6 6"/>',
  eye: '<path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="4"/>',
  festival:
    '<path fill="#d8ba65" d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 9M3 3v7h7"/>',
  retrigger:
    '<path d="M4 8h11a6 6 0 0 1 0 12h-3M4 8l5-5M4 8l5 5"/><path d="M5 16v6m-3-3h6"/>',
  arrow: '<path d="M2 12h19m-7-7 7 7-7 7"/>',
  erase: '<path d="m4 14 11-11 7 7-11 11H8Zm3-3 7 7m-3 3h12"/>',
  dark: '<path fill="#d8ba65" d="M18 2C6-1-1 14 8 21c5 4 13 1 15-5C12 18 7 9 18 2Z"/>',
};
// Simplified numbered blue wooden token from the Special Edition components (p. 4).
export function scoreToken(value, size = 26) {
  const label = String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
  const length = String(value).length;
  return `<svg class="icon score-token" width="${size}" height="${size}" viewBox="0 0 28 26" aria-hidden="true"><path fill="#6b5542" d="M7 4h14l6 10-6 11H7L1 14Z"/><path fill="#287eb4" stroke="#b8dced" stroke-width="1.1" stroke-linejoin="round" d="M7 1h14l6 10-6 11H7L1 11Z"/><text x="14" y="12" dy=".35em" text-anchor="middle" fill="#fff" stroke="none" font-family="Georgia, serif" font-weight="bold" font-size="${length > 3 ? 9 : length > 2 ? 11 : 16}">${label}</text></svg>`;
}
export function icon(id, size = 24) {
  if (id === "vp") return scoreToken(1, size);
  const crop = id.split("-")[1];
  let drawing = paths[id] ?? paths.building;
  if (id === "crate")
    drawing = `<g transform="translate(0 1) scale(.65)">${paths.corn}</g><g transform="translate(10 2) scale(.58)">${paths.coffee}</g><g transform="translate(7 10) scale(.6)">${paths.fruit}</g>`;
  if (["corn", "fruit", "sugar", "tobacco", "coffee"].includes(crop)) {
    if (id.startsWith("field-"))
      drawing = `<path fill="#78965c" d="m1 15 11-7 11 7-11 8Z"/><path stroke="#d7e2ad" d="m5 15 7 5m-4-7 7 5m-4-7 7 5"/><g transform="translate(6 0) scale(.5)">${paths[crop]}</g>`;
    if (id.startsWith("workshop-"))
      drawing = `<path fill="#d6b994" d="M3 10h18v12H3Z"/><path fill="#b16b4e" d="m1 10 11-8 11 8Z"/><g transform="translate(7 10) scale(.42)">${paths[crop]}</g>`;
  }
  return `<svg class="icon icon-${id}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
}
