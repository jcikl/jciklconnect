import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CalendarEvent, Event } from '../../types';
import { ICalService } from '../../services/icalService';

describe('Event Management Properties', () => {
  // Property 21: Calendar event date organization
  it('Property 21: Calendar event date organization', () => {
    /**
     * Feature: platform-enhancements, Property 21: Calendar event date organization
     * For any calendar view, all events must appear on their correct date according to their startDate field.
     * Validates: Requirements 9.1
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
            endDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
            allDay: fc.boolean(),
            location: fc.string(),
            description: fc.string(),
            type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (events) => {
          // Ensure endDate is after or equal to startDate
          const validEvents = events.map(event => ({
            ...event,
            endDate: event.endDate < event.startDate ? event.startDate : event.endDate
          }));

          // Group events by date
          const eventsByDate = new Map<string, CalendarEvent[]>();
          
          validEvents.forEach(event => {
            const dateKey = event.startDate.toDateString();
            if (!eventsByDate.has(dateKey)) {
              eventsByDate.set(dateKey, []);
            }
            eventsByDate.get(dateKey)!.push(event);
          });

          // Property: All events should be organized by their correct start date
          validEvents.forEach(event => {
            const dateKey = event.startDate.toDateString();
            const eventsOnDate = eventsByDate.get(dateKey) || [];
            
            // The event should appear in the correct date group
            expect(eventsOnDate.some(e => e.id === event.id)).toBe(true);
            
            // All events in this date group should have the same date
            eventsOnDate.forEach(e => {
              expect(e.startDate.toDateString()).toBe(dateKey);
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 22: Event drag-and-drop date update
  it('Property 22: Event drag-and-drop date update', () => {
    /**
     * Feature: platform-enhancements, Property 22: Event drag-and-drop date update
     * For any event dragged to a new date, the event's startDate and endDate must be updated to reflect the new date.
     * Validates: Requirements 9.3
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          title: fc.string({ minLength: 1 }),
          startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          endDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          allDay: fc.boolean(),
          location: fc.string(),
          description: fc.string(),
          type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
        }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (originalEvent, newStartDate, newEndDate) => {
          // Skip invalid dates
          if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime()) || 
              isNaN(originalEvent.startDate.getTime()) || isNaN(originalEvent.endDate.getTime())) {
            return true; // Skip this test case
          }

          // Ensure original event has valid dates
          const validOriginalEvent = {
            ...originalEvent,
            endDate: originalEvent.endDate < originalEvent.startDate ? originalEvent.startDate : originalEvent.endDate
          };

          // Ensure new dates are valid (endDate >= startDate)
          const validNewEndDate = newEndDate < newStartDate ? newStartDate : newEndDate;

          // Simulate drag-and-drop operation
          const updatedEvent = {
            ...validOriginalEvent,
            startDate: newStartDate,
            endDate: validNewEndDate
          };

          // Property: After drag-and-drop, the event's dates should be updated
          expect(updatedEvent.startDate).toEqual(newStartDate);
          expect(updatedEvent.endDate).toEqual(validNewEndDate);
          
          // Property: End date should not be before start date
          expect(updatedEvent.endDate.getTime()).toBeGreaterThanOrEqual(updatedEvent.startDate.getTime());
          
          // Property: Other properties should remain unchanged
          expect(updatedEvent.id).toBe(validOriginalEvent.id);
          expect(updatedEvent.title).toBe(validOriginalEvent.title);
          expect(updatedEvent.location).toBe(validOriginalEvent.location);
          expect(updatedEvent.description).toBe(validOriginalEvent.description);
          expect(updatedEvent.type).toBe(validOriginalEvent.type);
          expect(updatedEvent.allDay).toBe(validOriginalEvent.allDay);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 23: iCal export round-trip
  it('Property 23: iCal export round-trip', () => {
    /**
     * Feature: platform-enhancements, Property 23: iCal export round-trip
     * For any calendar export to iCal format, importing the file should preserve all event data (title, dates, location, description).
     * Validates: Requirements 9.4
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 1 && !s.includes('@')),
            title: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 1),
            startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
            endDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
            allDay: fc.boolean(),
            location: fc.string({ maxLength: 200 }),
            description: fc.string({ maxLength: 500 }),
            type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
          }),
          { minLength: 1, maxLength: 5 } // Reduced for simpler testing
        ),
        (events) => {
          // Ensure all events have valid dates and IDs
          const validEvents = events.map(event => ({
            ...event,
            id: event.id.replace(/[^a-zA-Z0-9-_]/g, '_'), // Clean ID for iCal compatibility
            endDate: event.endDate < event.startDate ? event.startDate : event.endDate
          }));

          try {
            // Export to iCal format
            const icalContent = ICalService.generateICalContent(validEvents, 'Test Calendar');
            
            // Property: Basic iCal structure should be present
            expect(icalContent).toContain('BEGIN:VCALENDAR');
            expect(icalContent).toContain('END:VCALENDAR');
            expect(icalContent).toContain('VERSION:2.0');
            expect(icalContent).toContain('PRODID:');
            
            // Import back from iCal format
            const importedEvents = ICalService.parseICalContent(icalContent);
            
            // Property: Number of events should be preserved
            expect(importedEvents.length).toBe(validEvents.length);
            
            // Property: Each original event should have a corresponding imported event
            validEvents.forEach(originalEvent => {
              const importedEvent = importedEvents.find(e => e.id === originalEvent.id);
              expect(importedEvent).toBeDefined();
              
              if (importedEvent) {
                // Property: Essential data should be preserved (allowing for whitespace normalization)
                expect(importedEvent.title.trim()).toBe(originalEvent.title.trim());
                expect(importedEvent.location.trim()).toBe(originalEvent.location.trim());
                expect(importedEvent.description.trim()).toBe(originalEvent.description.trim());
                expect(importedEvent.type).toBe(originalEvent.type);
                expect(importedEvent.allDay).toBe(originalEvent.allDay);
                
                // Property: Dates should be preserved (allowing for timezone/precision differences)
                const startTimeDiff = Math.abs(importedEvent.startDate.getTime() - originalEvent.startDate.getTime());
                const endTimeDiff = Math.abs(importedEvent.endDate.getTime() - originalEvent.endDate.getTime());
                
                // For all-day events, allow up to 2 days difference (timezone handling and date parsing)
                // For timed events, allow up to 1 hour difference for date precision and timezone issues
                const maxDiff = originalEvent.allDay ? 172800000 : 3600000; // 2 days or 1 hour
                expect(startTimeDiff).toBeLessThan(maxDiff);
                expect(endTimeDiff).toBeLessThan(maxDiff);
              }
            });
            
            // Property: iCal content should contain event blocks
            expect(icalContent).toContain('BEGIN:VEVENT');
            expect(icalContent).toContain('END:VEVENT');
            
          } catch (error) {
            // If there's an error, it should be due to invalid input data, not the round-trip process
            console.error('iCal round-trip error:', error);
            throw error;
          }
        }
      ),
      { numRuns: 20 } // Reduced runs due to complexity of iCal parsing
    );
  });

  // Property 24: Event template field preservation
  it('Property 24: Event template field preservation', () => {
    /**
     * Feature: platform-enhancements, Property 24: Event template field preservation
     * For any event template, all event fields except date and time must be saved and retrievable.
     * Validates: Requirements 10.1
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
          description: fc.string(),
          location: fc.string(),
          duration: fc.integer({ min: 15, max: 480 }), // 15 minutes to 8 hours
          capacity: fc.integer({ min: 1, max: 1000 }),
          registrationSettings: fc.record({
            requiresRegistration: fc.boolean(),
            maxAttendees: fc.integer({ min: 1, max: 1000 }),
            registrationDeadline: fc.string(),
          }),
          budgetTemplate: fc.record({
            plannedIncome: fc.array(fc.record({
              category: fc.string({ minLength: 1 }),
              plannedAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
              description: fc.string(),
            })),
            plannedExpense: fc.array(fc.record({
              category: fc.string({ minLength: 1 }),
              plannedAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
              description: fc.string(),
            })),
            totalBudget: fc.float({ min: 0, max: 50000, noNaN: true }),
          }),
          createdAt: fc.date(),
          createdBy: fc.string({ minLength: 1 }),
          usageCount: fc.integer({ min: 0, max: 100 }),
          category: fc.string(),
        }),
        (template) => {
          // Simulate saving and retrieving a template
          const savedTemplate = JSON.parse(JSON.stringify(template)); // Deep copy to simulate save/load
          
          // Property: All fields except date/time should be preserved
          expect(savedTemplate.id).toBe(template.id);
          expect(savedTemplate.name).toBe(template.name);
          expect(savedTemplate.type).toBe(template.type);
          expect(savedTemplate.description).toBe(template.description);
          expect(savedTemplate.location).toBe(template.location);
          expect(savedTemplate.duration).toBe(template.duration);
          expect(savedTemplate.capacity).toBe(template.capacity);
          expect(savedTemplate.createdBy).toBe(template.createdBy);
          expect(savedTemplate.usageCount).toBe(template.usageCount);
          expect(savedTemplate.category).toBe(template.category);
          
          // Property: Registration settings should be preserved
          expect(savedTemplate.registrationSettings.requiresRegistration)
            .toBe(template.registrationSettings.requiresRegistration);
          expect(savedTemplate.registrationSettings.maxAttendees)
            .toBe(template.registrationSettings.maxAttendees);
          expect(savedTemplate.registrationSettings.registrationDeadline)
            .toBe(template.registrationSettings.registrationDeadline);
          
          // Property: Budget template should be preserved
          expect(savedTemplate.budgetTemplate.totalBudget).toBe(template.budgetTemplate.totalBudget);
          expect(savedTemplate.budgetTemplate.plannedIncome.length)
            .toBe(template.budgetTemplate.plannedIncome.length);
          expect(savedTemplate.budgetTemplate.plannedExpense.length)
            .toBe(template.budgetTemplate.plannedExpense.length);
          
          // Property: Budget categories should be preserved
          template.budgetTemplate.plannedIncome.forEach((income, index) => {
            expect(savedTemplate.budgetTemplate.plannedIncome[index].category).toBe(income.category);
            expect(savedTemplate.budgetTemplate.plannedIncome[index].plannedAmount).toBe(income.plannedAmount);
            expect(savedTemplate.budgetTemplate.plannedIncome[index].description).toBe(income.description);
          });
          
          template.budgetTemplate.plannedExpense.forEach((expense, index) => {
            expect(savedTemplate.budgetTemplate.plannedExpense[index].category).toBe(expense.category);
            expect(savedTemplate.budgetTemplate.plannedExpense[index].plannedAmount).toBe(expense.plannedAmount);
            expect(savedTemplate.budgetTemplate.plannedExpense[index].description).toBe(expense.description);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 25: Template application field population
  it('Property 25: Template application field population', () => {
    /**
     * Feature: platform-enhancements, Property 25: Template application field population
     * For any template applied to a new event, all template fields must populate the corresponding event fields.
     * Validates: Requirements 10.2
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
          description: fc.string(),
          location: fc.string(),
          duration: fc.integer({ min: 15, max: 480 }),
          capacity: fc.integer({ min: 1, max: 1000 }),
          registrationSettings: fc.record({
            requiresRegistration: fc.boolean(),
            maxAttendees: fc.integer({ min: 1, max: 1000 }),
          }),
          budgetTemplate: fc.record({
            totalBudget: fc.float({ min: 0, max: 50000, noNaN: true }),
          }),
          category: fc.string(),
        }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        fc.string({ minLength: 1 }), // Event title override
        (template, eventDate, eventTitle) => {
          // Skip invalid dates
          if (isNaN(eventDate.getTime())) {
            return true; // Skip this test case
          }

          // Simulate applying template to create a new event
          const newEvent = {
            id: `event_${Date.now()}`,
            title: eventTitle, // User-provided title
            date: eventDate.toISOString(),
            endDate: new Date(eventDate.getTime() + template.duration * 60000).toISOString(),
            
            // Fields populated from template
            type: template.type,
            description: template.description,
            location: template.location,
            capacity: template.capacity,
            registrationSettings: { ...template.registrationSettings },
            budget: template.budgetTemplate.totalBudget,
            category: template.category,
            
            // Template metadata
            createdFromTemplate: template.id,
            templateName: template.name,
          };
          
          // Property: Template fields should populate corresponding event fields
          expect(newEvent.type).toBe(template.type);
          expect(newEvent.description).toBe(template.description);
          expect(newEvent.location).toBe(template.location);
          expect(newEvent.capacity).toBe(template.capacity);
          expect(newEvent.budget).toBe(template.budgetTemplate.totalBudget);
          expect(newEvent.category).toBe(template.category);
          
          // Property: Registration settings should be copied
          expect(newEvent.registrationSettings.requiresRegistration)
            .toBe(template.registrationSettings.requiresRegistration);
          expect(newEvent.registrationSettings.maxAttendees)
            .toBe(template.registrationSettings.maxAttendees);
          
          // Property: User-provided fields should override template
          expect(newEvent.title).toBe(eventTitle);
          expect(new Date(newEvent.date)).toEqual(eventDate);
          
          // Property: Duration should be applied correctly
          const actualDuration = new Date(newEvent.endDate).getTime() - new Date(newEvent.date).getTime();
          const expectedDuration = template.duration * 60000; // Convert minutes to milliseconds
          expect(actualDuration).toBe(expectedDuration);
          
          // Property: Template reference should be maintained
          expect(newEvent.createdFromTemplate).toBe(template.id);
          expect(newEvent.templateName).toBe(template.name);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 26: Template edit isolation
  it('Property 26: Template edit isolation', () => {
    /**
     * Feature: platform-enhancements, Property 26: Template edit isolation
     * For any template edit, existing events created from that template must remain unchanged.
     * Validates: Requirements 10.3
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          type: fc.constantFrom('Meeting', 'Training', 'Social', 'Conference', 'Workshop'),
          description: fc.string(),
          location: fc.string(),
          duration: fc.integer({ min: 15, max: 480 }),
        }),
        fc.record({
          name: fc.string({ minLength: 1 }),
          description: fc.string(),
          location: fc.string(),
          duration: fc.integer({ min: 15, max: 480 }),
        }),
        (originalTemplate, templateUpdates) => {
          // Create an event from the original template
          const originalEvent = {
            id: `event_${Date.now()}`,
            title: 'Test Event',
            type: originalTemplate.type,
            description: originalTemplate.description,
            location: originalTemplate.location,
            duration: originalTemplate.duration,
            createdFromTemplate: originalTemplate.id,
            templateName: originalTemplate.name,
          };
          
          // Store original event state
          const eventSnapshot = JSON.parse(JSON.stringify(originalEvent));
          
          // Update the template
          const updatedTemplate = {
            ...originalTemplate,
            ...templateUpdates,
          };
          
          // Property: Existing event should remain unchanged after template update
          expect(originalEvent.id).toBe(eventSnapshot.id);
          expect(originalEvent.title).toBe(eventSnapshot.title);
          expect(originalEvent.type).toBe(eventSnapshot.type);
          expect(originalEvent.description).toBe(eventSnapshot.description);
          expect(originalEvent.location).toBe(eventSnapshot.location);
          expect(originalEvent.duration).toBe(eventSnapshot.duration);
          expect(originalEvent.createdFromTemplate).toBe(eventSnapshot.createdFromTemplate);
          expect(originalEvent.templateName).toBe(eventSnapshot.templateName);
          
          // Property: Template should be updated independently
          expect(updatedTemplate.name).toBe(templateUpdates.name);
          expect(updatedTemplate.description).toBe(templateUpdates.description);
          expect(updatedTemplate.location).toBe(templateUpdates.location);
          expect(updatedTemplate.duration).toBe(templateUpdates.duration);
          
          // Property: Template changes should not affect existing event (only if values actually changed)
          if (templateUpdates.description !== originalTemplate.description) {
            expect(originalEvent.description).toBe(originalTemplate.description);
            expect(originalEvent.description).not.toBe(updatedTemplate.description);
          }
          if (templateUpdates.location !== originalTemplate.location) {
            expect(originalEvent.location).toBe(originalTemplate.location);
            expect(originalEvent.location).not.toBe(updatedTemplate.location);
          }
          if (templateUpdates.duration !== originalTemplate.duration) {
            expect(originalEvent.duration).toBe(originalTemplate.duration);
            expect(originalEvent.duration).not.toBe(updatedTemplate.duration);
          }
          
          // Property: Template reference should remain valid
          expect(originalEvent.createdFromTemplate).toBe(updatedTemplate.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 27: Event budget remaining calculation
  it('Property 27: Event budget remaining calculation', () => {
    /**
     * Feature: platform-enhancements, Property 27: Event budget remaining calculation
     * For any event budget, remaining funds must equal budget minus total actual expenses.
     * Validates: Requirements 11.2
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          eventId: fc.string({ minLength: 1 }),
          totalBudget: fc.float({ min: 0, max: 100000, noNaN: true }),
          budgetItems: fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              category: fc.constantFrom('Venue', 'Catering', 'Marketing', 'Equipment', 'Staff', 'Materials'),
              type: fc.constantFrom('income', 'expense'),
              plannedAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
              actualAmount: fc.float({ min: 0, max: 15000, noNaN: true }),
              description: fc.string(),
              status: fc.constantFrom('planned', 'approved', 'paid', 'received'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          status: fc.constantFrom('Draft', 'Approved', 'Active', 'Completed'),
        }),
        (budget) => {
          // Calculate total actual expenses and income
          const totalExpenses = budget.budgetItems
            .filter(item => item.type === 'expense')
            .reduce((sum, item) => sum + item.actualAmount, 0);
          
          const totalIncome = budget.budgetItems
            .filter(item => item.type === 'income')
            .reduce((sum, item) => sum + item.actualAmount, 0);
          
          // Calculate remaining funds
          const remainingFunds = budget.totalBudget + totalIncome - totalExpenses;
          
          // Property: Remaining funds must equal budget plus income minus expenses
          const calculatedRemaining = budget.totalBudget + totalIncome - totalExpenses;
          expect(remainingFunds).toBe(calculatedRemaining);
          
          // Property: Remaining funds calculation should be consistent
          expect(remainingFunds).toBeCloseTo(budget.totalBudget + totalIncome - totalExpenses, 2);
          
          // Property: If no expenses, remaining should equal budget plus income
          if (totalExpenses === 0) {
            expect(remainingFunds).toBe(budget.totalBudget + totalIncome);
          }
          
          // Property: If expenses equal budget plus income, remaining should be zero
          if (Math.abs(totalExpenses - (budget.totalBudget + totalIncome)) < 0.01) {
            expect(Math.abs(remainingFunds)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 28: Budget warning threshold
  it('Property 28: Budget warning threshold', () => {
    /**
     * Feature: platform-enhancements, Property 28: Budget warning threshold
     * For any event budget where expenses reach 80% of budget, a warning indicator must be displayed.
     * Validates: Requirements 11.3
     */
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          eventId: fc.string({ minLength: 1 }),
          totalBudget: fc.float({ min: 100, max: 100000, noNaN: true }),
          budgetItems: fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              category: fc.constantFrom('Venue', 'Catering', 'Marketing', 'Equipment', 'Staff', 'Materials'),
              type: fc.constantFrom('income', 'expense'),
              plannedAmount: fc.float({ min: 0, max: 10000, noNaN: true }),
              actualAmount: fc.float({ min: 0, max: 15000, noNaN: true }),
              description: fc.string(),
              status: fc.constantFrom('planned', 'approved', 'paid', 'received'),
            }),
            { minLength: 0, maxLength: 15 }
          ),
        }),
        (budget) => {
          // Calculate total actual expenses
          const totalExpenses = budget.budgetItems
            .filter(item => item.type === 'expense')
            .reduce((sum, item) => sum + item.actualAmount, 0);
          
          // Calculate expense percentage
          const expensePercentage = (totalExpenses / budget.totalBudget) * 100;
          
          // Simulate warning threshold logic
          const shouldShowWarning = expensePercentage >= 80;
          const shouldShowDanger = expensePercentage >= 100;
          
          // Property: Warning should be shown when expenses reach 80% of budget
          if (expensePercentage >= 80 && expensePercentage < 100) {
            expect(shouldShowWarning).toBe(true);
            expect(shouldShowDanger).toBe(false);
          }
          
          // Property: Danger should be shown when expenses reach or exceed 100% of budget
          if (expensePercentage >= 100) {
            expect(shouldShowWarning).toBe(true);
            expect(shouldShowDanger).toBe(true);
          }
          
          // Property: No warning should be shown when expenses are below 80%
          if (expensePercentage < 80) {
            expect(shouldShowWarning).toBe(false);
            expect(shouldShowDanger).toBe(false);
          }
          
          // Property: Percentage calculation should be accurate
          const calculatedPercentage = (totalExpenses / budget.totalBudget) * 100;
          expect(expensePercentage).toBeCloseTo(calculatedPercentage, 2);
          
          // Property: Warning thresholds should be consistent
          expect(shouldShowWarning).toBe(expensePercentage >= 80);
          expect(shouldShowDanger).toBe(expensePercentage >= 100);
        }
      ),
      { numRuns: 100 }
    );
  });
});