const core = require('@actions/core');
const fetch = require('node-fetch');
const process = require('process');

const getFromGithub = (url) => fetch(url, {
    headers: {
        'Authorization': `token ${core.getInput('token')}`,
        'Accept': 'application/vnd.github.v3.raw'
    }
});

const fetchBaseCoverage = (summaryFile, coverageBranch) => getFromGithub(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${coverageBranch}/${summaryFile}`);

const fetchBaseDetailedCoverages = (summaryFile, coverageBranch) => getFromGithub(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${coverageBranch}/detailed-${summaryFile}`);

const fetchHistory = (coverageBranch, historyFilename) => getFromGithub(`https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${coverageBranch}/${historyFilename}`);

export { fetchBaseCoverage, fetchBaseDetailedCoverages, fetchHistory };
