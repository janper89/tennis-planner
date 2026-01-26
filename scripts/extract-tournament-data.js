/**
 * Script to extract tournament data from ITF IPIN tournament factsheet page
 * 
 * Usage options:
 * 1. Browser console: Copy and paste this script into browser console after logging into IPIN
 * 2. Node.js with Puppeteer: Run with node scripts/extract-tournament-data.js
 */

// Tournament URL
const TOURNAMENT_URL = 'https://ipin.itftennis.com/factsheet?tournamentId=f25547bf-5bf7-407a-bd96-142afa09f2bc&circuitId=4a17c0c7-3dd4-4193-b868-dadfdf16732f';

/**
 * Extract tournament data from the page
 * This function works when run in browser console on the factsheet page
 */
function extractTournamentData() {
  const data = {
    tournamentKey: null,
    tournamentName: null,
    city: null,
    startDate: null
  };

  // Extract Tournament Key from URL or page
  const urlParams = new URLSearchParams(window.location.search);
  data.tournamentKey = urlParams.get('tournamentId') || null;

  // Try to find tournament name - common selectors for tournament pages
  const nameSelectors = [
    'h1',
    '[data-testid="tournament-name"]',
    '.tournament-name',
    '.tournament-title',
    'h2.tournament-name',
    '.factsheet-header h1',
    '.factsheet-header h2'
  ];

  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      data.tournamentName = element.textContent.trim();
      break;
    }
  }

  // Try to find city
  const citySelectors = [
    '[data-testid="tournament-city"]',
    '.tournament-city',
    '.city',
    '.location',
    '.factsheet-location',
    'td:contains("City")',
    'th:contains("City")'
  ];

  for (const selector of citySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const cityText = element.textContent.trim();
      if (cityText && !cityText.toLowerCase().includes('city')) {
        data.city = cityText;
        break;
      }
    }
  }

  // Look for city in table rows
  const allText = document.body.innerText;
  const cityMatch = allText.match(/City[:\s]+([^\n\r]+)/i);
  if (cityMatch && !data.city) {
    data.city = cityMatch[1].trim();
  }

  // Try to find start date
  const dateSelectors = [
    '[data-testid="tournament-start-date"]',
    '.tournament-start-date',
    '.start-date',
    '.date',
    '.factsheet-date',
    'td:contains("Start Date")',
    'th:contains("Start Date")',
    'td:contains("Date")',
    'th:contains("Date")'
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const dateText = element.textContent.trim();
      if (dateText && dateText.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/)) {
        data.startDate = dateText;
        break;
      }
    }
  }

  // Look for date patterns in text
  const datePatterns = [
    /Start Date[:\s]+([^\n\r]+)/i,
    /Date[:\s]+([^\n\r]+)/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/
  ];

  for (const pattern of datePatterns) {
    const match = allText.match(pattern);
    if (match && !data.startDate) {
      data.startDate = match[1] || match[0];
      break;
    }
  }

  // Try to extract from tables
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const label = cells[0].textContent.trim().toLowerCase();
        const value = cells[1].textContent.trim();
        
        if (label.includes('city') && !data.city) {
          data.city = value;
        }
        if ((label.includes('start') || label.includes('date')) && !data.startDate) {
          data.startDate = value;
        }
        if (label.includes('name') || label.includes('tournament') && !data.tournamentName) {
          data.tournamentName = value;
        }
      }
    });
  });

  return data;
}

// If running in browser console
if (typeof window !== 'undefined') {
  const result = extractTournamentData();
  console.log('Tournament Data:', result);
  console.log('JSON:', JSON.stringify(result, null, 2));
  
  // Copy to clipboard if possible
  if (navigator.clipboard) {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      .then(() => console.log('✓ JSON copied to clipboard'))
      .catch(err => console.log('Could not copy to clipboard:', err));
  }
  
  // Return for manual copy
  return result;
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractTournamentData, TOURNAMENT_URL };
}
