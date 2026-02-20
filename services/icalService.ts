// iCal Export Service
import { CalendarEvent, Event } from '../types';
import { formatDate } from '../utils/dateUtils';

export class ICalService {
  /**
   * Generate iCal content from calendar events
   */
  static generateICalContent(events: CalendarEvent[], calendarName = 'JCI Events'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    let icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JCI LO Management//Event Calendar//EN',
      `X-WR-CALNAME:${calendarName}`,
      'X-WR-TIMEZONE:Asia/Kuala_Lumpur',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    events.forEach(event => {
      icalContent += '\r\n' + this.generateEventVEvent(event, timestamp);
    });

    icalContent += '\r\nEND:VCALENDAR';
    return icalContent;
  }

  /**
   * Generate a single VEVENT component
   */
  private static generateEventVEvent(event: CalendarEvent, timestamp: string): string {
    const startDate = this.formatICalDate(event.startDate, event.allDay);
    const endDate = this.formatICalDate(event.endDate, event.allDay);
    const uid = `${event.id}@jci-lo-management.com`;
    
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${startDate}`,
      `DTEND${event.allDay ? ';VALUE=DATE' : ''}:${endDate}`,
      `SUMMARY:${this.escapeICalText(event.title)}`,
    ];

    if (event.description) {
      lines.push(`DESCRIPTION:${this.escapeICalText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${this.escapeICalText(event.location)}`);
    }

    if (event.type) {
      lines.push(`CATEGORIES:${this.escapeICalText(event.type)}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');

    return lines.join('\r\n');
  }

  /**
   * Format date for iCal format
   */
  private static formatICalDate(date: Date, allDay: boolean): string {
    if (allDay) {
      // All-day events use DATE format (YYYYMMDD)
      return date.toISOString().split('T')[0].replace(/-/g, '');
    } else {
      // Timed events use DATETIME format (YYYYMMDDTHHMMSSZ)
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
  }

  /**
   * Escape special characters for iCal text fields
   */
  private static escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/;/g, '\\;')    // Escape semicolons
      .replace(/,/g, '\\,')    // Escape commas
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '');     // Remove carriage returns
  }

  /**
   * Download iCal file
   */
  static downloadICalFile(events: CalendarEvent[], filename = 'events.ics', calendarName = 'JCI Events'): void {
    const icalContent = this.generateICalContent(events, calendarName);
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Convert Event objects to CalendarEvent objects
   */
  static convertEventsToCalendarEvents(events: Event[]): CalendarEvent[] {
    return events.map(event => ({
      id: event.id,
      title: event.title,
      startDate: new Date(event.date),
      endDate: new Date(event.endDate || event.date),
      allDay: !event.time, // If no time specified, treat as all-day
      location: event.location || '',
      description: event.description || '',
      type: event.type || 'Event',
      eventId: event.id,
    }));
  }

  /**
   * Generate iCal URL for a single event (for sharing)
   */
  static generateEventICalUrl(event: CalendarEvent): string {
    const icalContent = this.generateICalContent([event], 'JCI Event');
    const encodedContent = encodeURIComponent(icalContent);
    return `data:text/calendar;charset=utf8,${encodedContent}`;
  }

  /**
   * Validate iCal content by attempting to parse it
   */
  static validateICalContent(icalContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = icalContent.split(/\r?\n/);
    
    // Basic validation
    if (!lines.includes('BEGIN:VCALENDAR')) {
      errors.push('Missing BEGIN:VCALENDAR');
    }
    
    if (!lines.includes('END:VCALENDAR')) {
      errors.push('Missing END:VCALENDAR');
    }
    
    // Check for required properties
    const hasVersion = lines.some(line => line.startsWith('VERSION:'));
    if (!hasVersion) {
      errors.push('Missing VERSION property');
    }
    
    const hasProdId = lines.some(line => line.startsWith('PRODID:'));
    if (!hasProdId) {
      errors.push('Missing PRODID property');
    }
    
    // Validate VEVENT blocks
    const eventBlocks = this.extractEventBlocks(lines);
    eventBlocks.forEach((block, index) => {
      const blockErrors = this.validateEventBlock(block);
      errors.push(...blockErrors.map(err => `Event ${index + 1}: ${err}`));
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract VEVENT blocks from iCal lines
   */
  private static extractEventBlocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let currentBlock: string[] = [];
    let inEvent = false;
    
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentBlock = [line];
      } else if (line === 'END:VEVENT') {
        currentBlock.push(line);
        blocks.push(currentBlock);
        inEvent = false;
        currentBlock = [];
      } else if (inEvent) {
        currentBlock.push(line);
      }
    }
    
    return blocks;
  }

  /**
   * Validate a single VEVENT block
   */
  private static validateEventBlock(block: string[]): string[] {
    const errors: string[] = [];
    
    // Required properties for VEVENT
    const requiredProps = ['UID', 'DTSTAMP', 'DTSTART'];
    
    for (const prop of requiredProps) {
      const hasProperty = block.some(line => line.startsWith(`${prop}:`));
      if (!hasProperty) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
    
    return errors;
  }

  /**
   * Parse iCal content and extract events
   */
  static parseICalContent(icalContent: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = icalContent.split(/\r?\n/);
    const eventBlocks = this.extractEventBlocks(lines);
    
    eventBlocks.forEach(block => {
      try {
        const event = this.parseEventBlock(block);
        if (event) {
          events.push(event);
        }
      } catch (error) {
        console.warn('Failed to parse event block:', error);
      }
    });
    
    return events;
  }

  /**
   * Parse a single VEVENT block into a CalendarEvent
   */
  private static parseEventBlock(block: string[]): CalendarEvent | null {
    const props: Record<string, string> = {};
    
    // Parse properties
    for (const line of block) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        // Extract key (may include parameters like DTSTART;VALUE=DATE)
        const fullKey = line.substring(0, colonIndex);
        const key = fullKey.split(';')[0]; // Get base property name
        const value = line.substring(colonIndex + 1);
        props[key] = this.unescapeICalText(value);
        // Store full key for parameter checking
        props[`${key}_FULL`] = fullKey;
      }
    }
    
    // Required properties
    if (!props.UID || !props.DTSTART) {
      return null;
    }
    
    // Parse dates
    const startDate = this.parseICalDate(props.DTSTART);
    const endDate = props.DTEND ? this.parseICalDate(props.DTEND) : startDate;
    const allDay = (props.DTSTART_FULL || '').includes('VALUE=DATE');
    
    // Extract clean ID from UID (remove domain part)
    const cleanId = props.UID.includes('@') ? props.UID.split('@')[0] : props.UID;
    
    return {
      id: cleanId,
      title: props.SUMMARY || 'Untitled Event',
      startDate,
      endDate,
      allDay,
      location: props.LOCATION || '',
      description: props.DESCRIPTION || '',
      type: props.CATEGORIES || 'Event',
    };
  }

  /**
   * Parse iCal date string to Date object
   */
  private static parseICalDate(dateString: string): Date {
    // Remove VALUE=DATE parameter if present
    const cleanDateString = dateString.replace(/^[^:]*:/, '');
    
    if (cleanDateString.length === 8) {
      // DATE format: YYYYMMDD
      const year = parseInt(cleanDateString.substring(0, 4));
      const month = parseInt(cleanDateString.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(cleanDateString.substring(6, 8));
      return new Date(year, month, day);
    } else {
      // DATETIME format: YYYYMMDDTHHMMSSZ
      const year = parseInt(cleanDateString.substring(0, 4));
      const month = parseInt(cleanDateString.substring(4, 6)) - 1;
      const day = parseInt(cleanDateString.substring(6, 8));
      const hour = parseInt(cleanDateString.substring(9, 11));
      const minute = parseInt(cleanDateString.substring(11, 13));
      const second = parseInt(cleanDateString.substring(13, 15));
      
      if (cleanDateString.endsWith('Z')) {
        // UTC time
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        // Local time
        return new Date(year, month, day, hour, minute, second);
      }
    }
  }

  /**
   * Unescape iCal text
   */
  private static unescapeICalText(text: string): string {
    return text
      .replace(/\\n/g, '\n')   // Unescape newlines first
      .replace(/\\,/g, ',')    // Unescape commas
      .replace(/\\;/g, ';')    // Unescape semicolons
      .replace(/\\\\/g, '\\'); // Unescape backslashes last
  }
}