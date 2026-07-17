import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED, ConfirmState } from '../ui/Common';
import { Input } from '../ui/Form';
import { MembersService } from '../../services/membersService';
import { PointsService } from '../../services/pointsService';
import { SponsorshipsService } from '../../services/sponsorshipService';
import { Member, SponsorshipRecord, RadarPointsConfig, MemberTier } from '../../types';
import { db } from '../../config/firebase';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, getDocs, query, where, orderBy, limit, startAfter, deleteDoc } from 'firebase/firestore';
// import { RadarEventManager } from './RadarEventManager';
import { LedgerTable } from '../ui/LedgerTable';

const defaultMappingStr = `type\tcategory_id\tparent_category\tcategory_name\tscore
project\t16\tProject Pillars\tCommunity\t5
project\t17\tProject Pillars\tBusiness\t5
project\t18\tProject Pillars\tInternational\t5
project\t19\tProject Pillars\tPersonal\t5
program\t1\tJCI Malaysia Official Programs\tTOYM\t10
program\t2\tJCI Malaysia Official Programs\tCYEA\t10
program\t3\tJCI Malaysia Official Programs\tSDA\t10
program\t4\tJCI Malaysia Official Programs\tCYE\t10
program\t27\tJCI Malaysia Official Programs\tBCP (Business Connect Program)\t5
program\t28\tJCI Malaysia Official Programs\tBSP (Business School Program)\t5
program\t30\tJCI Malaysia Official Programs\tR&R\t3
program\t32\tJCI Malaysia Official Programs\tBSP (Business Supercharge Program)\t5
program\t38\tJCI Malaysia Official Programs\tZero Waste Campaign\t10
program\t39\tJCI Malaysia Official Programs\tLeaders School Program\t5
program\t40\tJCI Malaysia Official Programs\tJIB (JCI In Business)\t3
skill_development\t1\tJCI Foundational Courses\tJCI Discover\t5
skill_development\t2\tJCI Foundational Courses\tJCI Explore\t5
skill_development\t3\tJCI Leadership Courses\tEffective Communications - Building a Foundation\t3
skill_development\t5\tJCI Leadership Courses\tEffective Communications - Crafting Your Message\t3
skill_development\t6\tJCI Leadership Courses\tEffective Communications - Mastering Management\t3
skill_development\t7\tJCI Leadership Courses\tEffective Communications - Message Delivery\t3
skill_development\t8\tJCI Leadership Courses\tEffective Leadership\t3
skill_development\t9\tJCI Leadership Courses\tEffective Meetings\t3
skill_development\t10\tJCI Leadership Courses\tEngage, Empower, Grow\t3
skill_development\t11\tJCI Leadership Courses\tNetworking\t3
skill_development\t12\tJCI Leadership Courses\tProject Management\t5
skill_development\t13\tJCI Leadership Courses\tSocial Responsibility\t3
skill_development\t14\tJCI Advanced Courses\tFacilitator\t5
skill_development\t15\tJCI Advanced Courses\tJCI Presenter\t5
skill_development\t16\tJCIM Training\tJCIM Leadership Summit\t5
skill_development\t17\tJCIM Courses\tJCIM Inspire\t5
skill_development\t18\tJCIM Courses\tJCIM Empower\t5
skill_development\t19\tJCIM Courses\tJCIM Train The Trainer 1\t10
skill_development\t20\tJCIM Courses\tJCIM Train The Trainer 2\t10
skill_development\t21\tJCIM Courses\tJCIM Competent Trainer Academy\t10
skill_development\t22\tJCIM Training\tJCIM Trainer Arena\t5
skill_development\t23\tJCIM Training\tJCIM National Academy\t10
skill_development\t24\tJCIM Training\tArea Academy\t10
skill_development\t25\tJCIM Training\tLocal Academy\t10
skill_development\t26\tJCIM Other Courses & Training\tJCIM Other Courses & Training\t3
skill_development\t27\tJCIM Training\tRecruitment & Retention Workshop\t3
skill_development\t28\tJCI Other Courses & Training\tJCI Other Courses & Training\t3
skill_development\t29\tJCIM Training\tParliamentary Procedure\t3
skill_development\t30\tJCIM Training\tPublic Speaking\t3
skill_development\t31\tJCIM Training\tDebate\t3
event\t5\tConvention & Conference\tArea Convention\t10
event\t6\tConvention & Conference\tNational Convention\t15
event\t7\tConvention & Conference\tJCI Area Conference (Asia-Pacific)\t20
event\t8\tConvention & Conference\tOther Convention\t10
event\t9\tGathering & Ceremony\tInstallation Ceremony\t5
event\t10\tGathering & Ceremony\tAnniversary Ceremony\t5
event\t11\tGathering & Ceremony\tGala Dinner & Gathering\t5
event\t12\tGathering & Ceremony\tGeneral Member Meeting\t2
event\t13\tOther Event\tPartnership Summit\t10
event\t14\tOther Event\tEntertainments, Concerts & Shows\t10
event\t15\tOther Event\tExhibitions, Fairs & Expo\t10
event\t20\tOther Event\tOther Event\t10
event\t22\tAward Event\tNomination\t3
event\t23\tAward Event\tPress Conference\t3
event\t24\tAward Event\tInterview Session\t3
event\t25\tAward Event\tAnnouncement Of Finalist\t3
event\t26\tOther Event\tMeeting\t3
event\t29\tConvention & Conference\tJCI World Congress\t25
event\t33\tOther Event\tWorkshop\t3
event\t34\tOther Event\tBusiness Networking\t3
event\t36\tConvention & Conference\tJCI Asia-Pacific Senate Golf\t10
event\t37\tOther Event\tVisitation\t3
event\t41\tOther Event\tLinguistic Competitions\t10
event\t42\tConvention & Conference\tSenate Conference\t15`;

export const RadarDataImporter: React.FC = () => {
  const [viewMode, setViewMode] = useState<'import' | 'ledger' | 'sponsorships' | 'config' | 'scores'>('import');
  const [pastedData, setPastedData] = useState(Array(10).fill('\t\t\t\t\t\t\t\t').join('\n'));
  const [mappingFunctionStr, setMappingFunctionStr] = useState(defaultMappingStr);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'missing' | 'ignored'>('all');

  const handleImportCellChange = (rIdx: number, cIdx: number, val: string) => {
    const lines = pastedData.split('\n');
    const cols = (lines[rIdx] || '').split('\t');
    while (cols.length <= cIdx) cols.push('');
    cols[cIdx] = val;
    lines[rIdx] = cols.join('\t');
    setPastedData(lines.join('\n'));
  };

  const handleGridPaste = (e: React.ClipboardEvent<HTMLInputElement>, rIdx: number, cIdx: number) => {
    e.preventDefault(); // Always intercept paste on the grid to handle correctly
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const lines = pastedData.split('\n');
    const pastedLines = text.split(/\r?\n/);

    pastedLines.forEach((pLine, i) => {
      if (!pLine.trim() && i === pastedLines.length - 1) return;

      const targetRIdx = rIdx + i;
      while (lines.length <= targetRIdx) lines.push('\t\t\t\t\t\t\t\t');

      const cols = lines[targetRIdx].split('\t');
      while (cols.length < 9) cols.push('');

      const pCols = pLine.split('\t');
      pCols.forEach((pCol, j) => {
        const targetCIdx = cIdx + j;
        if (targetCIdx < 9) {
          cols[targetCIdx] = pCol.trim();
        }
      });

      lines[targetRIdx] = cols.join('\t');
    });

    setPastedData(lines.join('\n'));
  };

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const ms = await MembersService.getAllMembers();
      setMembers(ms);

      try {
        const docRef = doc(db, 'system', 'radar_mappings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().tsvStr) {
          setMappingFunctionStr(docSnap.data().tsvStr);
        }
      } catch (e) {
        console.error('Failed to fetch mapping rules:', e);
      }
    };
    fetchInitialData();
  }, []);

  // Mapping rules are now edited under the Config tab

  const resolveEventMapping = (generalType: string, catIdStr: string) => {
    try {
      const lines = mappingFunctionStr.trim().split('\n');
      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());

      const typeIdx = headers.indexOf('type');
      const catIdIdx = headers.indexOf('category_id');
      const parentCatIdx = headers.indexOf('parent_category');
      const catNameIdx = headers.indexOf('category_name');
      const scoreIdx = headers.indexOf('score');

      if (typeIdx === -1 || catIdIdx === -1) return null;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split('\t').map(c => c.trim());

        if (cols[typeIdx]?.toLowerCase() === generalType?.toLowerCase() && cols[catIdIdx] === catIdStr) {
          return {
            type: cols[typeIdx],
            category_id: cols[catIdIdx],
            parent_category: parentCatIdx !== -1 ? cols[parentCatIdx] : '',
            category_name: catNameIdx !== -1 ? cols[catNameIdx] : '',
            score: scoreIdx !== -1 ? parseFloat(cols[scoreIdx]) : undefined
          };
        }
      }
      return null;
    } catch (e) {
      console.error('Error parsing mapping table:', e);
      return null;
    }
  };

  const resolveEventMappingByCatId = (catIdStr: string) => {
    try {
      const lines = mappingFunctionStr.trim().split('\n');
      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());

      const typeIdx = headers.indexOf('type');
      const catIdIdx = headers.indexOf('category_id');
      const parentCatIdx = headers.indexOf('parent_category');
      const catNameIdx = headers.indexOf('category_name');
      const scoreIdx = headers.indexOf('score');

      if (catIdIdx === -1) return null;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split('\t').map(c => c.trim());

        if (cols[catIdIdx] === catIdStr) {
          return {
            type: typeIdx !== -1 ? cols[typeIdx] : '',
            category_id: cols[catIdIdx],
            parent_category: parentCatIdx !== -1 ? cols[parentCatIdx] : '',
            category_name: catNameIdx !== -1 ? cols[catNameIdx] : '',
            score: scoreIdx !== -1 ? parseFloat(cols[scoreIdx]) : undefined
          };
        }
      }
    } catch (e) {
      console.error('Error parsing mapping table by Cat ID:', e);
    }
    return null;
  };

  const handleParse = () => {
    const lines = pastedData.split('\n');
    const rows = lines.map((line, index) => {
      if (!line.replace(/\t/g, '').trim()) {
        return null;
      }

      const cols = line.split('\t').map(c => c.trim());
      let rawName = cols[0] || '';
      let category = cols[1] || '';
      let value = cols[2] || '';
      let resolvedType = '';
      let parent_category = '';
      let mappedScore: number | undefined = undefined;
      let eventYear = new Date().getFullYear().toString();
      let eventDate = '';
      let eventTitle = '';

      // 9-column input: URL | Event Title | Hosting LO | Registrant Name | Mobile / Phone | Chapter / LO | Event Date | Type | Cat
      let hostingLO = '';
      let chapterLO = '';
      if (cols.length >= 9) {
        const chapter = cols[5];
        if (chapter && !chapter.toLowerCase().includes('kuala lumpur')) {
          return { id: index, isIgnored: true };
        }

        hostingLO = cols[2]?.trim() || '';
        chapterLO = cols[5]?.trim() || '';
        eventTitle = cols[1]?.trim() || '';
        rawName = cols[3];
        const rawDate = cols[6]?.trim() || '';
        if (rawDate) {
          const match = rawDate.match(/\b(20\d{2})\b/);
          if (match) eventYear = match[1];

          // Format Event Date to "dd MMM yyyy"
          const parts = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          let d: Date;
          if (parts) {
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1;
            const year = parseInt(parts[3], 10);
            d = new Date(year, month, day);
          } else {
            d = new Date(rawDate);
          }
          if (!isNaN(d.getTime())) {
            eventDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          } else {
            eventDate = rawDate;
          }
        }
        const typeVal = cols[7]?.trim();
        const catId = cols[8]?.trim();
        value = '1';

        const mapping = resolveEventMapping(typeVal, catId) || resolveEventMappingByCatId(catId);
        if (mapping) {
          category = mapping.category_name;
          parent_category = mapping.parent_category;
          resolvedType = mapping.type;
          mappedScore = mapping.score;
        } else {
          category = `Cat ID: ${catId}`;
          resolvedType = typeVal || 'event';
        }
      }
      // Fallback 4-column mapping: Name | generalType | catId | Value
      else if (cols.length >= 4) {
        rawName = cols[0];
        const generalType = cols[1];
        const catId = cols[2];
        value = cols[3];

        const mapping = resolveEventMapping(generalType, catId);
        if (mapping) {
          category = mapping.category_name;
          parent_category = mapping.parent_category;
          resolvedType = mapping.type;
          mappedScore = mapping.score;
        } else {
          category = `${generalType} (${catId})`;
          resolvedType = generalType;
        }
      }

      // Fuzzy match member
      const matchedMember = members.find(m =>
        (m.general?.name || '').toLowerCase() === rawName.toLowerCase() ||
        (m.name || '').toLowerCase() === rawName.toLowerCase() ||
        (m.chiName || '') === rawName
      );

      return {
        id: index,
        rawName,
        category,
        parent_category,
        resolvedType,
        mappedScore,
        value,
        eventYear,
        eventDate,
        eventTitle,
        hostingLO,
        chapterLO,
        matchedMemberId: matchedMember ? matchedMember.id : '',
        matchedMemberName: matchedMember ? (matchedMember.general?.name || matchedMember.name) : 'Unmatched',
      };
    });

    setParsedRows(rows);
  };

  useEffect(() => {
    handleParse();
  }, [pastedData, mappingFunctionStr, members]);

  const handleMemberChange = (rowId: number, memberId: string) => {
    const matched = members.find(m => m.id === memberId);
    setParsedRows(prev => prev.map(r => r.id === rowId ? {
      ...r,
      matchedMemberId: memberId,
      matchedMemberName: matched ? (matched.general?.name || matched.name) : 'Unmatched'
    } : r));
  };

  const calculatePoints = (category: string, value: string, mappedScore?: number): number => {
    const val = parseFloat(value) || 0;

    // If mapping provided a custom score logic (e.g. Points per Value)
    if (mappedScore !== undefined && !isNaN(mappedScore)) {
      return val * mappedScore;
    }

    const lowerCat = category.toLowerCase();

    if (lowerCat.includes('training')) {
      // 1 hour = 5 points
      return val * 5;
    }
    if (lowerCat.includes('leadership')) {
      // String value like 'Project Committee' or 'VP'
      if (value.toLowerCase().includes('vp') || value.toLowerCase().includes('vice president')) return 100;
      if (value.toLowerCase().includes('director')) return 50;
      if (value.toLowerCase().includes('committee')) return 20;
      return 10; // default leadership points
    }
    if (lowerCat.includes('event')) {
      // 1 attendance = 10 points
      return val * 10;
    }
    if (lowerCat.includes('recruitment')) {
      // 1 pax = 30 points
      return val * 30;
    }
    if (lowerCat.includes('sponsorship')) {
      // Every 100 amount = 2 points
      return Math.floor(val / 100) * 2;
    }
    return 0;
  };

  const getRadarKey = (category: string, resolvedType?: string): string => {
    // According to the new logic, ALL imported contributions are strictly assigned to 'events'.
    // The admin will then use the Event Roles Manager to promote specific members to Leadership, Training, etc.
    return 'events';
  };

  const commitData = async () => {
    const validRows = parsedRows.filter(r => r && !r.isIgnored && r.matchedMemberId && getRadarKey(r.category, r.resolvedType));
    if (validRows.length === 0) {
      setFeedback('No valid rows to commit. Make sure members are matched and categories are correct.');
      return;
    }

    setCommitting(true);
    setFeedback(null);
    let successCount = 0;

    try {
      // Group by member to batch updates
      const memberUpdates: Record<string, { total: Record<string, number>, byYear: Record<string, Record<string, number>> }> = {};
      const memberCache: Record<string, any[]> = {}; // Cache existing logs to check duplicates
      let skippedCount = 0;

      for (const row of validRows) {
        const points = calculatePoints(row.category, row.value, row.mappedScore);
        const radarKey = getRadarKey(row.category, row.resolvedType);
        const year = row.eventYear || new Date().getFullYear().toString();
        const finalEventTitle = row.eventTitle || row.category;

        if (!radarKey) continue;

        // 1. Check for duplicates
        if (!memberCache[row.matchedMemberId]) {
          const q = query(collection(db, 'RadarContributions'), where('memberId', '==', row.matchedMemberId));
          const snap = await getDocs(q);
          memberCache[row.matchedMemberId] = snap.docs.map(d => d.data());
        }

        const isDuplicate = memberCache[row.matchedMemberId].some(d =>
          d.eventTitle === finalEventTitle &&
          (d.eventDate || '') === (row.eventDate || '')
        );

        if (isDuplicate) {
          skippedCount++;
          continue; // Skip duplicate record
        }

        // Add to cache to prevent duplicates within the same batch
        memberCache[row.matchedMemberId].push({
          eventTitle: finalEventTitle,
          eventDate: row.eventDate || '',
          radarKey
        });

        // 2. Add ledger record
        await addDoc(collection(db, 'RadarContributions'), {
          memberId: row.matchedMemberId,
          memberName: row.matchedMemberName,
          rawCategory: row.category,
          eventTitle: finalEventTitle,
          radarKey,
          rawValue: row.value,
          points,
          year,
          eventDate: row.eventDate || '',
          hostingLO: row.hostingLO || '',
          chapterLO: row.chapterLO || '',
          createdAt: new Date().toISOString(),
          source: 'Bulk Import'
        });

        // 2. Aggregate member updates locally
        if (!memberUpdates[row.matchedMemberId]) {
          memberUpdates[row.matchedMemberId] = { total: {}, byYear: {} };
        }
        memberUpdates[row.matchedMemberId].total[radarKey] = (memberUpdates[row.matchedMemberId].total[radarKey] || 0) + points;

        if (!memberUpdates[row.matchedMemberId].byYear[year]) {
          memberUpdates[row.matchedMemberId].byYear[year] = {};
        }
        memberUpdates[row.matchedMemberId].byYear[year][radarKey] = (memberUpdates[row.matchedMemberId].byYear[year][radarKey] || 0) + points;

        successCount++;
      }

      // Recalculate member radar stats using centralized PointsService
      for (const memberId of Object.keys(memberUpdates)) {
        await PointsService.recalculateMemberRadarStats(memberId);
      }
      setViewMode('ledger');
      setFeedback(`Successfully imported ${successCount} records. ${skippedCount > 0 ? `Skipped ${skippedCount} duplicate records.` : ''}`);
      setParsedRows([]);
      setPastedData('');
    } catch (err: any) {
      console.error(err);
      setFeedback('Error committing data: ' + err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="p-6  mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Radar Contribution System</h1>
          <p className="text-sm text-slate-500 mt-1">Import tabular data or manage existing contribution records.</p>
        </div>
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl ring-1 ring-slate-200/50 flex-wrap gap-1">
          <Button
            onClick={() => setViewMode('import')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'import' ? 'bg-gradient-to-r from-jci-blue to-blue-600 text-white shadow-md' : 'text-black hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Data Importer
          </Button>
          <Button
            onClick={() => setViewMode('ledger')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'ledger' ? 'bg-gradient-to-r from-jci-blue to-blue-600 text-white shadow-md' : 'text-black hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Contribution Ledger
          </Button>
          <Button
            onClick={() => setViewMode('scores')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'scores' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-black hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Member Scores
          </Button>
          <Button
            onClick={() => setViewMode('sponsorships')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'sponsorships' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' : 'text-black hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Sponsorships
          </Button>
          <Button
            onClick={() => setViewMode('config')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'config' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-black hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Points Config
          </Button>
        </div>
      </div>

      {viewMode === 'ledger' ? (
        <RadarLedgerView />
      ) : viewMode === 'sponsorships' ? (
        <RadarSponsorshipManager members={members} />
      ) : viewMode === 'config' ? (
        <RadarPointsConfigManager
          members={members}
          mappingFunctionStr={mappingFunctionStr}
          setMappingFunctionStr={setMappingFunctionStr}
        />
      ) : viewMode === 'scores' ? (
        <RadarMemberScoresView members={members} setMembers={setMembers} />
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-jci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Import Contribution Data
                </h3>
                <p className="text-sm text-slate-500 mt-1">Paste directly from Excel to auto-fill. Invalid records are greyed out.</p>
              </div>
            </div>

            {/* Mapping editor moved to Config tab */}

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-slate-200 rounded-2xl shadow-md bg-white">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th colSpan={9} className="py-3 px-4 font-black text-slate-700 bg-slate-100 border-b border-r border-slate-300 text-center uppercase tracking-widest text-[11px]">Raw Input (Editable)</th>
                    <th colSpan={4} className="py-3 px-4 font-black text-white bg-gradient-to-r from-jci-blue to-blue-600 border-b border-blue-400 text-center uppercase tracking-widest text-[11px] shadow-inner">Live Mapping Output</th>
                  </tr>
                  <tr>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">URL</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Event Title</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Hosting LO</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Registrant Name</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Mobile / Phone</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Chapter / LO</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Event Date</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Type</th>
                    <th className="py-2 px-3 font-bold text-slate-600 bg-slate-50 border-b border-r border-slate-300">Cat</th>
                    <th className="py-2 px-3 font-medium text-slate-100 bg-slate-800 border-b border-slate-700">Parent Category</th>
                    <th className="py-2 px-3 font-medium text-slate-100 bg-slate-800 border-b border-slate-700">Category Name</th>
                    <th className="py-2 px-3 font-medium text-slate-100 bg-slate-800 border-b border-slate-700">Score</th>
                    <th className="py-2 px-3 font-medium text-slate-100 bg-slate-800 border-b border-slate-700">Member</th>
                  </tr>
                </thead>
                <tbody>
                  {pastedData.split('\n').map((line, rIdx) => {
                    const cols = line.split('\t');
                    while (cols.length < 9) cols.push('');
                    const parsed = parsedRows[rIdx] || {};

                    const isLineEmpty = !line.replace(/\t/g, '').trim();
                    const isIgnored = parsed.isIgnored;
                    const isValid = !isIgnored && parsed.matchedMemberId && getRadarKey(parsed.category, parsed.resolvedType);
                    const isMissing = !isLineEmpty && !isIgnored && !isValid;

                    if (!isLineEmpty) {
                      if (filterMode === 'valid' && !isValid) return null;
                      if (filterMode === 'missing' && !isMissing) return null;
                      if (filterMode === 'ignored' && !isIgnored) return null;
                    } else if (filterMode !== 'all') {
                      return null; // hide empty rows when filtering
                    }

                    return (
                      <tr key={rIdx} className={`border-b border-slate-200 ${parsed.isIgnored ? 'opacity-40 bg-slate-50' : 'hover:bg-blue-50/30'}`}>
                        {cols.map((col, cIdx) => (
                          <td key={cIdx} className={`p-0 border-r border-slate-200 ${cIdx === 8 ? 'border-r-slate-300' : ''}`}>
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => handleImportCellChange(rIdx, cIdx, e.target.value)}
                              onPaste={(e) => handleGridPaste(e, rIdx, cIdx)}
                              className="w-full bg-transparent px-3 py-2 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-jci-blue"
                              placeholder={`Col ${cIdx + 1}`}
                            />
                          </td>
                        ))}

                        {parsed.isIgnored ? (
                          <td colSpan={4} className="p-3 text-center italic text-slate-500 font-medium bg-slate-50">Ignored (Not JCI Kuala Lumpur)</td>
                        ) : (
                          <>
                            <td className="p-2 border-r border-slate-100 text-slate-500 text-[10px] bg-slate-50">{parsed.parent_category}</td>
                            <td className="p-2 border-r border-slate-100 text-slate-900 font-medium bg-slate-50">{parsed.category}</td>
                            <td className="p-2 border-r border-slate-100 bg-slate-50">
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                {calculatePoints(parsed.category || '', parsed.value || '', parsed.mappedScore)} pts
                              </span>
                            </td>
                            <td className="p-2 bg-slate-50 min-w-[150px]">
                              <select
                                value={parsed.matchedMemberId || ''}
                                onChange={(e) => handleMemberChange(rIdx, e.target.value)}
                                className={`border rounded p-1 w-full text-xs ${parsed.matchedMemberId ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}
                              >
                                <option value="">-- Select --</option>
                                {members.map(m => (
                                  <option key={m.id} value={m.id}>{m.general?.name || m.name}</option>
                                ))}
                              </select>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>


          {/* Summary Stats and Commit Button */}
          {(() => {
            const dataLines = pastedData.split('\n').filter(line => line.replace(/\t/g, '').trim().length > 0);
            const totalDataRows = dataLines.length;
            if (totalDataRows === 0) return null;

            const ignoredCount = parsedRows.filter(r => r && r.isIgnored).length;
            const validCount = parsedRows.filter(r => r && !r.isIgnored && r.matchedMemberId && getRadarKey(r.category, r.resolvedType)).length;
            const errorCount = totalDataRows - ignoredCount - validCount;

            return (
              <div className="mt-8 flex flex-col xl:flex-row items-center justify-between bg-white border border-slate-200 rounded-2xl p-2 pl-4 shadow-lg ring-1 ring-slate-900/5">
                <div className="flex flex-wrap justify-center items-center gap-1 mb-4 xl:mb-0">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 hidden md:block">Filter:</span>
                  <button onClick={() => setFilterMode('all')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${filterMode === 'all' ? 'bg-slate-800 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`}>
                    <div className="text-left">
                      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-80`}>Total</p>
                      <p className="text-xl font-black leading-none mt-0.5">{totalDataRows}</p>
                    </div>
                  </button>
                  <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />
                  <button onClick={() => setFilterMode('valid')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${filterMode === 'valid' ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-emerald-50 text-emerald-600'}`}>
                    <div className="text-left">
                      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-80`}>Ready</p>
                      <p className="text-xl font-black leading-none mt-0.5">{validCount}</p>
                    </div>
                  </button>
                  <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />
                  <button onClick={() => setFilterMode('missing')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${filterMode === 'missing' ? 'bg-amber-500 text-white shadow-md' : 'hover:bg-amber-50 text-amber-600'}`}>
                    <div className="text-left">
                      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-80`}>Missing</p>
                      <p className="text-xl font-black leading-none mt-0.5">{errorCount}</p>
                    </div>
                  </button>
                  <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />
                  <button onClick={() => setFilterMode('ignored')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${filterMode === 'ignored' ? 'bg-slate-400 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}>
                    <div className="text-left">
                      <p className={`text-[10px] font-bold uppercase tracking-wider opacity-80`}>Ignored</p>
                      <p className="text-xl font-black leading-none mt-0.5">{ignoredCount}</p>
                    </div>
                  </button>
                </div>
                <Button
                  onClick={commitData}
                  disabled={committing || validCount === 0}
                  className={`w-full xl:w-auto px-8 py-4 xl:ml-4 rounded-xl text-lg font-black transition-all ${validCount > 0 ? 'bg-gradient-to-r from-jci-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
                >
                  {committing ? 'Committing...' : `Commit ${validCount} Records`}
                </Button>
              </div>
            );
          })()}

          {feedback && (
            <div className={`p-4 rounded-xl font-bold ${feedback.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {feedback}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const RadarLedgerView = () => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let q;
      if (isLoadMore && lastDoc) {
        q = query(collection(db, 'RadarContributions'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(100));
      } else {
        q = query(collection(db, 'RadarContributions'), orderBy('createdAt', 'desc'), limit(100));
      }
      const snap = await getDocs(q);
      const newLogs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      if (isLoadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }

      if (snap.docs.length < 100) {
        setHasMore(false);
      } else {
        setHasMore(true);
        setLastDoc(snap.docs[snap.docs.length - 1]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleSelect = (logId: string) => {
    const next = new Set(selectedLogs);
    if (next.has(logId)) next.delete(logId);
    else next.add(logId);
    setSelectedLogs(next);
  };

  const toggleSelectAll = () => {
    if (selectedLogs.size === logs.length) setSelectedLogs(new Set());
    else setSelectedLogs(new Set(logs.map(l => l.id)));
  };

  const handleBatchDelete = () => {
    if (selectedLogs.size === 0) return;
    setConfirmState({
      open: true,
      title: 'Delete Selected Records',
      message: `Are you sure you want to revert and delete ${selectedLogs.size} selected records?\n\nThis will deduct points from the members' radar stats.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        await _doBatchDelete();
      },
    });
  };

  const _doBatchDelete = async () => {
    setDeleting(true);
    try {
      const logsToDelete = logs.filter(l => selectedLogs.has(l.id));

      // Group deductions by member to batch updates
      const memberDeductions: Record<string, { total: Record<string, number>, byYear: Record<string, Record<string, number>> }> = {};
      for (const log of logsToDelete) {
        if (!memberDeductions[log.memberId]) memberDeductions[log.memberId] = { total: {}, byYear: {} };
        memberDeductions[log.memberId].total[log.radarKey] = (memberDeductions[log.memberId].total[log.radarKey] || 0) + log.points;

        if (log.year) {
          if (!memberDeductions[log.memberId].byYear[log.year]) memberDeductions[log.memberId].byYear[log.year] = {};
          memberDeductions[log.memberId].byYear[log.year][log.radarKey] = (memberDeductions[log.memberId].byYear[log.year][log.radarKey] || 0) + log.points;
        }
      }

      // Recalculate member radar stats using centralized PointsService
      for (const memberId of Object.keys(memberDeductions)) {
        await PointsService.recalculateMemberRadarStats(memberId);
      }

      // Process ledger record deletions
      for (const log of logsToDelete) {
        await deleteDoc(doc(db, 'RadarContributions', log.id));
      }

      setSelectedLogs(new Set());
      fetchLogs();
    } catch (e) {
      alert('Error during batch deletion: ' + e);
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = (logId: string, memberId: string, radarKey: string, points: number, year?: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Record',
      message: `Are you sure you want to delete this record?\n\nThis will deduct ${points} points from the member's ${radarKey} radar.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        try {
          await deleteDoc(doc(db, 'RadarContributions', logId));
          await PointsService.recalculateMemberRadarStats(memberId);
          fetchLogs();
        } catch (e) {
          alert('Error deleting record: ' + e);
        }
      },
    });
  };

  if (loading) return <Card><div className="p-8 text-center text-slate-500 font-bold">Loading Ledger...</div></Card>;

  const processedLogs = logs.map(log => ({
    ...log,
    eventTitle: log.eventTitle || log.rawCategory || 'Unknown Event'
  }));

  return (
    <>
      <LedgerTable
        logs={processedLogs}
        selectedLogs={selectedLogs}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onDelete={(log) => handleDelete(log.id, log.memberId, log.radarKey, log.points, log.year ? String(log.year) : undefined)}
        onBatchDelete={handleBatchDelete}
        deleting={deleting}
        hasMore={hasMore}
        onLoadMore={() => fetchLogs(true)}
        loadingMore={loadingMore}
      />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </>
  );
};

// ─── Sponsorship Management Tab ─────────────────────────────────────────────
const RadarSponsorshipManager: React.FC<{ members: Member[] }> = ({ members }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [sponsorships, setSponsorships] = useState<SponsorshipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SponsorshipRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadSponsorships = async () => {
    setLoading(true);
    try {
      const list = await SponsorshipsService.getAllSponsorships();
      setSponsorships(list);
    } catch (e) {
      console.error(e);
      showToast('Failed to load sponsorships', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSponsorships(); }, []);

  const openAddModal = () => {
    setEditingRecord(null);
    setSelectedMemberId('');
    setSponsorName('');
    setAmount(0);
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (record: SponsorshipRecord) => {
    setEditingRecord(record);
    setSelectedMemberId(record.memberId);
    setSponsorName(record.sponsorName);
    setAmount(record.amount);
    setDate(record.date);
    setDescription(record.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !sponsorName || amount <= 0 || !date) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    setSubmitting(true);
    const matchedMember = members.find(m => m.id === selectedMemberId);
    const memberName = matchedMember ? (matchedMember.fullName || matchedMember.general?.name || matchedMember.name || '') : '';

    const payload = { memberId: selectedMemberId, memberName, sponsorName, amount, date, description };

    try {
      if (editingRecord) {
        await SponsorshipsService.updateSponsorship(editingRecord.id, payload, editingRecord.memberId);
        showToast('Sponsorship updated', 'success');
      } else {
        await SponsorshipsService.createSponsorship(payload);
        showToast('Sponsorship created', 'success');
      }
      setIsModalOpen(false);
      loadSponsorships();
    } catch (err) {
      console.error(err);
      showToast('Failed to save sponsorship', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: SponsorshipRecord) => {
    setConfirmState({
      open: true,
      title: 'Delete Sponsorship',
      message: `Delete sponsorship from "${record.sponsorName}"?\n\nThis will deduct points from the member.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        try {
          await SponsorshipsService.deleteSponsorship(record.id, record.memberId);
          showToast('Sponsorship deleted', 'success');
          loadSponsorships();
        } catch (err) {
          console.error(err);
          showToast('Failed to delete sponsorship', 'error');
        }
      },
    });
  };

  const filtered = sponsorships.filter(s => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return s.sponsorName.toLowerCase().includes(t)
      || (s.memberName || '').toLowerCase().includes(t)
      || (s.description || '').toLowerCase().includes(t);
  });

  const totalAmount = filtered.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by sponsor, member, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue transition-all"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
            <span className="text-xs font-bold text-emerald-600 uppercase">Total</span>
            <span className="font-black text-emerald-700">RM {totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <Button onClick={openAddModal} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold px-5 py-2.5 shadow-md hover:shadow-lg transition-all">
          + New Sponsorship
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="py-3 px-4 font-bold text-slate-600 border-b">Date</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b">Sponsor Name</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b">Secured By</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b text-right">Amount (RM)</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b">Description</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b text-center">Est. Points</th>
                <th className="py-3 px-4 font-bold text-slate-600 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500 font-bold">Loading sponsorships...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No sponsorship records found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 text-slate-500">{s.date}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-800">{s.sponsorName}</td>
                  <td className="py-2.5 px-4 text-slate-700">{s.memberName || 'Unknown'}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">RM {s.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]" title={s.description}>{s.description || '—'}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                      +{Math.floor(s.amount / 100) * 2} pts
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(s)} className="text-jci-blue hover:bg-blue-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">Edit</button>
                      <button onClick={() => handleDelete(s)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRecord ? 'Edit Sponsorship' : 'New Sponsorship Record'}>
          <form onSubmit={handleSave} className="space-y-4 p-1">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Secured By Member <span className="text-red-400">*</span></label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue bg-white transition-all"
                required
              >
                <option value="">— Select Member —</option>
                {members
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.fullName || m.general?.name || m.name || m.email || m.id}</option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Sponsor / Company Name <span className="text-red-400">*</span></label>
              <input type="text" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue/30" required placeholder="e.g. Tech Corp Sdn Bhd" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Amount (RM) <span className="text-red-400">*</span></label>
                <input type="number" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue/30" min="0.01" step="0.01" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Date <span className="text-red-400">*</span></label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            {amount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-amber-600 text-lg font-black">⚡</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">Estimated Radar Points</p>
                  <p className="text-sm text-amber-700">RM {amount.toFixed(0)} → <strong>{Math.floor(amount / 100) * 2} points</strong> (2 pts per RM 100)</p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue/30" rows={3} placeholder="Optional notes about the sponsorship..." />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border border-slate-200 text-slate-600 font-bold px-5 py-2 rounded-xl hover:bg-slate-50 transition-all">Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold px-6 py-2 rounded-xl shadow-md hover:shadow-lg transition-all">
                {submitting ? 'Saving...' : editingRecord ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};

interface RadarPointsConfigManagerProps {
  members: Member[];
  mappingFunctionStr: string;
  setMappingFunctionStr: React.Dispatch<React.SetStateAction<string>>;
}

const RadarPointsConfigManager: React.FC<RadarPointsConfigManagerProps> = ({
  members,
  mappingFunctionStr,
  setMappingFunctionStr
}) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [config, setConfig] = useState<RadarPointsConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0 });
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    PointsService.getRadarPointsConfig()
      .then(data => setConfig(data))
      .catch(e => { console.error(e); showToast('Failed to load config', 'error'); })
      .finally(() => setLoading(false));
  }, []);

  const handleMappingCellChange = (rIdx: number, cIdx: number, val: string) => {
    const lines = mappingFunctionStr.split('\n');
    const lineIndex = rIdx + 1; // Account for header row
    if (lineIndex < lines.length) {
      const cols = lines[lineIndex].split('\t');
      cols[cIdx] = val;
      lines[lineIndex] = cols.join('\t');
      setMappingFunctionStr(lines.join('\n'));
    }
  };

  const handleMappingGridPaste = (e: React.ClipboardEvent<HTMLInputElement>, rIdx: number, cIdx: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const lines = mappingFunctionStr.split('\n');
    const pastedLines = text.split(/\r?\n/);
    const numCols = lines[0].split('\t').length;

    pastedLines.forEach((pLine, i) => {
      if (!pLine.trim() && i === pastedLines.length - 1) return;

      const targetRIdx = rIdx + 1 + i;
      while (lines.length <= targetRIdx) {
        lines.push(Array(numCols).fill('').join('\t'));
      }

      const cols = lines[targetRIdx].split('\t');
      while (cols.length < numCols) cols.push('');

      const pCols = pLine.split('\t');
      pCols.forEach((pCol, j) => {
        const targetCIdx = cIdx + j;
        if (targetCIdx < numCols) {
          cols[targetCIdx] = pCol.trim();
        }
      });

      lines[targetRIdx] = cols.join('\t');
    });

    setMappingFunctionStr(lines.join('\n'));
  };

  const saveMappingRules = async () => {
    setSavingMapping(true);
    try {
      const docRef = doc(db, 'system', 'radar_mappings');
      await setDoc(docRef, { tsvStr: mappingFunctionStr, updatedAt: new Date().toISOString() }, { merge: true });
      showToast('Mapping rules saved successfully!', 'success');
    } catch (e: any) {
      console.error('Failed to save mapping rules', e);
      showToast('Error saving mapping rules: ' + e.message, 'error');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      await PointsService.saveRadarPointsConfig(config);
      showToast('Configuration saved successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculateAll = () => {
    if (!config) return;
    setConfirmState({
      open: true,
      title: 'Recalculate All Radar Stats',
      message: `Save configuration and recalculate radar stats for ALL ${members.length} members?\n\nThis will update every member's leaderboard standings.`,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        await _doRecalculateAll();
      },
    });
  };

  const _doRecalculateAll = async () => {
    setRecalculating(true);
    setRecalcProgress({ current: 0, total: members.length });

    try {
      await PointsService.saveRadarPointsConfig(config);
      let idx = 0;
      for (const member of members) {
        await PointsService.recalculateMemberRadarStats(member.id);
        idx++;
        setRecalcProgress({ current: idx, total: members.length });
      }
      showToast(`Recalculated radar stats for all ${members.length} members!`, 'success');
    } catch (e) {
      console.error(e);
      showToast('An error occurred during recalculation', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading || !config) {
    return <Card><div className="p-8 text-center text-slate-500 font-bold">Loading configuration...</div></Card>;
  }

  const configSections = [
    {
      title: '🏆 Leadership Point Multipliers',
      subtitle: 'Points awarded for project committee roles',
      fields: [
        { label: 'Ex-Officio', value: config.leadership.exOfficio, onChange: (v: number) => setConfig({ ...config, leadership: { ...config.leadership, exOfficio: v } }) },
        { label: 'Organising Chairman/Chairperson', value: config.leadership.organisingChairman, onChange: (v: number) => setConfig({ ...config, leadership: { ...config.leadership, organisingChairman: v } }) },
        { label: 'Committee Member', value: config.leadership.committee, onChange: (v: number) => setConfig({ ...config, leadership: { ...config.leadership, committee: v } }) },
      ]
    },
    {
      title: '📚 Training & Education',
      subtitle: 'Points awarded for training delivery',
      fields: [
        { label: 'Points Per Trainer Hour', value: config.training.pointsPerHour, onChange: (v: number) => setConfig({ ...config, training: { ...config.training, pointsPerHour: v } }), step: 0.5 },
      ]
    },
    {
      title: '🤝 Recruitment & Growth',
      subtitle: 'Points awarded for introducing new members',
      fields: [
        { label: 'Points Per Member Introduced', value: config.recruitment.pointsPerPax, onChange: (v: number) => setConfig({ ...config, recruitment: { ...config.recruitment, pointsPerPax: v } }) },
      ]
    },
    {
      title: '💰 Sponsorship & Resources',
      subtitle: 'Points awarded for securing external sponsorships',
      fields: [
        { label: 'Points Per RM 100 Sponsorship', value: config.sponsorship.pointsPer100, onChange: (v: number) => setConfig({ ...config, sponsorship: { ...config.sponsorship, pointsPer100: v } }) },
      ]
    },
  ];

  return (
    <div className="mx-auto space-y-6">
      <form onSubmit={handleSave} className="space-y-5">
        {configSections.map((section, sIdx) => (
          <Card key={sIdx} className="p-5">
            <h3 className="text-base font-black text-slate-900 mb-0.5">{section.title}</h3>
            <p className="text-xs text-slate-500 mb-4">{section.subtitle}</p>
            <div className={`grid gap-4 ${section.fields.length >= 3 ? 'grid-cols-3' : section.fields.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
              {section.fields.map((field, fIdx) => (
                <div key={fIdx}>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{field.label}</label>
                  <input
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue transition-all"
                    min="0"
                    step={field.step || 1}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}

        {/* Action Buttons */}
        <Card className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/30">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button type="submit" disabled={saving || recalculating} className="bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-700 transition-all">
                {saving ? 'Saving...' : '💾 Save Configuration'}
              </Button>
              <Button
                type="button"
                onClick={handleRecalculateAll}
                disabled={saving || recalculating}
                className="bg-gradient-to-r from-jci-blue to-blue-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {recalculating ? `⏳ Recalculating (${recalcProgress.current}/${recalcProgress.total})...` : `🔄 Save & Recalculate All (${members.length} Members)`}
              </Button>
            </div>
            {recalculating && (
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-jci-blue to-blue-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${recalcProgress.total > 0 ? (recalcProgress.current / recalcProgress.total) * 100 : 0}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-400 text-right">
              "Save & Recalculate" will apply the new multipliers to all member scores immediately.
            </p>
          </div>
        </Card>
      </form>

      {/* Mapping Rules Engine */}
      <Card className="p-5 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 mb-0.5">⚙️ Mapping Rules Engine</h3>
            <p className="text-xs text-slate-500">Map Type and Cat combinations to Radar Points</p>
          </div>
          <Button
            onClick={saveMappingRules}
            disabled={savingMapping}
            className="bg-gradient-to-r from-jci-blue to-blue-600 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            {savingMapping ? 'Saving...' : 'Save Mapping Rules'}
          </Button>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
              <tr>
                {mappingFunctionStr.trim().split('\n')[0]?.split('\t').map((header, i) => (
                  <th key={i} className="py-2.5 px-3 font-bold text-slate-600 border-b border-slate-200">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappingFunctionStr.trim().split('\n').slice(1).map((line, rIdx) => {
                const cols = line.split('\t');
                return (
                  <tr key={rIdx} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-0 border-r border-slate-100 last:border-0">
                        <input
                          type="text"
                          value={col}
                          onChange={(e) => handleMappingCellChange(rIdx, cIdx, e.target.value)}
                          onPaste={(e) => handleMappingGridPaste(e, rIdx, cIdx)}
                          className="w-full bg-transparent px-3 py-2 text-xs text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-jci-blue"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};

// ─── Member Scores View Tab ──────────────────────────────────────────────────
interface RadarMemberScoresViewProps {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}

const RadarMemberScoresView: React.FC<RadarMemberScoresViewProps> = ({ members, setMembers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'points' | 'leadership' | 'training' | 'recruitment' | 'sponsorship' | 'events'>('points');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const getMemberName = (m: Member) => m.fullName || m.general?.name || m.name || '';
  const getInitials = (name: string) => name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  const handleRecalculateSingle = async (memberId: string) => {
    try {
      setRecalculatingId(memberId);
      await PointsService.recalculateMemberRadarStats(memberId);
      const updatedMember = await MembersService.getMemberById(memberId);
      if (updatedMember) {
        setMembers(prev => prev.map(m => m.id === memberId ? updatedMember : m));
        showToast('Points recalculated successfully!', 'success');
      } else {
        // Fallback: fetch all members if single fetch fails
        const ms = await MembersService.getAllMembers();
        setMembers(ms);
        showToast('Points recalculated and list refreshed!', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to recalculate points', 'error');
    } finally {
      setRecalculatingId(null);
    }
  };

  // 1. Calculate Stats
  const totalPointsAll = members.reduce((sum, m) => sum + (m.points || m.jciCareer?.points || 0), 0);
  const activeMembersCount = members.filter(m => (m.points || m.jciCareer?.points || 0) > 0).length;

  let topMember: Member | null = null;
  let topScore = -1;
  members.forEach(m => {
    const score = m.points || m.jciCareer?.points || 0;
    if (score > topScore) {
      topScore = score;
      topMember = m;
    }
  });

  const tierCounts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, None: 0 };
  members.forEach(m => {
    const t = m.tier || '';
    if (t.toLowerCase().includes('platinum')) tierCounts.Platinum++;
    else if (t.toLowerCase().includes('gold')) tierCounts.Gold++;
    else if (t.toLowerCase().includes('silver')) tierCounts.Silver++;
    else if (t.toLowerCase().includes('bronze')) tierCounts.Bronze++;
    else tierCounts.None++;
  });

  // 2. Filter & Sort
  const filtered = members.filter(m => {
    const name = getMemberName(m).toLowerCase();
    const email = (m.contact?.email || m.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || email.includes(query);

    const mTier = m.tier || '';
    const matchesTier = !selectedTier || selectedTier === 'All' || mTier.toLowerCase() === selectedTier.toLowerCase();

    return matchesSearch && matchesTier;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal: any = 0;
    let bVal: any = 0;

    if (sortBy === 'name') {
      aVal = getMemberName(a);
      bVal = getMemberName(b);
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else if (sortBy === 'points') {
      aVal = a.points ?? a.jciCareer?.points ?? 0;
      bVal = b.points ?? b.jciCareer?.points ?? 0;
    } else {
      aVal = (a.jciCareer?.radarStats ?? a.radarStats)?.[sortBy] ?? 0;
      bVal = (b.jciCareer?.radarStats ?? b.radarStats)?.[sortBy] ?? 0;
    }

    if (aVal === bVal) {
      return getMemberName(a).localeCompare(getMemberName(b));
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // 3. Pagination
  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = sorted.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTier, sortBy, sortDirection]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getTierBadgeClass = (tier?: string | MemberTier) => {
    const tStr = String(tier || '').toLowerCase();
    if (tStr.includes('platinum')) return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-300 shadow-sm';
    if (tStr.includes('gold')) return 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-300 shadow-sm';
    if (tStr.includes('silver')) return 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-slate-300 shadow-sm';
    if (tStr.includes('bronze')) return 'bg-gradient-to-r from-orange-500 to-amber-700 text-white border-orange-300 shadow-sm';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const SortHeader = ({ field, label }: { field: typeof sortBy, label: string }) => {
    const isActive = sortBy === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className="py-3.5 px-4 font-bold text-slate-600 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <svg className="w-3.5 h-3.5 text-jci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-jci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            )
          ) : (
            <svg className="w-3.5 h-3.5 text-slate-300 hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{members.length}</h3>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Contributors</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {activeMembersCount} <span className="text-xs font-medium text-slate-400">({Math.round((activeMembersCount / (members.length || 1)) * 100)}%)</span>
            </h3>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Contributor</span>
            <h3 className="text-base font-black text-slate-800 mt-1.5 truncate max-w-[150px]">
              {topMember ? getMemberName(topMember) : '—'}
            </h3>
            <span className="text-xs font-bold text-jci-blue">{topScore > 0 ? `${topScore} pts` : '—'}</span>
          </div>
        </Card>
        <Card className="flex flex-col justify-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tier Breakdown</span>
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">P:{tierCounts.Platinum}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">G:{tierCounts.Gold}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">S:{tierCounts.Silver}</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">B:{tierCounts.Bronze}</span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card noPadding className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name or email..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
            />
            <div className="absolute left-3 top-2.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
          >
            <option value="">All Tiers</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
            <option value="None">No Tier</option>
          </select>

          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
          >
            <option value={10}>10 per page</option>
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </Card>

      {/* Main Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead>
            <tr>
              <SortHeader field="name" label="Member" />
              <SortHeader field="points" label="Total Points" />
              <th className="py-3.5 px-4 font-bold text-slate-600 bg-slate-50 border-b border-slate-200">Tier</th>
              <SortHeader field="leadership" label="Leadership" />
              <SortHeader field="training" label="Training" />
              <SortHeader field="recruitment" label="Recruitment" />
              <SortHeader field="sponsorship" label="Sponsorship" />
              <SortHeader field="events" label="Events" />
              <th className="py-3.5 px-4 font-bold text-slate-600 bg-slate-50 border-b border-slate-200 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">No members found matching filter criteria</td>
              </tr>
            ) : (
              paginatedItems.map(m => {
                const totalPoints = m.points || m.jciCareer?.points || 0;
                const stats = (m.jciCareer?.radarStats ?? m.radarStats) || { leadership: 0, training: 0, recruitment: 0, sponsorship: 0, events: 0 };
                const name = getMemberName(m);
                const isRecalculating = recalculatingId === m.id;

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Member Profile */}
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500 text-[10px] uppercase shadow-inner">
                        {m.general?.avatarUrl ? (
                          <img src={m.general.avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(name)
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          {name}
                          {m.general?.chineseName && (
                            <span className="text-[10px] text-slate-400 font-normal">({m.general.chineseName})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{m.contact?.email || m.email || '—'}</div>
                      </div>
                    </td>

                    {/* Total Points */}
                    <td className="py-3 px-4 font-black text-slate-900 text-sm">
                      {totalPoints}
                    </td>

                    {/* Tier badge */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getTierBadgeClass(m.tier)}`}>
                        {m.tier || 'None'}
                      </span>
                    </td>

                    {/* Radar scores */}
                    <td className={`py-3 px-4 font-bold ${stats.leadership > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'}`}>
                      {stats.leadership || '0'}
                    </td>
                    <td className={`py-3 px-4 font-bold ${stats.training > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'}`}>
                      {stats.training || '0'}
                    </td>
                    <td className={`py-3 px-4 font-bold ${stats.recruitment > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'}`}>
                      {stats.recruitment || '0'}
                    </td>
                    <td className={`py-3 px-4 font-bold ${stats.sponsorship > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'}`}>
                      {stats.sponsorship || '0'}
                    </td>
                    <td className={`py-3 px-4 font-bold ${stats.events > 0 ? 'text-slate-800' : 'text-slate-300 font-normal'}`}>
                      {stats.events || '0'}
                    </td>

                    {/* Quick Recalculate Action */}
                    <td className="py-3 px-4 text-center">
                      <Button
                        onClick={() => handleRecalculateSingle(m.id)}
                        disabled={isRecalculating}
                        className="p-1.5 text-slate-400 hover:text-jci-blue hover:bg-slate-100 rounded-lg transition-all"
                        title="Recalculate points for this member"
                      >
                        {isRecalculating ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" /></svg>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
        <span className="text-[11px] text-slate-500 font-bold">
          Showing {sorted.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, sorted.length)} of {sorted.length} entries
        </span>

        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-all disabled:opacity-50"
          >
            Previous
          </Button>

          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isCurrent = currentPage === pageNum;
            return (
              <Button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 flex items-center justify-center text-[11px] font-bold rounded-xl transition-all ${isCurrent ? 'bg-slate-800 text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-[11px] border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-all disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

