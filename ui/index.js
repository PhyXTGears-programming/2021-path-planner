// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

// I'm adding _* spots around the code to make easy bookmarks. Listed w/ - to prevent trigger:
/*
  -C - Constants
  -SU - "Setup;" background and setup functions for the app
  -CL - Click
  -CA - Canvas (Specifically drawing)
  -P0 - Pose Stuff
  -COM - Commands Stuff
  -ROT - Rotation Stuff
  -BEXP - Bot Export Stuff
*/

import { mouseEventToCanvasPoint } from './js/canvas-util.js';

import { tintStyle } from './js/color.js';

import Point from './js/geom/point.js';
import Vector from './js/geom/vector.js';
import { RotationList, Rotation, toRadians } from './js/rotation.js';

import { throttleLast } from './js/timer.js';

import { IdGen, clamp } from './js/util.js';

import {
  importPoses, exportPoses, Pose, PoseList, botExport, ExportChunk
} from './js/pose.js';

import Viewport from './js/viewport.js';

import { accelerate } from './js/robot/distanceToVelocity.js';

import { ActionNode, CommandPointList, CommandPoint } from './js/commandpoint.js';

// JSDoc types

/** @external {object} Canvas */

/** @external {object} Context2d */

/** @typedef {import('./js/pose.js').Pose} Pose */

/** @typedef {import('./js/pose.js').PoseList} PoseList */

const { open, save } = window.__TAURI__.dialog;
const { exists, readTextFile, writeTextFile } = window.__TAURI__.fs;
const { documentDir } = window.__TAURI__.path;

// Custom types

const FRC_SEASON = '2024';

// Constants _C

const Tool = {
  POSE: 0,
  WAYPOINT: 1,
  FINISH: 2,
  NONE: 3,
  SELECT: 4,
  DELETE: 5,
  COMMANDS: 6,
  ROTATION: 7,
};

const SelectState = {
  NONE: 0,
  MOVE_POSE: 1,
  MOVE_ENTER_HANDLE: 2,
  MOVE_EXIT_HANDLE: 3,
}

const RotationState = {
  NONE: 0,
  NEW: 1,
  MOVE: 2,
  ROTATE: 3,
}

const colors = {
  handle: {
    enter: {
      color: '#03a9f4',
      selected: {
        color: '#76ff03',
      },
    },
    exit: {
      color: '#ff9800',
      selected: {
        color: '#76ff03',
      },
    },
  },
};

const toolStateToName = {
  [Tool.POSE]: 'pose',
  [Tool.WAYPOINT]: 'waypoint',
  [Tool.FINISH]: 'finish',
  [Tool.NONE]: '',
  [Tool.SELECT]: 'select',
  [Tool.DELETE]: 'delete',
  [Tool.COMMANDS]: 'commands',
  [Tool.ROTATION] : 'rotation',
};

const styles = {
  default:      { primary: '#ccc',  secondary: '#282828' },
  robotActive:  { primary: '#fffa', secondary: '#777a' },
  robotNormal:  { primary: '#666a', secondary: '#333a' },
  robotHovered: { primary: '#aaac', secondary: '#555c' },
};

// Global variables

// const frog = {attributes : ["kindness", "beauty", "just incredible"], dangerLevel: "Cognitohazard"};

// A noop is a function that performs "no operation".
// When we have a variable that must hold a function (never null), but we don't have any
// particular action we want to perform, we can lend that variable noop, so it at least
// has a function (so it's happy) that does nothing (so dev is happy).
const noop = () => {}; // ?????? what is noop? I'm the confused one for once??? (- The Frog Man)

let toolState = Tool.NONE;
const images = {};
let poseList = PoseList();
let rotationList = new RotationList();
let commandPointList = CommandPointList();

let hoveredPose = null;
let activePose = null;

let hoveredHandle = null;
let moveHandle = null;

let hoveredRotation = null;
let rotationState = null;
let activeRotation = null;

let actionedCommandPoint = null;
let hoveredCommandPoint = null;

let selectState = SelectState.NONE;

let importFileName = '';
let saveFileName = '';

let targetNode = null;
let spacerTarget = null;

const ORIGIN = Point(0, 0);

const genId = IdGen();

let mousePt = Point(0, 0);
let nearestPt = { t: -1, pt: Point(0, 0) }

let drawToolPt = Point(0, 0);

let inputState = {
  isShiftDown: false,
  isMouseMiddleDown: false,
};

// Example:
// commandImages.set('lowerIntake', './images/temp-lower.png')
const commandImages = new Map();

const ZOOM_FACTOR = 1.2;

const canvasViewport = Viewport(ZOOM_FACTOR);

const config = {
  imageFiles: [
    {
      name: 'pose',
      file: './images/start.png',
    },
    {
      name: 'waypoint',
      file: './images/waypoint.png',
    },
    {
      name: 'finish',
      file: './images/finish.png',
    },
    {
      name: 'select',
      file: './images/finish.png',
    },
    {
      name: 'delete',
      file: './images/delete.png',
    },
    {
      name: 'commands',
      file: './images/temp-lower.png',
    },
  ],
};

const seasonConfig = {
  isLoaded () { return null !== this.config; },

  get fieldDims () {
    if (!this.isLoaded()) {
      return null;
    }

    return {
      ...this.config.fieldDims,
      xPixels: this.config.image.width,
      yPixels: this.config.image.height,
    };
  },

  // _SU
  loadSeason (year) {
    const self = this;

    return Promise.all([
      fetch(`./season/${year}/config.json`)
        .then(resp => {
          if (!resp.ok) {
            alert(`Cannot load season ${FRC_SEASON} config file. ${resp.text()}`);
            throw Error('Failed to load season config');
          }

          return resp.json();
        }),
      loadImage('field', `./season/${year}/field.png`)
        .then(res => res.image),
    ]).then(([ config, image ]) => {
      self.config = Object.assign(config, { image, year });
      return self;
    }).catch(err => {
      self.config = null;
      throw `Failed to load season config: ${err}`;
    });
  },

  config: null,
};

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');

  (new Promise((ok, _err) => loadImages(ok)))
    .then(() => seasonConfig.loadSeason(FRC_SEASON))
    .then(updateRobotCommands)
    .then(() => {
      onFieldLoaded(canvas);

      if (actionedCommandPoint) {
        drawAllNodes(actionedCommandPoint.commands);
      }
    })
    .catch(err => console.error('dom content loaded', err));
})

function updateRobotCommands() {
  if (!seasonConfig.isLoaded()) {
    console.error('season config is not loaded. unable to update robot commands');
    return;
  }

  const listElem = document.getElementById('robot-command-list');

  // Remove current children in robot command list.
  while (listElem.firstChild) {
    listElem.removeChild(listElem.lastChild);
  }

  commandImages.clear();

  // Add robot commands from season config.
  for (const cmd of seasonConfig.config.robot.commands) {
    const imgSrc = (cmd.image)
      ? `./season/${seasonConfig.config.year}/${cmd.image}`
      : './images/default-command-icon.png';

    // Update command list GUI.
    const imgElem = document.createElement('img');
    imgElem.src = imgSrc;
    imgElem.draggable = true;
    imgElem.id = cmd.name;
    imgElem.title = cmd.name;
    imgElem.classList.add('o-action-command-icon');

    const itemElem = document.createElement('li');
    itemElem.appendChild(imgElem);

    listElem.appendChild(itemElem);

    // Add command images to image index.
    commandImages.set(cmd.name, imgSrc);
  }
}

// Load all images in parallel, wait for all images to finish loading,
// then activate onDone function.
function loadImages(onDone) {
  let loadCount = config.imageFiles.length;

  const onImageLoaded = _ev => {
    loadCount -= 1;

    if (0 == loadCount) {
      onDone();
    }
  };

  for (let entry of config.imageFiles) {
    images[entry.name] = new Image();
    images[entry.name].src = entry.file;
    images[entry.name].addEventListener('load', onImageLoaded, { once: true });
  }
}

function loadImage(name, filename) {
  return new Promise((resolve, _reject) => {
    const image = new Image();
    const onLoad = () => resolve({ name, image });

    image.src = filename;
    image.addEventListener('load', onLoad, { once: true });
  });
}

function onFieldLoaded(canvas) {
  if (!seasonConfig.isLoaded()) {
    console.error('season config is not loaded');
    return;
  }

  canvas.width = seasonConfig.config.image.width;
  canvas.height = seasonConfig.config.image.height;

  redrawCanvas(canvas, poseList);

  // Mouse buttons.
  const LEFT_BUTTON = 0;
  const MIDDLE_BUTTON = 1;

  canvas.addEventListener('click', ev => {// _CL
    if (LEFT_BUTTON !== ev.button) {
      return;
    }

    // Compute the canvas position of the cursor relative to the canvas.
    const clickVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    // Compute field position of cursor with current zoom+pan.
    const { x, y } = canvasViewport.toViewCoord(clickVec);

    switch (toolState) {
      case Tool.NONE:
        //Do nothing
        break;

      case Tool.SELECT:
        //Do nothing?
        break;

      case Tool.POSE:
        if (ev.shiftKey) {

          repositionRotsAndDo('insert');

        } else {
          // Append pose.
          placePointAt(x, y);
          // poseList.updateMoveSwitchPerms();
        }

        redrawCanvas(canvas, poseList);
        break;

      case Tool.DELETE:

        let nearestRotation = findRotationNear(x, y);

        if (nearestRotation && nearestRotation.index != 0) {
          repositionRotsAndDo('deleteRotation', rotationList.rotations[nearestRotation.index]);
        } else if (hoveredPose) {
          repositionRotsAndDo('deleteWaypoint', Point(x, y));
        }

        deleteTouchedCmdPtIfAny(Point(x, y));

        break;

      case Tool.COMMANDS:
      //   actionedControl = findPoseNear(x, y);

      //   if (!actionedControl) {
      //     clearAllNodes();
      //     break;
      //   } else {
      //     drawAllNodes(actionedControl.commands);
      //   }


      //   if (poseList.poses.indexOf(actionedControl) == 0) {
      //     setEditHeadingVisible(true);
      //   } else {
      //     setEditHeadingVisible(false);
      //   }
      //   break;



      let chosenCmdT = poseList.findTNearPoint(Point(x, y));

      if (!inputState.isShiftDown) {
        chosenCmdT = tSnappedToPoses(chosenCmdT);
      }

      commandPointList.newCommandPoint(chosenCmdT);
      break;

      case Tool.ROTATION:
        if (rotationState == RotationState.NEW) {
          makeRotation(nearestPt.t);
        }
        rotationState = RotationState.NONE;

        redrawCanvas(canvas, poseList);

        break;
    }
  });

  // Mouse move handler to draw tool icon that follows mouse cursor.
  canvas.addEventListener('mousemove', ev => {
    // Reset ui state variables.  Make sure to reaquire hovered widget before event ends.
    hoveredHandle = null;
    hoveredPose = null;
    hoveredRotation = null;

    // Compute the canvas position of the cursor relative to the canvas.
    const clickVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    drawToolPt = clickVec;

    // Compute field position of cursor with current zoom+pan.
    const { x, y } = canvasViewport.toViewCoord(clickVec);

    mousePt = Point(x, y);

    switch (toolState) {
      case Tool.COMMANDS:
        // hoveredPose = findPoseNear(x, y);
        hoveredCommandPoint = poseList.findTNearPoint(mousePt, 50).pt;
        break;

        case Tool.SELECT:

        moveDraggingCmdPtIfApplicable(poseList.findTNearPoint(mousePt));

        switch (selectState) {
          case SelectState.MOVE_POSE:
            const posePt = mousePt.addVec(activePose.offset);

            activePose.pose.point = posePt;

            hoveredPose = findPoseNear(x, y);

            break;

          case SelectState.MOVE_ENTER_HANDLE:
            const enterPt = mousePt.addVec(moveHandle.offset);
            const enterVec = enterPt.sub(moveHandle.pose.point);

            moveHandle.pose.exitHandle = enterVec.scale(-1).unit().scale(moveHandle.pose.exitHandle.length());
            moveHandle.pose.enterHandle = enterVec;

            hoveredHandle = findHandleNear(x, y);

            break;

          case SelectState.MOVE_EXIT_HANDLE:
            const exitPt = mousePt.addVec(moveHandle.offset);
            const exitVec = exitPt.sub(moveHandle.pose.point);

            moveHandle.pose.exitHandle = exitVec;
            moveHandle.pose.enterHandle = exitVec.scale(-1).unit().scale(moveHandle.pose.enterHandle.length());

            hoveredHandle = findHandleNear(x, y);

            break;

          case SelectState.NONE:
            updateElementNear(x, y);

            break;
        }
        break;

      case Tool.NONE:
        //Don't do anything
        break;

      case Tool.POSE:
        break;

      case Tool.DELETE:
        hoveredPose = findPoseNear(x, y);

        break;

      case Tool.ROTATION:
        switch (rotationState) {
          case RotationState.NONE:
            hoveredRotation = findRotationNear(x, y);
            break;

          case RotationState.NEW:
            rotationState = RotationState.NONE;
            hoveredRotation = findRotationNear(x, y);
            break;

          case RotationState.MOVE:
            // don't move when mouse moves off of valid t vals
            if (poseList.findTNearPoint(Point(x, y), 50).t != -1) {
              activeRotation.rotation.t = poseList.findTNearPoint(Point(x, y), 50).t;
            }
            break;

          case RotationState.ROTATE:
            const { pt, rotation } = activeRotation;
            rotation.setRotVal(getAngleToCursor(pt, Point(x, y)));

            break;
        }
        break;
    }

    redrawCanvas(canvas, poseList);
  });

  canvas.addEventListener('mousedown', ev => {
    if (LEFT_BUTTON !== ev.button) {
      return;
    }

    // Compute the canvas position of the cursor relative to the canvas.
    const clickVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    // Compute field position of cursor with current zoom+pan.
    const { x, y } = canvasViewport.toViewCoord(clickVec);

    const mousePt = Point(x, y);

    switch (toolState) {
      case Tool.POSE:
        break;

      case Tool.SELECT:

      actionedCommandPoint = cmdPtObjNear(mousePt);

      if(actionedCommandPoint !== null) {
        break;
      }

        if (hoveredPose != null) {
          selectState = SelectState.MOVE_POSE;

          activePose = {
            offset: hoveredPose.point.sub(mousePt),
            pose: hoveredPose,
          };
        } else if (hoveredHandle != null) {
          let offset;

          if (hoveredHandle.isEnter) {
            selectState = SelectState.MOVE_ENTER_HANDLE;
            offset = hoveredHandle.pose.point.addVec(hoveredHandle.pose.enterHandle).sub(mousePt);

          } else {
            selectState = SelectState.MOVE_EXIT_HANDLE;
            offset = hoveredHandle.pose.point.addVec(hoveredHandle.pose.exitHandle).sub(mousePt);
          }

          moveHandle = {
            offset,
            pose: hoveredHandle.pose,
          }
        }
        break;

      case Tool.ROTATION:
        if (hoveredRotation != null
          && 0 < hoveredRotation.index
          && innerOrOuterRadius(mousePt, hoveredRotation.pt) == 'inner'
        ) {
          rotationState = RotationState.MOVE;
          activeRotation = hoveredRotation;
        } else if (hoveredRotation != null && innerOrOuterRadius(mousePt, hoveredRotation.pt) == 'outer') {
          rotationState = RotationState.ROTATE;
          activeRotation = hoveredRotation;
        } else {
          rotationState = RotationState.NEW;
          activeRotation = null;
        }

        break;

      default:
        break;
    }

    redrawCanvas(canvas, poseList);
  });

  canvas.addEventListener('mouseup', ev => {
    if (LEFT_BUTTON != ev.button) {
      return;
    }

    // Compute the canvas position of the cursor relative to the canvas.
    const clickVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    // Compute field position of cursor with current zoom+pan.
    const { x, y } = canvasViewport.toViewCoord(clickVec);

    mousePt = Point(x, y);

    actionedCommandPoint = null;

    switch (toolState) {
      case Tool.COMMANDS:
        activePose = { pose: hoveredPose };

        break;

      case Tool.POSE:
        break;

      case Tool.SELECT:
        switch (selectState) {
          case SelectState.MOVE_POSE:
            selectState = SelectState.NONE;
            activePose = null;
            break;

          case SelectState.MOVE_ENTER_HANDLE:
            selectState = SelectState.NONE;
            moveHandle = null;
            break;

          case SelectState.MOVE_EXIT_HANDLE:
            selectState = SelectState.NONE;
            moveHandle = null;
            break;


        }
        break;

      case Tool.ROTATION:
        if (rotationState == RotationState.ROTATE && activeRotation) {
          if (findNearestRotationIndex(mousePt) >= 0) {
            const { pt, rotation } = activeRotation;

            rotation.setRotVal(getAngleToCursor(pt, mousePt));
          }

          selectState = SelectState.NONE;
          rotationState = RotationState.NONE;
          activeRotation = null;
        }

        break;

      default:
        break;
    }

    redrawCanvas(canvas, poseList);
  });

  // Mouse down handler to pan the canvas view.
  canvas.addEventListener('mousedown', ev => {
    if (MIDDLE_BUTTON !== ev.button) {
      return;
    }

    inputState.isMouseMiddleDown = true;

    // Compute the canvas position of the cursor relative to the canvas.
    const startVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    canvasViewport.startPan(startVec);
    redrawCanvas(canvas, poseList);
  });

  // Mouse up handler to pan the canvas view.
  canvas.addEventListener('mouseup', ev => {
    if (MIDDLE_BUTTON == ev.button) {
      inputState.isMouseMiddleDown = false;
    }
  });

  // Mouse move handler to pan the canvase.
  canvas.addEventListener('mousemove', ev => {
    if (MIDDLE_BUTTON !== ev.button && !inputState.isMouseMiddleDown) {
      return;
    }

    // Compute the canvas position of the cursor relative to the canvas.
    const endVec = mouseEventToCanvasPoint(ev, canvas).vecFromOrigin();

    canvasViewport.pan(endVec);
    redrawCanvas(canvas, poseList);
  });

  // Mouse wheel to zoom the canvas view.
  canvas.addEventListener('mousewheel', ev => {
    // Compute the canvas position of the cursor relative to the canvas.
    const clickPt = mouseEventToCanvasPoint(ev, canvas);

    if (ev.deltaY > 0) {
      canvasViewport.zoomIn(clickPt);
    } else if (ev.deltaY < 0) {
      canvasViewport.zoomOut(clickPt);
    }

    redrawCanvas(canvas, poseList);
  });

  // Shift key handlers
  window.addEventListener('keyup', ev => {
    if ('Shift' === ev.key) {
      inputState.isShiftDown = false;
      redrawCanvas(canvas, poseList);
    }
  });

  window.addEventListener('keydown', ev => {
    if ('Shift' == ev.key) {
      inputState.isShiftDown = true;
      redrawCanvas(canvas, poseList);
    }
  });

  canvas.addEventListener('mousemove', ev => {
    inputState.isShiftDown = ev.shiftKey;
  });

  // Adding event handlers for toolbar icons

  const tool_map = [
    {
      id: 'pose-tool',
      state: Tool.POSE,
    },
    {
      id: 'select-tool',
      state: Tool.SELECT,
    },
    {
      id: 'delete-tool',
      state: Tool.DELETE,
    },
    {
      id: 'commands-tool',
      state: Tool.COMMANDS,
    },
    {
      id: 'rotation-tool',
      state: Tool.ROTATION,
    },
  ];

  for (let tool of tool_map) {
    const elem = document.getElementById(tool.id);
    elem.addEventListener('click', () => {
      toolState = tool.state;

      document.querySelectorAll('.toolbar .tool').forEach(item => item.classList.remove('active'));
      elem.classList.add('active');

      redrawCanvas(canvas, poseList);
    });
  }

  document.getElementById('save-file').addEventListener('click', _ev => {
    documentDir()
      .then(docDir =>
        save({
          defaultPath: docDir,
          filters: [{
            name: 'Json',
            extensions: [ 'json' ],
          }],
        })
      ).then(filename => {
        // Leave filename in text box if user cancels Save File dialog.
        if (null !== filename) {
          saveFileName = filename;

          const saveFileNameShort = saveFileName.split("/").slice(-1);
          const saveFileElem = document.getElementById('save-file');

          saveFileElem.value = saveFileNameShort;
          saveFileElem.title = saveFileName;
        }
      });
  });

  document.getElementById('export').addEventListener('click', _ev => {
    const payload = exportPoses(poseList, seasonConfig.fieldDims, rotationList);
    const data = JSON.stringify(payload, null, 4);

    console.log('export data', payload);

    writeTextFile(saveFileName, data);
  });

  document.getElementById('export-for-bot').addEventListener('click', () => {
    const payload = botExport(poseList, rotationList.rotations, bakeAdvancedExport);
    const data = JSON.stringify(payload, null, 4);

    console.log('Bot export payload: ', payload);

    writeTextFile(saveFileName, data);
  });

  document.getElementById('load-file').addEventListener('click', _ev => {
    documentDir()
      .then(docDir =>
        open({
          defaultPath: docDir,
          filters: [{
            name: 'Json',
            extensions: [ 'json' ],
          }],
        })
      ).then(selected => {
        if (Array.isArray(selected)) {
          importFileName = selected[0];
        } else if (null === selected) {
          // Do nothing.
        } else {
          importFileName = selected;
        }

        const importFileNameShort = importFileName.split("/").slice(-1);
        const importFileElem = document.getElementById('load-file');

        importFileElem.value = importFileNameShort;
        importFileElem.title = importFileName;
      })
  });

  document.getElementById('import').addEventListener('click', _ev => {
    if (null === importFileName) return;
    if ("" === importFileName) return;

    exists(importFileName)
      .then(hasFile => {
        if (hasFile) {
          readTextFile(importFileName)
            .then(text => JSON.parse(text))
            .then(data => importPoses(data, seasonConfig.fieldDims, genId) )
            .then(p => { poseList = p.poseList; return p; })
            .then(r1 => { return revertRotOffset(r1.rotationList.rotations, r1.rotationOffset); })
            .then(r2 => { rotationList.rotations = convertAllRotDegToRad(r2.rotations) })
            .then(() => redrawCanvas(canvas, poseList));
        }
      })

  });
}

/**
 * @function
 * @param {Canvas} canvas
 * @param {PoseList} poseList
 */
const redrawCanvas = throttleLast(100, _redrawCanvas);

/**
 * @function
 * @param {Canvas} canvas
 * @param {PoseList} poseList
 * @param {object} options
 *
 * options :: { onOverlay :: (canvas) -> Void }
 */
function _redrawCanvas(canvas, poseList, options = {}) { // _CA
  // Calculate the t value nearest to the mouse.
  // Do this before any drawing, so that anything drawn that needs the nearestPt will have a correct value.
  // Would prefer to calculate outside of the draw function, but we must compute just before every redraw, so here we be.
  {
    if (0 < poseList.length) {
      let nearest;

      if (nearestPt.t < 0.0) {
        nearest = poseList.findTNearPoint(mousePt, 50);
      } else {
        nearest = poseList.findNextTNearPoint(mousePt, nearestPt.t - 1, 50);
      }

      if (0.0 <= nearest.t) {
        // We found a nearest point.
        const { t , pt } = nearest; // Discard distance squared.
        nearestPt = { t, pt };
      } else {
        // No point found, invalidate the value.
        nearestPt = { t: -1, pt: Point(0, 0) };
      }
    }
  }

  const context = canvas.getContext('2d');

  // Clear previous transform.  Return to unit coordinate system.
  context.setTransform();

  // Clear screen.
  context.rect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#282828';
  context.fill();

  // Save canvas transform.
  context.save();

  // Reposition origin to hold zoom location under cursor.
  // Switch to viewport coordinate system.
  context.translate(canvasViewport.offset.x, canvasViewport.offset.y);
  context.scale(canvasViewport.scale, canvasViewport.scale);

  // Draw canvas objects in viewport coordinate system.
  drawField(context);
  drawAllPoses(context, poseList);
  drawAllCommandPoints(context);
  drawBezier(context, poseList);

  if (toolState == Tool.SELECT) {
    drawAllHandleLines(context, poseList);
    drawAllHandleDots(context, poseList);
  }

  drawRotations(context, poseList);

  if (shallDrawHighlight() && hoveredRotation != null) {
    drawHighlight(context, calcRotationPos(hoveredRotation.rotation));
  } else if (shallDrawHighlight() && hoveredCommandPoint != null) {
    if (!inputState.isShiftDown) {
      drawHighlight(context, poseList.pointAt(tSnappedToPoses(poseList.findTNearPoint(hoveredCommandPoint)).t));
    } else {
      drawHighlight(context, hoveredCommandPoint);
    }
  }

  if (shallDrawNearestPoint()) {
    drawNearestPoint(context);
  }

  // Restore canvas transform.
  context.restore();

  // Draw overlays in unit coordinate system here.

  if (shallDrawTool()) {
    const { size } = seasonConfig.config.robot.parameters;
    const w = size.xmeters * seasonConfig.fieldDims.xPixels / seasonConfig.fieldDims.xmeters;
    const h = size.ymeters * seasonConfig.fieldDims.yPixels / seasonConfig.fieldDims.ymeters;

    context.save();

    context.translate(drawToolPt.x, drawToolPt.y);

    context.save();
    context.scale(canvasViewport.scale, canvasViewport.scale);
    drawRobot(context, w, h, styles.robotNormal);
    context.restore();

    drawTool(context, toolStateToName[toolState]);

    context.restore();
  }

  if ('function' == typeof options.onOverlay) {
    options.onOverlay(canvas);
  }
}

function drawField(context) {
  if (seasonConfig.isLoaded()) {
    context.drawImage(seasonConfig.config.image, 0, 0);
  }
}

function drawCircle(context, x, y, r) {
  context.beginPath();
  context.arc(x, y, r, 0, 2 * Math.PI, false);
}

function drawRobot(context, w, h, style = styles.default) {
  if (w < 0 || h < 0) {
    return;
  }

  // Outside chassis components.
  const odx = w / 2;
  const ody = h / 2;

  // Inside chassis components.
  const idx = odx - 8;
  const idy = ody - 8;

  // Arrow components.
  const adx = idx * 0.25;
  const ady = idx * 0.50;

  context.save();

  context.beginPath();
  context.moveTo(-odx, -ody);
  context.lineTo( odx, -ody);
  context.lineTo( odx,  ody);
  context.lineTo(-odx,  ody);
  context.closePath();

  context.moveTo(-idx, -idy);
  context.lineTo(-idx,  idy);
  context.lineTo( idx,  idy);
  context.lineTo( idx, -idy);
  context.closePath();

  // Draw forward arrow.
  context.moveTo( adx, -ady);
  context.lineTo( idx,    0);
  context.lineTo( adx,  ady);
  context.closePath();

  context.fillStyle = style.primary;
  context.fill();

  context.beginPath();
  context.moveTo(-idx, -idy);
  context.lineTo(-idx,  idy);
  context.lineTo( idx,  idy);
  context.lineTo( idx, -idy);
  context.closePath();

  // Cut forward arrow.
  context.moveTo( adx, -ady);
  context.lineTo( idx,    0);
  context.lineTo( adx,  ady);
  context.closePath();

  context.fillStyle = style.secondary;
  context.fill();

  context.restore();
}

function drawTool(context, tool) {
  // Center tool image on cursor.
  const tx = -images[tool].width / 2;
  const ty = -images[tool].height / 2;

  context.save();
  context.scale(0.5, 0.5);
  context.translate(tx, ty);
  context.globalCompositeOperation = 'overlay';
  context.drawImage(images[tool], 0, 0);
  context.restore();
}

function alignPath(path, dirVec) {
  return path.map(pt => calcPointOnVector(pt, dirVec));
}

function drawPath(context, path) {
  const first = path[0];
  const rest = path.slice(1);

  context.moveTo(first.x, first.y);

  for (let point of rest) {
    context.lineTo(point.x, point.y);
  }
}

function drawArrowPath(context, dirVec) {
  drawPath(context, alignPath(arrowPoints(), dirVec));
  context.closePath();
  context.moveTo(0, 0);
};

function drawArrowHeadPath(context, dirVec) {
  drawPath(context, alignPath(arrowHeadPoints(), dirVec));
  context.closePath();
  context.moveTo(0, 0);
}

function drawMoveWidget(context) {
  drawArrowPath(context, Vector.i);
  drawArrowPath(context, Vector.i.scale(-1));
  drawArrowPath(context, Vector.j);
  drawArrowPath(context, Vector.j.scale(-1));
}

/**
 * @param {Context2d} context
 * @param {Pose} pose
 * @param {object} [options={}]
 *
 * options = { robotTint : HexColor }
 */
function drawPose(context, pose, options = {}) {
  const isHovered = pose === hoveredPose;
  const isActive = !!activePose && pose === activePose.pose;

  const canEdit = isHovered && toolState == Tool.COMMANDS;
  const canMove = isHovered && toolState == Tool.SELECT;
  const canDelete = isHovered && toolState == Tool.DELETE;

  const isEditActive = !!isActive && toolState == Tool.COMMANDS;
  const isMoveActive = !!isActive && selectState == SelectState.MOVE_POSE;

  context.save();

  context.translate(pose.point.x, pose.point.y);

  // Center tool image on cursor.
  {
    const { size } = seasonConfig.config.robot.parameters;
    const w = size.xmeters * seasonConfig.fieldDims.xPixels / seasonConfig.fieldDims.xmeters;
    const h = size.ymeters * seasonConfig.fieldDims.yPixels / seasonConfig.fieldDims.ymeters;
    const viewSize = Vector(w, h);

    const prevRotation = findRotationBefore(pose.point.x, pose.point.y);

    const style = (() => {
      const base = (isEditActive || isMoveActive)
        ? styles.robotActive
        : (canDelete || canEdit || canMove)
        ? styles.robotHovered
        : styles.robotNormal;

      return (options.hasOwnProperty('robotTint'))
        ? tintStyle(base, options.robotTint)
        : base;
    })();

    context.save();

    if (prevRotation) {
      context.rotate(prevRotation.rotation.rot);
    }

    drawRobot(context, viewSize.x, viewSize.y, style);

    context.restore();
  }

  if (canMove || isMoveActive) {

    context.globalCompositeOperation = 'xor';

    context.scale(1.0 / canvasViewport.scale, 1.0 / canvasViewport.scale);
    context.scale(45.0, 45.0);

    context.beginPath();
    drawMoveWidget(context);

    context.fillStyle = "#ccc8";
    context.fill();

  }

  context.restore();
}

function drawAllPoses(context, poseList) {
  if (poseList.length < 1) return;

  const first = poseList.poses.slice(0, 1);
  const inner = poseList.poses.slice(1, -1);
  const last = poseList.poses.slice(-1);

  drawPose(context, first[0], { robotTint: '#0f0' });

  for (let pose of inner) {
    drawPose(context, pose, { robotTint: '#ff0' });
  }

  if (poseList.length > 1) {
    drawPose(context, last[0], { robotTint: '#f00' });
  }
}

function drawBezier(context, poseList) {
  if (2 > poseList.length) {
    return;
  }

  let pose1 = poseList.poses[0];

  context.save();
  context.lineWidth = 2.0;
  context.beginPath();
  context.moveTo(pose1.point.x, pose1.point.y);

  for (let pose2 of poseList.poses.slice(1)) {
    const exitPt = pose1.point.addVec(pose1.exitHandle);
    const enterPt = pose2.point.addVec(pose2.enterHandle);

    context.bezierCurveTo(
      exitPt.x,
      exitPt.y,
      enterPt.x,
      enterPt.y,
      pose2.point.x,
      pose2.point.y,
    );

    pose1 = pose2;
  }

  context.stroke();
  context.restore();
}

function shallDrawNearestPoint() {
  // Only draw when:
  // 1. nothing is hovered, and
  // 2. tool is:
  //  a. pose (aka add waypoint) + shift key, or
  //  b. rotation

  const isNothingHovered = (
    null === hoveredHandle
    && null === hoveredPose
    && null === hoveredRotation
  );

  const isProperTool = (
    (toolState === Tool.POSE && inputState.isShiftDown)
    || toolState === Tool.ROTATION
  );

  return isNothingHovered && isProperTool;
}

function shallDrawHighlight() {
  return toolState == Tool.ROTATION || toolState == Tool.COMMANDS;
}

function shallDrawTool() {
  // Only draw when pose tool selected.

  return toolState === Tool.POSE;
}

function isHandleSelected(handle) {
  return (
    null != hoveredHandle
    && (
      (hoveredHandle.isEnter && handle === hoveredHandle.pose.enterHandle)
      || (!hoveredHandle.isEnter && handle === hoveredHandle.pose.exitHandle)
    )
  )
}

function drawHandleLine(context, handle, posePoint) {
  const p = posePoint.addVec(handle);

  context.save();

  context.lineWidth = 2.0;

  context.beginPath();
  context.moveTo(posePoint.x, posePoint.y);
  context.lineTo(p.x, p.y);
  context.stroke();

  context.restore();
}

function drawHandleDot(context, handle, posePoint, style, scale) {
  const p = posePoint.addVec(handle);

  context.save();

  context.fillStyle = style;
  context.lineWidth = 2.0;

  context.beginPath();
  context.ellipse(
    p.x,
    p.y,
    8 * scale,
    8 * scale,
    0,
    0,
    2 * Math.PI,
  );
  context.fill();
  context.stroke();

  context.restore();
}

function drawAllHandleLines(context, poseList) {
  if (poseList.length == 0) {
    return;
  }

  const first = poseList.poses.slice(0, 1);
  const inner = poseList.poses.slice(1, -1);
  const last  = poseList.poses.slice(-1);

  for (const pose of first) {
    drawHandleLine(context, pose.exitHandle, pose.point);
  }

  for (const pose of inner) {
    drawHandleLine(context, pose.enterHandle, pose.point);
    drawHandleLine(context, pose.exitHandle, pose.point);
  }

  for (const pose of last) {
    drawHandleLine(context, pose.enterHandle, pose.point);
  }
}

function drawAllHandleDots(context, poseList) {
  if (poseList.length == 0) {
    return;
  }

  const drawEnterDot = pose => {
    const enterColor = isHandleSelected(pose.enterHandle)
      ? colors.handle.enter.selected.color
      : colors.handle.enter.color;

    const enterScale = isHandleSelected(pose.enterHandle)
      ? 1.3
      : 1.0;

    drawHandleDot(context, pose.enterHandle, pose.point, enterColor, enterScale);
  };

  const drawExitDot = pose => {
    const exitColor = isHandleSelected(pose.exitHandle)
      ? colors.handle.exit.selected.color
      : colors.handle.exit.color;

    const exitScale = isHandleSelected(pose.exitHandle)
      ? 1.3
      : 1.0;

    drawHandleDot(context, pose.exitHandle, pose.point, exitColor, exitScale);
  };

  const first = poseList.poses.slice(0, 1);
  const inner = poseList.poses.slice(1, -1);
  const last  = poseList.poses.slice(-1);

  for (const pose of first) {
    drawExitDot(pose);
  }

  for (const pose of inner) {
    drawEnterDot(pose);
    drawExitDot(pose);
  }

  for (const pose of last) {
    drawEnterDot(pose);
  }
}

function drawNearestPoint(context) {
  // Draw point on poseList path that is nearest mouse.
  if (0.0 <= nearestPt.t) {
    context.save();

    drawCircle(context, nearestPt.pt.x, nearestPt.pt.y, 5.0);
    context.fillStyle = '#f0f';
    context.fill();

    context.restore();
  }
}

// _P0
function insertPoseAt(t) {

  if (2 > poseList.length) {
    return;
  }

  if (-1 == t) {
    return;
  }

  let originalCmdPtPtList = [];

  for (let cmdPt of commandPointList.cmdPts) {
    originalCmdPtPtList.push(cmdPt.t.pt);
  }

  const pt = poseList.pointAt(t);

  // Abort if new point is too close to a bezier endpoint.
  const previous = ~~t;
  const next     = previous + 1;

  const pt1 = poseList.poses[previous].point;
  const pt2 = poseList.poses[next].point;

  if (pt1.sub(pt).length() < 100 || pt2.sub(pt).length() < 100) {
    return;
  }

  // All is well. Create pose and insert.
  const enterVec = pt1.sub(pt2).unit().scale(100);
  const exitVec = enterVec.scale(-1);

  const pose = (
  // Pose(pt, enterVec, exitVec, { commands: PoseCommandGroup(genId()) })
  //   .setMoveCondition('go')
  Pose(pt, enterVec, exitVec,)
  // .setMoveCondition('go')
  );

  poseList.insertPose(next, pose);

  attachNewPtsToCmdPts(originalCmdPtPtList);

  for (let cmdPt of commandPointList.cmdPts) {
    let index = commandPointList.cmdPts.indexOf(cmdPt);

    commandPointList.cmdPts[index].t = poseList.findTNearPoint(cmdPt.t.pt);
  }
}

  function placePointAt(x, y) {
    const new_point = Point(x, y, []);
    let new_pose;

    if (0 == poseList.length) {
    new_pose = Pose(new_point, Vector(-100, 0), Vector(100, 0), 0, 1);
    makeRotation(0);
    rotationState = RotationState.NONE;

  } else {
    const last_point = poseList.poses.slice(-1)[0].point;
    const enterVec = last_point.sub(new_point).unit().scale(100);
    const exitVec = enterVec.scale(-1);

    new_pose = Pose(new_point, enterVec, exitVec);
  }

  poseList.appendPose(new_pose)
}

function updateElementNear(x, y) {
  // Find element nearest to the given point.  Only hover one element.

  hoveredHandle = findHandleNear(x, y);

  if (null !== hoveredHandle) {
    return;
  }

  hoveredPose = findPoseNear(x, y);

  if (null !== hoveredPose) {
    return;
  }
}

function findPoseNear(x, y) {
  const { size } = seasonConfig.config.robot.parameters;
  const w = size.xmeters * seasonConfig.fieldDims.xPixels / seasonConfig.fieldDims.xmeters;
  const h = size.ymeters * seasonConfig.fieldDims.yPixels / seasonConfig.fieldDims.ymeters;
  const threshold = Math.pow(Math.max(w, h) / 2, 2);

  for (let pose of poseList.poses) {
    const distance = Math.pow(x - pose.point.x, 2) + Math.pow(y - pose.point.y, 2);

    if (distance < threshold) {
      return pose;
    }
  }

  return null;
}

function findHandleNear(x, y) {
  for (let pose of poseList.poses) {
    let pt = pose.point.addVec(pose.enterHandle);
    let distance = Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2);

    if (distance < 300) {
      return {
        pose,
        isEnter: true,
      };
    }

    pt = pose.point.addVec(pose.exitHandle);
    distance = Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2);
    if (distance < 300) {
      return {
        pose,
        isEnter: false,
      };
    }
  }

  return null;
}

function findRotationBefore(x, y) {
  if (!poseList.hasBezier) {
    return null;
  }

  const { t: nearestT } = poseList.findTNearPoint(Point(x, y), 70);

  for (let a = rotationList.rotations.length - 1; a >= 0; a -= 1) {
    const { t } = rotationList.rotations[a];

    if (t <= nearestT) {
      return {
        index: a,
        rotation: rotationList.rotations[a],
      };
    }
  }

  console.log('no rotation before t:', nearestT);

  return null;
}

function findRotationNear(x, y) {
  if (!poseList.hasBezier) {
    return null;
  }

  for (let a = 0; a < rotationList.rotations.length; a += 1) {
    const { t } = rotationList.rotations[a];

    const i = Math.floor(t);

    if (i > poseList.poses.length - 1) {
      console.error("found rotation with tVal beyond last bezier segment.", a, rotationList.rotations[a]);
      continue;
    }

    const pt = poseList.pointAt(t);

    const distance = Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2);
    const threshold = Math.pow(80 / canvasViewport.scale, 2);

    if (distance < threshold) {
      return {
        index: a,
        pt,
        rotation: rotationList.rotations[a],
      };
    }
  }

  return null;
}

function findNode(passedNode, idTarget) {

  if (passedNode.nodeId == idTarget) {
    return passedNode;
  }
  else {
    for (let child of passedNode.children) {
      let node = findNode(child, idTarget, false);

      if (node !== null) {
        return node;
      }
    }
    return null;
  }
}
// _COM
document.addEventListener('dragstart', ev => {
  let dragTargets = [
    "sequence",
    "parallel",
    "race",
  ];

  if (seasonConfig.isLoaded()) {

    // Add robot commands to drag targets.

    dragTargets = dragTargets.concat(seasonConfig.config.robot.commands.map(c => c.name));
  }

  if (dragTargets.includes(ev.target.id)) {
    ev.dataTransfer.setData('text/plain', ev.target.id);
  }

});

document.addEventListener('dragend', ev => {
  ev.preventDefault();
});

document.addEventListener('dragenter', ev => {
  ev.preventDefault();

  if (ev.target.classList.contains('action-drop-zone')) {
    if (spacerTarget) {
      spacerTarget.classList.remove("is-active-dropzone");
    }

    if (ev.target.classList.contains("o-command-group__spacer")) {
      spacerTarget = ev.target;
      spacerTarget.classList.add('is-active-dropzone');
    }
  }
});

document.addEventListener('dragover', ev => {
  if (ev.target.classList.contains('action-drop-zone')) {
    ev.preventDefault();
  } // frog  (._.)
});

function clearAllNodes() {
  const rootElement = document.getElementById("c-action-work-area__sequence");

  const childList = Array.prototype.slice.call(rootElement.children, 0);

  for (let child of childList) {
    rootElement.removeChild(child);
  }
}

function drawAllNodes(rootSomething) {
  const rootElement = document.getElementById("c-action-work-area__sequence");

  const childList = Array.prototype.slice.call(rootElement.children, 0);

  for (let child of childList) {
    rootElement.removeChild(child);
  }

  if (null === rootSomething) {
    // No root node provided. Leave command ui empty.
    return;
  }

  const { moveCondition, rootNode } = rootSomething;

  const moveConditionContinueClarification = document.createElement("p");
  if (actionedCommandPoint.canSwitch()) {
    if (moveCondition == "halt") {
      moveConditionContinueClarification.textContent = "Go";
      moveConditionContinueClarification.classList.add('c-command-moveswitch-continue-foot');
    }
  } else {
    moveConditionContinueClarification.textContent = "End Auto";
    moveConditionContinueClarification.classList.add('c-command-moveswitch-continue-foot__end');
  }

  const moveConditionSwitch = document.createElement("div");
  moveConditionSwitch.classList.add('o-command-moveswitch');
  moveConditionSwitch.addEventListener('click', () => {
    if (actionedCommandPoint.canSwitch()) {
      actionedCommandPoint.toggleMoveCondition();
    } else {
      alert("Cannot continue moving after final Waypoint. To switch to 'Go', please add another waypoint at the desired end location.");
    }
    drawAllNodes(actionedCommandPoint.commands);
  });

  if (moveCondition === "go") {
    moveConditionSwitch.textContent = "Go";
    moveConditionSwitch.classList.add("o-command-moveswitch--go");
  } else {
    moveConditionSwitch.textContent = "Halt";
    moveConditionSwitch.classList.add("o-command-moveswitch--stop");
  }

  const elem = drawNodes(rootNode);

  rootElement.appendChild(moveConditionSwitch);
  rootElement.appendChild(elem);
  rootElement.appendChild(moveConditionContinueClarification);
}

function drawNodes(node) {
  /* HTML Template: Group Node
   *
   * <div class="o-command-group"
   *      data-node-id="0"
   *      data-node-name="race"
   *      data-node-kind="group">
   *  <span class="o-command-label">
   *    COMMAND NAME
   *  </span>
   *  <div class="action-drop-zone o-command-group__spacer"
   *       data-insert-index="0" />
  *   <!-- Put child nodes here.
   * </div>
   *
   * HTML Template: Command Node
   * <img class="o-command"
   *      src="./images/..."
   *      title="move arm"
   *      data-node-id="0"
   *      data-node-name="move arm"
   *      data-node-kind="command" />
   */


  let capitalizedCommandName = node.name[0].toUpperCase() + node.name.substring(1);

  if (node.kind == 'group') {
    const nodeElem = document.createElement("div");
    nodeElem.classList.add('o-command-group');

    nodeElem.dataset.nodeId = node.nodeId;
    nodeElem.dataset.nodeName = node.name;
    nodeElem.dataset.nodeKind = node.kind;

    const titleTop = document.createElement("span");
    const groupName = document.createTextNode(capitalizedCommandName);
    titleTop.classList.add('o-command-label');

    const createSpacer = insertIndex => {
      const spacerElem = document.createElement("div");

      spacerElem.classList.add("action-drop-zone");
      spacerElem.classList.add("o-command-group__spacer");
      spacerElem.dataset.insertIndex = insertIndex;

      return spacerElem;
    }

    titleTop.appendChild(groupName);
    nodeElem.appendChild(titleTop);

    const numChildren = node.children.length;

    if (numChildren) {
      for (let a = 0; a < numChildren; a++) {
        const child = node.children[a];

        nodeElem.appendChild(createSpacer(a));

        nodeElem.appendChild(drawNodes(child));
      }
    }

    nodeElem.appendChild(createSpacer(numChildren));

    return nodeElem;
  } else {
    const nodeElem = document.createElement("img");
    nodeElem.classList.add('o-command');
    nodeElem.src = commandImages.get(node.name) || "images/command.png";
    nodeElem.title = node.name;

    nodeElem.dataset.nodeId = node.nodeId;
    nodeElem.dataset.nodeName = node.name;
    nodeElem.dataset.nodeKind = node.kind;

    return nodeElem;
  }
}

function createNode(type, commandName) {
  return ActionNode(type, [], commandName, genId());
}

function insertNode(child, parent, index) {
  parent.children = parent.children.slice(0, index)
    .concat([child])
    .concat(parent.children.slice(index));
}

//createNode(initialNode, document.getElementById('c-action-work-area__sequence'))

// function addCommandNode(commandGroupName, target, isGroup) {
//   let capitalizedCommandGroupName = commandGroupName[0].toUpperCase() + commandGroupName.substring(1);

//   if (isGroup) {
//     nodeUi = document.createElement("div");
//     nodeUi.classList.add('action-drop-zone');
//     nodeUi.classList.add('o-command-group');

//     titleTop = document.createElement("span");
//     textNodeHolder = document.createTextNode(capitalizedCommandGroupName);
//     titleTop.classList.add('o-command-label');

//     titleTop.appendChild(textNodeHolder);
//     nodeUi.appendChild(titleTop);

//   } else {
//     nodeUi = document.createElement("img");
//     nodeUi.classList.add('o-command');
//     nodeUi.src = "images/command.png";
//   }

//   nodeUi.dataset.nodeId = idCounter;

//   target.appendChild(nodeUi);
/////////////////////////////////////////////////////////
//   targetId = parseInt(target.dataset.nodeId);
//   targetNode = findNode(initialNode, targetId);
// }

document.addEventListener('drop', ev => {

  const targetPoseCommands = actionedCommandPoint.commands;
  let target = ev.target;

  if (spacerTarget) {
    spacerTarget.classList.remove("is-active-dropzone");
  }

  if (ev.target.classList.contains('action-drop-zone')) {

    const targetPoseCommands = actionedCommandPoint.commands;

    let insertIndex = 0;

    if (target.classList.contains('o-command-group__spacer')) {
      insertIndex = target.dataset.insertIndex;
      target = target.parentElement;
    }

    const commandName = ev.dataTransfer.getData('text/plain');
    // console.log("Target nodeId: ", target.dataset.nodeId, target);

    targetNode = findNode(targetPoseCommands.rootNode, target.dataset.nodeId, true);

    switch (commandName) {
      case 'sequence':
      case 'race':
      case 'parallel':
        if (targetNode === null) {
          console.error("Unable to find target node", targetNode);
        } else {
          insertNode(createNode('group', commandName), targetNode, insertIndex);
        }
        break;
      default:
        insertNode(createNode('command', commandName), targetNode, insertIndex);
    }
  }
  // console.log("Updated Data structure: ", targetPoseCommands, targetNode);
  drawAllNodes(targetPoseCommands);
});

// Hi welcome to pain

// let rootSomething = {
//  moveCondition: "go" | "stop",
//  rootNode: {
//   kind: 'group',
//   moveCondition: "go" | "stop",
//   children: [
//     {
//       kind: 'group',
//       children: [],
//       name: 'parallel',
//       id: 1,
//     },
//     {
//       kind: 'group',
//       children: [],
//       name: 'race',
//       id: 2,
//     }
//   ],
//   name: 'sequence',
//   id: 0,
// }

// ====--------------====   ROTATION STUFF   ====--------------==== _ROT

function makeRotation(tval) {
  rotationList.insertRotation(tval);
  note(popsicle(rotationList));
  pruneInvalidRotPts();

}

function deleteRotation(r) {
  rotationList.rotations.splice(rotationList.rotations.indexOf(r), 1);
}

function calcRotationPos(rotation) {
  return poseList.pointAt(rotation.t);
}

function getAngleToCursor(pt, mousePt) {
  let distAdj = mousePt.x - pt.x;
  let distOpp = mousePt.y - pt.y;
  return Math.atan2(distOpp, distAdj);
}

function findNearestRotationIndex(mousePt) {
  for (let rotation of rotationList.rotations) {
    let rotationPt = calcRotationPos(rotation);
    let distance = Math.sqrt(Math.pow(rotationPt.x - mousePt.x, 2) + Math.pow(rotationPt.y - mousePt.y, 2));

    if (distance <= 30) {
      return rotationList.rotations.indexOf(rotation);
    }

  }

  return null;
}

function drawRotation(context, rotation) {
  let rotationOrigin = calcRotationPos(rotation);

  context.save();

  context.translate(rotationOrigin.x, rotationOrigin.y);

  context.scale(1.0 / canvasViewport.scale, 1.0 / canvasViewport.scale);

  // Draw hover elements.
  if (null !== hoveredRotation && rotation == hoveredRotation.rotation) {
    const mouseArrowVec = mousePt.sub(rotationOrigin);

    context.save();

    context.globalCompositeOperation = 'xor';

    context.scale(80.0, 80.0);

    context.beginPath();
    drawArrowHeadPath(context, mouseArrowVec);

    context.arc(0.0, 0.0, 0.55, 0, 2 * Math.PI, true);
    context.arc(0.0, 0.0, 1.00, 0, 2 * Math.PI, false);

    context.clip();

    context.beginPath();
    context.arc(0.0, 0.0, 1.05, 0, 2 * Math.PI, false);

    context.fillStyle = "#cccc";
    context.fill();

    context.restore();

    if (0 < hoveredRotation.index) {
      context.save();

      context.globalCompositeOperation = 'xor';

      context.scale(45.0, 45.0);

      context.beginPath();
      drawMoveWidget(context);

      context.fillStyle = "#cccc";
      context.fill();

      context.restore();
    }
  }

  context.scale(60.0, 60.0);

  context.fillStyle = '#a0a';

  drawCircle(context, 0.0, 0.0, 0.2);

  context.fill();

  const arrowVec = Vector(Math.cos(rotation.rot), Math.sin(rotation.rot));

  context.beginPath();
  drawArrowPath(context, arrowVec);

  context.fill();

  context.restore();
}

function drawRotations(context, poseList) {
  if (poseList.length < 2) {
    return;
  }

  for (let a = 0; a < rotationList.rotations.length; a += 1) {
    const rotation = rotationList.rotations[a];

    drawRotation(context, rotation);
  }
}

function calcPointOnVector(pt, vector) {
  const va = vector.unit();
  const vb = Vector(-va.y, va.x);
  const v1 = va.scale(pt.x);
  const v2 = vb.scale(pt.y);

  const v3 = v1.add(v2);

  return ORIGIN.addVec(v3);
}

function arrowPoints() { // Takes canvas point and calcs
  return [                             // relative points to draw arrow
    Point(0.00,  0.00),
    Point(0.00,  0.06),
    Point(0.55,  0.06),
    Point(0.55,  0.24),
    Point(1.00,  0.00),
    Point(0.55, -0.24),
    Point(0.55, -0.06),
    Point(0.00, -0.06),
    Point(0.00,  0.00),
  ];
}

function arrowHeadPoints() { // Takes canvas point and calcs
  return [                             // relative points to draw arrow
    Point(0.55,  0.06),
    Point(0.55,  0.24),
    Point(1.00,  0.00),
    Point(0.55, -0.24),
    Point(0.55, -0.06),
  ];
}

function setEditHeadingVisible(visibool) {
  const headingElem = document.getElementById("rotation-heading-area");

  if (visibool) {
    headingElem.style.visibility = "visible";
  } else {
    headingElem.style.visibility = "collapse";
  }

}

function getHeadingInput() {
  const inputElem = document.getElementById("o-heading-input");

  return inputElem.value;
}

document.getElementById("o-heading-input").addEventListener("input", (_ev) => {
  rotationList.rotations[0].rot = toRadians(getHeadingInput());
  redrawCanvas(document.getElementById('canvas'), poseList);
});

function revertRotOffset(rotations, offset) {
  let processedRotations = new RotationList;
  let processingRotation;

  for (let r of rotations) {
    processingRotation = new Rotation(r.t);
    processingRotation.setRotVal(r.rot + offset);
    processedRotations.rotations.push(processingRotation);
  }

  console.log("revertRotOffset, passed rotations: ", rotations);
  console.log("revertRotOffset, passed offset: ", offset);
  console.log("Post-revertRotOffset: ", processedRotations);

  return processedRotations;
}

function convertAllRotDegToRad(rotations) {
  let processedRotations = [];
  let processingRot;


  for (let r of rotations) {
    processingRot = new Rotation(r.t);
    processingRot.setRotVal(toRadians(r.rot));
    processedRotations.push(processingRot);
  }

  return processedRotations;
}

function repositionRotsAndDo(task, data = undefined) {
  // TASK OPTIONS: 'insert' (Inserting Waypoint) || 'deleteWaypoint' || 'deleteRotation'

  // Get all rot pts repositioned in place:
  let rotPosList = [];

  for (let r of rotationList.rotations) {
    rotPosList.push(calcRotationPos(r));
  }

  // Detect and perform requested task.
  if (task == 'insert') {//                                         Task Insert
    if (data !== undefined) {console.log("Just noting that you passed data into repositionRotsAndDo when inserting. This is not necessary.");}

    insertPoseAt(nearestPt.t);

  } else if (task == 'deleteWaypoint' && data === undefined) {//        Task Delete Waypoint
    console.warn("You did not pass the needed data (the mouse point) into repositionRotsAndDo() while attempting to delete a waypoint.");

  } else if (task == 'deleteWaypoint' && data !== undefined) {
    const nearestPose = findPoseNear(data.x, data.y);

    poseList.deletePose(nearestPose);
    
  } else if (task == 'deleteRotation' && data === undefined) {//        Task Delete Rotation
    console.warn("You did not pass the needed data (the Rotation) into repositionRotsAndDo() while attempting to delete a rotation.");
    
  } else if (task == 'deleteRotation' && data !== undefined) {
    rotPosList.splice(rotationList.rotations.indexOf(data), 1);
    deleteRotation(data);

  } else {//                                                         Invalid/No Task
    console.warn("You passed ", task, " to repositionRotsAndDo; this is not a valid task. Valid tasks are 'insert' and 'delete.' Did not perform task in any capacity.");

  }

  // Cont. repositioning rot pts:
  for (let i = 0; i < rotPosList.length; i++) {
    const nearestT = poseList.findTNearPoint(rotPosList[i], 70);
    rotationList.rotations[i].t = nearestT.t;
  }

  pruneInvalidRotPts();

  redrawCanvas(canvas, poseList);
}

function pruneInvalidRotPts() {
  // Filter invalid rot pt locations:
  for (let i = 1; i < rotationList.rotations.length; i++) {
    if (rotationList.rotations[i].t == -1) { // Check points
      rotationList.rotations.splice(i, 1);
      i = 0;
    }
  }
  if (rotationList.rotations[0].t != 0) { // Ensure first rotation is on start point again
    rotationList.rotations[0].t = 0;
  }
}

function innerOrOuterRadius(mousePt, rotPt) {
  const threshold = 50.0 / canvasViewport.scale;

  if (ezPtDistance2D(mousePt, rotPt) <= threshold) {
    return 'inner';
  } else {
    return 'outer';
  }
}

function drawHighlight(context, pos) {
  if (poseList.length >= 2 && hoveredRotation || hoveredCommandPoint != null) {
    // const rotPos = calcRotationPos(hoveredRotation.rotation);

    context.fillStyle = '#2F2';
    drawCircle(context, pos.x, pos.y, 4);
    context.fill();
  }
}

// ====--------------====   NEW EXPORT THING   ====--------------==== _BEXP

// function isTLowestOption(origin, t, iterations = 8) {
  //   console.log("Checking if t ", t, " is lowest option");
  //   const initialDist = ezPtDistance(origin, poseList.pointAt(t));
  //   const integral = ezTestIntegral(t, iterations);

//   for (let i = 1; i < iterations; i++) {
  //     const newDist = ezPtDistance(origin, poseList.pointAt(t - (integral * i)));
  //     console.log("Comparing t dist to new t: ", t - (integral * i));
//     if (newDist < initialDist && newDist > initialDist * 0.8) {
  //       console.log("It wasn't");
  //       return false;
  //     }
  //   }
  //   console.log("It was");
  //   return true;

  // }

function findIdealTIntegral(lowT, hiT, i = 0, maxTries = 20) {
  // console.log("reiterating with lowT, hiT:", lowT, hiT);
  const ideal = 0.1;

  const midT = (lowT + hiT) / 2;
  i++;

  const lowPt = poseList.pointAt(lowT);
  const midPt = poseList.pointAt(midT);
  const sampleDistance = pxToMeters(ezPtDistance2D(lowPt, midPt));

  if (i >= maxTries) {
    console.warn("While finding ideal t integral, had to iterate more than ", maxTries, " times. Returning the following t value despite it not being as accurate as wanted: ", midT);
    return midT;

  } else if ((ideal * 0.9) > sampleDistance) {
    // console.log("To reiterate up for precision from t ", midT, " as sample Dist (m) is ", sampleDistance);
    return findIdealTIntegral(lowT, midT + ((midT - lowT) / 0.8), i, maxTries);

  } else if (sampleDistance > (ideal * 1.1)
  //|| !isTLowestOption(poseList.pointAt(lowT), midT)
  // && midT > 0.05
  ) {
    // console.log("Going to reiterate from t ", midT, " as Sample Dist (m) is ", sampleDistance);
    return findIdealTIntegral(lowT, midT, i, maxTries);

  } else {
    return midT - lowT;

  }
}

/* payload = {
  poses: [Point, Point, Point, Point],
  rots: [DetailRotation, DetailRotation, DetailRotation, DetailRotation]
  }

HAVE TO CALCULATE MORE ACCURATE OF INTERPOLATION
function makeAdvanceExport(poseList, rotations) {
      let detailedRotations = [];
      for (rot of rotations) {
      detailedRotations.push(DetailRotation(rot, calcRotationPos(rot)));
    }
    ^^ This won't work; calculate at certain t vals.
}

*/
/*

- - - - - - - - T.O.D.O. LIST - - - - - - - -
    [X] Interpolate Pose pts
    [X] Interpolate Rot pts
    [X] Assign Commands to New Pose pts
    [-] Put all of these together [No longer necessary]
    [X] Actually export it
    [-] Velocity

*/

function bakeAdvancedExport(poseList, rotations) {
  let payload = [];

  // Building initial interpolated list
  let currentIntegral = 0;
  let lowT = 0;
  let endT = poseList.findTNearPoint(poseList.poses[poseList.poses.length - 1].point, 30).t;
  // console.log("Low and End ts: ", lowT, endT);

  // console.log("Start and End pose pts for reference: ", poseList.poses[0].point, poseList.poses[poseList.poses.length - 1].point);

  // Interpolating poses:
  while (lowT + 1 <= endT) {
    // console.log("Iterating with lowT and integral: ", lowT, currentIntegral);
    currentIntegral = findIdealTIntegral(lowT, lowT + 1);

    payload.push(ExportChunk(
      "unbakedUnrotated",
      null,
      poseList.pointAt(lowT).x,
      poseList.pointAt(lowT).y,
      [],
      lowT,
    ));

    lowT = lowT + currentIntegral;
  }

  while (lowT <= endT - 0.05) {
    // console.log("Late-stage iterating with lowT and integral: ", lowT, currentIntegral);
    currentIntegral = findIdealTIntegral(lowT, endT, 0, 15);

    payload.push(ExportChunk(
      "unbakedUnrotated",
      null,
      poseList.pointAt(lowT).x,
      poseList.pointAt(lowT).y,
      [],
      lowT,
    ));

    lowT = lowT + currentIntegral;
  }
  payload.push(ExportChunk(
    "unbakedUnrotated",
    null,
    poseList.pointAt(endT).x,
    poseList.pointAt(endT).y,
    [],
    endT,
  ));

  // console.log("End space coagulated into final pt (m): ", pxToMeters(ezPtDistance(poseList.pointAt(lowT - currentIntegral), poseList.pointAt(endT))));

  //            Interpolating rotations:

  {
    let lastRotationIndex = 0;
    let lastRotation = rotations[0].rot;

    payload = payload.map(chunk => {
      // Find relevant rotation.
      const nearestT = poseList.findTNearPoint(Point(chunk.x, chunk.y), 50);

      if (-1 === nearestT.t) {
        console.log("Cannot find t near point", { x: chunk.x, y: chunk.y });
      } else {
        for (let a = lastRotationIndex; a < rotations.length; a += 1) {
          debugger;
          if (nearestT.t >= rotations[a].t) {
            lastRotationIndex = a;
            lastRotation = rotations[a].rot;
          } else {
            break;
          }
        }
      }

      // Apply relevant rotation to chunk.
      return Object.assign(
        {},
        chunk,
        { rot: lastRotation }
      );
    });
  }

  // for (let r of rotations) {
  //   let attatchedPoseIndex = findNearestIndexToFromByT(r, payload);
  //   payload[attatchedPoseIndex].rot = r.rot - rotations[0].rot;
  //   payload[attatchedPoseIndex].type = "unbakedRotationHead";
  // } // Label rotation heads, adjust volume to be per the head

  // for (let p of poseList.poses) {
  //   payload[p.t].type = "";
  // }

  // let rotationHeads = filterPayloadToIndexListByType(payload, "unbakedRotationHead");
  // rotationHeads[0].rot = 0;

  // for (let i in rotationHeads) {

  //   // if (i < rotationHeads.length - 1) {
  //   //   i = Number(i);
  //   //   const iUp = i + 1;
  //   //   const indexDist = rotationHeads[iUp] - rotationHeads[i];
  //   //   const avgChange = (payload[rotationHeads[i]].rot + payload[rotationHeads[iUp]].rot) / indexDist;

  //   // for (let x = 1; x <= indexDist; x++) {
  //   //   payload[x + rotationHeads[i]].rot = payload[rotationHeads[i]].rot + avgChange * x;
  //   //   payload[x + rotationHeads[i]].type = "unbaked";
  //   // }
  //   // } else {
  //   //   const howManyAtEnd = payload.length - rotationHeads[i];
  //   //   for (let x = 1; x < howManyAtEnd; x++) {
  //   //     payload[x +  rotationHeads[i]].rot =  payload[rotationHeads[i]].rot;
  //   //     payload[x +  rotationHeads[i]].type = "unbaked";
  //   //   }
  //   // }

  // }


  // Baking commands into the payload:

  // CURRENT COMMAND EXPORTING

  console.log("Pre-command-baking payload: ", popsicle(payload));

  // let commandHeads = [];

  // for (let pose of poseList.poses) {
  //   const tEncased = poseList.findTNearPoint(pose.point);
  //   const commandHeadIndex = findNearestIndexToFromByT(tEncased, payload);

  //   commandHeads.push({
  //     index: commandHeadIndex,
  //     commands: pose.commands,
  //   });
  // }

  // for (let h of commandHeads) {
  //   payload[h.index].commands = h.commands;

  //   if (h.commands.moveCondition == 'halt') {
  //     payload[h.index].type = 'stop';
  //     payload[h.index].vel = 0.0;
  //   }
  // }

  // Calculate and apply velocities:
  const distanceToVelocity = accelerate(seasonConfig.config.robot.parameters);
  const maxVelocity = seasonConfig.config.robot.parameters.maxVelocityMetersPerSecond;

  {
    // Assign zero velocities to stop positions.
    // Assign max velocity to all other positions.
    payload = payload.map(chunk => {
      if ('stop' === chunk.type) {
        const newChunk = Object.assign({}, chunk, { vel: 0.0 });

        return newChunk;
      } else {
        const newChunk = Object.assign({}, chunk, { vel: maxVelocity });

        return newChunk;
      }
    });
  }

  {
    // Compute velocities for acceleration from rest.
    let distance = 0.0;
    let prevPt = Point(0.0, 0.0);
    let prevVel = 0.0;

    payload = payload.map(chunk => {
      if ('stop' === chunk.type) {
        distance = 0.0;
        prevPt = Point(chunk.x, chunk.y);
        prevVel = 0.0;

        return chunk;
      } else {
        const herePt = Point(chunk.x, chunk.y);
        distance += herePt.sub(prevPt).length();
        prevPt = herePt;

        const vel = clamp(chunk.vel, 0.0, distanceToVelocity(distance, prevVel));
        prevVel = vel;

        const newChunk = Object.assign({}, chunk, { vel });

        return newChunk;
      }
    });
  }

  {
    // Reverse payload, and compute velocities for deceleration to rest.
    // Because the list is reversed, the code looks identical to acceleration above.
    payload = payload.toReversed();

    let distance = 0.0;
    let prevPt = Point(0.0, 0.0);
    let prevVel = 0.0;

    payload = payload.map(chunk => {
      if ('stop' === chunk.type) {
        distance = 0.0;
        prevPt = Point(chunk.x, chunk.y);
        prevVel = 0.0;

        return chunk;
      } else {
        const herePt = Point(chunk.x, chunk.y);
        distance += herePt.sub(prevPt).length();
        prevPt = herePt;

        const vel = clamp(chunk.vel, 0.0, distanceToVelocity(distance, prevVel));
        prevVel = vel;

        const newChunk = Object.assign({}, chunk, { vel });

        return newChunk;
      }
    });

    // Restore payload to original order.
    payload = payload.toReversed();
  }

  // Convert pixel units to meters and set origin to bottom left corner - Linus D
  for (let pose of payload) {
    pose.x =                                  pose.x / seasonConfig.fieldDims.xPixels * seasonConfig.fieldDims.xmeters;
    pose.y = seasonConfig.fieldDims.ymeters - pose.y / seasonConfig.fieldDims.yPixels * seasonConfig.fieldDims.ymeters;
  }

  console.log("Done. payload: ", popsicle(payload));
  return payload;
}

// Sub-processes for exporting
function findNearestIndexToFromByT(origin, ptList) {
  let near = {dist: 9999, pt: null};

  if (ptList == [] || ptList == null) {
    console.error("You passed an empty or null list into findNearestIndexToFromByT");
  }

  for(let pt of ptList) {
    const dist = Math.abs(origin.t - pt.t);
    if (dist < near.dist) {
      near = {
        dist: dist,
        pt: pt,
      };
    }
  }

  return ptList.indexOf(near.pt);
}

function filterPayloadToIndexListByType(payload, type) {
  let filteredList = [];
  for (let pose of payload) {
    if (pose.type == type) {
      filteredList.push(
        Number(payload.indexOf(pose)),
      );
    }
  }

  return filteredList;
}

// Control Point Stuff: (_COM)

function drawAllCommandPoints(context) {

  updateCommandPointPts();

  for(let cmdPt of commandPointList.cmdPts) {
    context.fillStyle = "FFF";
    drawCircle(context, cmdPt.t.pt.x, cmdPt.t.pt.y, 8);
    context.fill();
  }
}

function updateCommandPointPts() {
  pruneStrayCmdPts();

  for (let cmdPt of commandPointList.cmdPts) {
    let index = commandPointList.cmdPts.indexOf(cmdPt);
    commandPointList.cmdPts[index].t.pt = poseList.pointAt(cmdPt.t.t);
  }
}

function attachNewPtsToCmdPts(ptList) {
  for (let cmdPt of commandPointList.cmdPts) {
    let index = commandPointList.cmdPts.indexOf(cmdPt);
    commandPointList.cmdPts[index].t.pt = ptList[index];
  }
}

function tSnappedToPoses(t) {

  for (let pose of poseList.poses) {
    let poseT = poseList.findTNearPoint(pose.point, 30, 20);

    if (ezNumDist(t.t, poseT.t) < 0.05 && ezNumDist(t.t, poseT.t) > -0.05) {
      return poseT;
    }

  }

  return t;
}

function isTReasonable(t) {
  if (poseList.pointAt(t) == null) {
    return false;
  } else {
    return true;
  }
}

function pruneStrayCmdPts() {
  for (let cmdPt of commandPointList.cmdPts) {
    let index = commandPointList.cmdPts.indexOf(cmdPt);
    if (!isTReasonable(cmdPt.t.t)) {
      commandPointList.cmdPts.splice(index, 1);
      pruneStrayCmdPts();
    }
  }
}

function deleteTouchedCmdPtIfAny(pt) {
  for (let cmdPt of commandPointList.cmdPts) {
    if (ezPtDistance2D(pt, cmdPt.t.pt) <= 10) {
      commandPointList.deleteCommandPoint(cmdPt);
      break;
    }
  }
}

function cmdPtObjNear(pt) {
  for (let cmdPt of commandPointList.cmdPts) {
    if (ezPtDistance2D(pt, cmdPt.t.pt) <= 10) {
      return cmdPt;
    }
  }
  return null;
}

function moveDraggingCmdPtIfApplicable(t) {
  if (actionedCommandPoint !== null && t.t > 0) {
    commandPointList.moveCommandPointToT(actionedCommandPoint, t);

  }
}

// Other useful functions:

function ezPtDistance2D(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function ezNumDist(a, b) {
  return a - b;
}

function pxToMeters(px) {
  return (seasonConfig.fieldDims.xmeters / seasonConfig.fieldDims.xPixels) * px;
}

function popsicle(data) { // temporary function for debugging. Just deep clones.
  return JSON.parse(JSON.stringify(data));
}

function note(x) {
  console.log(x);
}

// The Following Is A Secret Frog:
  /*
                      █████████████████
                 █████████      ██████████
               ███ █████  ██ ████       ███
               █  ███████   ██      █████ ██
              █   ████████   █     ██████████
              █   ████████   ██    ████████ ██
             ███   ██████     █    ████████  ██
             █ ██            ███     █████   ██
             █  ███   ████████ ████         ███
             █    █████            ████████████
             ██                             ██
              █                            ██
              ███                        ██
            ██  ██████                  ██
           ██    ██  ██████████████████████
          █      █          ███           ██
                 █            ██           ██
                                ██          ██
                                 █           █
  */
