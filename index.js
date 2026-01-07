const extensionName = 'cozy-cat-for-ST';

// ===== RP Epoch (fixed story start) =====
const RP_BASE_YEAR = 2000; // internal baseline year for Date math
const RP_EPOCH = { m: 12, d: 31, hh: 23, mm: 45, baseAgeDays: 63 }; // 31 Dec 23:45, 9 weeks

function cozyConfirmReset() {
  return new Promise((resolve) => {
    const existing = document.getElementById('cozycat-confirm');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'cozycat-confirm';
    wrap.className = 'cozycat-confirm-backdrop';

    wrap.innerHTML = `
      <div class="cozycat-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cozycat-confirm-title">
        <div class="cozycat-confirm-title" id="cozycat-confirm-title">Reset Cozy Cat?</div>
        <div class="cozycat-confirm-text">
          This will clear metadata of the Kitten for this chat.
          
        </div>
        <div class="cozycat-confirm-actions">
          <button type="button" class="cozycat-confirm-btn" data-act="cancel">Cancel</button>
          <button type="button" class="cozycat-confirm-btn danger" data-act="ok">Reset</button>
        </div>
      </div>
    `;

    function close(val) {
      wrap.remove();
      resolve(val);
    }

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close(false);
    });

    wrap.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    wrap.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));

    document.body.appendChild(wrap);
  });
}


function loadSettings() {
  $('.cozy-cat-settings').remove();

  const enabledKey = `${extensionName}:enabled`;
  const enabled = localStorage.getItem(enabledKey) === 'true';

  const settingsHtml = `
    <div class="cozy-cat-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Cozy Cat for ST</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>

        <div class="inline-drawer-content">
          <div class="styled_description_block" style="text-align:center;">
            <small>
              Created by <a href="https://bio.site/deMors" target="_blank" rel="noopener noreferrer">Mors</a>
              with help of POPKO<br>
              Hopefully, you guys enjoy it. Have fun:)
            </small>
          </div>

          <hr>

          <div class="toggle-and-lower-area">
            <div class="cozycat-settings-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <label class="checkbox_label" for="${extensionName}-enabled" style="margin:0;">
                <input id="${extensionName}-enabled" type="checkbox" ${enabled ? 'checked' : ''}>
                <span>Enable Cozy Cat</span>
              </label>

              <button type="button" class="cozycatResetBtn" id="cozycatResetBtn"
                style="width:auto;min-width:0;padding:6px 10px;font-size:12px;line-height:1;border-radius:8px;">
                Reset
              </button>
            </div>

            <div style="text-align:center;color:#aaa;padding:12px 0 0;">

              <div style="opacity:.7;font-size:12px;margin-top:6px;line-height:1.3;">
                This Extension is for my character, "Your Pet Cat." <br> The reset button will clears all data saved within the extension (but it won't delete chat history). If you want to re-roll the kitten, use the reset button. 𐔌՞꜆. ̫ .꜀՞𐦯
              </div>
</div>
          </div>
        </div>
      </div>
    </div>
  `;
  $('#extensions_settings').append(settingsHtml);
// drawer open/close
  const $root = $('.cozy-cat-settings');

  // Reset CozyCat per-chat data (synced).
  // Note: we keep a reset marker so old COZY_CAT_DATA blocks in chat history won't re-hydrate immediately.
  const $resetBtn = $root.find('#cozycatResetBtn');
  if ($resetBtn.length) {
    $resetBtn.on('click', async () => {
  const ok = await cozyConfirmReset();
  if (!ok) return;
  await resetCozyCatForThisChat();
});

  }
  $root.find('.inline-drawer-toggle').on('click', function () {
    $(this).toggleClass('open');
    $root.find('.inline-drawer-icon').toggleClass('down up');
    $root.find('.inline-drawer-content').toggleClass('open');
  });

  // ===== Overlay IDs / storage keys =====
  const pawBtnId = 'cozycat-paw-btn';
  const overlayId = 'cozycat-overlay';
  const pawPosKey = `${extensionName}:pawPos`;

  let escHandler = null;

  // ===== Screen Router State =====
  const SCREENS = {
    home: 'home',
    card: 'card',
    status: 'status',
    music: 'music',
  };

  let currentScreen = SCREENS.home;



// ===== CozyCat State / Storage =====
const CAT_STATE_KEY = `${extensionName}:catState:v1`; // (legacy local fallback)
const CAT_META_KEY = `${extensionName}:catState`; // stored per-chat on server via chatMetadata

function defaultCatState() {
  const s = {
    profile: {
      name: '—',
      // Displayed in Status as: "X เดือน Y วัน"
      age: '—',
      type: '—',
      sex: '—',
      urlcat: 'https://i.postimg.cc/4yQghhGj/none.png',
      spirit: '—',
      social: '—',
      vocal: '—',
      crime: '—',
      lifestyle: '—',
      // Health badge text (Healthy / Weak / Sick / Injured / Critical)
      HEALTH: 'Healthy',
    },

    // Roleplay timeline for age progression (persisted in chatMetadata)
    rp: {
      // Set once when the first calendar block is seen in this chat
      start: null,   // { y, m, d }
      // Updated whenever a new calendar block appears
      current: null, // { y, m, d }
      baseAgeDays: 63, // 9 weeks = 63 days
      ageDays: 63,
    },

    // Status placeholders (we'll implement logic later)
    status: {
      hunger: 10,
      happiness: 15,
      hygiene: 25,
      energy: 10,
    },
    health: {
      injured: false,
    },
  };

  // Ensure initial HEALTH badge matches initial status values.
  try {
    ensureDerivedHealth(s);
  } catch {}

  return s;
}

function mergeCatState(raw) {
  const def = defaultCatState();
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const merged = {
    ...def,
    ...parsed,
    profile: {
      ...def.profile,
      ...(parsed.profile || {}),
    },
    status: {
      ...def.status,
      ...(parsed.status || {}),
    },
    health: {
      ...def.health,
      ...(parsed.health || {}),
    },
    rp: {
      ...def.rp,
      ...(parsed.rp || {}),
    },
  };

  // Always derive HEALTH badge from current status so it can't get stuck at the default
  // (e.g., after reset or before the first COZY_CAT_STATUS block arrives).
  try {
    ensureDerivedHealth(merged);
  } catch (e) {
    // Non-fatal; keep previous badge if any.
  }

  return merged;
}

function getCtx() {
  return (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext) ? SillyTavern.getContext() : null;
}

function loadCatState() {
  // 1) Prefer per-chat metadata (syncs across devices)
  const ctx = getCtx();
  const meta = ctx?.chatMetadata;
  const metaVal = meta ? meta[CAT_META_KEY] : null;
  // If this chat was reset, ignore any old chat history re-hydration until a new gacha happens.
  if (metaVal && metaVal._reset === true) {
    return defaultCatState();
  }
  if (metaVal) {
    const s = mergeCatState(metaVal);
    // Normalize AGE display from rp.ageDays (base 63 days) so it never shows 0/—
    const ageDays = (s.rp?.ageDays ?? s.rp?.baseAgeDays ?? 63);
    s.profile.age = formatAgeMonthsDays(ageDays);
    return s;
  }

  // 2) Fallback: legacy local storage (device-only)
  try {
    const raw = localStorage.getItem(CAT_STATE_KEY);
    if (!raw) return defaultCatState();
    return mergeCatState(JSON.parse(raw));
  } catch {
    return defaultCatState();
  }
}

async function saveCatState(state) {
  const ctx = getCtx();

  // Save to chat metadata (server) if available
  if (ctx?.chatMetadata && typeof ctx.saveMetadata === 'function') {
    ctx.chatMetadata[CAT_META_KEY] = state;
    try {
      await ctx.saveMetadata();
    } catch (e) {
      console.warn('[cozy-cat-for-ST] saveMetadata failed', e);
    }
  }

  // Also keep local fallback (optional / backward compatibility)
  try {
    localStorage.setItem(CAT_STATE_KEY, JSON.stringify(state));
  } catch {}
}

// ===== Hidden JSON extractor (HTML comment block) =====
// Expected format:
// <!--COZY_CAT_DATA
// { ...json... }
// COZY_CAT_DATA-->
function extractCozyCatData(text) {
  if (!text) return null;
  const m = text.match(/<!--\s*COZY_CAT_DATA\s*([\s\S]*?)\s*COZY_CAT_DATA\s*-->/i);
  if (!m) return null;

  try {
    return JSON.parse(m[1].trim());
  } catch (e) {
    console.warn('[cozy-cat-for-ST] Invalid COZY_CAT_DATA JSON', e);
    return null;
  }
}

// ===== Hidden Status JSON extractor (inline in AI message) =====
// Expected format:
// <!--COZY_CAT_STATUS
// { ...json... }
// COZY_CAT_STATUS-->
function extractCozyCatStatus(text) {
  if (!text) return null;
  const m = text.match(/<!--\s*COZY_CAT_STATUS\s*([\s\S]*?)\s*COZY_CAT_STATUS\s*-->/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch (e) {
    console.warn('[cozy-cat-for-ST] Invalid COZY_CAT_STATUS JSON', e);
    return null;
  }
}

// ===== Hidden Name JSON extractor =====
// Expected format:
// <!--COZY_CAT_NAME
// { "name": "Fluffy" }
// COZY_CAT_NAME-->
function extractCozyCatName(text) {
  if (!text) return null;
  const m = text.match(/<!--\s*COZY_CAT_NAME\s*([\s\S]*?)\s*COZY_CAT_NAME\s*-->/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch (e) {
    console.warn('[cozy-cat-for-ST] Invalid COZY_CAT_NAME JSON', e);
    return null;
  }
}

function clamp01(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// Clamp a status delta object to reasonable bounds.  This prevents
// extremely large positive or negative adjustments returned by the AI from
// causing unrealistic jumps in the kitten's needs.  Each delta will be
// capped to the range [-50, 50] by default.
function clampStatusDelta(delta, maxAbs = 50) {
  const result = {};
  const keys = ['hunger', 'happiness', 'hygiene', 'energy'];
  for (const k of keys) {
    let v = 0;
    if (delta && Object.prototype.hasOwnProperty.call(delta, k)) {
      const n = Number(delta[k]);
      if (Number.isFinite(n)) v = n;
    }
    if (v > maxAbs) v = maxAbs;
    if (v < -maxAbs) v = -maxAbs;
    result[k] = v;
  }
  return result;
}

function applyStatusDelta(state, delta) {
  if (!state.status) state.status = { hunger: 50, happiness: 50, hygiene: 50, energy: 50 };
  const d = delta || {};
  state.status.hunger = clamp01((state.status.hunger ?? 50) + (Number(d.hunger) || 0));
  state.status.happiness = clamp01((state.status.happiness ?? 50) + (Number(d.happiness) || 0));
  state.status.hygiene = clamp01((state.status.hygiene ?? 50) + (Number(d.hygiene) || 0));
  state.status.energy = clamp01((state.status.energy ?? 50) + (Number(d.energy) || 0));
}

// ===== RP Calendar -> Age (reads calendar HTML blocks from chat messages) =====
// Expected snippet (in chat message HTML):
// <div class="cal-wrap"><div class="cal-title">DECEMBER</div> ... <div class="cal-date"><b>31</b><small>WED</small></div> ...</div>

function parseRpDateFromCalendarHtml(html) {
  if (!html) return null;
  html = decodeHtmlEntities(html);

  const monthMap = {
    JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
    JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
  };

  // 1) New time card UI: c-mo (MONTH • YEAR optional), c-dd (DAY), c-tm (HH:MM optional)
  const moEls = [...String(html).matchAll(/<[^>]+class=(["'])[^"']*\bc-mo\b[^"']*\1[^>]*>([\s\S]*?)<\//gi)];
  const ddEls = [...String(html).matchAll(/<[^>]+class=(["'])[^"']*\bc-dd\b[^"']*\1[^>]*>\s*(\d{1,2})\s*<\//gi)];
  const tmEls = [...String(html).matchAll(/<[^>]+class=(["'])[^"']*\bc-tm\b[^"']*\1[^>]*>\s*([0-2]?\d:[0-5]\d)\s*<\//gi)];

  if (moEls.length && ddEls.length) {
    const moEl = moEls[moEls.length - 1];
    const ddEl = ddEls[ddEls.length - 1];

    const moText = String(moEl[2]).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const moParts = moText.match(/([A-Za-z]+)\s*(?:•|&bull;|\u2022)\s*(\d{4})?/i);

    const m = monthMap[String(moParts?.[1] || '').toUpperCase()];
    const y = moParts?.[2] ? Number(moParts[2]) : undefined;
    const day = Number(ddEl[2]);

    let hh, mm;
    if (tmEls.length) {
      const t = tmEls[tmEls.length - 1][2];
      const [hStr, mStr] = t.split(':');
      const hNum = Number(hStr), mNum = Number(mStr);
      if (Number.isFinite(hNum) && Number.isFinite(mNum)) { hh = hNum; mm = mNum; }
    }

    if (m && Number.isFinite(day)) {
      const out = { m, d: day };
      if (Number.isFinite(y)) out.y = y;
      if (Number.isFinite(hh) && Number.isFinite(mm)) { out.hh = hh; out.mm = mm; }
      return out;
    }
  }

  // 2) Legacy calendar UI: cal-title (MONTH), cal-date (<b>DAY</b>) cal-title (MONTH), cal-date (<b>DAY</b>)
  const blocks = extractCalendarBlocksFromHtml(html);
  const candidates = blocks.length ? blocks : [html];

  let last = null;
  for (const chunk of candidates) {
    const months = [...String(chunk).matchAll(/class=(["'])cal-title\1\s*>\s*([A-Za-z]+)\s*</gi)].map(x => x[2]);
    const days = [...String(chunk).matchAll(/class=(["'])cal-date\1[^>]*>\s*<b>\s*(\d{1,2})\s*<\/b>/gi)].map(x => x[2]);
    if (!months.length || !days.length) continue;
    const m = monthMap[String(months[months.length - 1]).toUpperCase()];
    const d = Number(days[days.length - 1]);
    if (!m || !Number.isFinite(d)) continue;
    last = { m, d };
  }
  return last;
}


// Parse HH:MM from calendar block, e.g. <small ...>23:45 • Heavy Snow</small>
function parseRpTimeFromCalendarHtml(html) {
  if (!html) return null;
  html = decodeHtmlEntities(html);

  // Prefer new time card UI: <span class="c-tm">23:45</span>
  const mNew = html.match(/class=(["'])c-tm\1[^>]*>\s*([0-2]?\d):([0-5]\d)\s*</i);
  if (mNew) {
    const hh = Number(mNew[2]);
    const mm = Number(mNew[3]);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return { hh, mm };
  }

  const m = html.match(/>\s*(\d{1,2}):(\d{2})\s*(?:•|&bull;|\u2022)/i) || html.match(/>\s*(\d{1,2}):(\d{2})\s*</i);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}



function decodeHtmlEntities(s) {
  if (!s || typeof s !== 'string') return s;
  // Minimal decoding for calendar blocks that may be stored escaped in chat history.
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractCalendarBlocksFromHtml(html) {
  if (!html) return [];
  const blocks = [];
  const reBlock = /<div\s+class=(["'])cal-wrap\1[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  while ((m = reBlock.exec(html)) !== null) {
    blocks.push(m[0]);
  }
  return blocks;
}


function findLatestRpDateTimeInChat(chatArr) {
  if (!Array.isArray(chatArr)) return null;
  for (let i = chatArr.length - 1; i >= 0; i--) {
    const mes = decodeHtmlEntities(chatArr[i]?.mes ?? '');
    const d = parseRpDateFromCalendarHtml(mes);
    if (!d) continue;
    const t = parseRpTimeFromCalendarHtml(mes) || { hh: 0, mm: 0 };
    return { ...d, ...t };
  }
  return null;
}

function inferEpochNarrativeYear(latest) {
  if (!latest || typeof latest.y !== 'number') return null;
  if (latest.m < 12 || (latest.m === 12 && latest.d < 31)) return latest.y - 1;
  return latest.y;
}

function mapNarrativeYearToBase(narrativeYear, epochNarrativeYear) {
  if (typeof narrativeYear !== 'number' || typeof epochNarrativeYear !== 'number') return RP_BASE_YEAR;
  return RP_BASE_YEAR + (narrativeYear - epochNarrativeYear);
}

function ymdhmToEpochMinutes(ymdhm) {
  const dt = new Date(ymdhm.y, ymdhm.m - 1, ymdhm.d, ymdhm.hh || 0, ymdhm.mm || 0, 0, 0);
  return Math.floor(dt.getTime() / 60000);
}


function isGoodCareBeforeTimeskip(state) {
  // Heuristic: if the cat was doing well before the skip, assume continued decent care.
  const st = state?.status || {};
  const h = computeHealthBaseStateFromStatus(st);
  const avg = (Number(st.hunger ?? 50) + Number(st.happiness ?? 50) + Number(st.hygiene ?? 50) + Number(st.energy ?? 50)) / 4;
  // "Good care" if base health is Healthy OR average needs are comfortably above mid.
  return (h.base === 'Healthy' && h.value >= 55) || avg >= 60;
}

function applyTimeskipReset(state) {
  // When the narrative timeskips by a day or more:
  // - If prior care looked good -> land in Healthy-ish mid-high
  // - Otherwise -> land in Weak-ish mid
  // Do NOT clear injuries automatically.
  state.status = state.status || {};
  const good = isGoodCareBeforeTimeskip(state);

  const floors = good
    ? { hunger: 70, energy: 65, hygiene: 65, happiness: 60 }   // should evaluate to Healthy base
    : { hunger: 55, energy: 50, hygiene: 50, happiness: 45 };  // should evaluate to Weak base

  state.status.hunger = Math.max(floors.hunger, Number(state.status.hunger ?? floors.hunger));
  state.status.energy = Math.max(floors.energy, Number(state.status.energy ?? floors.energy));
  state.status.hygiene = Math.max(floors.hygiene, Number(state.status.hygiene ?? floors.hygiene));
  state.status.happiness = Math.max(floors.happiness, Number(state.status.happiness ?? floors.happiness));
}


function applyHalfHourDecay(state, steps) {
  if (!steps || steps <= 0) return;
  state.status = state.status || {};
  // Per 30 minutes of RP time (tweakable later)
  const dec = { hunger: -3, energy: -2, hygiene: -1, happiness: -1 };
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  state.status.hunger = clamp((state.status.hunger ?? 50) + dec.hunger * steps);
  state.status.energy = clamp((state.status.energy ?? 50) + dec.energy * steps);
  state.status.hygiene = clamp((state.status.hygiene ?? 50) + dec.hygiene * steps);
  state.status.happiness = clamp((state.status.happiness ?? 50) + dec.happiness * steps);
}

function toDateObj(ymd) {
  return new Date(ymd.y, ymd.m - 1, ymd.d);
}

function diffDays(a, b) {
  const ms = toDateObj(b).getTime() - toDateObj(a).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function formatAgeMonthsDays(ageDays) {
  const days = Math.max(0, Math.floor(Number(ageDays) || 0));
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return `${months} mo. ${rem} d.`;
}

function findFirstRpDateInChat(chatArr) {
  if (!Array.isArray(chatArr)) return null;
  for (let i = 0; i < chatArr.length; i++) {
    const mes = decodeHtmlEntities(chatArr[i]?.mes ?? '');
    const parsed = parseRpDateFromCalendarHtml(mes);
    if (parsed) return parsed;
  }
  return null;
}

function findLatestRpDateInChat(chatArr) {
  if (!Array.isArray(chatArr)) return null;
  for (let i = chatArr.length - 1; i >= 0; i--) {
    const mes = chatArr[i]?.mes ?? '';
    const parsed = parseRpDateFromCalendarHtml(mes);
    if (parsed) return parsed;
  }
  return null;
}

// Sets rp.start ONCE, then updates rp.current. Persists to chatMetadata.

async function hydrateAgeFromChat() {
  const ctx = getCtx();
  const chat = ctx?.chat;
  const state = loadCatState();

  // Ensure rp defaults
  const rp = state.rp || (state.rp = defaultCatState().rp);
  if (!rp.baseAgeDays) rp.baseAgeDays = RP_EPOCH.baseAgeDays;
  if (!rp.ageDays) rp.ageDays = rp.baseAgeDays;

  // Always ensure age is not 0/— (show base age at minimum)
  state.profile = state.profile || {};
  if (!state.profile.age || state.profile.age === '—' || state.profile.age === 0 || state.profile.age === '0') {
    state.profile.age = formatAgeMonthsDays(rp.ageDays);
  }

  if (!Array.isArray(chat) || chat.length === 0) {
    await saveCatState(state);
    return false;
  }

const latest = findLatestRpDateTimeInChat(chat);    // {m,d,hh,mm} and possibly {y}
if (!latest) {
  await saveCatState(state);
  return false;
}

// 1) Lock start date/time if missing (ONLY ONCE) to the fixed story epoch: Dec 31 23:45.
const didInitStart = !rp.start;
if (!rp.start) {
  rp.epochNarrativeYear = inferEpochNarrativeYear(latest);
  rp.start = { y: RP_BASE_YEAR, m: RP_EPOCH.m, d: RP_EPOCH.d, hh: RP_EPOCH.hh, mm: RP_EPOCH.mm };
} else if (!rp.epochNarrativeYear && typeof latest.y === 'number') {
  rp.epochNarrativeYear = inferEpochNarrativeYear(latest);
}

  // 2) Build next current date with year rollover inference
  const prevCur = rp.current || rp.start;
  // Determine internal year for Date math.
  let y = (typeof prevCur?.y === 'number') ? prevCur.y : RP_BASE_YEAR;

  // If UI provides a narrative year, map it to our internal baseline.
  if (typeof latest.y === 'number' && typeof rp.epochNarrativeYear === 'number') {
    y = mapNarrativeYearToBase(latest.y, rp.epochNarrativeYear);
  }

  // If UI didn't provide a narrative year, infer year rollover (Dec -> Jan etc.)
  if (!(typeof latest.y === 'number' && typeof rp.epochNarrativeYear === 'number')) {
    if (prevCur && typeof prevCur.m === 'number' && latest.m < prevCur.m && (prevCur.m - latest.m) >= 6) {
      y = (prevCur.y ?? y) + 1;
    }
  }

  const nextCurrent = { y, m: latest.m, d: latest.d, hh: (latest.hh ?? 0), mm: (latest.mm ?? 0) };

  const changedCurrent =
    !rp.current ||
    rp.current.y !== nextCurrent.y ||
    rp.current.m !== nextCurrent.m ||
    rp.current.d !== nextCurrent.d ||
    (rp.current.hh ?? 0) !== (nextCurrent.hh ?? 0) ||
    (rp.current.mm ?? 0) !== (nextCurrent.mm ?? 0);

  // 3) If RP time advanced, apply decay or timeskip reset
  // We use rp.lastDecayEpochMin to ensure we apply decay exactly once per 30 min window.
  const prevEpoch = (typeof rp.lastDecayEpochMin === 'number')
    ? rp.lastDecayEpochMin
    : ymdhmToEpochMinutes({ ...(rp.current || nextCurrent), hh: (rp.current?.hh ?? nextCurrent.hh), mm: (rp.current?.mm ?? nextCurrent.mm) });

  const nextEpoch = ymdhmToEpochMinutes(nextCurrent);

    if (nextEpoch > prevEpoch) {
    // Determine whether to apply a timeskip reset or normal decay.  A timeskip reset
    // should only occur when the narrative jumps forward by a full day *and* the time
    // difference is large enough (to avoid crossing midnight triggering an immediate reset).
    const prevDay = rp.current ? { y: rp.current.y, m: rp.current.m, d: rp.current.d } : { y: nextCurrent.y, m: nextCurrent.m, d: nextCurrent.d };
    const jumpedDays = diffDays(prevDay, { y: nextCurrent.y, m: nextCurrent.m, d: nextCurrent.d });
    const minutesDiff = nextEpoch - prevEpoch;

    // If we jumped at least one day AND the elapsed time is >= 12 hours (720 minutes),
    // treat this as a true timeskip; otherwise, apply normal decay. This prevents
    // crossing midnight by a few minutes from triggering a full reset.
    if (jumpedDays >= 1 && minutesDiff >= 12 * 60) {
      applyTimeskipReset(state);
      rp.lastDecayEpochMin = nextEpoch;
    } else {
      const steps = Math.floor(minutesDiff / 30);
      if (steps > 0) {
        applyHalfHourDecay(state, steps);
        rp.lastDecayEpochMin = prevEpoch + steps * 30;
      }
    }
  } else if (typeof rp.lastDecayEpochMin !== 'number') {
    // Initialize once so we don't decay backwards
    rp.lastDecayEpochMin = nextEpoch;
  }

  // Always update age from start->current (date-based), even if we didn't decay this tick.
  const deltaDays = diffDays(rp.start, { y: nextCurrent.y, m: nextCurrent.m, d: nextCurrent.d });
  rp.ageDays = (rp.baseAgeDays ?? 63) + Math.max(0, deltaDays);
  state.profile.age = formatAgeMonthsDays(rp.ageDays);

rp.current = nextCurrent;

  await saveCatState(state);
  return didInitStart || changedCurrent;
}




// ===== Rehydrate from chat history (for cross-device sync) =====
// If chatMetadata is missing (or stale), try to find the latest COZY_CAT_DATA block in loaded messages.
// This works when you open the same ST chat from another device (e.g., via Tailscale).
async function rehydrateFromChatHistory() {
  const ctx = getCtx();
  const chat = ctx?.chat;
  if (!Array.isArray(chat) || chat.length === 0) return false;

  // If we already have per-chat state (metadata) with a cat, do NOT overwrite it.
  // This function is meant as a fallback for cross-device when metadata is missing.
  const metaVal = ctx?.chatMetadata ? ctx.chatMetadata[CAT_META_KEY] : null;
  if (metaVal && metaVal._reset !== true) {
    const existing = mergeCatState(metaVal);
    if (existing?.profile?.type && existing.profile.type !== '—') {
      return false;
    }
  }

  for (let i = chat.length - 1; i >= 0; i--) {
    const mes = chat[i]?.mes ?? '';
    const data = extractCozyCatData(mes);
    if (!data) continue;

    // Merge into existing state if any, so we don't wipe status/age.
    const state = mergeCatState(metaVal || {});
    state.profile.type = data.type ?? state.profile.type;
    state.profile.sex = data.sex ?? state.profile.sex;
    state.profile.urlcat = data.urlcat ?? state.profile.urlcat;
    state.profile.spirit = data.spirit ?? state.profile.spirit;
    state.profile.social = data.social ?? state.profile.social;
    state.profile.vocal = data.vocal ?? state.profile.vocal;
    state.profile.crime = data.crime ?? state.profile.crime;
    state.profile.lifestyle = data.lifestyle ?? state.profile.lifestyle;

    // If this chat was previously reset, clear the reset marker now that we found valid cat data.
    if (state._reset === true) delete state._reset;

    await saveCatState(state);
    return true;
  }

  return false;
}



  // ===== AI-assisted Status (quiet prompt) =====
  let statusDebounceTimer = null;
  let statusInFlight = false;
  let lastStatusRunAt = 0;

  function sanitizeMessageForStatus(mes) {
    if (!mes) return '';
    let t = String(mes);

    // Remove hidden cat data blocks
    t = t.replace(/<!--\s*COZY_CAT_DATA[\s\S]*?COZY_CAT_DATA\s*-->/gi, '');

    // Remove calendar UI blocks (time/scene)
    t = t.replace(/<div\s+class="cal-wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '');

    // Strip remaining HTML tags
    t = t.replace(/<[^>]+>/g, ' ');

    // Collapse whitespace
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  
  function buildStatusPrompt(conversationText, prev, catProfile) {
    const anchor = {
      hunger: prev?.hunger ?? 50,
      happiness: prev?.happiness ?? 50,
      hygiene: prev?.hygiene ?? 50,
      energy: prev?.energy ?? 50,
      injured: Boolean(prev?.injured),
    };

    const traits = {
      spirit: catProfile?.spirit ?? '—',
      social: catProfile?.social ?? '—',
      vocal: catProfile?.vocal ?? '—',
      crime: catProfile?.crime ?? '—',
      lifestyle: catProfile?.lifestyle ?? '—',
    };

    return `
You are a pet‑care status updater for a roleplay kitten.

You will be given:
- **Previous status (anchor)** — values range 0–100 where higher is better:
  • hunger: 0 starving, 100 very full
  • happiness: 0 distressed, 100 very happy
  • hygiene: 0 filthy, 100 clean
  • energy: 0 exhausted, 100 energetic
- **Cat personality traits** (for context)
- **Recent conversation** describing what just happened

Task:
1) Infer what the kitten did or experienced since the previous status.
2) Output a **delta** object representing only the change in each stat (not absolute values).
3) Set **injured_event** to true only if the conversation describes an accident or injury (e.g. fall, fight, sickness). Set **injury_resolved** to true only if treatment or medicine is clearly applied. Otherwise both should be false.

Guidelines:
- **Activity completion rule:** Apply the main effects only when an activity is finished.
- **Interpret positive/negative deltas:** A positive delta improves the stat (cleaner, fuller, happier, more rested); a negative delta worsens it (dirtier, hungrier, sadder, tired).
- **Typical activity effects:**
  • *Feeding (snack/treat)*: hunger +10…+15; happiness +5; energy 0.
  • *Feeding (full meal)*: hunger +40…+60; energy +5; hygiene −5; happiness +10.
  • *Sleeping (nap/short rest)*: energy +20…+30; hunger −5; happiness 0.
  • *Sleeping (full night/deep sleep)*: energy +70…+90; hunger −15…−20; happiness +5.
  • *Bathing (thorough wash)*: hygiene +60…+80; happiness −10…−20; energy −10.
  • *Playing*: happiness +15…+25; energy −15…−20; hunger −10; hygiene −5.
- **Limits:** Do not worry about exceeding 100; the system will cap values automatically. Focus on the relative impact of each action on a 0–100 scale.
- **Conservative by default:** If the conversation does not clearly imply any of the above activities or consequences, return a delta of 0 for that stat.
- **Do not include commentary:** Return only the JSON described below.

Previous status (anchor):
${JSON.stringify(anchor)}

Cat personality (for context; use only when clearly relevant):
${JSON.stringify(traits)}

Conversation:
${conversationText}

Return ONLY valid JSON in this schema:
{
  "delta": { "hunger": int, "happiness": int, "hygiene": int, "energy": int },
  "injured_event": boolean,
  "injury_resolved": boolean
}
`.trim();
  }

  function safeJsonParseLoose(text) {
    if (!text) return null;
    const s = String(text).trim();
    try { return JSON.parse(s); } catch {}
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }

  function clampInt(v, min = 0, max = 100) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeHealthState(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'healthy') return 'Healthy';
    if (s === 'weak') return 'Weak';
    if (s === 'sick') return 'Sick';
    if (s === 'injured') return 'Injured';
    if (s === 'critical') return 'Critical';
    return null;
  }


// ===== Health logic (derived from status + AI hint) =====
const HEALTH_RANK = { Healthy: 0, Weak: 1, Sick: 2, Injured: 3, Critical: 4 };

function computeHealthValueFromStatus(st) {
  const hunger = Number(st?.hunger ?? 50);
  const happiness = Number(st?.happiness ?? 50);
  const hygiene = Number(st?.hygiene ?? 50);
  const energy = Number(st?.energy ?? 50);

  // Weighted average: hunger & energy matter most
  const v =
    (hunger * 0.35) +
    (energy * 0.35) +
    (hygiene * 0.20) +
    (happiness * 0.10);

  // Also consider "hard floor" when any critical need is extremely low
  const minStat = Math.min(hunger, happiness, hygiene, energy);
  return { value: Math.round(v), minStat: Math.round(minStat) };
}

function computeHealthBaseStateFromStatus(st) {
  // Base state derived ONLY from needs (no Injured here)
  const { value, minStat } = computeHealthValueFromStatus(st);

  // Emergency: if any stat is extremely low -> Critical
  if (minStat <= 5) return { base: 'Critical', value };

  // Thresholds requested:
  // - Weak is below mid (30-49)
  // - Sick <30 (20-29)
  // - Critical <20
  if (value < 20) return { base: 'Critical', value };
  if (value < 30) return { base: 'Sick', value };
  if (value < 50) return { base: 'Weak', value };
  return { base: 'Healthy', value };
}

function computeHealthShown(health) {
  // health: { base, injured }
  const base = health?.base || 'Healthy';
  const injured = !!health?.injured;
  if (base === 'Critical') return 'Critical';
  if (injured) return 'Injured';
  return base;
}

// Keep derived health fields in-sync with status. Call this whenever status changes
// or when loading/resetting state so the badge never gets stuck at a default value.
function ensureDerivedHealth(state) {
  if (!state) return;
  state.status = state.status || { hunger: 50, happiness: 50, hygiene: 50, energy: 50 };
  state.health = state.health || { injured: false };

  const hb = computeHealthBaseStateFromStatus(state.status);
  state.health.base = hb.base;
  state.health.value = hb.value;
  state.health.shown = computeHealthShown(state.health);
  if (!state.profile) state.profile = {};
  state.profile.HEALTH = state.health.shown;
}



  // ===== Manual actions (Status screen buttons) =====
  async function applyManualAction(action) {
    const state = await loadCatState();
    state.status = state.status || { hunger: 50, happiness: 50, hygiene: 50, energy: 50 };
    state.health = state.health || { injured: false };

    // deltas: positive = better (since 0 bad, 100 good)
    let delta = { hunger: 0, happiness: 0, hygiene: 0, energy: 0 };

    if (action === 'rest') {
      // Rest: gain energy, calm down a bit; may get slightly hungrier/less clean over time.
      delta = { energy: +25, happiness: +5, hunger: -5, hygiene: -1 };
    } else if (action === 'heal') {
      // Heal: resolve injury flag; small comfort boost.
      state.health.injured = false;
      delta = { energy: +10, happiness: +8, hygiene: +5, hunger: 0 };
    } else {
      return;
    }

    const s = state.status;
    s.hunger = clampInt(Number(s.hunger ?? 50) + delta.hunger, 0, 100);
    s.happiness = clampInt(Number(s.happiness ?? 50) + delta.happiness, 0, 100);
    s.hygiene = clampInt(Number(s.hygiene ?? 50) + delta.hygiene, 0, 100);
    s.energy = clampInt(Number(s.energy ?? 50) + delta.energy, 0, 100);

    // Update derived/shown health using the current health rules
    ensureDerivedHealth(state);

    await saveCatState(state);
    refreshIfOverlayOpen();
  }


function baseHealthStateFromDerived({ value, minStat }) {
  // Emergency override: if any stat is extremely low, health must be Critical
  if (minStat <= 5) return 'Critical';

  if (value >= 80) return 'Healthy';
  if (value >= 60) return 'Weak';
  if (value >= 40) return 'Sick';
  return 'Critical';
}

function pickWorseHealth(a, b) {
  const ra = HEALTH_RANK[a] ?? 1;
  const rb = HEALTH_RANK[b] ?? 1;
  return ra >= rb ? a : b;
}

  
function scheduleStatusRecalc(reason = '') {
  // Disabled: status is updated inline via <!--COZY_CAT_STATUS ... -->
  window.__cozycat_last_skip_reason = reason ? `inline-only (${reason})` : 'inline-only';
}

function renderTemplate(html, state) {
  const map = {
    // profile placeholders used in templates
    name: state.profile.name,
    age: state.profile.age,
    type: state.profile.type,
    sex: state.profile.sex,
    urlcat: state.profile.urlcat,
    spirit: state.profile.spirit,
    social: state.profile.social,
    vocal: state.profile.vocal,
    crime: state.profile.crime,
    lifestyle: state.profile.lifestyle,
    HEALTH: (state.health && state.health.shown) ? state.health.shown : (state.profile.HEALTH ?? 'Healthy'),

    // status placeholders
    hunger: state.status?.hunger ?? 50,
    happiness: state.status?.happiness ?? 50,
    hygiene: state.status?.hygiene ?? 50,
    energy: state.status?.energy ?? 50,
  };

  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = map[k];
    return (v === undefined || v === null) ? '—' : String(v);
  });
}


function applyCatImages(rootEl, state) {
  if (!rootEl) return;
  const url = state.profile.urlcat || 'https://i.postimg.cc/4yQghhGj/none.png';

  rootEl.querySelectorAll('.cozycat-card-img, .cozycat-status-avatar, .cozycat-music-cover')
    .forEach((img) => img.setAttribute('src', url));
}

function isOverlayOpen() {
  const el = document.getElementById(overlayId);
  if (!el) return false;
  return el.style.display !== 'none' && el.style.display !== '';
}

function refreshIfOverlayOpen() {
  if (!isOverlayOpen()) return;
  renderScreen(currentScreen);
}

// ===== Chat listener: when AI returns COZY_CAT_DATA block, store it =====
function attachChatHooks() {
  const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext) ? SillyTavern.getContext() : null;
  if (!ctx?.eventSource || !ctx?.event_types) {
    console.warn('[cozy-cat-for-ST] getContext/eventSource not available');
    return;
  }

  const { eventSource, event_types } = ctx;

  // prevent double-attach even if loadSettings() is called multiple times
  if (window.__cozycat_hooks_attached) return;
  window.__cozycat_hooks_attached = true;

  
eventSource.on(event_types.MESSAGE_RECEIVED, async () => {
    const last = ctx.chat?.[ctx.chat.length - 1];
    const mes = last?.mes ?? '';

    // 1) If there is a cat-data block, store it (card info)
    const data = extractCozyCatData(mes);
    if (data) {
      const state = loadCatState();

      // lorebook provides: type, sex, urlcat, spirit, social, vocal, crime, lifestyle
      state.profile.type = data.type ?? state.profile.type;
      state.profile.sex = data.sex ?? state.profile.sex;
      state.profile.urlcat = data.urlcat ?? state.profile.urlcat;

      state.profile.spirit = data.spirit ?? state.profile.spirit;
      state.profile.social = data.social ?? state.profile.social;
      state.profile.vocal = data.vocal ?? state.profile.vocal;
      state.profile.crime = data.crime ?? state.profile.crime;
      state.profile.lifestyle = data.lifestyle ?? state.profile.lifestyle;

      await saveCatState(state);
    }

    // 2) Always refresh age/decay from calendar blocks (timeskips may happen anytime)
    await hydrateAgeFromChat();

    // 3) Inline status update (one-call): parse COZY_CAT_STATUS and apply delta
    const stPayload = extractCozyCatStatus(mes);
    if (stPayload && stPayload.delta) {
      const state = loadCatState();
      const before = JSON.stringify({ status: state.status, health: state.health });

      // Clamp deltas to prevent unrealistic jumps (e.g., negative energy when sleeping)
      const safeDelta = clampStatusDelta(stPayload.delta);
      applyStatusDelta(state, safeDelta);

      state.health = state.health || { base: 'Healthy', injured: false };
      if (stPayload.injured_event === true) state.health.injured = true;
      if (stPayload.injury_resolved === true) state.health.injured = false;

      const hb = computeHealthBaseStateFromStatus(state.status);
      state.health.base = hb.base;
      state.health.value = hb.value;
      state.health.shown = computeHealthShown(state.health);

      const after = JSON.stringify({ status: state.status, health: state.health });

      if (before !== after) {
        await saveCatState(state);
        window.__cozycat_status_updates_count = Number(window.__cozycat_status_updates_count || 0) + 1;
        window.__cozycat_status_last_update_at = Date.now();
        window.__cozycat_last_skip_reason = '';
      } else {
        window.__cozycat_last_skip_reason = 'no change';
      }
} else {
      window.__cozycat_last_skip_reason = 'no COZY_CAT_STATUS';
}

    // 4) Name update: if the AI embedded a COZY_CAT_NAME block, set the cat's name.
    // We process this regardless of whether a status payload exists so that naming
    // can occur separately from status updates.  The block contains just:
    // { "name": "Fluffy" }
    const namePayload = extractCozyCatName(mes);
    if (namePayload && namePayload.name) {
      const stateName = loadCatState();
      stateName.profile.name = String(namePayload.name);
      await saveCatState(stateName);
    }

    refreshIfOverlayOpen();
  });

  // Update age when user sends messages too (timeskip blocks may be user-authored)
  if (event_types.MESSAGE_SENT) {
    eventSource.on(event_types.MESSAGE_SENT, async () => {
      await hydrateAgeFromChat();
      // scheduleStatusRecalc('message_sent');
      refreshIfOverlayOpen();
    });
  }

  // Cross-device / reload: when chat switches or loads, restore cat data for that chat
  if (event_types.CHAT_CHANGED) {
    eventSource.on(event_types.CHAT_CHANGED, () => {
      Promise.all([rehydrateFromChatHistory(), hydrateAgeFromChat()]).then((results) => {
        // scheduleStatusRecalc('chat_changed');
        if (results.some(Boolean)) refreshIfOverlayOpen();
      });
    });
  }
  if (event_types.CHAT_LOADED) {
    eventSource.on(event_types.CHAT_LOADED, () => {
      Promise.all([rehydrateFromChatHistory(), hydrateAgeFromChat()]).then((results) => {
        // scheduleStatusRecalc('chat_changed');
        if (results.some(Boolean)) refreshIfOverlayOpen();
      });
    });
  }
}


    // ===== Music (global audio persists across screens) =====
  const MUSIC_SRC_DEFAULT = 'https://od.lk/s/ODdfNDIxNjM0ODlf/2am.mp3';
  

  let cozyMusic = {
    audio: null,
    ui: null, 
  };

  function ensureMusicAudio() {
    if (cozyMusic.audio) return cozyMusic.audio;

    const a = document.createElement('audio');
    a.id = `${extensionName}-audio`;
    a.src = MUSIC_SRC_DEFAULT;
    a.loop = true;
    a.preload = 'auto';

    // listeners (ติดครั้งเดียว)
    a.addEventListener('timeupdate', () => updateMusicUIFromAudio());
    a.addEventListener('loadedmetadata', () => updateMusicUIFromAudio());
    a.addEventListener('play', () => updateMusicUIPlayState(true));
    a.addEventListener('pause', () => updateMusicUIPlayState(false));

    document.body.appendChild(a);
    cozyMusic.audio = a;
    return a;
  }

  function teardownMusicAudio() {
    const a = cozyMusic.audio;
    cozyMusic.ui = null;
    if (!a) return;

    try { a.pause(); } catch {}
    a.src = '';
    a.remove();
    cozyMusic.audio = null;
  }

  function formatTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  function updateMusicUIFromAudio() {
    const audio = cozyMusic.audio;
    const ui = cozyMusic.ui;
    if (!audio || !ui) return;

    const d = audio.duration;
    const t = audio.currentTime;

    ui.currentTimeEl.textContent = formatTime(t);
    ui.durationEl.textContent = Number.isFinite(d) ? formatTime(d) : '0:00';

    if (Number.isFinite(d) && d > 0) {
      ui.progress.value = String((t / d) * 100);
    }
  }

  function updateMusicUIPlayState(isPlaying) {
    const ui = cozyMusic.ui;
    if (!ui) return;

    ui.playIcon.style.display = isPlaying ? 'none' : 'block';
    ui.pauseIcon.style.display = isPlaying ? 'block' : 'none';

    ui.vinyl.classList.toggle('paused-animation', !isPlaying);
    ui.stylus.classList.toggle('playing', isPlaying);
  }

  function connectMusicUI(rootEl) {
    const audio = ensureMusicAudio();

    const ui = {
      playBtn: rootEl.querySelector('#cozycatPlayBtn'),
      playIcon: rootEl.querySelector('#cozycatPlayIcon'),
      pauseIcon: rootEl.querySelector('#cozycatPauseIcon'),
      progress: rootEl.querySelector('#cozycatProgress'),
      currentTimeEl: rootEl.querySelector('#cozycatCurrentTime'),
      durationEl: rootEl.querySelector('#cozycatDuration'),
      vinyl: rootEl.querySelector('#cozycatVinyl'),
      stylus: rootEl.querySelector('#cozycatStylus'),
    };

    // ถ้าหน้า music ยังไม่ render ครบ อย่าทำอะไร
    if (!ui.playBtn || !ui.progress) return;

    cozyMusic.ui = ui;

    // Play/Pause (ต้องกดจาก user gesture ถึงจะ play ได้ในบางเบราว์เซอร์)
    ui.playBtn.addEventListener('click', async () => {
      if (audio.paused) {
        try { await audio.play(); } catch {}
      } else {
        audio.pause();
      }
    });

    // Seek
    ui.progress.addEventListener('input', () => {
      if (!Number.isFinite(audio.duration)) return;
      audio.currentTime = (Number(ui.progress.value) / 100) * audio.duration;
   });

    // sync initial
    updateMusicUIFromAudio();
    updateMusicUIPlayState(!audio.paused);
  }


  // ===== Overlay system =====
  function mountOverlay() {
    if (document.getElementById(overlayId)) return;

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'cozycat-overlay';
    overlay.setAttribute('data-cozycat', 'overlay');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideOverlay();
    });

    overlay.innerHTML = `
      <div class="cozycat-screen" role="dialog" aria-modal="true">
        <div class="cozycat-screen-inner"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    escHandler = (e) => {
      if (e.key === 'Escape') hideOverlay();
    };
    document.addEventListener('keydown', escHandler);

    hydrateAgeFromChat().finally(() => renderScreen(SCREENS.home));
  }

  function showOverlay() {
    mountOverlay();
    const el = document.getElementById(overlayId);
    if (el) el.style.display = 'flex';

    // When opening, refresh from chat + recalc age/status so UI is never stale
    Promise.all([
      rehydrateFromChatHistory(),
      hydrateAgeFromChat(),
    ]).then(([rehydrated]) => {
      // scheduleStatusRecalc('overlay_open');
      if (rehydrated) refreshIfOverlayOpen();
      else renderScreen(currentScreen);
    });
  }

  function hideOverlay() {
    const el = document.getElementById(overlayId);
    if (el) el.style.display = 'none';
  }

  function toggleOverlay() {
    const el = document.getElementById(overlayId);
    if (!el || el.style.display === 'none' || el.style.display === '') showOverlay();
    else hideOverlay();
  }

  function unmountOverlay() {
    hideOverlay();
    const el = document.getElementById(overlayId);
    if (el) el.remove();

    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  // ===== Render helpers =====
  function getInnerRoot() {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return null;
    return overlay.querySelector('.cozycat-screen-inner');
  }

  function templateHome() {
    return `
      <div class="cozycat-home">
        <div class="cozycat-header-small">MORS'S COLLECTION</div>

        <div class="cozycat-title" aria-label="Your Pet Cat">
          <span class="cozycat-title-italic">Your</span><br>
          <span class="cozycat-title-indent cozycat-title-normal">Pet</span><br>
          <span class="cozycat-title-italic">Cat.</span>
        </div>

        <div class="cozycat-title-rule"></div>
        <div class="cozycat-watermark">FELINE</div>

        <div class="cozycat-menu">
          <button class="cozycat-menu-item" type="button" data-go="${SCREENS.card}">
            <div class="cozycat-menu-row">
              <span class="cozycat-menu-num">01</span>
              <span class="cozycat-menu-label">Check Pet Card</span>
            </div>
          </button>

          <button class="cozycat-menu-item" type="button" data-go="${SCREENS.status}">
            <div class="cozycat-menu-row">
              <span class="cozycat-menu-num">02</span>
              <span class="cozycat-menu-label">Check Status</span>
            </div>
          </button>

          <button class="cozycat-menu-item" type="button" data-go="${SCREENS.music}">
            <div class="cozycat-menu-row">
              <span class="cozycat-menu-num">03</span>
              <span class="cozycat-menu-label">Music Player</span>
            </div>
          </button>
        </div>

        <div class="cozycat-footer">have a cozy day...</div>
      </div>
    `;
  }

  function templateBack() {
    // ปุ่ม Back
    return `
      <button class="cozycat-back" type="button" data-back="1" title="Back" aria-label="Back">
        <svg class="cozycat-back-svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span class="cozycat-back-text">Back</span>
      </button>
    `;
  }

  function templateCard() {
    // ใช้ default image
    const defaultImg = 'https://i.postimg.cc/4yQghhGj/none.png';

    return `
      <div class="cozycat-card-screen">
        ${templateBack()}

        <div class="cozycat-card-wrap">
          <div class="cozycat-card" tabindex="0" role="button" aria-label="Cat Card (tap to flip)">
            <div class="cozycat-card-front">
              <img src="${defaultImg}" class="cozycat-card-img" alt="Cat">
              <div class="cozycat-card-hint">👆 Flip to Read</div>
            </div>

            <div class="cozycat-card-back">
              <div class="cozycat-card-watermark">CAT</div>

              <div class="cozycat-card-content">
                <div>
                  <div class="cozycat-card-sub">MORS'S KITTEN COLLECTION</div>
                  <!-- ใช้ div แทน h2 กันธีมอื่นแทรกเส้น/สี -->
                  <div class="cozycat-card-title">Your<br>Soon To Be<br>Master.</div>
                </div>

                <div class="cozycat-card-body">
                  <div class="cozycat-card-stats">
                    <span>TYPE: {{type}}</span>
                    <span>SEX: {{sex}}</span>
                  </div>

                  <div class="cozycat-card-personality">
                    <b class="cozycat-card-personality-label">Personality:</b>
                    <ul class="cozycat-card-list">
                      <li>{{spirit}}</li>
                      <li>{{social}}</li>
                      <li>{{vocal}}</li>
                      <li>{{crime}}</li>
                      <li>{{lifestyle}}</li>
                    </ul>
                  </div>
                </div>

                <div class="cozycat-card-icon">🐾</div>
              </div>
            </div>
          </div>
        </div>

        <div class="cozycat-card-signature" aria-hidden="true">
          <span>your little fur ball...</span>
        </div>
      </div>
    `;
  }

  function templateStatus() {
  const defaultImg = 'https://i.postimg.cc/4yQghhGj/none.png';

  return `
    <div class="cozycat-page-screen cozycat-status-screen">
      ${templateBack()}

      <!-- Profile -->
      <div class="cozycat-status-profile">
        <div class="cozycat-status-avatar-wrap">
          <img src="${defaultImg}" class="cozycat-status-avatar" alt="Cat">
          <div class="cozycat-status-badge">❤ {{HEALTH}}</div>
        </div>

        <div class="cozycat-status-name">{{name}}</div>

        <div class="cozycat-status-meta">
          <span>AGE: {{age}}</span>
          <span>TYPE: {{type}}</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="cozycat-status-stats">

        ${statusRow('🥩 Hunger', '{{hunger}}')}
        ${statusRow('🧸 Happiness', '{{happiness}}')}
        ${statusRow('🧼 Hygiene', '{{hygiene}}')}
        ${statusRow('⚡ Energy', '{{energy}}')}

</div>

      <div class="cozycat-status-footer">
        dreaming of tuna...
      </div>
    </div>
  `;
}

function statusRow(label, value) {
  return `
    <div class="cozycat-status-row">
      <div class="cozycat-status-row-head">
        <span class="cozycat-status-label">${label}</span>
        <span class="cozycat-status-value">${value}%</span>
      </div>
      <div class="cozycat-status-bar-bg">
        <div class="cozycat-status-bar-fill" style="width:${value}%;"></div>
      </div>
    </div>
  `;
}
function animateStatusBars(rootEl) {
  // เล่นเฉพาะใน status screen
  const bars = rootEl.querySelectorAll('.cozycat-status-bar-fill');
  if (!bars.length) return;

  requestAnimationFrame(() => {
    bars.forEach((bar) => {
      const target = bar.style.width || '0%';
      bar.style.width = '0%';
      bar.offsetHeight; // force reflow
      bar.style.width = target;
    });
  });
}



  function templateMusic() {
  const coverDefault = 'https://i.postimg.cc/4yQghhGj/none.png';

  return `
    <div class="cozycat-page-screen cozycat-music-screen">
      ${templateBack()}

      <div class="cozycat-music-content">
        <!-- Vinyl -->
        <div class="cozycat-music-vinyl-area">
          <div class="cozycat-music-vinyl spin-animation paused-animation" id="cozycatVinyl">
            <div class="cozycat-music-grooves"></div>
            <img src="${coverDefault}" class="cozycat-music-cover" alt="Cover">
          </div>

          <div class="cozycat-music-stylus" id="cozycatStylus">
            <div class="cozycat-music-stylus-knob"></div>
          </div>
        </div>

        
        <div class="cozycat-music-track">
          <div class="cozycat-music-tag">NOW PLAYING • VOL. 03</div>
          <div class="cozycat-music-title">Soft Paws on Wood Floors</div>
          <div class="cozycat-music-artist">M. Entertainment</div>
        </div>

        <!-- Controls -->
        <div class="cozycat-music-controls">
          <div class="cozycat-music-progress">
            <span id="cozycatCurrentTime">0:00</span>
            <input type="range" id="cozycatProgress" class="cozycat-music-progressbar" value="0" step="0.1">
            <span id="cozycatDuration">0:00</span>
          </div>

          <div class="cozycat-music-btnrow">
            <button class="cozycat-music-btn" type="button" aria-label="Previous" disabled>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 20L9 12l10-8v16zM5 4h2v16H5V4z"/>
              </svg>
            </button>

            <button class="cozycat-music-play" type="button" id="cozycatPlayBtn" aria-label="Play/Pause">
              <svg id="cozycatPlayIcon" width="24" height="24" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg id="cozycatPauseIcon" width="24" height="24" viewBox="0 0 24 24" style="display:none;">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>

            <button class="cozycat-music-btn" type="button" aria-label="Next" disabled>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 4l10 8-10 8V4zm14 0h2v16h-2V4z"/>
              </svg>
            </button>
          </div>
          <div class="cozycat-music-sign">on repeat forever...</div>
        </div>
      </div>
    </div>
  `;
}


  function renderScreen(next) {
    currentScreen = next;

    const root = getInnerRoot();
    if (!root) return;

    let html = '';
    if (next === SCREENS.home) html = templateHome();
    else if (next === SCREENS.card) html = templateCard();
    else if (next === SCREENS.status) html = templateStatus();
    else if (next === SCREENS.music) html = templateMusic();
    else html = templateHome();

const state = loadCatState();
root.innerHTML = renderTemplate(html, state);
applyCatImages(root, state);

    if (next === SCREENS.status) {
      animateStatusBars(root);
    }
     if (next === SCREENS.music) {
    connectMusicUI(root);
    } else {
      cozyMusic.ui = null; // ออกจากหน้า music แต่ “ไม่หยุดเพลง”
    }
    
    wireScreenEvents(root);
  }

  function wireScreenEvents(rootEl) {
    // go
    rootEl.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-go');
        renderScreen(target);
      });
    });

    // back
    const backBtn = rootEl.querySelector('[data-back="1"]');
    if (backBtn) {
      backBtn.addEventListener('click', () => renderScreen(SCREENS.home));
    }

    // card flip 
    const card = rootEl.querySelector('.cozycat-card');
    if (card) {
      const toggleFlip = () => card.classList.toggle('is-flipped');

      card.addEventListener('click', (e) => {
        // กันคลิกโดนปุ่ม back ถ้ามี overlap
        if (e.target.closest('.cozycat-back')) return;
        toggleFlip();
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleFlip();
        }
      });
    }

    // status actions
    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-action');
        await applyManualAction(act);
      });
    });
  }

  // ===== Draggable paw button (remember position) =====
  function getSavedPawPos() {
    try {
      const raw = localStorage.getItem(pawPosKey);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v?.x !== 'number' || typeof v?.y !== 'number') return null;
      return v;
    } catch {
      return null;
    }
  }

  function savePawPos(x, y) {
    localStorage.setItem(pawPosKey, JSON.stringify({ x, y }));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function mountPawButton() {
    if (document.getElementById(pawBtnId)) return;

    const btn = document.createElement('div');
    btn.id = pawBtnId;
    btn.className = 'cozycat-paw-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.title = 'Cozy Cat Overlay';
    btn.innerHTML = `<span class="cozycat-paw-emoji">🐾</span>`;

    const saved = getSavedPawPos();
    if (saved) {
      btn.style.left = `${saved.x}px`;
      btn.style.top = `${saved.y}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    } else {
      btn.style.right = '16px';
      btn.style.bottom = '16px';
    }

    let dragging = false;
    let moved = false;

    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function ensureLeftTop() {
      const rect = btn.getBoundingClientRect();
      btn.style.left = `${rect.left}px`;
      btn.style.top = `${rect.top}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }

    btn.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;

      btn.setPointerCapture(e.pointerId);
      ensureLeftTop();

      const rect = btn.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
    });

    btn.addEventListener('pointermove', (e) => {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const rect = btn.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const nextLeft = clamp(startLeft + dx, 8, vw - w - 8);
      const nextTop = clamp(startTop + dy, 8, vh - h - 8);

      btn.style.left = `${nextLeft}px`;
      btn.style.top = `${nextTop}px`;
    });

    btn.addEventListener('pointerup', () => {
      dragging = false;

      const rect = btn.getBoundingClientRect();
      savePawPos(rect.left, rect.top);

      if (!moved) toggleOverlay();
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleOverlay();
      }
    });

    document.body.appendChild(btn);

    // --- NEW: normalize position after mount (compat: no ?. / no ??) ---
    requestAnimationFrame(function () {
      var vv = window.visualViewport;
      var vw = (vv && typeof vv.width === 'number') ? vv.width : window.innerWidth;
      var vh = (vv && typeof vv.height === 'number') ? vv.height : window.innerHeight;

      // iOS Safari บางเคสมี offset ของ visual viewport
      var offX = (vv && typeof vv.offsetLeft === 'number') ? vv.offsetLeft : 0;
      var offY = (vv && typeof vv.offsetTop === 'number') ? vv.offsetTop : 0;

      var rect = btn.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;

      var pad = 8;

      // current position (prefer style-left/top; fallback rect)
      var x = parseFloat(btn.style.left);
      if (!isFinite(x)) x = rect.left;

      var y = parseFloat(btn.style.top);
      if (!isFinite(y)) y = rect.top;

      var minX = offX + pad;
      var maxX = offX + vw - w - pad;
      var minY = offY + pad;
      var maxY = offY + vh - h - pad;

      // ถ้า saved เพี้ยนหนัก/NaN ให้รีเซ็ตกลับมุมล่างขวา + ล้างค่าเก่า
      var bad =
        !isFinite(x) || !isFinite(y) ||
        x < (minX - 200) || x > (maxX + 200) ||
        y < (minY - 200) || y > (maxY + 200);

      if (bad) {
        btn.style.left = '';
        btn.style.top = '';
        btn.style.right = '16px';
        btn.style.bottom = '16px';
        try { localStorage.removeItem(pawPosKey); } catch (e) {}
        return;
      }

      // clamp ให้อยู่ในจอ
      x = clamp(x, minX, maxX);
      y = clamp(y, minY, maxY);

      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    });


  }

  function unmountPawButton() {
    const btn = document.getElementById(pawBtnId);
    if (btn) btn.remove();
  }

  function unmountAll() {
    unmountOverlay();
    unmountPawButton();
  }

  // ===== enable/disable =====
  function applyEnabledState(isEnabled) {
    if (isEnabled) {
      ensureMusicAudio();
      mountPawButton();
    } else {
      teardownMusicAudio();
      unmountAll();
    }
  }

  const $enabled = $root.find(`#${extensionName}-enabled`);
  $enabled.on('change', function () {
    const isEnabled = this.checked;
    localStorage.setItem(enabledKey, String(isEnabled));
    applyEnabledState(isEnabled);
  });

  

  // ===== Reset (per-chat, synced) =====
  async function resetCozyCatForThisChat() {
    const ctx = getCtx();
    if (!ctx?.chatMetadata || typeof ctx.saveMetadata !== 'function') {
      console.warn('[cozy-cat-for-ST] chatMetadata/saveMetadata unavailable; cannot reset');
      return;
    }

    // Delete only CozyCat per-chat state
    try {
      ctx.chatMetadata[CAT_META_KEY] = { _reset: true };
      await ctx.saveMetadata();
    } catch (e) {
      console.warn('[cozy-cat-for-ST] reset saveMetadata failed', e);
    }

    // Also clear any in-memory UI
    refreshIfOverlayOpen();
  }
applyEnabledState(enabled);
  attachChatHooks();

}
jQuery(async () => {
  loadSettings();
  console.log('[cozy-cat-for-ST] Panel Loaded.');
});



