import { ProjectLevel, ProjectPillar, ProjectType } from '../types';
import { PROJECT_CATEGORIES_BY_TYPE } from '../config/constants';

export const PENDING_USE_TEMPLATE_KEY = 'jci_pending_use_template_id';

export interface RoadmapEventDetails {
  logoUrl: string;
  title: string;
  description: string;
  level: ProjectLevel | '';
  pillar: ProjectPillar | '';
  type: ProjectType | '';
  category: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStartTime: string;
  eventEndTime: string;
  proposedDate: string;
  priceMin?: number;
  priceMax?: number;
}

export const fetchRoadmapEventDetails = async (input: string): Promise<RoadmapEventDetails> => {
  let eventId = input.trim();
  if (eventId.includes('eventid=')) {
    const urlParams = new URLSearchParams(eventId.split('?')[1]);
    eventId = urlParams.get('eventid') || '';
  }
  if (!eventId) {
    throw new Error('Invalid Event ID or URL');
  }

  const targetUrl = `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${eventId}`;
  let html = '';
  let lastError = '';

  // Detect Capacitor native platform — no CORS restriction, direct fetch works
  const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();

  if (isNative) {
    // On native (APK), skip proxies and fetch directly — CORS does not apply
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        html = await response.text();
      } else {
        lastError = `Direct fetch returned status ${response.status}`;
      }
    } catch (err: any) {
      lastError = err.message || err;
    }
  } else {
    // Try 1: Netlify Function server-side proxy (avoids CORS proxy blocks)
    try {
      const response = await fetch(`/api/jci-proxy?eventid=${eventId}`);
      if (response.ok) {
        html = await response.text();
      } else {
        lastError = `Netlify proxy returned status ${response.status}`;
      }
    } catch (err: any) {
      lastError = err.message || err;
    }

    // Try 2: corsproxy.io
    if (!html) {
      try {
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        if (response.ok) {
          html = await response.text();
        } else {
          lastError = `corsproxy.io returned status ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message || err;
      }
    }

    // Try 3: AllOrigins JSON endpoint
    if (!html) {
      try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.contents) {
            html = data.contents;
          }
        } else {
          lastError = `AllOrigins returned status ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message || err;
      }
    }

    // Try 4: CodeTabs Proxy
    if (!html) {
      try {
        const response = await fetch(`https://api.codetabs.com/v1/proxy?target=${encodeURIComponent(targetUrl)}`);
        if (response.ok) {
          html = await response.text();
        } else {
          lastError = `CodeTabs returned status ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message || err;
      }
    }

    // Try 5: Direct fetch (fallback)
    if (!html) {
      try {
        const response = await fetch(targetUrl);
        if (response.ok) {
          html = await response.text();
        } else {
          lastError = `Direct fetch returned status ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message || err;
      }
    }
  }

  if (!html) {
    throw new Error(`Failed to fetch page. Please verify your internet connection or try again later. (Details: ${lastError || 'Proxy failed'})`);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Get Logo / Poster Url
  let logoUrl = '';
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage) {
    logoUrl = ogImage.trim();
  } else {
    const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    if (twitterImage) {
      logoUrl = twitterImage.trim();
    } else {
      const imgElement = doc.querySelector('.d-flex.align-items-center.justify-content-center img.product-img') || doc.querySelector('img.product-img');
      const src = imgElement?.getAttribute('src');
      if (src) {
        logoUrl = src.startsWith('http') ? src.trim() : `https://jcimalaysia.cc/roadmap/${src.trim()}`;
      }
    }
  }

  // 2. Get Title
  const title = doc.querySelector('.col-md-7 h3')?.textContent?.trim() ||
    doc.querySelector('h3')?.textContent?.trim() ||
    doc.querySelector('title')?.textContent?.split('|')[0].trim() || '';

  // 3. Get Description in Paragraph Format
  const cardTexts = Array.from(doc.querySelectorAll('.col-md-7 p.card-text, p.card-text'));
  const shortEl = cardTexts.find(el => !el.querySelector('.badge') && el.textContent?.trim() !== '');
  let shortDesc = '';
  if (shortEl) {
    let htmlContent = shortEl.innerHTML || '';
    htmlContent = htmlContent.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = parser.parseFromString(htmlContent, 'text/html');
    shortDesc = (tempDiv.body.textContent || '').trim();
  }

  const pb2Elements = Array.from(doc.querySelectorAll('.pb-2'));
  const longEl = pb2Elements.find(el => !el.querySelector('.badge') && el.textContent?.trim() !== '');
  let longDesc = '';
  if (longEl) {
    let htmlContent = longEl.innerHTML || '';
    htmlContent = htmlContent.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = parser.parseFromString(htmlContent, 'text/html');
    longDesc = (tempDiv.body.textContent || '').trim();
  }

  let rawDesc = '';
  if (shortDesc && longDesc) {
    if (longDesc.includes(shortDesc) || shortDesc.includes(longDesc)) {
      rawDesc = longDesc.length >= shortDesc.length ? longDesc : shortDesc;
    } else {
      rawDesc = shortDesc + '\n\n' + longDesc;
    }
  } else {
    rawDesc = shortDesc || longDesc || '';
  }

  const lines = rawDesc.split(/\r?\n/).map(line => line.trim());
  const formattedParagraphs: string[] = [];
  let currentParagraph = '';

  for (const line of lines) {
    if (line === '') {
      if (currentParagraph) {
        formattedParagraphs.push(currentParagraph);
        currentParagraph = '';
      }
    } else {
      // If it starts with a list bullet (e.g. ¢, -, *, 1.), make it a separate block
      const isListItem = /^[¢\-\*\d+\.]/.test(line);
      if (isListItem) {
        if (currentParagraph) {
          formattedParagraphs.push(currentParagraph);
        }
        formattedParagraphs.push(line);
        currentParagraph = '';
      } else {
        if (currentParagraph) {
          currentParagraph += ' ' + line;
        } else {
          currentParagraph = line;
        }
      }
    }
  }
  if (currentParagraph) {
    formattedParagraphs.push(currentParagraph);
  }
  const description = formattedParagraphs.join('\n\n');

  // 4. Parse Dates & Times
  const dateText = doc.querySelector('h6.text-success')?.textContent?.trim() || '';
  let eventStartDate = '';
  let eventEndDate = '';
  let eventStartTime = '';
  let eventEndTime = '';

  const parseRoadmapDate = (str: string) => {
    const cleaned = str.replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(' ');
    let day = '';
    let monthStr = '';
    let year = '';
    let time = '';
    let ampm = '';

    if (parts.length >= 3) {
      day = parts[0];
      monthStr = parts[1];
      year = parts[2];
    }
    if (parts.length >= 5) {
      time = parts[3];
      ampm = parts[4];
    }

    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mKey = monthStr.toLowerCase().slice(0, 3);
    const month = months[mKey] || '01';

    const formattedDay = day.padStart(2, '0');
    const formattedDate = (year && month && formattedDay) ? `${year}-${month}-${formattedDay}` : '';

    let formattedTime = '';
    if (time) {
      const [h, m] = time.split(':');
      let hour = parseInt(h, 10);
      const min = m || '00';
      if (ampm.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
      } else if (ampm.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
      formattedTime = `${hour.toString().padStart(2, '0')}:${min}`;
    }

    return { date: formattedDate, time: formattedTime };
  };

  if (dateText) {
    const parts = dateText.split(' - ');
    if (parts.length === 2) {
      const startParsed = parseRoadmapDate(parts[0]);
      const endParsed = parseRoadmapDate(parts[1]);
      eventStartDate = startParsed.date;
      eventStartTime = startParsed.time;
      eventEndDate = endParsed.date;
      eventEndTime = endParsed.time;
    } else {
      const parsed = parseRoadmapDate(dateText);
      eventStartDate = parsed.date;
      eventStartTime = parsed.time;
    }
  }

  // 5. Parse Level, Pillar, Type, Category from badges
  const badges = Array.from(doc.querySelectorAll('span.badge')).map(el => el.textContent?.trim() || '');
  let level: ProjectLevel | '' = '';
  let pillar: ProjectPillar | '' = '';
  let type: ProjectType | '' = '';
  let category = '';

  badges.forEach(badge => {
    const lower = badge.toLowerCase();

    if (lower === 'national') level = 'National';
    else if (lower === 'jci') level = 'JCI';
    else if (lower.includes('area')) level = 'Area';
    else if (lower.includes('local')) level = 'Local';

    if (lower === 'event') type = 'event';
    else if (lower === 'program') type = 'program';
    else if (lower === 'project') type = 'project';
    else if (lower.includes('skill')) type = 'skill_development';

    if (lower === 'individual') pillar = 'Individual';
    else if (lower === 'community') pillar = 'Community';
    else if (lower === 'business') pillar = 'Business';
    else if (lower === 'international') pillar = 'International';
    else if (lower === 'lom') pillar = 'LOM';
    else if (lower === 'chapter') pillar = 'Chapter';
  });

  const unmatchedBadges = badges.filter(badge => {
    const lower = badge.toLowerCase();
    const isLevel = lower === 'national' || lower === 'jci' || lower.includes('area') || lower.includes('local');
    const isType = lower === 'event' || lower === 'program' || lower === 'project' || lower.includes('skill');
    const isPillar = ['individual', 'community', 'business', 'international', 'lom', 'chapter'].includes(lower);
    return !isLevel && !isType && !isPillar;
  });
  const parsedCategory = unmatchedBadges.join(', ');

  // Match the matched category against allowed system category options
  if (type) {
    const allowedCategories = PROJECT_CATEGORIES_BY_TYPE[type] || [];
    const searchStr = `${parsedCategory} ${title}`.toLowerCase();
    const match = allowedCategories.find(c => {
      const cLower = c.toLowerCase();
      return searchStr.includes(cLower) || cLower.includes(parsedCategory.toLowerCase());
    });
    category = match || allowedCategories[0] || '';
  } else {
    category = parsedCategory;
  }

  // 6. Parse ticket prices from type_ticket radio options
  let priceMin: number | undefined;
  let priceMax: number | undefined;
  const ticketLabels = Array.from(doc.querySelectorAll('label.custom-option-item'));
  const ticketPrices: number[] = [];
  const myrPattern = /MYR\s*([\d,]+(?:\.\d{1,2})?)/i;
  ticketLabels.forEach(label => {
    const spans = Array.from(label.querySelectorAll('span.fw-bolder'));
    spans.forEach(span => {
      const text = span.textContent?.trim() || '';
      const m = text.match(myrPattern);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val >= 0) ticketPrices.push(val);
      }
    });
  });
  // Fallback: scan full text for MYR or RM amounts if no structured tickets found
  if (ticketPrices.length === 0) {
    const allText = doc.body?.textContent || '';
    const fallbackMatches = [...allText.matchAll(/(?:MYR|RM)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    fallbackMatches.forEach(m => {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 100000) ticketPrices.push(val);
    });
  }
  if (ticketPrices.length > 0) {
    priceMin = Math.min(...ticketPrices);
    priceMax = Math.max(...ticketPrices);
    if (priceMin === priceMax) priceMax = undefined;
  }

  return {
    logoUrl,
    title,
    description,
    level,
    pillar,
    type,
    category,
    eventStartDate,
    eventEndDate,
    eventStartTime,
    eventEndTime,
    proposedDate: eventStartDate,
    priceMin,
    priceMax,
  };
};
