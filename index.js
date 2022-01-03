const core = require('@actions/core');
const process = require('process');
const { check, update } = require('./actions');
const { fail } = require('./core');
const { parseCoverages } = require('./coverage');
const fs = require('fs');
const path = require('path');

const ACTION = core.getInput('action');
const COVERAGE_BRANCH = core.getInput('coverage-branch');
const WITH_AVERAGE = core.getInput('with-average') === 'true';
const COVERAGE_DIRECTORY = core.getInput('directory');
const COVERAGE_FILES = JSON.parse(core.getInput('files'));
const REPO = `https://${process.env.GITHUB_ACTOR}:${core.getInput('token')}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
const HISTORY_FILENAME = 'coverage-history.json';
const REPORT_MESSAGE_HEADER = 'Issued by Coverage Checker:';

const buildFilesConfig = (directory, filesConfig) => {
    if (COVERAGE_DIRECTORY === '') {
        return filesConfig;
    }

    filesConfig = [];

    fs.readdirSync(directory).filter(it => path.extname(it) === '.xml').forEach(fileName => {
        const name = path.parse(fileName).name;
        filesConfig.push({
            coverage: directory + fileName,
            summary: name + '-coverage-summary.json',
            label: name + ' Coverage',
            badge: name + '-coverage.svg'
        })
    })

    return filesConfig;
}

const action = async () => {
    try {
        const coverageFiles = buildFilesConfig(COVERAGE_DIRECTORY, COVERAGE_FILES);

        console.log('Parsing clover files...')

        const coverages = await parseCoverages(coverageFiles);

        await (ACTION === 'update'
            ? update(coverages, COVERAGE_BRANCH, REPO, HISTORY_FILENAME, coverageFiles)
            : check(coverages, COVERAGE_BRANCH, coverageFiles, REPORT_MESSAGE_HEADER, WITH_AVERAGE)
        );
    } catch (error) {
        fail(error.message);
    }
};

action();
