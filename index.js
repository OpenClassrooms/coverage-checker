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
const COVERAGE_FILE = core.getInput('coverage-file');
const SUMMARY_FILE = core.getInput('summary-file');
const TOKEN = core.getInput('token');
const REPO = `https://${process.env.GITHUB_ACTOR}:${TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

const fail = (message) => {
    core.setFailed(message);
    console.error(message);
    process.exit(-1);
};

const execute = (command, options) => new Promise(function (resolve, reject) {
    const cb = (error, stdout) => {
        if (error) {
            core.setFailed(error);
            reject(error);

            return;
        }

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
    const globber = await glob.create(COVERAGE_FILE);
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

const fetchBaseCoverage = () => fetch(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${COVERAGE_BRANCH}/${SUMMARY_FILE}`, {
    headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
    }
});

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

const update = async coverage => {
    const workingDir = await clone();
    fs.writeFileSync(`${workingDir}/${SUMMARY_FILE}`, JSON.stringify(coverage));
    await push(workingDir);

    console.log('Coverage successfully updated');
};

const check = async coverage => {
    const baseCoverageResult = await fetchBaseCoverage();

    if (baseCoverageResult.status === 404) {
        console.log(`No base coverage found. Current coverage is ${coverage.coverage}% (${coverage.total} lines, ${coverage.covered} covered)`);
        return;
    }

    const coverageResult = await baseCoverageResult.json();

    if (coverage.coverage < coverageResult.coverage) {
        await postMessageOnPullRequest(buildFailureMessage(coverageResult, coverage));
        core.setFailed('Code coverage has been degraded');
    } else {
        await postMessageOnPullRequest(buildSuccessMessage(coverageResult, coverage));
    }
};

const action = async () => {
    try {
        const coverage = await parseCoverage();

        await (ACTION === 'update' ? update(coverage) : check(coverage));
    } catch (error) {
        core.setFailed(error.message);
    }
};

action();
