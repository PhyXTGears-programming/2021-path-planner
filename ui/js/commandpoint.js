// export const Control = () => ({
//     moveConditionCanSwitch: false,
//     moveCondition: "halt",
//     rootNode: ActionNode("group", [], 'sequence', nodeId, 0),
// });

import { IdGen } from './util.js';

export const ActionNode = (kind, children, name, t) => ({
    kind,
    children,
    name,
    t,
});

export const CommandPoint = (t, commands) => ({
    t,
    commands,
});

const CommandPointListPrototype = {
    cmdPts: [],

    newCommandPoint (t, commands = []) {
        let commandPackage = ActionNode("group", commands, 'sequence', IdGen(), 0); // Ensure there is always a base sequence group
        this.cmdPts.push(CommandPoint(t, commandPackage));
    },

    deleteCommandPoint (cmdPt) {
        this.cmdPts.splice(this.cmdPts.indexOf(cmdPt), 1);
    }
}

export const CommandPointList = () => {
    const self = Object.create(CommandPointListPrototype);
    return self;
}