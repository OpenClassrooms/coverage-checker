const { fail } = require('./core');

const findNode = (tree, name) => {
    if (!tree.elements) {
        fail('Wrong coverage file format');
    }

    const element = tree.elements.find(e => e.name === name);

    if (!element) {
        fail('Wrong coverage file format');
    }

    return element;
}

const retrieveGlobalMetricsElement = json => findNode(findNode(findNode(json, 'coverage'), 'project'), 'metrics');

export { retrieveGlobalMetricsElement };
