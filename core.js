const core = require('@actions/core');
const process = require('process');
const { exec } = require('child_process');

const fail = (message) => {
    core.setFailed(message);
    console.error(message);
    process.exit(-1);
};

const execute = (command, options) => new Promise(function (resolve, reject) {
    const cb = (error, stdout) => {
        if (error) {
            fail(error);
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

export { execute, fail };
