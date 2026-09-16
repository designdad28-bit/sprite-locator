/**
 * "HEATWAVE HARBOR" → "Heatwave Harbor", "REALITY'S REIGN" → "Reality's Reign".
 *
 * POI names are stored upper-case in public/data/pois.json; both the Add
 * finding form and the rows we write to Supabase read better in title case.
 * Splits on spaces rather than word boundaries, so the "s" after an
 * apostrophe stays lower-case.
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
