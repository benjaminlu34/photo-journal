import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Link, ExternalLink } from "lucide-react";
import { format, isSameDay } from "date-fns";
import type { JournalEntryData } from "@/types/journal";

interface JournalIntegrationProps {
  currentDate: Date;
  journalEntries: JournalEntryData[];
  onNavigateToJournal: (date: Date) => void;
  onLinkEventToJournal: (entryId: string) => void;
  linkedJournalEntryId?: string;
}

export function JournalIntegration({
  currentDate,
  journalEntries,
  onNavigateToJournal,
  onLinkEventToJournal,
  linkedJournalEntryId
}: JournalIntegrationProps) {
  // Find journal entry for the current date
  const journalEntryForDate = journalEntries.find(entry => 
    isSameDay(new Date(entry.date), currentDate)
  );
  
  // Check if there are any journal entries for the week
  const hasWeeklyEntries = journalEntries.length > 0;
  
  return (
    <div className="p-4 bg-gray-50 border-b border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Journal Integration</h3>
        </div>
        
        {journalEntryForDate ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Journal Entry Available
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToJournal(currentDate)}
              className="neu-card flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              View Entry
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToJournal(currentDate)}
            className="neu-card"
          >
            Create Journal Entry
          </Button>
        )}
      </div>
      
      {hasWeeklyEntries && (
        <div className="mt-3">
          <p className="text-sm text-gray-600 mb-2">
            Journal entries available for this week:
          </p>
          <div className="flex flex-wrap gap-2">
            {journalEntries.map(entry => {
              const entryDate = new Date(entry.date);
              const isLinked = entry.id === linkedJournalEntryId;
              
              return (
                <Button
                  key={entry.id}
                  variant={isLinked ? "default" : "outline"}
                  size="sm"
                  onClick={() => onLinkEventToJournal(entry.id)}
                  className={`neu-card flex items-center gap-1 ${
                    isLinked 
                      ? "bg-purple-500 hover:bg-purple-600 text-white" 
                      : ""
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {format(entryDate, "MMM d")}
                  {isLinked && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Linked
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      
      {!hasWeeklyEntries && (
        <p className="text-sm text-gray-500 mt-2">
          No journal entries found for this week. Create one to link with your events.
        </p>
      )}
    </div>
  );
}