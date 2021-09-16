const core = require('@actions/core');
const process = require('process');
const { check, update } = require('./actions');
const { fail } = require('./core');
const { parseCoverages } = require('./coverage');

const ACTION = core.getInput('action');
const COVERAGE_BRANCH = 'coverage';
const COVERAGE_FILES = JSON.parse(core.getInput('files'));
const REPO = `https://${process.env.GITHUB_ACTOR}:${core.getInput('token')}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
const HISTORY_FILENAME = 'coverage-history.json';
const REPORT_MESSAGE_HEADER = 'Issued by Coverage Checker:';

const action = async () => {
    try {
        console.log('Parsing clover files...')
        const coverages = await parseCoverages(COVERAGE_FILES);

        await (ACTION === 'update'
            ? update(coverages, COVERAGE_BRANCH, REPO, HISTORY_FILENAME, COVERAGE_FILES)
            : check(coverages, COVERAGE_FILES, REPORT_MESSAGE_HEADER)
        );
    } catch (error) {
        fail(error.message);
    }
};

action();
