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

export const CommandPoint = (t, commands, moveCondition) => ({
    t,
    commands,
    moveCondition,

    toggleMoveCondition () {
        if (this.moveCondition == 'go') {
            this.moveCondition = 'halt';
        } else if (this.moveCondition == 'halt') {
            this.moveCondition = 'go';
        }
    }
});

const CommandPointListPrototype = {

    newCommandPoint (t, commands = []) {
        let commandPackage = ActionNode("group", commands, 'sequence', 0, IdGen()); // Ensure there is always a base sequence group
        this.cmdPts.push(CommandPoint(t, commandPackage, 'go'));
    },

    deleteCommandPoint (cmdPt) {
        this.cmdPts.splice(this.cmdPts.indexOf(cmdPt), 1);
    },

    moveCommandPointToT (cmdPt, t) {
        this.cmdPts[this.cmdPts.indexOf(cmdPt)].t = t;
    },

    absorb (data) {
        // copy cmdPtList data into self to preserve variable
        this.cmdPts = data.cmdPts;
    },

}

export const CommandPointList = () => {
    const self = Object.create(CommandPointListPrototype);
    self.cmdPts = [];
    return self;
}