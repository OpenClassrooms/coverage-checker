const { fail } = require('./core');

const extractNodes = (tree, name) => {
    if (!tree.elements || tree.elements.length === 0) {
        return [];
    }

    let out = [];
    tree.elements.filter(e => e.name !== name).forEach(e => out = out.concat(extractNodes(e, name)));
    out = out.concat(tree.elements.filter(e => e.name === name));

    return out;
};

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

const retrieveDetailedFilesElements = json => extractNodes(json, 'file');

const retrieveMetricsElement = json => findNode(json, 'metrics');

export { retrieveDetailedFilesElements, retrieveGlobalMetricsElement, retrieveMetricsElement };
