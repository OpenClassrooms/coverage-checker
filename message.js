const core = require('@actions/core');
const github = require('@actions/github');
const process = require('process');

const buildDeltaMessage = (oldCoverage, newCoverage) => {
    return [
        '',
        '| Measure | Main branch | ' + process.env.GITHUB_REF + ' |',
        '| --- | --- | --- |',
        '| Coverage | ' + oldCoverage.coverage + '% | ' + newCoverage.coverage + '% |',
        '| Total lines | ' + oldCoverage.total + ' | ' + newCoverage.total + ' |',
        '| Covered lines | ' + oldCoverage.covered + ' | ' + newCoverage.covered + ' |',
        '',
        '∆ ' + (newCoverage.coverage - oldCoverage.coverage).toFixed(3),
        '',
        ''
    ].join('\n');
}

const buildDetailedDiffTable = (diff) => {
    const out = [
        '',
        '| File | On main branch | ' + process.env.GITHUB_REF + ' |',
        '| --- | --- | --- |'
    ];

    for (const entry of diff) {
        out.push('| ' + entry.filename + ' | ' + entry.old + ' | ' + entry.new + ' | ');
    }

    return out . join('\n');
};

const buildDetailedDiffMessage = (detailedDiff) => {
    if (detailedDiff === null) {
        return '';
    }

    let out = '';

    if (detailedDiff.improved.length > 0) {
        out += '<details>\n<summary> :green_circle: :arrow_upper_right: Improved files:</summary> \n' + buildDetailedDiffTable(detailedDiff.improved) + '\n</details>\n\n';
    }
    if (detailedDiff.degraded.length > 0) {
        out += '<details>\n<summary> :red_circle: :arrow_lower_right: Degraded files:</summary> \n' + buildDetailedDiffTable(detailedDiff.degraded)  + '\n</details>\n\n';
    }

    return out + '\n';
};

const buildFailureMessage = (oldCoverage, newCoverage, detailedDiff) => {
    return ':x: Your code coverage has been degraded :sob:' + buildDeltaMessage(oldCoverage, newCoverage) + buildDetailedDiffMessage(detailedDiff);
};

const buildSuccessMessage = (oldCoverage, newCoverage, detailedDiff) => {
    return ':white_check_mark: Your code coverage has not been degraded :tada:' + buildDeltaMessage(oldCoverage, newCoverage)  + buildDetailedDiffMessage(detailedDiff);
};

const buildResultMessage = (oldCoverage, newCoverage, detailedDiff = null) => {
    if (newCoverage.coverage < oldCoverage.coverage) {
        core.setFailed('Code coverage has been degraded');

        return buildFailureMessage(oldCoverage, newCoverage, detailedDiff);
    }

    return buildSuccessMessage(oldCoverage, newCoverage, detailedDiff);
}

const postMessageOnPullRequest = async (message, header) => {
    const context = github.context;

    console.log(message);

    if (context.payload.pull_request == null) {
        return;
    }

    const body = header + '\n\n' + message;

    const pullRequestNumber = context.payload.pull_request.number;
    const octokit = new github.getOctokit(core.getInput('token'));

    const commentId = await retrieveCommentIdFromPullRequest(context, octokit, header);

    if (commentId !== null) {
        await octokit.issues.updateComment({
            ...context.repo,
            body,
            comment_id: commentId
        });
    } else {
        await octokit.issues.createComment({
            ...context.repo,
            body,
            issue_number: pullRequestNumber
        });
    }
};

const retrieveCommentIdFromPullRequest = async (context, octokit, header) => {
    const pullRequestNumber = context.payload.pull_request.number;

    const { data: comments } = await octokit.issues.listComments({
        ...context.repo,
        issue_number: pullRequestNumber
    });
    const comment = comments.find(comment => comment.user.login === 'github-actions[bot]' && comment.body.startsWith(header));

    return comment ? comment.id : null;
};

export { buildResultMessage, postMessageOnPullRequest };
