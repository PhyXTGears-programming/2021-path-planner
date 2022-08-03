// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

// While addition of command nodes to poses is underway, import/export functionality will
// be very much non-functional.

// Issue at hand:
// When clicking on the condition switch, it does not change. DrawAllNodes
// function does redraw it, so variable holding value may be wrong

// Custom types

const Payload = (p0, p1, p2, p3, options) => {
  const self = {
    points: [p0, p1, p2, p3, options],
  }
};

const PointPrototype = {
  addVec: function (vec) {
    return Point(this.x + vec.x, this.y + vec.y);
  },

  sub: function (other) {
    return Vector(this.x - other.x, this.y - other.y);
  },
};

const Point = (x, y) => {
  const self = Object.create(PointPrototype);
  self.x = x;
  self.y = y;
  return self;
};

VectorPrototype = {
  add: function (other) {
    return Vector(this.x + other.x, this.y + other.y);
  },

  sub: function (other) {
    return Vector(this.x - other.x, this.y - other.y);
  },

  scale: function (factor) {
    return Vector(this.x * factor, this.y * factor);
  },

  length: function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },

  unit: function () {
    const length = this.length();

    // If near zero, return a zero vector.
    if (0.001 > length) {
      return Vector(0, 0);
    } else {
      return this.scale(1 / this.length());
    }
  },
};

const Vector = (x, y) => {
  const self = Object.create(VectorPrototype);
  self.x = x;
  self.y = y;
  return self;
};

const Pose = (point, enterHandle, exitHandle, options) => {
  return {
    point,
    enterHandle,
    exitHandle,
    options,
  };
};

function PoseCommandGroup() {
  return {
    moveCondition: "halt",
    rootNode: makeNode("group", [], 'sequential'),
  }
}

function ActionNode(kind, children, name, nodeId) {
  return {
    kind,
    children,
    name,
    nodeId,
  };
}

function makeNode(kind, children, name) {
  idCounter += 1;
  return ActionNode(kind, children, name, idCounter - 1);
}

//For changing and updating MoveSwitch
function switchMoveSwitch() {
  const switchRootSomething = actionedPose.options.commands;
  if(switchRootSomething.moveCondition == "go") {
    switchRootSomething.moveCondition = "halt";
  }
  if(switchRootSomething.moveCondition == "halt") {
    switchRootSomething.moveCondition = "go";
  }
  drawAllNodes(switchRootSomething);
}

// Constants

const Tool = {
  POSE: 0,
  WAYPOINT: 1,
  FINISH: 2,
  NONE: 3,
  SELECT: 4,
  DELETE: 5,
  ACTIONS: 6,
};

const SelectState = {
  NONE: 0,
  MOVE_POSE: 1,
  MOVE_ENTER_HANDLE: 2,
  MOVE_EXIT_HANDLE: 3,
}

const colors = {
  handle: {
    enter: {
      color: "#03a9f4",
      selected: {
        color: "#76ff03",
      },
    },
    exit: {
      color: "#ff9800",
      selected: {
        color: "#76ff03",
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
  [Tool.ACTIONS]: 'actions',
};

const actionsCommandGroups = {
  SEQUENTIAL: 0,
  PARALLEL: 1,
  RACE: 2,
};

const commandGroupsToName = {
  [actionsCommandGroups.SEQUENTIAL]: 'sequential',
  [actionsCommandGroups.PARALLEL]: 'parallel',
  [actionsCommandGroups.RACE]: 'race',
};

// Global variables

// const frog = {attributes["kindness", "beauty", "just incredible"], dangerLevel: "Cognitohazard"};

let toolState = Tool.NONE;
const images = {};
let poseList = [];

let hoveredPose = null;
let movePose = null;

let hoveredHandle = null;
let moveHandle = null;

let actionedPose = null;

let selectState = SelectState.NONE;

let saveFileName = '';
let saveData = '';

let yoinked = null; // For dragging of commands

let draggedId = null; // Keeps track of id of dragged to define nodeUi
let nodeUi = null; // Defines what will be placed into work area of command sequencer
let workArea = document.getElementById('c-action-work-area__sequence');
let textNodeHolder = null; // For creating text dynamically
let titleTop = null; // to hold the text node for the title (:
let idCounter = 0;
let targetId = null;
let targetNode = null;
let spacerTarget = null;
const commandTypeImgs = { lowerIntake: "./images/temp-lower.png" };

const config = {
  fieldDims: {
    xmeters: 9.14,
    ymeters: 4.57,
  },
  imageFiles: [
    {
      name: 'field',
      file: './images/field.png'
    },
    {
      name: 'pose',
      file: './images/start.png'
    },
    {
      name: 'waypoint',
      file: './images/waypoint.png'
    },
    {
      name: 'finish',
      file: './images/finish.png'
    },
    {
      name: 'select',
      file: './images/finish.png'
    },
    {
      name: 'delete',
      file: './images/delete.png'
    },
    {
      name: 'actions',
      file: './images/temp-lower.png'
    },
  ]
};

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');

  loadImages(() => {
    onFieldLoaded(canvas);

    if(actionedPose) {
      drawAllNodes(actionedPose.options.commands);
    }
  });
})

// Load all images in parallel, wait for all images to finish loading,
// then activate onDone function.
function loadImages(onDone) {
  let loadCount = config.imageFiles.length;

  const onImageLoaded = (ev) => {
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

function onFieldLoaded(canvas) {
  canvas.width = images.field.width;
  canvas.height = images.field.height;

  const context = canvas.getContext('2d');
  clearCanvas(context);

  canvas.addEventListener('click', (ev) => {
    const context = canvas.getContext('2d');

    const x = ev.clientX - canvas.offsetLeft;
    const y = ev.clientY - canvas.clientTop;

    const x2 = map(x, 0, canvas.offsetWidth, 0, canvas.width);
    const y2 = map(y, 0, canvas.offsetHeight, 0, canvas.height);

        if(ev.target.classList.contains("o-command-moveSwitch")) {
          switchMoveSwitch();
        }

    switch (toolState) {
      case Tool.NONE:
        //Do nothing
        break;

      case Tool.SELECT:
        break;

      case Tool.POSE:
        // Compute the canvas position of the cursor relative to the canvas.
        placePointAt(x2, y2);

        redrawCanvas(context, poseList);
        break;
      case Tool.DELETE:
        const nearestPose = findPoseNear(x2, y2);
        const poseLocation = poseList.indexOf(nearestPose);
        poseList.splice(poseLocation, 1);
        redrawCanvas(context, poseList);
        break;
      case Tool.ACTIONS:
        let target = ev.target;
        actionedPose = findPoseNear(x2, y2);

        if(!actionedPose) {
          break;
        }

        drawAllNodes(actionedPose.options.commands);
        break;
    }
  });

  canvas.addEventListener('mousemove', (ev) => {
    const context = canvas.getContext('2d');

    const tool = toolStateToName[toolState];

    // Compute the screen position of the cursor relative to the canvas.
    const x = ev.clientX - canvas.offsetLeft;
    const y = ev.clientY - canvas.clientTop;

    // Compute the canvas position of the cursor relative to the canvas.
    const x2 = map(x, 0, canvas.offsetWidth, 0, canvas.width);
    const y2 = map(y, 0, canvas.offsetHeight, 0, canvas.height);

    const mousePt = Point(x2, y2, []);

    switch (toolState) {
      case Tool.SELECT:
        switch (selectState) {
          case SelectState.MOVE_POSE:
            const posePt = mousePt.addVec(movePose.offset);

            movePose.pose.point = posePt;

            redrawCanvas(context, poseList);
            break;

          case SelectState.MOVE_ENTER_HANDLE:
            const enterPt = mousePt.addVec(moveHandle.offset);
            const enterVec = enterPt.sub(moveHandle.pose.point);

            moveHandle.pose.exitHandle = enterVec.scale(-1).unit().scale(moveHandle.pose.exitHandle.length());
            moveHandle.pose.enterHandle = enterVec;

            redrawCanvas(context, poseList);
            break;

          case SelectState.MOVE_EXIT_HANDLE:
            const exitPt = mousePt.addVec(moveHandle.offset);
            const exitVec = exitPt.sub(moveHandle.pose.point);

            moveHandle.pose.exitHandle = exitVec;
            moveHandle.pose.enterHandle = exitVec.scale(-1).unit().scale(moveHandle.pose.enterHandle.length());

            redrawCanvas(context, poseList);
            break;

          case SelectState.NONE:
            hoveredPose = findPoseNear(x2, y2);
            hoveredHandle = findHandleNear(x2, y2);

            redrawCanvas(context, poseList);
            break;
        }

        break;

      case Tool.NONE:
        //Don't do anything
        break;

      case Tool.POSE:
        // Center tool image on cursor.
        const x3 = x2 - images[tool].width / 2;
        const y3 = y2 - images[tool].height / 2;

        redrawCanvas(context, poseList);
        drawTool(context, tool, x3, y3);
        break;

      case Tool.DELETE:
        hoveredPose = findPoseNear(x2, y2);
        redrawCanvas(context, poseList);

        break;
    }

    if ('' != tool) {

    }
  });

  canvas.addEventListener('mousedown', ev => {

    // Compute the screen position of the cursor relative to the canvas.
    const x = ev.clientX - canvas.offsetLeft;
    const y = ev.clientY - canvas.clientTop;

    // Compute the canvas position of the cursor relative to the canvas.
    const x2 = map(x, 0, canvas.offsetWidth, 0, canvas.width);
    const y2 = map(y, 0, canvas.offsetHeight, 0, canvas.height);

    const mousePt = Point(x2, y2, []);

    switch (toolState) {
      case Tool.POSE:
        break;

      case Tool.SELECT:
        if (hoveredPose != null) {
          selectState = SelectState.MOVE_POSE;

          movePose = {
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

      default:
        break;
    }


  });

  canvas.addEventListener('mouseup', ev => {
    switch (toolState) {
      case Tool.POSE:
        break;

      case Tool.SELECT:
        switch (selectState) {
          case SelectState.MOVE_POSE:
            selectState = SelectState.NONE;
            movePose = null;
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

      default:
        break;
    }
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
      id: 'action-tool',
      state: Tool.ACTIONS,
    },
  ];

  for (let tool of tool_map) {
    const elem = document.getElementById(tool.id);
    elem.addEventListener('click', () => {
      toolState = tool.state;

      document.querySelectorAll('.toolbar .tool').forEach(item => item.classList.remove('active'));
      elem.classList.add('active');
    });
  }

  document.getElementById('save-file').addEventListener('click', ev => {
    window.api.send('toMain', { event: 'selectSaveFile' });
    // saveFileName = selectSaveFile();
    // ev.target.value = saveFileName;
  });

  document.getElementById('export').addEventListener('click', ev => {
    const data = exportPoses(poseList);
    window.api.send('toMain', {
      event: 'saveFile', data: {
        saveFile: saveFileName,
        segments: exportPoses(poseList),
      }
    });
    console.log(data);
  });

  document.getElementById('import').addEventListener('click', ev => {
    const context = canvas.getContext('2d');

    let importFileList = document.getElementById('load-file').files;
    if (importFileList.length == 0) return;

    importFileList[0].text()
      .then((text) => JSON.parse(text))
      .then(importPoses)
      .then((poses) => { poseList = poses; })
      .then(() => redrawCanvas(context, poseList));

    console.log(importFileList);

  });

  console.log('attach fromMain receiver');

  if (window.api && window.api.receive) {

    window.api.receive('fromMain', args => {
      switch (args.event) {
        case 'selectSaveFile':
          saveFileName = args.data.saveFile;
          const saveFileNameShort = saveFileName.split("/").slice(-1);
          document.getElementById('save-file').value = saveFileNameShort;
          break;

        case 'saveFileData':
          console.log("Save File Stringified: ", saveFileData);
          break;

        default:
          console.warn("Unknown event:", args);
      }
    });

  }
}

function redrawCanvas(context, poseList) {
  clearCanvas(context);
  drawBezier(context, poseList);
  drawAllHandleLines(context, poseList);
  drawAllPoses(context, poseList);
  drawAllHandleDots(context, poseList);
}

function clearCanvas(context) {
  context.drawImage(images.field, 0, 0);
}

function drawTool(context, tool, x, y) {
  context.drawImage(images[tool], x, y);
}

function drawPose(context, pose, image) {
  const selected = pose === hoveredPose;
  const size = selected ? 40 : 32;

  // Center tool image on cursor.
  const x = pose.point.x - size / 2;
  const y = pose.point.y - size / 2;
  context.drawImage(image, x, y, size, size);
}

function drawAllPoses(context, poseList) {
  if (poseList.length < 1) return;

  const first = poseList.slice(0, 1);
  const inner = poseList.slice(1, -1);
  const last = poseList.slice(-1);

  drawPose(context, first[0], images[toolStateToName[Tool.POSE]]);

  for (let pose of inner) {
    const image = images[toolStateToName[Tool.WAYPOINT]];

    drawPose(context, pose, image);
  }

  if (poseList.length > 1) {
    drawPose(context, last[0], images[toolStateToName[Tool.FINISH]]);
  }
}

function drawBezier(context, poseList) {
  if (2 > poseList.length) {
    return;
  }

  let pose1 = poseList[0];

  context.save();
  context.lineWidth = 2.0;
  context.beginPath();
  context.moveTo(pose1.point.x, pose1.point.y);

  for (let pose2 of poseList.slice(1)) {
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

  for (let pose of poseList) {
    drawHandleLine(context, pose.enterHandle, pose.point);
    drawHandleLine(context, pose.exitHandle, pose.point);
  }
}

function drawAllHandleDots(context, poseList) {
  if (poseList.length == 0) {
    return;
  }

  for (let pose of poseList) {
    const enterColor = isHandleSelected(pose.enterHandle)
      ? colors.handle.enter.selected.color
      : colors.handle.enter.color;

    const enterScale = isHandleSelected(pose.enterHandle)
      ? 1.3
      : 1.0;

    drawHandleDot(context, pose.enterHandle, pose.point, enterColor, enterScale);

    const exitColor = isHandleSelected(pose.exitHandle)
      ? colors.handle.exit.selected.color
      : colors.handle.exit.color;

    const exitScale = isHandleSelected(pose.exitHandle)
      ? 1.3
      : 1.0;

    drawHandleDot(context, pose.exitHandle, pose.point, exitColor, exitScale);
  }
}

function map(value, x1, w1, x2, w2) {
  return (value - x1) * w2 / w1 + x2;
}

function placePointAt(x, y) {
  const new_point = Point(x, y, []);
  let new_pose;

  if (0 == poseList.length) {
    new_pose = Pose(new_point, Vector(-100, 0), Vector(100, 0), {commands: PoseCommandGroup()});
  } else {
    const last_point = poseList.slice(-1)[0].point;
    const enterVec = last_point.sub(new_point).unit().scale(100);
    const exitVec = enterVec.scale(-1);

    new_pose = Pose(new_point, enterVec, exitVec, {commands: PoseCommandGroup()});
  }

  poseList.push(new_pose)
}

function findPoseNear(x, y) {
  for (let pose of poseList) {
    const distance = Math.pow(x - pose.point.x, 2) + Math.pow(y - pose.point.y, 2);

    if (distance < 450) {
      return pose;
    }
  }

  return null;
}

function findHandleNear(x, y) {
  for (let pose of poseList) {
    let pt = pose.point.addVec(pose.enterHandle);
    let distance = Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2);

    if (distance < 450) {
      return {
        pose,
        isEnter: true,
      };
    }

    pt = pose.point.addVec(pose.exitHandle);
    distance = Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2);
    if (distance < 450) {
      return {
        pose,
        isEnter: false,
      };
    }
  }

  return null;
}

function exportPoses(poseList) {
  /** Export file format
   *
   *  Segment :: Tuple Point Point Point (List Options)
   *
   *  Payload :: { self :: List Segment }
   */


  if (2 > poseList.length) {
    return [];
  } else {
    //const result = [];
    const pointToArray = pt => [pt.x, pt.y];
    const canvasToMeters = point => Point(
      point.x / images.field.width * config.fieldDims.xmeters,
      (1 - (point.y / images.field.height)) * config.fieldDims.ymeters,
    );

    let pose1 = poseList[0];
    for (let pose2 of poseList.slice(1)) {
      const segment = [
        pose1.point,
        pose1.point.addVec(pose1.exitHandle),
        pose2.point.addVec(pose2.enterHandle),
        pose2.point,
        pose1.options,
      ].map(canvasToMeters)
        .map(pointToArray);

      Payload.self.push(segment);
      pose1 = pose2;
    }

    return Payload;
  }
}

function importPoses(data) {
  const poseList = [];

  if (data.length < 1) {
    return poseList;
  }

  const metersToCanvas = point => Point(
    (point.x * images.field.width / config.fieldDims.xmeters),
    (point.y / config.fieldDims.ymeters - 1) * -1 * images.field.height,
    []
  );

  const toPoint = (p) => Point(p[0], p[1]);

  data = data.map((segment) =>
    segment.map(toPoint).map(metersToCanvas)
  );

  let pt1 = data[0][0];
  let cp1 = data[0][1];

  let pose = Pose(pt1, cp1.sub(pt1).scale(-1), cp1.sub(pt1), {commands:PoseCommandGroup()});
  poseList.push(pose);

  pt1 = data[0][3];
  cp1 = data[0][2];

  for (let segment of data.slice(1)) {
    const cp2 = segment[1];

    pose = Pose(pt1, cp1.sub(pt1), cp2.sub(pt1), {commands:PoseCommandGroup()});

    poseList.push(pose);
    pt1 = segment[3];
    cp1 = segment[2];
  }

  let segment = data.slice(-1)[0];
  pt1 = segment[3];
  cp1 = segment[2];
  pose = Pose(pt1, cp1.sub(pt1), cp1.sub(pt1).scale(-1), [0]);

  poseList.push(pose);

  return poseList;
}

//   Draw UI in the command group dropping area:
let initialSomething = {
  moveCondition: "go",
  rootNode: makeNode('group', [], 'sequential'),
};

let rootSomething = {
  moveCondition: "go",
  rootNode: makeNode('group', [], 'sequential'),
};

function findNode(node, idTarget) {
  if (node.nodeId == idTarget) {
    return node;
  }
  else {
    for (let child of node.children) {
      let node = findNode(child, idTarget);

      if (node !== null) {
        return node;
      }
    }
    return null;
  }
}

document.addEventListener('dragstart', (ev) => {

  let dragTargets = [
    "sequential",
    "parallel",
    "race",
    "example",
  ];

  if (dragTargets.includes(ev.target.id)) {
    ev.dataTransfer.setData('text/plain', ev.target.id);
  }
});

document.addEventListener('dragend', (ev) => {
  ev.preventDefault();
});

document.addEventListener('dragenter', (ev) => {
  ev.preventDefault();

  if (ev.target.classList.contains('action-drop-zone')) {
    if(spacerTarget) {
      spacerTarget.classList.remove("is-active-dropzone");
    }

    console.log("enter drop zone", ev.target.id, ev.dataTransfer.getData('text'));

    if(ev.target.classList.contains("o-command-group__spacer")) {
      spacerTarget = ev.target;
      spacerTarget.classList.add('is-active-dropzone');
    }
  }
});

document.addEventListener('dragover', (ev) => {
  if (ev.target.classList.contains('action-drop-zone')) {
    ev.preventDefault();
    let dragoverTarget = ev.target;
  } // frog  (._.)
});

function drawAllNodes(rootSomething) {
  const rootElement = document.getElementById("c-action-work-area__sequence");

  const { moveCondition, rootNode } = rootSomething;

  const moveConditionSwitch = document.createElement("div");
  moveConditionSwitch.classList.add('o-command-moveSwitch');

  const childList = Array.prototype.slice.call(rootElement.children, 0);

  for (let child of childList) {
    rootElement.removeChild(child);
  }

  if (moveCondition === "go") {
    moveConditionSwitch.textContent = "Go";
    moveConditionSwitch.classList.add("o-command-moveSwitch-stop");
    moveConditionSwitch.classList.remove("o-command-moveswitch-go");
  } else {
    moveConditionSwitch.textContent = "Halt";
    moveConditionSwitch.classList.remove("o-command-moveswitch-stop");
    moveConditionSwitch.classList.add("o-command-moveswitch-go");
  }

  const elem = drawNodes(rootNode);

  rootElement.appendChild(moveConditionSwitch);
  rootElement.appendChild(elem);
}

function drawNodes(node) {
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

    function createSpacer(insertIndex) {
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
    nodeElem = document.createElement("img");
    nodeElem.classList.add('o-command');
    nodeElem.src = "images/command.png";

    nodeElem.dataset.nodeId = node.nodeId;
    nodeElem.dataset.nodeName = node.name;
    nodeElem.dataset.nodeKind = node.kind;

    return nodeElem;
  }
}

function createNode(type, commandName) {
  return makeNode(type, [], commandName);
}

function attachNode(child, parent) {
  parent.children.push(child);
}

function insertNode(child, parent, index) {
  parent.children = parent.children.slice(0, index)
    .concat([child])
    .concat(parent.children.slice(index));
}

function getCommandImg(commandName) {
  commandImgs.forEach(element => {
    if (element == commandName) {
      return commandImgs.element;
    }
  });
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

document.addEventListener('drop', (ev) => {

  const targetPoseCommands = actionedPose.options.commands;
  let target = ev.target;

  if(spacerTarget) {
    spacerTarget.classList.remove("is-active-dropzone");
  }

  if (ev.target.classList.contains('action-drop-zone')) {

    const targetPoseCommands = actionedPose.options.commands; // pass in options of current target of actions tool

    let insertIndex = 0;

    if (target.classList.contains('o-command-group__spacer')) {
      insertIndex = target.dataset.insertIndex;
      target = target.parentElement;
    }

    const commandName = ev.dataTransfer.getData('text/plain');
    console.log("Target nodeId: ", target.dataset.nodeId, target);

    targetNode = findNode(targetPoseCommands, target.dataset.nodeId, true); // need to figure out index of target pose in poselist, pass in the options.commands object of said pose

    switch (commandName) {
      case 'sequential':
      case 'race':
      case 'parallel':
        if (targetNode === null) {
          console.error("Unable to find target node", targetNode);
        } else {
          insertNode(createNode('group', commandName), targetNode, insertIndex);
        }
        break;
      case 'example':
        insertNode(createNode('command', commandName), targetNode, insertIndex);
        break;
      default:
        console.error("Oh no command not recognised help: ", commandName);
    }
  }
  console.log("Updated Data structure: ", targetPoseCommands, targetNode);
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
//   name: 'sequential',
//   id: 0,
// }
