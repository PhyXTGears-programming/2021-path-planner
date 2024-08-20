// export const Control = () => ({
//     moveConditionCanSwitch: false,
//     moveCondition: "halt",
//     rootNode: ActionNode("group", [], 'sequence', nodeId, 0),
// });

import { IdGen } from './util.js';

export const ActionNode = (kind, children, name, t, nodeId) => ({
    kind,
    children,
    name,
    t,
    nodeId,
});

export const CommandPoint = (t, commands) => ({
    t,
    commands,

    canSwitch () {
        //TODO
        return false;
    },

    toggleMoveCondition () {
        //TODO
        return false;
    }
});

const CommandPointListPrototype = {
    cmdPts: [],

    newCommandPoint (t, commands = []) {
        let commandPackage = ActionNode("group", commands, 'sequence', 0, IdGen()); // Ensure there is always a base sequence group
        this.cmdPts.push(CommandPoint(t, commandPackage));
    },

    deleteCommandPoint (cmdPt) {
        this.cmdPts.splice(this.cmdPts.indexOf(cmdPt), 1);
    },

    moveCommandPointToT (cmdPt, t) {
        this.cmdPts[this.cmdPts.indexOf(cmdPt)].t = t;
    },

}

export const CommandPointList = () => {
    const self = Object.create(CommandPointListPrototype);
    return self;
}