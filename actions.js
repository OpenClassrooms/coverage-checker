const fs = require('fs');
const { generateBadge } = require ('./badge');
const { retrieveBaseCoverage, retrieveHistory, sumCoverages } = require('./coverage');
const { clone, push } = require('./git');
const { buildResultMessage, postMessageOnPullRequest } = require ('./message');

const check = async (coverages, coverageFiles, reportMessageHeader) => {
    const baseCoverages = {};
    const messages = [];

    for (const summaryFile of Object.keys(coverages)) {
        const baseCoverageResult = await retrieveBaseCoverage(summaryFile);
        const coverage = coverages[summaryFile];

        if (baseCoverageResult === null) {
            console.log(`No base coverage ${summaryFile} found. Current coverage is ${coverage.coverage}% (${coverage.total} lines, ${coverage.covered} covered)`);
            continue;
        }

        baseCoverages[summaryFile] = baseCoverageResult;

        messages.push('*' + coverageFiles.find(e => e.summary === summaryFile).label + '* \n\n' + buildResultMessage(baseCoverages[summaryFile], coverage));
    }

    if (Object.keys(coverages).length > 1) {
        const globalBaseCoverage = sumCoverages(baseCoverages);
        const globalCoverage = sumCoverages(coverages);

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
        fs.writeFileSync(`${workingDir}/${summaryFile}`, JSON.stringify(coverages[summaryFile]));

        if (conf.badge) {
            await generateBadge(coverages[summaryFile].coverage, conf.label, conf.badge, workingDir);
        }

        if (typeof history[conf.label] === 'undefined') {
            history[conf.label] = [];
        }

        history[conf.label].push({
            time: (new Date()).toISOString(),
            coverage: coverages[summaryFile].coverage
        });
    }
    fs.writeFileSync(`${workingDir}/${historyFilename}`, JSON.stringify(history));

    console.log('Pushing to coverage branch');
    await push(workingDir, repository);

    console.log('Coverage successfully updated');
};

export { check, update };
