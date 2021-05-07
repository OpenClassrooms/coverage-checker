const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');
const {exec} = require('child_process');
const fs = require('fs');
const fetch = require('node-fetch');
const process = require('process');
const convert = require('xml-js');

const ACTION = core.getInput('action');
const COVERAGE_BRANCH = 'coverage';
const FILES = core.getInput('files');
const TOKEN = core.getInput('token');
const REPO = `https://${process.env.GITHUB_ACTOR}:${TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

const fail = (message) => {
    core.setFailed(message);
    console.error(message);
    process.exit(-1);
};

const execute = (command, options) => new Promise(function (resolve, reject) {
    const cb = (error, stdout, stderr) => {
        if (error) {
            console.log(command, stderr);
            core.setFailed(error);
            reject(error);

            return;
        }

        console.log(command, stdout);
        resolve(stdout.trim());
    };

    if (!!options) {
        exec(command, options, cb);
    } else {
        exec(command, cb);
    }
});

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

const clone = async () => {
    const cloneInto = `repo-${new Date().getTime()}`;

    await execute(`git clone ${REPO} ${cloneInto}`);
    const list = await execute(`git branch -a`, {cwd: cloneInto});
    const branches = list.split('\n').filter(b => b.length > 2).map(b => b.replace('remotes/origin/', '').trim());

    if (branches.includes(COVERAGE_BRANCH)) {
        await execute(`git checkout ${COVERAGE_BRANCH}`, {cwd: cloneInto});
        await execute(`git pull`, {cwd: cloneInto});
    } else {
        await execute(`git checkout --orphan ${COVERAGE_BRANCH}`, {cwd: cloneInto});
        await execute(`rm -rf *`, {cwd: cloneInto});
    }

    return cloneInto;
};

const push = async (cwd) => {
    await execute('git config --local user.email zozor@openclassrooms.com', {cwd});
    await execute('git config --local user.name Zozor', {cwd});
    await execute('git add .', {cwd});
    await execute('git commit -m "Update coverage info" --allow-empty', {cwd});
    await execute(`git push ${REPO} HEAD`, {cwd});
};

const parseCoverage = async () => {
    const globber = await glob.create();
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

    return {total, covered, coverage};
}

const parseCoverages = async () => {
    const reports = {};

    for (const file of FILES) {
        reports[file.summary] = await parseCoverage(file.coverage);
    }

    return reports;
};

const fetchBaseCoverage = summaryFile => fetch(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${COVERAGE_BRANCH}/${summaryFile}`, {
    headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
    }
});

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

const postMessageOnPullRequest = async message => {
    const context = github.context;

    console.log(message);

    if (context.payload.pull_request == null) {
        return;
    }

    const pullRequestNumber = context.payload.pull_request.number;
    const octokit = new github.getOctokit(TOKEN);
    await octokit.issues.createComment({
       ...context.repo,
       issue_number: pullRequestNumber,
       body: message
   });
};

const buildDeltaMessage = (oldCoverage, newCoverage) => {
    return [
        '',
        '| Measure | Main branch | ' + process.env.GITHUB_REF + ' |',
        '| --- | --- | --- |',
        '| Coverage | ' + oldCoverage.coverage + '% | ' + newCoverage.coverage + '% |',
        '| Total lines | ' + oldCoverage.total + ' | ' + newCoverage.total + ' |',
        '| Covered lines | ' + oldCoverage.covered + ' | ' + newCoverage.covered + ' |',
        '',
        '∆ ' + (newCoverage.coverage - oldCoverage.coverage).toFixed(3)
    ].join('\n');
}

const buildFailureMessage = (oldCoverage, newCoverage) => {
    return ':x: Your code coverage has been degraded :sob:' + buildDeltaMessage(oldCoverage, newCoverage);
};

const buildSuccessMessage = (oldCoverage, newCoverage) => {
    return ':white_check_mark: Your code coverage has not been degraded :tada:' + buildDeltaMessage(oldCoverage, newCoverage);
};

const buildResultMessage = (oldCoverage, newCoverage) => {
    if (newCoverage.coverage < oldCoverage.coverage) {
        core.setFailed('Code coverage has been degraded');

        return buildFailureMessage(oldCoverage, newCoverage);
    }

    return buildSuccessMessage(oldCoverage, newCoverage);
}

const update = async coverages => {
    const workingDir = await clone();

    for (const summaryFile of Object.keys(coverages)) {
        fs.writeFileSync(`${workingDir}/${summaryFile}`, JSON.stringify(coverages[summaryFile]));
    }

    await push(workingDir);

    console.log('Coverage successfully updated');
};

const check = async coverages => {
    const baseCoverages = {};
    const messages = [];

    for (const summaryFile of Object.keys(coverages)) {
        const baseCoverageResult = await fetchBaseCoverage(summaryFile);
        const coverage = coverages[summaryFile];

        if (baseCoverageResult.status === 404) {
            console.log(`No base coverage ${summaryFile} found. Current coverage is ${coverage.coverage}% (${coverage.total} lines, ${coverage.covered} covered)`);
            continue;
        }

        baseCoverages[summaryFile] = await baseCoverageResult.json();

        messages.push(summaryFile + '\n' + buildResultMessage(baseCoverages[summaryFile], coverage));
    }

    const globalBaseCoverage = sumCoverages(baseCoverages);
    const globalCoverage = sumCoverages(coverages);

    messages.push('global\n' + buildResultMessage(globalBaseCoverage, globalCoverage));

    await postMessageOnPullRequest(messages.join('\n---\n'));
};

const action = async () => {
    try {
        const coverages = await parseCoverages();

        await (ACTION === 'update' ? update(coverages) : check(coverages));
    } catch (error) {
        core.setFailed(error.message);
    }
};

//action();

console.log(core.getInput('files'));
