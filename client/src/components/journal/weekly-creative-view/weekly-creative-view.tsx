import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import { Plus, Heart, Camera, Palette } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import type { ContentBlockType } from "@/types/journal";

export function WeeklyCreativeView() {
  const { currentDate, setCurrentDate, setViewMode, createContentBlock, currentWeek, setCurrentWeek } = useJournal();

  const startDate = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: startDate, end: endDate });



  const addCreativeContent = (day: Date, type: ContentBlockType) => {
    setCurrentDate(day);
    const position = {
      x: Math.random() * 300 + 100,
      y: Math.random() * 200 + 100,
      width: type === "photo" ? 300 : 240,
      height: type === "photo" ? 200 : 180,
      rotation: Math.random() * 4 - 2
    };

    const defaultContent = {
      "sticky_note": { text: "Creative thought..." },
      "photo": { url: "", caption: "Capture the moment" },
      "checklist": { items: [{ text: "Creative goal", completed: false }] }
    };

    // Type assertion to handle the ContentBlockType mapping
    const content = defaultContent[type as keyof typeof defaultContent];
    createContentBlock(type, content, position);
  };

  const getMoodEmoji = (dayIndex: number) => {
    const moods = ["😊", "🌟", "💭", "🎨", "🌙", "🌺", "✨"];
    return moods[dayIndex];
  };

  const getInspirationQuote = (dayIndex: number) => {
    const quotes = [
      "Start with what inspires you",
      "Create something beautiful today",
      "Let your imagination flow",
      "Art is expression of the soul",
      "Find magic in the ordinary",
      "Dream in colors",
      "Make today memorable"
    ];
    return quotes[dayIndex];
  };

  return (
    <div className="flex-1 p-6 pinboard-bg overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Palette className="w-5 h-5 text-purple-500 mr-2" />
            Creative Mode
          </h2>
          <p className="text-gray-600 mt-1">Express yourself through art and memories</p>
        </div>
      </div>

      {/* Creative Days Grid */}
      <div className="grid grid-cols-7 gap-6">
        {weekDays.map((day, index) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, currentDate);

          return (
            <div
              key={day.toISOString()}
              className={`group relative ${isSelected ? "ring-2 ring-primary-400" : ""
                }`}
            >
              {/* Day Card */}
              <div
                className="neu-card p-6 min-h-[350px] flex flex-col cursor-pointer hover:shadow-neu-active transition-all"
                onClick={() => {
                  setCurrentDate(day);
                  setViewMode("daily");
                }}
              >
                {/* Day Header */}
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">{getMoodEmoji(index)}</div>
                  <div className="text-xs text-secondary-500 font-medium uppercase mb-1">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-xl font-bold ${isToday ? "text-primary-600" : "text-secondary-800"
                    }`}>
                    {format(day, "d")}
                  </div>
                  {isToday && (
                    <Badge variant="secondary" className="bg-primary-500 text-white text-xs mt-2">
                      Today
                    </Badge>
                  )}
                </div>

                {/* Inspiration */}
                <div className="text-center mb-4">
                  <p className="text-xs text-primary-600 italic font-medium">
                    "{getInspirationQuote(index)}"
                  </p>
                </div>

                {/* Creative Actions */}
                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addCreativeContent(day, "photo")}
                    className="neu-inset text-xs justify-start text-gray-700"
                  >
                    <Camera className="w-3 h-3 mr-2" />
                    Capture Memory
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addCreativeContent(day, "checklist")}
                    className="neu-inset text-xs justify-start text-gray-700"
                  >
                    <Heart className="w-3 h-3 mr-2" />
                    Quick Thought
                  </Button>
                </div>

                {/* Mock Creative Content Preview */}
                <div className="mt-4 space-y-2">
                  {index === 1 && (
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <div className="text-xs text-indigo-700">📝 Morning thoughts</div>
                    </div>
                  )}
                  {index === 3 && (
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <div className="text-xs text-blue-700">📸 Sunset photo</div>
                    </div>
                  )}
                  {index === 5 && (
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <div className="text-xs text-purple-700">🎨 Sketch session</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Add Button */}
              <Button
                size="sm"
                onClick={() => addCreativeContent(day, "sticky_note")}
                className="absolute -top-2 -right-2 w-8 h-8 p-0 neu-button text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Weekly Creative Summary */}
      <div className="mt-8 neu-card p-6">
        <h3 className="text-lg font-semibold text-secondary-800 mb-4 flex items-center">
          <Heart className="w-5 h-5 text-primary-500 mr-2" />
          This Week's Creative Journey
        </h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary-600">3</div>
            <div className="text-xs text-secondary-500">Photos Captured</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary-600">7</div>
            <div className="text-xs text-secondary-500">Notes Written</div>
          </div>
        </div>
      </div>
    </div>
  );
}