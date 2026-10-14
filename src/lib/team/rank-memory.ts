/** Seat memory for Rank. Nothing in this list is a price. */
export const RANK_MEMORY = {
  seat: "Rank",
  seatId: "takeover",
  locked: "2026-10-12",
  passed: { scripts: 197, lane: 20097, billing: 113, sim: 585, auth: 55 },
  checked: "2026-10-13",
  keep: [
    "The first page is the sheet. After it loads, Read, Price, and Except run. You pay, they want, the difference, and the flagged lines are shown, with the reason on each line. A year roll and a file roll appear only when the sheet has more than one, on the page and on the Report sheet. A match is not flagged. A blank amount stays blank. The spreadsheet still has every line. Nothing is sent.",
    "Rank orders an invoice look, then off, then match.",
    "Teal matches. Rust is a payment mismatch and names both amounts. Amber means a person has to look. No amount is guessed.",
    "An imported file is checked immediately. The charge column is the billed amount, not an allowed column.",
    "Mismatch and unknown lines stay in this browser. A match is not stored as an alert.",
    "New York uses the county the file names. Personal care is the January 1, 2024 workbook. One county’s rate is not used for another.",
    "Lane does not submit a claim and does not invent a rate.",
    "Inside the bill: Fee management holds the file, Finder stops at unknown, Audit compares their amount.",
    "Unknown for this year shows the last posted year beside it. That older amount is not used.",
    "The first line after a check is what you pay, what they want to pay, and the dollars on the wrong schedule.",
    "Save a workbook in the client layout: CLAIM TYPE, FACILITY, year, DATE OF SERVICE, SCHDULE, CPT CODE, MODIFIER, UNITS, CPT CODE LOOKUP, GROSS, PROVIDER BILLED, COLLABRIOS WANT TO PAY, I WANT TO PAY, the 0.98 rate, the amount after 0.98, DIFF, DESCRIPTION, FLAG. Their lookup stays their lookup. I WANT TO PAY is the file times the units, and it is left blank when the file has no dollar. The Report sheet compares the two amounts and flags a wrong schedule, a lookup that does not match, an amount that does not match, and an unknown. A missing dollar is not written as zero. Nothing is sent.",
    "Tap a code to see every year, place, and modifier of that code on the sheet. A 26 or TC line is not the global amount. Another row is not the price.",
    "The spider opens the physician, equipment, ambulance, lab, drug, and HCPCS pages, plus the code list and New York. A code in a link address or label is looked up next. E0431, 99213, 99214, 97110, 97161, A0428, and A0425 stay on the posted file. A page dollar is not the payment.",
    "rankBrief and rankInvoice both stay in the rank file.",
  ],
} as const;
