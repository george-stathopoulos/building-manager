# UI/UX standards (mandatory for every feature)

## Form controls
- Use shared `src/styles.css` form primitives. Never size a specific input to compensate for another field's label, hint, or validation text.
- Inputs and selects have a consistent 46px desktop / 44px mobile height. Textareas may grow independently. Checkboxes and radios retain their native dimensions.
- Grid children align at the start. Labels use intrinsic content height, not stretched grid rows. Helper/error text belongs below its own control and must not stretch adjacent controls.
- Use a consistent label/control spacing, clear focus ring, visible disabled state, and descriptive accessible names.
- Do not style an input to resemble a button; actions use buttons and data entry uses inputs.
- Use responsive grid layout: fields must remain readable on small screens and must not overflow their parent.

## Quality gate for future UI changes
1. Review all modified forms at desktop and mobile widths.
2. Test a row where one field has a hint or validation error and its neighbor has none.
3. Check controls for consistent height, alignment, spacing, focus, disabled and error states.
4. Check long Greek labels, month picker, number inputs, select arrows, and textarea resizing.
5. Ensure print-only styles do not leak into screen layouts and vice versa.
6. Fix reusable styles rather than adding local pixel-offset hacks.

The canonical styles are in `src/styles.css`; this file records the rules for contributors and AI-assisted changes.
