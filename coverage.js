const convert = require('xml-js');
const fs = require('fs');
const glob = require('@actions/glob');
const { fail } = require('./core');
const { fetchBaseCoverage, fetchHistory } = require('./remote');
const { retrieveGlobalMetricsElement } = require('./xml');

const parseCoverage = async (file) => {
    const globber = await glob.create(file);
    const files = await globber.glob();

    if (files.length === 0) {
        fail('Coverage file not found :/');
    }

    const options = {ignoreComment: true, alwaysChildren: true};
    const json = convert.xml2js(fs.readFileSync(files[0], {encoding: 'utf8'}), options);
    const metrics = retrieveGlobalMetricsElement(json);
    const total = parseInt(metrics.attributes.elements, 10);
    const covered = parseInt(metrics.attributes.coveredelements, 10);
    const coverage = parseFloat((100 * covered / total).toFixed(3));

    console.log('Metrics gathered from clover file:', metrics.attributes);

    return { total, covered, coverage };
}

const parseCoverages = async (coverageFiles) => {
    const reports = {};

    for (const file of coverageFiles) {
        console.log(`Parsing ${file.coverage}...`);
        reports[file.summary] = await parseCoverage(file.coverage);
        console.log(`Parsed ${file.coverage}`);
    }

    return reports;
};

const retrieveBaseCoverage = async (summaryFile) => {
    const baseCoverageResult = await fetchBaseCoverage(summaryFile);

    if (baseCoverageResult.status === 404) {
        return null;
    }

    return await baseCoverageResult.json();
}

const retrieveHistory = async (coverageBranch, historyFilename) => {
    const historyFile = await fetchHistory(coverageBranch, historyFilename);

    return historyFile.status === 200 ? (await historyFile.json()) : {};
};

const sumCoverages = coverages => {
    const out = {
        total: 0,
        covered: 0
    };

    for (const coverage of Object.values(coverages)) {
        out.total += coverage.total;
        out.covered += coverage.covered;
    }

    out.coverage = parseFloat((100 * out.covered / out.total).toFixed(3));

    return out;
}

export { parseCoverages, retrieveBaseCoverage, retrieveHistory, sumCoverages };
