# Lane

Lane checks a bill against posted Medicare and New York fee files. It is built for Olean, and for any New York county a loaded file names.

Intake reads the bill. Price finds the year. New York uses the county on the file. Review marks what does not match. A person decides. Nothing is sent.

## The four teams

| Team | What it does | What it does not do |
|---|---|---|
| Intake | Reads each line: code, date, and charge. | Does not invent a code that is not written on the line. |
| Price | Shows one code and the amount for each year on the file. | Does not guess a code the file does not contain. |
| New York | Uses the county the file names. Personal care is the January 1, 2024 workbook. | Does not use one county’s rate for another county. |
| Review | Marks a charge that does not match the file. | Does not send the bill. A person decides. |

A matching line is teal. A mismatch is rust and names both amounts. Amber means a person has to look, and no amount is guessed.

## What this is not

Lane is not a payer. It does not submit a claim. It does not have a monthly program payment. Those stay with the program. It does not invent a rate.

## Place

Olean, New York, Cattaraugus County. Allegany is separate. Medicare on this desk is Rest of New York, MAC 13282, locality 99. Those physician amounts are not Manhattan, Queens, the New York City suburbs, or Poughkeepsie.

A Medicaid transportation fee is the fee for the county on the claim. The draft fix uses that same county.

## A gap stays empty

A later public sheet is used only when it names the county. These are still not on a free posted file, so they are not filled in:

- 97160
- New York Medicaid rehabilitation for 97110 and 97161
- New York Medicaid hospice, non-residence, after September 30, 2026
- No-fault, and workers’ compensation physician and therapy
- A Medicaid PACE rate

Medicare Rest of New York still prices 97110 and 97161. The 2026 PACE ratebook prices Medicare Parts A and B by county. That is not a Medicaid rate.

## Run

```bash
npm install
npm run dev
```

The desk listens on port 8080.

```bash
npm test
```

The tests cover the loaded files, the billing checks, and mixed years and bad codes. A bad line raises an alert. It is not sent.
