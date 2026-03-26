/**
 * Loads property_data.json and fills the static destination page template.
 */

/**
 * OptinMonster popups (ids like om-*-optin, classes heimdal-c-canvas) are usually injected via
 * Google Tag Manager or their script from a.omappapi.com. This removes any that still appear.
 */
function blockMarketingOverlays() {
  const remove = () => {
    document.querySelectorAll('[id^="om-"]').forEach((el) => el.remove());
    document.querySelectorAll('.heimdal-c-canvas').forEach((el) => el.remove());
    document
      .querySelectorAll(
        'iframe[src*="omappapi.com"], iframe[src*="optinmonster"]',
      )
      .forEach((el) => el.remove());
  };
  remove();
  let t;
  const obs = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(remove, 0);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normalize literal \\n sequences from JSON into newlines. */
function normalizeDescriptionText(s) {
  return String(s)
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}

/**
 * Same order and labels as the live listing: intro paragraph, then h4 + p blocks.
 * (Notes appear before Getting Around, matching the original DOM.)
 */
function getPublicDescriptionSections(data) {
  const pd = data.publicDescription || {};
  const spec = [
    { heading: null, text: pd.summary },
    { heading: 'The Space', text: pd.space },
    { heading: 'Guest Access', text: pd.access },
    { heading: 'Neighborhood', text: pd.neighborhood },
    { heading: 'Other Things to Note', text: pd.notes },
    { heading: 'Getting Around', text: pd.transit },
    { heading: 'Guest Interactions', text: pd.interactionWithGuests },
    { heading: 'House Rules', text: pd.houseRules },
  ];
  const out = [];
  for (const { heading, text } of spec) {
    if (typeof text !== 'string' || text.trim().length <= 2) continue;
    const t = normalizeDescriptionText(text);
    if (t.length <= 2) continue;
    if (/^T[a-z0-9]{3,},?$/i.test(t)) continue;
    out.push({ heading, text: t });
  }
  return out;
}

function sectionsToPlainText(sections) {
  if (!sections.length) return '';
  return sections
    .map((s) => (s.heading ? `${s.heading}\n\n${s.text}` : s.text))
    .join('\n\n');
}

function sectionsToHtml(sections) {
  return sections
    .map((s) => {
      const body = escapeHtml(s.text).replace(/\n/g, '<br>');
      if (s.heading) {
        return `<h4>${escapeHtml(s.heading)}</h4><p>${body}</p>`;
      }
      return `<p>${body}</p>`;
    })
    .join('');
}

function buildDescription(data) {
  const sections = getPublicDescriptionSections(data);
  return sectionsToPlainText(sections) || data.title || '';
}

const AMENITIES_PREVIEW_COUNT = 12;

function initPropertyDescriptionToggle(data) {
  const descEl = document.getElementById('property-description');
  const btn = document.getElementById('property-description-toggle');
  if (!descEl) return;

  const sections = getPublicDescriptionSections(data);
  const fullRaw = sectionsToPlainText(sections);
  const pd = data.publicDescription || {};
  const summaryRaw = (pd.summary && String(pd.summary).trim()) || '';
  const teaser =
    summaryRaw || fullRaw.slice(0, Math.min(500, fullRaw.length));

  const hasMore =
    fullRaw.length > teaser.length + 40 ||
    (!!summaryRaw && fullRaw.length > summaryRaw.length + 40);

  const renderTeaser = () => {
    const html = escapeHtml(teaser).replace(/\n/g, '<br>');
    descEl.innerHTML = `<p>${html}</p>`;
  };

  const renderFull = () => {
    descEl.innerHTML = sectionsToHtml(sections);
  };

  if (!hasMore) {
    renderFull();
    if (btn) btn.closest('p')?.classList.add('hidden');
    return;
  }

  if (btn) btn.closest('p')?.classList.remove('hidden');

  const apply = () => {
    const expanded = btn && btn.dataset.expanded === '1';
    if (expanded) renderFull();
    else renderTeaser();
    if (btn) btn.textContent = expanded ? 'Show Less' : 'Show More';
  };

  if (btn) {
    btn.dataset.expanded = '0';
    btn.onclick = (e) => {
      e.preventDefault();
      btn.dataset.expanded = btn.dataset.expanded === '1' ? '0' : '1';
      apply();
    };
    apply();
  } else {
    renderFull();
  }
}

function initAmenitiesShowMore(amenitiesGrid) {
  const btn = document.getElementById('amenities-show-more');
  if (!btn || !amenitiesGrid) return;

  const children = amenitiesGrid.children;
  if (children.length <= AMENITIES_PREVIEW_COUNT) {
    btn.closest('p')?.classList.add('hidden');
    return;
  }

  btn.closest('p')?.classList.remove('hidden');

  const apply = () => {
    const expanded = btn.dataset.expanded === '1';
    for (let i = 0; i < children.length; i++) {
      if (i >= AMENITIES_PREVIEW_COUNT) children[i].hidden = !expanded;
    }
    btn.textContent = expanded ? 'Show Less' : 'Show More';
  };

  btn.dataset.expanded = '0';
  btn.onclick = (e) => {
    e.preventDefault();
    btn.dataset.expanded = btn.dataset.expanded === '1' ? '0' : '1';
    apply();
  };
  apply();
}

function getIconSlug(name) {
  const n = String(name).trim();
  const map = {
    'Free parking on premises': 'FREE_PARKING',
    'Free parking on street': 'FREE_PARKING',
    'Air conditioning': 'AIR_CONDITIONING',
    Heating: 'HEATING',
    'Hot tub': 'HOT_TUB',
    Kitchen: 'KITCHEN',
    Wifi: 'WIRELESS_INTERNET',
    Internet: 'INTERNET',
    'Wireless Internet': 'WIRELESS_INTERNET',
    TV: 'TV',
    Washer: 'WASHER',
    Dryer: 'DRYER',
    Bathtub: 'BATHTUB',
    'Coffee maker': 'COFFEE_MAKER',
    Dishwasher: 'DISHWASHER',
    Oven: 'OVEN',
    Microwave: 'MICROWAVE',
    Stove: 'STOVE',
    Refrigerator: 'REFRIGERATOR',
    'Dishes and silverware': 'DISHES_AND_SILVERWARE',
    'Patio or balcony': 'PATIO_OR_BALCONY',
    'BBQ grill': 'BBQ_GRILL',
    'Smoke detector': 'SMOKE_DETECTOR',
    'Carbon monoxide detector': 'CARBON_MONOXIDE_DETECTOR',
    'Fire extinguisher': 'FIRE_EXTINGUISHER',
    'First aid kit': 'FIRST_AID_KIT',
    'Hair dryer': 'HAIR_DRYER',
    Hangers: 'HANGERS',
    Iron: 'IRON',
    Shampoo: 'SHAMPOO',
    'Bed linens': 'BED_LINENS',
    'Extra pillows and blankets': 'EXTRA_PILLOWS_AND_BLANKETS',
    'Room-darkening shades': 'ROOM_DARKENING_SHADES',
    Essentials: 'ESSENTIALS',
    'Hot water': 'HOT_WATER',
    'Baby bath': 'BABY_BATH',
    'High chair': 'HIGH_CHAIR',
    'Children’s dinnerware': 'CHILDREN_DINNERWARE',
    "Children's dinnerware": 'CHILDREN_DINNERWARE',
    'Children’s books and toys': 'CHILDREN_BOOKS_AND_TOYS',
    "Children's books and toys": 'CHILDREN_BOOKS_AND_TOYS',
    'Babysitter recommendations': 'BABYSITTER_RECOMMENDATIONS',
    'Accessible-height bed': 'ACCESSIBLE_HEIGHT_BED',
    'Accessible-height toilet': 'ACCESSIBLE_HEIGHT_TOILET',
    'Step-free access': 'STEP_FREE_ACCESS',
    'Path to entrance lit at night': 'PATH_TO_ENTRANCE_LIT_AT_NIGHT',
    'Pack ’n Play/travel crib': 'PACK_N_PLAY_TRAVEL_CRIB',
    'Pack \'n play/travel crib': 'PACK_N_PLAY_TRAVEL_CRIB',
    'Beach essentials': 'BEACH_ESSENTIALS',
  };
  if (map[n]) return map[n];
  return n
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function initProperty() {
  try {
    const response = await fetch('../property_data.json');
    if (!response.ok) throw new Error('Failed to load property data');
    const data = await response.json();
    renderProperty(data);
  } catch (error) {
    console.error('Error initializing property:', error);
  }
}

function renderProperty(data) {
  if (data.title) {
    document.title = data.title;
  }

  const titleEl = document.getElementById('property-title');
  if (titleEl) {
    titleEl.textContent = data.title || '';
  }

  initPropertyDescriptionToggle(data);

  const statsEl = document.getElementById('property-stats');
  if (statsEl) {
    const columns = statsEl.children;
    const guests = data.accommodates ?? data.guests;
    if (columns.length >= 3) {
      updateStatText(
        columns[0],
        `${data.bedrooms} ${data.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}`,
      );
      updateStatText(
        columns[1],
        `${data.bathrooms} ${data.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}`,
      );
      updateStatText(
        columns[2],
        `${guests} ${guests === 1 ? 'Guest' : 'Guests'}`,
      );
    }
  }

  const nickEl = document.getElementById('gallery-nickname');
  if (nickEl && data.nickname) {
    nickEl.textContent = data.nickname;
  }

  const locNick = document.getElementById('location-nickname');
  if (locNick && data.nickname) {
    locNick.textContent = data.nickname;
  }

  const addrLink = document.getElementById('property-address-link');
  if (addrLink && data.address) {
    const full = data.address.full || '';
    if (full) {
      addrLink.textContent = full;
      const q = encodeURIComponent(full);
      addrLink.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
  }

  const mapIframe = document.getElementById('property-map-iframe');
  if (mapIframe && data.address) {
    const lat = data.address.lat;
    const lng = data.address.lng;
    if (lat != null && lng != null) {
      mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&hl=en&z=15&output=embed`;
    }
  }

  const amenitiesGrid = document.getElementById('amenities-grid');
  if (amenitiesGrid && Array.isArray(data.amenities)) {
    const list = data.amenities;
    amenitiesGrid.innerHTML = list
      .map((name, index) => {
        const slug = getIconSlug(name);
        const safeName = escapeHtml(name);
        const extra = index >= AMENITIES_PREVIEW_COUNT ? ' hidden' : '';
        return `
      <div${extra}>
        <div class="flex flex-col">
          <div class="mb-5 max-w-[40px]">
            <div class="aspect-w-1 aspect-h-1">
              <img
                alt="${safeName}"
                loading="lazy"
                class="object-bottom object-contain"
                style="position: absolute; height: 100%; width: 100%; inset: 0px;"
                src="../icons/${slug}.svg"
                onerror="this.onerror=null;this.src='../icons/ESSENTIALS.svg'"
              />
            </div>
          </div>
          <p class="text-xs mb-0">${safeName}</p>
        </div>
      </div>`;
      })
      .join('');
    initAmenitiesShowMore(amenitiesGrid);
  }

  const pictures = data.pictures || [];
  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid && pictures.length) {
    const imgs = pictures.slice(0, 5);
    galleryGrid.innerHTML = imgs
      .map((pic, index) => {
        const url = pic.original || pic.url || '';
        const colSpan =
          index === 0
            ? 'col-span-4 md:col-span-2 row-span-2'
            : 'col-span-2 md:col-span-1 row-span-1';
        const cap = escapeHtml(pic.caption || `Image ${index + 1}`);
        const srcAttr = String(url).replace(/"/g, '&quot;');
        return `
          <button type="button" class="relative aspect-w-1 aspect-h-1 ${colSpan}">
            <img
              alt="${cap}"
              loading="lazy"
              class="object-cover object-center"
              style="position: absolute; height: 100%; width: 100%; inset: 0px; color: transparent;"
              src="${srcAttr}"
            />
          </button>`;
      })
      .join('');
  }

  initGalleryLightbox(pictures);
  initTestimonials(data);
}

const TESTIMONIAL_STAR_SVG = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" class="inline-block text-gold" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"></path></svg>`;

function testimonialImageUrl(t, data) {
  return (
    t.listing?.image?.data?.src ||
    data.testimonialFallbackImage ||
    data.picture?.thumbnail ||
    (data.pictures && data.pictures[0] && data.pictures[0].original) ||
    ''
  );
}

function formatTestimonialDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderTestimonialStars(rating) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 5)));
  return Array.from({ length: n }, () => TESTIMONIAL_STAR_SVG).join('');
}

function initTestimonials(data) {
  const items = data.testimonials;
  if (!Array.isArray(items) || items.length === 0) return;

  const imgEl = document.getElementById('testimonial-image');
  const bodyEl = document.getElementById('testimonial-body');
  const dateEl = document.getElementById('testimonial-date');
  const starsEl = document.getElementById('testimonial-stars');
  const nextBtn = document.getElementById('testimonial-next');
  if (!imgEl || !bodyEl || !dateEl || !starsEl) return;

  let idx = 0;
  const apply = () => {
    const t = items[idx];
    const url = testimonialImageUrl(t, data);
    if (url) {
      imgEl.removeAttribute('srcset');
      imgEl.src = url;
    }
    const alt =
      (t.listing && t.listing.title) || data.nickname || data.title || '';
    if (alt) imgEl.alt = alt;

    const body = String(t.body || '')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    bodyEl.textContent = body;

    dateEl.textContent = formatTestimonialDate(t.date);
    starsEl.innerHTML = renderTestimonialStars(t.rating);
  };

  apply();

  if (nextBtn && items.length > 1) {
    nextBtn.onclick = (e) => {
      e.preventDefault();
      idx = (idx + 1) % items.length;
      apply();
    };
  } else if (nextBtn) {
    nextBtn.classList.add('hidden');
  }
}

function initGalleryLightbox(pictures) {
  const showBtn = document.getElementById('gallery-show-all');
  const section = document.getElementById('gallery-section');
  if (!showBtn || !section || !pictures.length) return;

  let root = document.getElementById('property-gallery-lightbox');
  if (!root) {
    root = document.createElement('div');
    root.id = 'property-gallery-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'All property photos');
    root.style.cssText =
      'display:none;position:fixed;inset:0;z-index:200;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(0,0,0,0.92);padding:64px 16px 24px;box-sizing:border-box;';
    root.innerHTML = `
      <button type="button" data-lb-close aria-label="Close photo gallery" style="position:fixed;top:12px;right:12px;z-index:3;width:48px;height:48px;border:0;border-radius:4px;background:rgba(255,255,255,0.12);color:#fff;font-size:28px;line-height:1;cursor:pointer">×</button>
      <div data-lb-grid style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px"></div>`;
    document.body.appendChild(root);

    const close = () => {
      root.style.display = 'none';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onEsc);
    };
    const open = () => {
      root.style.display = 'block';
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onEsc);
    };
    function onEsc(e) {
      if (e.key === 'Escape') close();
    }

    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });
    root.querySelector('[data-lb-close]').addEventListener('click', close);
    showBtn.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
    section.addEventListener('click', (e) => {
      if (e.target.closest('#gallery-grid button')) open();
    });
  }

  const grid = root.querySelector('[data-lb-grid]');
  if (grid) {
    grid.innerHTML = pictures
      .map((pic, i) => {
        const url = pic.original || pic.url || '';
        const cap = escapeHtml(pic.caption || `Photo ${i + 1}`);
        const src = String(url).replace(/"/g, '&quot;');
        return `<figure style="margin:0">
  <img src="${src}" alt="${cap}" loading="lazy" style="width:100%;height:auto;display:block;object-fit:cover;border-radius:4px;vertical-align:middle" />
  <figcaption style="font-size:11px;color:#bbb;margin-top:8px;line-height:1.35">${cap}</figcaption>
</figure>`;
      })
      .join('');
  }
}

function updateStatText(container, text) {
  const textTarget = container.querySelector('.flex-col') || container;
  const existingSvg = textTarget.querySelector('svg');
  textTarget.innerHTML = '';
  if (existingSvg) textTarget.appendChild(existingSvg);
  textTarget.appendChild(document.createTextNode(text));
}

function initListingNav() {
  const menu = document.getElementById('site-nav-menu');
  const toggle = document.getElementById('site-nav-toggle');
  if (!menu || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('site-nav-open');
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  blockMarketingOverlays();
  initListingNav();
  initProperty();
});
