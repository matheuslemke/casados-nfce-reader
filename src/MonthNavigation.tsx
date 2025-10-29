interface MonthNavigationProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function MonthNavigation({ selectedMonth, selectedYear, onMonthChange }: MonthNavigationProps) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

  // Generate year options (current year and 2 years back)
  const yearOptions = [];
  for (let year = currentYear; year >= currentYear - 2; year--) {
    yearOptions.push(year);
  }

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      onMonthChange(12, selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onMonthChange(1, selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1, selectedYear);
    }
  };

  const isNextDisabled = selectedYear === currentYear && selectedMonth >= currentMonth;

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Navegação por Mês</h2>
        
        <div className="flex items-center space-x-4">
          {/* Navigation Arrows */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviousMonth}
              className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              aria-label="Mês anterior"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={handleNextMonth}
              disabled={isNextDisabled}
              className={`p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                isNextDisabled 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
              aria-label="Próximo mês"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Month Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
              Mês:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => onMonthChange(parseInt(e.target.value), selectedYear)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {MONTHS.map((month, index) => (
                <option key={index + 1} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="year-select" className="text-sm font-medium text-gray-700">
              Ano:
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => onMonthChange(selectedMonth, parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Current Selection Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
            <span className="text-sm font-medium text-blue-800">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}