import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

interface MonthNavigationProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

export function MonthNavigation({ selectedMonth, selectedYear, onMonthChange }: MonthNavigationProps) {
  const currentDate = new Date();
  const selectedDate = new Date(selectedYear, selectedMonth - 1, 1);

  const isNextDisabled =
    selectedYear === currentDate.getFullYear() &&
    selectedMonth >= currentDate.getMonth() + 1;

  const handlePrev = () => {
    if (selectedMonth === 1) {
      onMonthChange(12, selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1, selectedYear);
    }
  };

  const handleNext = () => {
    if (selectedMonth === 12) {
      onMonthChange(1, selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1, selectedYear);
    }
  };

  const handleMonthChange = (date: Date) => {
    onMonthChange(date.getMonth() + 1, date.getFullYear());
  };

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 mb-6 flex justify-center items-center gap-2">
      <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Mês anterior">
        <ChevronLeftIcon className="size-4" />
      </Button>

      <Calendar
        mode="single"
        selected={selectedDate}
        month={selectedDate}
        onMonthChange={handleMonthChange}
        disabled={{ after: currentDate }}
        captionLayout="dropdown"
        startMonth={new Date(currentDate.getFullYear() - 2, 0)}
        endMonth={currentDate}
        classNames={{
          nav: "hidden",
          month_grid: "hidden",
          weekdays: "hidden",
        }}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={isNextDisabled}
        aria-label="Próximo mês"
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  );
}
