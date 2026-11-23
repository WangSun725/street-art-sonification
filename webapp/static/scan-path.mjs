export const MIN_SCAN_RANGE = .005;
export const MAX_SCAN_RANGES = 24;

export function artworkPanelJoins(manifest) {
  return manifest?.scan_joins ?? manifest?.artwork_isolation?.segments?.slice(1)
    .map(segment => segment.output_origin.x) ?? [];
}

export function validScanRanges(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SCAN_RANGES).filter(range =>
    Number.isFinite(range?.from) && Number.isFinite(range?.to)
    && range.from >= 0 && range.from <= 1 && range.to >= 0 && range.to <= 1
    && Math.abs(range.to - range.from) >= MIN_SCAN_RANGE)
    .map(({ from, to }) => ({ from, to }));
}

export function scanRegionBounds(regions) {
  let left = 1, right = 0;
  for (const { scanColumns } of regions) {
    const first = scanColumns.findIndex(Boolean);
    if (first < 0) continue;
    left = Math.min(left, first / scanColumns.length);
    right = Math.max(right, (scanColumns.findLastIndex(Boolean) + 1) / scanColumns.length);
  }
  return left < right ? [left, right] : [0, 1];
}

export function buildScanRoute(mode, ranges, bounds = [0, 1], durationBars) {
  const [left, right] = bounds;
  const forward = { from: left, to: right };
  const reverse = { from: right, to: left };
  const segments = mode === "custom" ? ranges : mode === "roundtrip" ? [forward, reverse]
    : [mode === "reverse" ? reverse : forward];
  const distance = segments.reduce((sum, segment) => sum + Math.abs(segment.to - segment.from), 0);
  if (!distance) return [];
  if (durationBars !== undefined) {
    const available = Math.floor(durationBars + 1e-8);
    if (!Number.isFinite(available) || available < segments.length) return [];
    const ideal = segments.map(segment => available * Math.abs(segment.to - segment.from) / distance);
    const bars = ideal.map(count => Math.max(1, Math.floor(count)));
    let assigned = bars.reduce((sum, count) => sum + count, 0);
    while (assigned !== available) {
      const step = Math.sign(available - assigned);
      let best = -1;
      for (let index = 0; index < bars.length; index++) {
        if (step < 0 && bars[index] === 1) continue;
        if (best < 0 || (ideal[index] - bars[index]) * step > (ideal[best] - bars[best]) * step + 1e-9) best = index;
      }
      bars[best] += step;
      assigned += step;
    }
    let endBar = 0;
    return segments.map((segment, index) => {
      const startBar = endBar;
      endBar += bars[index];
      return { ...segment, index, startBar, endBar, start: startBar / durationBars, end: endBar / durationBars };
    });
  }
  let progress = 0;
  return segments.map((segment, index) => {
    const start = progress;
    progress += Math.abs(segment.to - segment.from) / distance;
    return { ...segment, index, start, end: index === segments.length - 1 ? 1 : progress };
  });
}

export function insertScanRange(route, range, nextBar, durationBars) {
  const endBar = route.at(-1)?.endBar ?? 0;
  const [selection] = validScanRanges([range]);
  if (!selection || nextBar < 1 || !Number.isInteger(nextBar) || nextBar >= endBar) return null;

  let insertionBar = nextBar;
  for (const segment of route) {
    if (segment.live && segment.startBar <= insertionBar && insertionBar < segment.endBar) {
      insertionBar = segment.endBar;
    }
  }
  const played = [];
  const remaining = [{ ...selection, live: true }];
  for (const segment of route) {
    const { from, to, startBar, endBar } = segment;
    if (endBar <= insertionBar) {
      played.push(segment);
    } else if (startBar >= insertionBar) {
      remaining.push({ from, to, live: segment.live });
    } else {
      const phase = (insertionBar - startBar) / (endBar - startBar);
      const split = from + (to - from) * phase;
      played.push({ ...segment, to: split, endBar: insertionBar, end: insertionBar / durationBars });
      remaining.push({ from: split, to, live: segment.live });
    }
  }
  const continuation = buildScanRoute("custom", remaining, undefined, endBar - insertionBar);
  if (!continuation.length) return null;
  return played.concat(continuation.map((segment, index) => {
    const startBar = segment.startBar + insertionBar;
    const endBar = segment.endBar + insertionBar;
    return { ...segment, index: played.length + index, startBar, endBar,
      start: startBar / durationBars, end: endBar / durationBars };
  }));
}

export function quantizePassages(passages, durationBars, endBar) {
  const spans = [];
  for (const passage of passages) {
    const start = Math.min(endBar - 1, Math.floor(passage.from * durationBars + 1e-8));
    const end = Math.min(endBar, Math.max(start + 1, Math.ceil(passage.to * durationBars - 1e-8)));
    const previous = spans.at(-1);
    if (previous && start <= previous.to) previous.to = Math.max(previous.to, end);
    else spans.push({ from: start, to: end });
  }
  return spans;
}

export function planRegionScan(route, columns, joins = []) {
  const passages = [];
  let peakColumn = -1;
  const playable = columns.slice();
  // Keep the artwork and hit masks literal while a single voice crosses a cut.
  const edgeTolerance = Math.max(1, Math.round(columns.length * .01));
  for (const join of joins) {
    if (!Number.isInteger(join) || join <= 0 || join >= columns.length) continue;
    let left = join - 1, right = join;
    while (left >= 0 && join - left <= edgeTolerance && !columns[left]) left--;
    while (right < columns.length && right - join < edgeTolerance && !columns[right]) right++;
    if (left >= 0 && right < columns.length && columns[left] && columns[right]) {
      playable.fill(1, left + 1, right);
    }
  }
  for (const segment of route) {
    const left = Math.min(segment.from, segment.to);
    const right = Math.max(segment.from, segment.to);
    const progressAt = x => segment.start
      + (segment.end - segment.start) * (x - segment.from) / (segment.to - segment.from);
    const first = Math.floor(left * columns.length);
    const end = Math.ceil(right * columns.length);
    const runs = [];
    for (let column = first; column < end;) {
      if (!playable[column]) {
        column++;
        continue;
      }
      const start = column;
      while (column < end && playable[column]) {
        if (columns[column] && (peakColumn < 0 || columns[column] > columns[peakColumn])) peakColumn = column;
        column++;
      }
      const startX = Math.max(left, start / columns.length);
      const endX = Math.min(right, column / columns.length);
      if (endX <= startX) continue;
      const a = progressAt(startX), b = progressAt(endX);
      runs.push({ from: Math.min(a, b), to: Math.max(a, b), segmentIndex: segment.index });
    }
    passages.push(...(segment.from < segment.to ? runs : runs.reverse()));
  }
  return { passages, peakColumn };
}

export function scanProximity(passages, progress, duration) {
  // Keep the filter continuous across jumps between custom ranges.
  const transitionScale = Math.min(1, duration / 15);
  const openingSeconds = 3.5 * transitionScale;
  const closingSeconds = 4.5 * transitionScale;
  let nearest = Infinity;
  for (const { from, to } of passages) {
    const distance = progress < from ? (from - progress) * duration / openingSeconds
      : Math.max(0, progress - to) * duration / closingSeconds;
    nearest = Math.min(nearest, distance);
  }
  const amount = Math.max(0, 1 - nearest);
  return amount * amount * (3 - 2 * amount);
}

export function scanPoint(route, progress) {
  const segment = route.find(item => progress < item.end) || route.at(-1);
  if (!segment) return { x: 0, index: -1 };
  const phase = Math.max(0, Math.min(1, (progress - segment.start) / (segment.end - segment.start)));
  return { x: segment.from + (segment.to - segment.from) * phase, index: segment.index };
}

export function planScanAccompaniment(profile, route, durationBars, instruments, previous = [], lockedBeforeBar = 0) {
  const endBar = route.at(-1)?.endBar ?? 0;
  if (!profile || !instruments || !endBar) return [];
  const { columns, min, max } = profile;
  const blocks = [];
  for (let startBar = 0; startBar < endBar; startBar += 4) {
    const end = Math.min(startBar + 4, endBar);
    const prior = blocks.at(-1);
    const locked = previous[startBar / 4];
    let count = prior?.count ?? 1;
    if (locked && startBar < lockedBeforeBar) {
      count = Math.min(instruments, locked.count);
    } else if (!prior || end - startBar === 4) {
      let edges = 0;
      let pairs = 0;
      const samples = (end - startBar) * 16;
      for (let i = 0; i < samples; i++) {
        const bar = startBar + (i + .5) / 16;
        const { x } = scanPoint(route, bar / durationBars);
        const columnIndex = Math.floor(x * columns.length + 1e-8);
        const column = columns[Math.min(columns.length - 1, columnIndex)];
        if (!column) continue;
        edges += column.edges;
        pairs += column.pairs;
      }
      if (pairs) {
        const normalized = max - min >= .005 ? Math.max(0, (edges / pairs - min) / (max - min)) : 0;
        count = Math.min(instruments, 1 + Math.floor(instruments * normalized));
      }
    }
    blocks.push({ startBar, endBar: end, count });
  }
  return blocks;
}

export function scanProgressAtX(route, x, currentProgress) {
  let nearest = null;
  for (const segment of route) {
    const phase = (x - segment.from) / (segment.to - segment.from);
    if (phase < 0 || phase > 1) continue;
    const progress = segment.start + phase * (segment.end - segment.start);
    if (nearest === null || Math.abs(progress - currentProgress) < Math.abs(nearest - currentProgress)) nearest = progress;
  }
  return nearest;
}
