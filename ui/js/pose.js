/* Module for code related to Pose data structure.  Drawing functions are kept
 * elsewhere, since they are detail of how the app chooses to use the data structure.
 */

import Point from './geom/point.js';

const PoseListPrototype = {
  appendPose (pose) {
    this.poses.push(pose);
  },

  deletePose (pose) {
    const index = this.poses.indexOf(pose);

    if (-1 < index) {
      this.poses.splice(index, 1);
    }
  },

  deletePoseAt (index) {
    this.poses.splice(index, 1);
  },

  get length() {
    return this.poses.length;
  },

  updateMoveSwitchPerms() {
    if (0 == this.length) {
      return;
    }

    const lastPose = this.poses[this.length - 1];
    lastPose.commands.moveConditionCanSwitch = false;

    const rest = this.poses.slice(0, -1);

    for (const pose of rest) {
      pose.commands.moveConditionCanSwitch = true;
    }
  },

};

export const PoseList = (poses = []) => {
  const self = Object.create(PoseListPrototype);
  self.poses = [];
  return self;
};


const PosePrototype = {
  canSwitch () {
    return this.commands.moveConditionCanSwitch;
  },

  toggleMoveCondition () {
    const sequence = this.commands;
    if (sequence.moveConditionCanSwitch) {
      if ('go' == commands.moveCondition) {
        sequence.moveCondition = 'halt';
      } else if ('halt' == sequence.moveCondition) {
        sequence.moveCondition = 'go';
      }
    }
  },
};

export const Pose = (point, enterHandle, exitHandle, options) => {
  const self = Object.create(PosePrototype);
  const { commands } = options;
  return Object.assign(self, {
    point,
    enterHandle,
    exitHandle,
    commands,
  });
};


export const PoseCommandGroup = nodeId => ({
  moveConditionCanSwitch: false,
  moveCondition: "halt",
  rootNode: ActionNode("group", [], 'sequential', nodeId),
});


export const ActionNode = (kind, children, name, nodeId) => ({
  kind,
  children,
  name,
  nodeId,
});


const Payload = () => ({
  segments: [],
  waypoints: [],
});


export const exportPoses = (poseList, fieldDims) => {
  /** Export file format
   *
   *  Point :: List Float Float
   *  Segment :: Tuple Point Point Point Point
   *  Waypoint :: { commands  :: List ??
   *              , shallHalt :: Boolean
   *              }
   *
   *  Payload :: { segments :: List Segment
   *             , waypoints :: List Waypoint
   *             }
   */

  const payload = Payload();

  if (2 > poseList.length) {
    return payload;
  } else {
    //const result = [];
    const pointToArray = pt => [pt.x, pt.y];

    const canvasToMeters = point => Point(
      point.x / fieldDims.xPixels * fieldDims.xmeters,
      (1 - (point.y / fieldDims.yPixels)) * fieldDims.ymeters,
    );

    let pose1 = poseList.poses[0];

    for (let pose2 of poseList.poses.slice(1)) {
      const segment = [
        pose1.point,
        pose1.point.addVec(pose1.exitHandle),
        pose2.point.addVec(pose2.enterHandle),
        pose2.point,
      ].map(canvasToMeters)
       .map(pointToArray);

      payload.segments.push(segment);

      const waypoint = {
        commands: pose1.commands.rootNode,
        shallHalt: pose1.commands.moveCondition === 'halt',
      };

      payload.waypoints.push(waypoint);

      pose1 = pose2;
    }

    return payload;
  }
}



export const importPoses = (data, fieldDims, genId) => {
  const poseList = PoseList();

  if (data.length < 1) {
    return poseList;
  }

  const metersToCanvas = point => Point(
    (point.x * fieldDims.xPixels / fieldDims.xmeters),
    (point.y / fieldDims.ymeters - 1) * -1 * fieldDims.yPixels,
    []
  );

  const toPoint = p => Point(p[0], p[1]);

  const segments = data.segments.map(
    segment => segment.map(toPoint).map(metersToCanvas)
  );

  let pt1 = segments[0][0];
  let cp1 = segments[0][1];

  let pose = Pose(pt1, cp1.sub(pt1).scale(-1), cp1.sub(pt1), { commands: PoseCommandGroup(genId()) });
  poseList.appendPose(pose);

  pt1 = segments[0][3];
  cp1 = segments[0][2];

  for (let segment of segments.slice(1)) {
    const cp2 = segment[1];

    pose = Pose(pt1, cp1.sub(pt1), cp2.sub(pt1), { commands: PoseCommandGroup(genId()) });

    poseList.appendPose(pose);
    pt1 = segment[3];
    cp1 = segment[2];
  }

  let segment = segments.slice(-1)[0];
  pt1 = segment[3];
  cp1 = segment[2];
  pose = Pose(pt1, cp1.sub(pt1), cp1.sub(pt1).scale(-1), { commands: PoseCommandGroup(genId()) });

  poseList.appendPose(pose);

  return poseList;
}
