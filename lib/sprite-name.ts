/**
 * The UI never shows the word "Sprite" in a name. Catalog names all carry it
 * ("Jonesy Sprite", "Gold Jonesy Sprite", "Loot Hacker Jonesy Sprite"), so
 * every place that displays a name goes through here. Any variant prefix is
 * kept ("Gold Jonesy"), so variants stay distinguishable from their base.
 */
export function displayName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/\bsprite\b/gi, "").replace(/\s+/g, " ").trim();
}
