// Drag-and-drop is complicated.
//
// The process consists of different elements:
//  - Start dragging a source.
//  - Drop source on a target (drop zone).
//
// The operation performed depends on which source is dragged, and which target
// it's dropped upon.
//  - Add command to existing path command.
//  - Move command within existing path command.
//  - Delete command within existing path command.
//  - Etc.
//
// Not all html elements are drag sources.
//
// For a given source, there may be a limited set of targets it's allowed to be
// dropped on.
//
// Our app only has one set of methods to manage all events involved in drag-n-drop.
//  - dragStart
//  - dragEnter
//  - dragLeave
//  - drop
//
// To better manage the different operations which can only be determined after
// a drop, following library will provide types to track the drag source.
//
// Let the CommandPalette be the UI element providing a command set used to
// create new commands.
//
// Let the CommandPoint be the UI element displaying the set of commands that
// will be executed at a particular point on the path.
//
// The AddCommand operation requires:
//  - source: command from the CommandPalette
//  - target: spacer in the PathCommand
//
// The MoveCommand operation requires:
//  - source: command from the PathCommand
//  - target: spacer in the PathCommand
//    - exclude spacers adjacent to source command.
//
// The DeleteComand operation requires:
//  - source: command from the PathCommand
//  - target: delete UI element.

export const SourceType = {
  CommandPalette: 0,
  CommandPoint: 1,
};

export function DragSource(type, data) {
  return { type, data };
}

// Add a command from the command palette to the active command sequence.
export function CommandPaletteSource(commandName) {
  return DragSource(
    SourceType.CommandPalette,
    { commandName }
  );
}

export function CommandPointSource(nodeId) {
  return DragSource(
    SourceType.CommandPoint,
    { nodeId }
  );
}
