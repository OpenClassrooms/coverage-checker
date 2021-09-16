const fs = require('fs');
const { generateBadge } = require ('./badge');
const { compareDetailedCoverages, retrieveBaseCoverage, retrieveBaseDetailedCoverages, retrieveHistory, sumCoverages } = require('./coverage');
const { clone, push } = require('./git');
const { buildResultMessage, postMessageOnPullRequest } = require ('./message');

const check = async (coverages, coverageBranch, coverageFiles, reportMessageHeader) => {
    const baseOverallCoverages = {};
    const newOverallCoverages = {};
    const messages = [];

    for (const summaryFile of Object.keys(coverages)) {
        const baseOverallCoverageResult = await retrieveBaseCoverage(summaryFile, coverageBranch);
        const baseDetailedCoverageResult = await retrieveBaseDetailedCoverages(summaryFile, coverageBranch);
        const newOverallCoverage = coverages[summaryFile].overall;

        if (baseOverallCoverageResult === null) {
            console.log(`No base coverage ${summaryFile} found. Current coverage is ${newOverallCoverage.coverage}% (${newOverallCoverage.total} lines, ${newOverallCoverage.covered} covered)`);
            continue;
        }

        newOverallCoverages[summaryFile] = newOverallCoverage;
        baseOverallCoverages[summaryFile] = baseOverallCoverageResult;

        const detailedDiff = (baseDetailedCoverageResult === null) ? null : compareDetailedCoverages(baseDetailedCoverageResult, coverages[summaryFile].detailed);

        messages.push('*' + coverageFiles.find(e => e.summary === summaryFile).label + '* \n\n' + buildResultMessage(baseOverallCoverages[summaryFile], newOverallCoverage, detailedDiff));
    }

    if (Object.keys(coverages).length > 1) {
        const globalBaseCoverage = sumCoverages(baseOverallCoverages);
        const globalCoverage = sumCoverages(newOverallCoverages);

        messages.push('*Global* \n\n' + buildResultMessage(globalBaseCoverage, globalCoverage));
    }

    await postMessageOnPullRequest(messages.join('\n---\n'), reportMessageHeader);
};

const update = async (coverages, coverageBranch, repository, historyFilename, coverageFiles) => {
    console.log('Updating base coverage...');
    const workingDir = await clone(coverageBranch, repository);
    const history = await retrieveHistory(coverageBranch, historyFilename);

    for (const summaryFile of Object.keys(coverages)) {
        const conf = coverageFiles.find(e => e.summary === summaryFile);

        console.log(`Writing ${summaryFile} report (${workingDir}/${summaryFile})`);
        fs.writeFileSync(`${workingDir}/${summaryFile}`, JSON.stringify(coverages[summaryFile].overall));
        fs.writeFileSync(`${workingDir}/detailed-${summaryFile}`, JSON.stringify(coverages[summaryFile].detailed));

        if (conf.badge) {
            await generateBadge(coverages[summaryFile].overall.coverage, conf.label, conf.badge, workingDir);
        }

        if (typeof history[conf.label] === 'undefined') {
            history[conf.label] = [];
        }

        history[conf.label].push({
            time: (new Date()).toISOString(),
            coverage: coverages[summaryFile].overall.coverage
        });
    }
    fs.writeFileSync(`${workingDir}/${historyFilename}`, JSON.stringify(history));

    console.log('Pushing to coverage branch');
    await push(workingDir, repository);

    console.log('Coverage successfully updated');
};

export { check, update };
