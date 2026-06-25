import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui/Common';
import { MembersService } from '../../services/membersService';
import { Member } from '../../types';
import { db } from '../../config/firebase';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, getDocs, query, where, orderBy, limit, startAfter, deleteDoc } from 'firebase/firestore';
// import { RadarEventManager } from './RadarEventManager';

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
  const [viewMode, setViewMode] = useState<'import' | 'ledger' | 'events'>('import');
  const [pastedData, setPastedData] = useState(Array(10).fill('\t\t\t\t\t\t\t\t').join('\n'));
  const [mappingFunctionStr, setMappingFunctionStr] = useState(defaultMappingStr);
  const [showMappingEditor, setShowMappingEditor] = useState(false);
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

  const handleMappingCellChange = (rIdx: number, cIdx: number, val: string) => {
    const lines = mappingFunctionStr.split('\n');
    // Account for header row (+1)
    const lineIndex = rIdx + 1;
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
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
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

  const saveMappingRules = async () => {
    setSavingMapping(true);
    try {
      const docRef = doc(db, 'system', 'radar_mappings');
      await setDoc(docRef, { tsvStr: mappingFunctionStr, updatedAt: new Date().toISOString() }, { merge: true });
      setFeedback('Mapping rules saved successfully!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      console.error('Failed to save mapping rules', e);
      setFeedback('Error saving mapping rules: ' + e.message);
    } finally {
      setSavingMapping(false);
    }
  };

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
      if (cols.length >= 9) {
        const chapter = cols[5];
        if (chapter && !chapter.toLowerCase().includes('kuala lumpur')) {
          return { id: index, isIgnored: true };
        }

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

      // Apply updates to member documents
      for (const [memberId, updates] of Object.entries(memberUpdates)) {
        const memberRef = doc(db, 'members', memberId);
        const memberDoc = await getDoc(memberRef);

        if (memberDoc.exists()) {
          const data = memberDoc.data();
          const currentStats = data.radarStats || {
            training: 0, leadership: 0, events: 0, recruitment: 0, sponsorship: 0
          };
          const currentStatsByYear = data.radarStatsByYear || {};

          const newStats = { ...currentStats };
          for (const [key, pts] of Object.entries(updates.total)) {
            newStats[key as keyof typeof newStats] += pts as number;
          }

          const newStatsByYear = { ...currentStatsByYear };
          for (const [year, yearStats] of Object.entries(updates.byYear)) {
            if (!newStatsByYear[year]) {
              newStatsByYear[year] = { training: 0, leadership: 0, events: 0, recruitment: 0, sponsorship: 0 };
            }
            for (const [key, pts] of Object.entries(yearStats)) {
              newStatsByYear[year][key as keyof typeof newStatsByYear[string]] += pts as number;
            }
          }

          await updateDoc(memberRef, {
            radarStats: newStats,
            radarStatsByYear: newStatsByYear
          });
        }
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
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl ring-1 ring-slate-200/50">
          <Button
            onClick={() => setViewMode('import')}
            className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${viewMode === 'import' ? 'bg-gradient-to-r from-jci-blue to-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Data Importer
          </Button>
          <Button
            onClick={() => setViewMode('ledger')}
            className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${viewMode === 'ledger' ? 'bg-gradient-to-r from-jci-blue to-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Contribution Ledger
          </Button>
          <Button
            onClick={() => setViewMode('events')}
            className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${viewMode === 'events' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 bg-transparent hover:bg-slate-200/50'}`}
          >
            Event Roles Manager
          </Button>
        </div>
      </div>

      {viewMode === 'ledger' ? (
        <RadarLedgerView />
      ) : viewMode === 'events' ? (
        <div>Radar Event Manager is disabled</div>
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
              <Button onClick={() => setShowMappingEditor(!showMappingEditor)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg whitespace-nowrap rounded-xl font-bold px-5 py-2.5 transition-all">
                {showMappingEditor ? 'Close Mapping Rules' : 'Configure Rules'}
              </Button>
            </div>

            {showMappingEditor && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg mb-4 animate-in fade-in slide-in-from-top-4">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Mapping Rules Engine</h3>
                    <p className="text-sm text-slate-500">Map <code className="text-xs font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Type</code> and <code className="text-xs font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">Cat</code> combinations to Radar Points</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={saveMappingRules} disabled={savingMapping} className="bg-gradient-to-r from-jci-blue to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md text-xs py-1.5 px-4 rounded-lg font-bold transition-all">
                      {savingMapping ? 'Saving...' : 'Save Config to Cloud'}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                      <tr>
                        {mappingFunctionStr.trim().split('\n')[0]?.split('\t').map((header, i) => (
                          <th key={i} className="py-2 px-3 font-bold text-slate-600 border-b border-slate-200">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappingFunctionStr.trim().split('\n').slice(1).map((line, rIdx) => {
                        const cols = line.split('\t');
                        return (
                          <tr key={rIdx} className="border-b border-slate-100 hover:bg-blue-50/50">
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
              </div>
            )}

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

  const handleBatchDelete = async () => {
    if (selectedLogs.size === 0) return;
    if (!window.confirm(`Are you sure you want to revert and delete ${selectedLogs.size} selected records?\n\nThis will deduct points from the members' radar stats.`)) return;

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

      // Process member updates
      for (const [memberId, deductions] of Object.entries(memberDeductions)) {
        const memberRef = doc(db, 'members', memberId);
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
          const data = memberDoc.data();
          const currentStats = data.radarStats || {};
          const currentStatsByYear = data.radarStatsByYear || {};
          
          const newStats = { ...currentStats };
          for (const [radarKey, pointsToDeduct] of Object.entries(deductions.total)) {
            if (newStats[radarKey] !== undefined) {
              newStats[radarKey] = Math.max(0, newStats[radarKey] - (pointsToDeduct as number));
            }
          }

          const newStatsByYear = { ...currentStatsByYear };
          for (const [year, yearStats] of Object.entries(deductions.byYear)) {
            if (newStatsByYear[year]) {
              for (const [radarKey, pointsToDeduct] of Object.entries(yearStats)) {
                if (newStatsByYear[year][radarKey] !== undefined) {
                  newStatsByYear[year][radarKey] = Math.max(0, newStatsByYear[year][radarKey] - (pointsToDeduct as number));
                }
              }
            }
          }

          await updateDoc(memberRef, { 
            radarStats: newStats,
            radarStatsByYear: newStatsByYear
          });
        }
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

  const handleDelete = async (logId: string, memberId: string, radarKey: string, points: number, year?: string) => {
    if (!window.confirm(`Are you sure you want to delete this record?\n\nThis will deduct ${points} points from the member's ${radarKey} radar.`)) return;
    try {
      await deleteDoc(doc(db, 'RadarContributions', logId));
      const memberRef = doc(db, 'members', memberId);
      const memberDoc = await getDoc(memberRef);
      if (memberDoc.exists()) {
        const data = memberDoc.data();
        const currentStats = data.radarStats || {};
        const currentStatsByYear = data.radarStatsByYear || {};
        
        const newStats = { ...currentStats };
        if (newStats[radarKey] !== undefined) {
          newStats[radarKey] = Math.max(0, newStats[radarKey] - points);
        }

        const newStatsByYear = { ...currentStatsByYear };
        if (year && newStatsByYear[year] && newStatsByYear[year][radarKey] !== undefined) {
          newStatsByYear[year][radarKey] = Math.max(0, newStatsByYear[year][radarKey] - points);
        }

        await updateDoc(memberRef, { 
          radarStats: newStats,
          radarStatsByYear: newStatsByYear
        });
      }
      fetchLogs();
    } catch (e) {
      alert('Error deleting record: ' + e);
    }
  };

  if (loading) return <Card><div className="p-8 text-center text-slate-500 font-bold">Loading Ledger...</div></Card>;

  return (
    <Card className="overflow-hidden p-0">
      {selectedLogs.size > 0 && (
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b border-blue-100">
          <span className="text-sm text-blue-800 font-bold px-2">{selectedLogs.size} records selected</span>
          <Button onClick={handleBatchDelete} disabled={deleting} className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white py-1.5 px-4 text-xs font-bold shadow-md rounded-lg transition-all">
            {deleting ? 'Processing...' : 'Batch Revert Selected'}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
            <tr>
              <th className="py-2 px-3 border-b w-10">
                <input
                  type="checkbox"
                  checked={logs.length > 0 && selectedLogs.size === logs.length}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue cursor-pointer"
                />
              </th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Member Name</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Event Title</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Radar Key</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Points</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Year</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Event Date</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Imported At</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-500">No contribution records found.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className={`border-b border-slate-100 transition-colors ${selectedLogs.has(log.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                <td className="py-1.5 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedLogs.has(log.id)}
                    onChange={() => toggleSelect(log.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue cursor-pointer"
                  />
                </td>
                <td className="py-1.5 px-3 font-bold text-slate-800">{log.memberName || 'Unknown'}</td>
                <td className="py-1.5 px-3 text-slate-600 max-w-[200px] truncate" title={log.eventTitle || log.rawCategory}>{log.eventTitle || log.rawCategory}</td>
                <td className="py-1.5 px-3">
                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{log.radarKey}</span>
                </td>
                <td className="py-1.5 px-3 font-mono font-bold text-amber-600">+{log.points}</td>
                <td className="py-1.5 px-3 font-bold text-slate-700">{log.year || 'All'}</td>
                <td className="py-1.5 px-3 text-[10px] text-slate-500">{log.eventDate || '-'}</td>
                <td className="py-1.5 px-3 text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="py-1.5 px-3 text-right">
                  <button
                    onClick={() => handleDelete(log.id, log.memberId, log.radarKey, log.points, log.year)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    Revert
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && logs.length > 0 && (
          <div className="p-4 flex justify-center bg-slate-50 border-t border-slate-100">
            <Button 
              onClick={() => fetchLogs(true)} 
              disabled={loadingMore}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-2 text-sm font-bold rounded-lg transition-all"
            >
              {loadingMore ? 'Loading...' : 'Load More Records'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
