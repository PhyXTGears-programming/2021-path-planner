/* Module for code related to Pose data structure.  Drawing functions are kept
 * elsewhere, since they are detail of how the app chooses to use the data structure.
 */

import Bezier from './geom/bezier.js';
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

  findTNearPoint (pt, maxDist, numSamples = 128) {
    let minT = -1;
    let minPt = null;
    let minD2 = Number.POSITIVE_INFINITY;

    for (let a = 0; a < this.length - 1; a += 1) {
      const pose1 = this.poses[a];
      const pose2 = this.poses[a + 1];

      const bez = bezierFromPoses(pose1, pose2);

      const { t, pt: bezPt, dist2 } = bez.findTNearPoint(pt, maxDist, numSamples);

      if (t < 0.0) {
        continue;
      }

      if (dist2 < minD2) {
        minT = t;
        minPt = bezPt;
        minD2 = dist2;
      }
    }

    return { t: minT, pt: minPt, dist2: minD2 };
  },

  findNextTNearPoint (pt, prevT, maxDist, numSamples = 128) {
    let minT = -1;
    let minPt = null;
    let minD2 = Number.POSITIVE_INFINITY;

    for (let a = 0; a < this.length - 1; a += 1) {
      const pose1 = this.poses[a];
      const pose2 = this.poses[a + 1];

      const bez = bezierFromPoses(pose1, pose2);

      const { t, pt: bezPt, dist2 } = bez.findTNearPoint(pt, maxDist, numSamples);

      if (t < 0.0) {
        continue;
      }

      const t2 = t + a; // Convert t [0, 1), to [a, a + 1).

      if (-1 === minT || Math.abs(t2 - prevT) < Math.abs(minT - prevT)) {
        // Keep the point closest to prevT even when it's further away.
        // This let's the user navigate overlaps by sliding along the bezier
        // toward the intersection.
        minT = t2;
        minPt = bezPt;
        minD2 = dist2;
      }
    }

    return { t: minT, pt: minPt, dist2: minD2 };
  },

  get length() {
    return this.poses.length;
  },

  insertPose (index, pose) {
    this.poses.splice(index, 0, pose);
  },

  pointAt (t) {
    // 1st bezier of pose list is t = [0.0, 1.0) between pose 0 and 1.
    // 2nd bezier              is t = [1.0, 2.0) between pose 1 and 2.
    // etc...

    if (t < 0.0 || t > this.length) {
      return null;
    }

    const index = ~~t;   // Javascript trick to convert float to int.

    t -= index;

    const pose1 = this.poses[index];
    const pose2 = this.poses[index + 1];

    const bez = bezierFromPoses(pose1, pose2);

    return bez.pointAt(t);
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


const bezierFromPoses = (pose1, pose2) => {
  return Bezier(
    pose1.point,
    pose1.point.addVec(pose1.exitHandle),
    pose2.point.addVec(pose2.enterHandle),
    pose2.point
  );
};
