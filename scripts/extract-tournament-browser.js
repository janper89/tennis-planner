/**
 * Browser console script to extract tournament data
 * 
 * INSTRUCTIONS:
 * 1. Log into IPIN at https://ipin.itftennis.com
 * 2. Navigate to the tournament factsheet page
 * 3. Open browser console (F12 or Cmd+Option+I)
 * 4. Copy and paste this entire script
 * 5. Press Enter
 * 6. The JSON will be displayed and copied to clipboard
 */

(function() {
  'use strict';
  
  const data = {
    tournamentKey: null,
    tournamentName: null,
    city: null,
    startDate: null
  };

  // Extract Tournament Key from URL
  const urlParams = new URLSearchParams(window.location.search);
  data.tournamentKey = urlParams.get('tournamentId');

  // Helper function to find text in elements
  function findTextContent(selectors, pattern = null) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent.trim();
          if (text && (!pattern || pattern.test(text))) {
            return text;
          }
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }
    return null;
  }

  // Extract tournament name
  const nameSelectors = [
    'h1',
    'h2',
    '.tournament-name',
    '.tournament-title',
    '.factsheet-header h1',
    '.factsheet-header h2',
    '[class*="tournament"][class*="name"]',
    '[class*="title"]'
  ];
  data.tournamentName = findTextContent(nameSelectors);

  // Extract city - look in tables and text
  function findCity() {
    // Check tables
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        for (let i = 0; i < cells.length - 1; i++) {
          const label = cells[i].textContent.trim().toLowerCase();
          const value = cells[i + 1].textContent.trim();
          if (label.includes('city') || label.includes('location')) {
            return value;
          }
        }
      }
    }
    
    // Check for "City:" pattern in text
    const bodyText = document.body.innerText;
    const cityMatch = bodyText.match(/City[:\s]+([A-Za-z\s,]+)/i);
    if (cityMatch) {
      return cityMatch[1].trim();
    }
    
    return null;
  }
  data.city = findCity();

  // Extract start date
  function findStartDate() {
    // Check tables
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        for (let i = 0; i < cells.length - 1; i++) {
          const label = cells[i].textContent.trim().toLowerCase();
          const value = cells[i + 1].textContent.trim();
          if ((label.includes('start') || label.includes('date')) && value.match(/\d/)) {
            return value;
          }
        }
      }
    }
    
    // Check for date patterns in text
    const bodyText = document.body.innerText;
    const datePatterns = [
      /Start Date[:\s]+([^\n\r]+)/i,
      /Date[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        return (match[1] || match[0]).trim();
      }
    }
    
    return null;
  }
  data.startDate = findStartDate();

  // Output results
  const jsonOutput = JSON.stringify(data, null, 2);
  
  console.log('═══════════════════════════════════════');
  console.log('TOURNAMENT DATA EXTRACTED:');
  console.log('═══════════════════════════════════════');
  console.log(jsonOutput);
  console.log('═══════════════════════════════════════');
  
  // Try to copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(jsonOutput).then(() => {
      console.log('✓ JSON copied to clipboard!');
    }).catch(err => {
      console.log('⚠ Could not copy to clipboard:', err);
      console.log('Please copy the JSON above manually.');
    });
  } else {
    console.log('⚠ Clipboard API not available. Please copy the JSON above manually.');
  }
  
  // Also create a downloadable file
  const blob = new Blob([jsonOutput], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tournament-${data.tournamentKey || 'data'}.json`;
  document.body.appendChild(a);
  console.log('💾 Click the link below to download JSON file:');
  console.log(a);
  
  return data;
})();
