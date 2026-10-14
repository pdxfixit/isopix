// What picking a color does to the tool (owner, 2026-10-12: "clicking a color
// changes off of eraser to pencil mode"). Picking a color means "I want to
// paint": the Eraser becomes the Pencil. Line, Fill, Select and the Pencil
// keep their tool, since they use the color. Only an actual color pick calls
// this (a swatch or the custom picker), never the auto-shade toggle or "+".
export const toolAfterColorPick = (tool) => (tool === 'eraser' ? 'pencil' : tool);
