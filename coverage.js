const convert = require('xml-js');
const fs = require('fs');
const glob = require('@actions/glob');
const { fail } = require('./core');
const { fetchBaseCoverage, fetchBaseDetailedCoverages, fetchHistory } = require('./remote');
const { retrieveDetailedFilesElements, retrieveGlobalMetricsElement, retrieveMetricsElement } = require('./xml');

const compareDetailedCoverages = (oldCoverages, newCoverages) => {
    const out = {
        degraded: [],
        improved: []
    };

    for (const filename of Object.keys(oldCoverages)) {
        if (typeof newCoverages[filename] === 'undefined' || newCoverages[filename].coverage === oldCoverages[filename].coverage) {
            continue;
        }

        const oldCoverage = Number(oldCoverages[filename].coverage);
        const newCoverage = Number(newCoverages[filename].coverage);

        out[newCoverage < oldCoverage ? 'degraded' : 'improved'].push({
            filename,
            old: `${oldCoverages[filename].covered} / ${oldCoverages[filename].total} (${oldCoverages[filename].coverage}%)`,
            new: `${newCoverages[filename].covered} / ${newCoverages[filename].total} (${newCoverages[filename].coverage}%)`
        });
    }

    return out.degraded.length === 0 && out.improved.length === 0 ? null : out;
}

const extractCoverageFromMetricsElement = (metrics) => {
    const total = parseInt(metrics.attributes.elements, 10);
    const covered = parseInt(metrics.attributes.coveredelements, 10);
    const coverage = parseFloat((100 * covered / total).toFixed(3));

    return { total, covered, coverage };
}

const extractDetailedCoverages = (json) => {
    const out = {};

    for (const fileElement of retrieveDetailedFilesElements(json)) {
        out[fileElement.attributes.name] = extractCoverageFromMetricsElement(retrieveMetricsElement(fileElement));
    }

    return out;
}

const parseCoverage = async (file) => {
    const globber = await glob.create(file);
    const files = await globber.glob();

    if (files.length === 0) {
        fail('Coverage file not found :/');
    }

    const options = {ignoreComment: true, alwaysChildren: true};
    const json = convert.xml2js(fs.readFileSync(files[0], {encoding: 'utf8'}), options);

    return {
        overall: extractCoverageFromMetricsElement(retrieveGlobalMetricsElement(json)),
        detailed: extractDetailedCoverages(json)
    };
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

const retrieveBaseCoverage = async (summaryFile, coverageBranch) => {
    const baseCoverageResult = await fetchBaseCoverage(summaryFile, coverageBranch);

    if (baseCoverageResult.status === 404) {
        return null;
    }

    return await baseCoverageResult.json();
}

const retrieveBaseDetailedCoverages = async (summaryFile, coverageBranch) => {
    const baseDetailedCoveragesResult = await fetchBaseDetailedCoverages(summaryFile, coverageBranch);

    if (baseDetailedCoveragesResult.status === 404) {
        return null;
    }

    return await baseDetailedCoveragesResult.json();
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

export { compareDetailedCoverages, parseCoverages, retrieveBaseCoverage, retrieveBaseDetailedCoverages, retrieveHistory, sumCoverages };
