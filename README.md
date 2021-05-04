# coverage-checker
Github action to check coverage.

This action does two things :

1. It updates coverage report from master branch on each merge
2. It calculates the difference between coverage on master and the current branch in PR

The main purpose is to ensure that coverage has not been degraded by the changes proposed in PR.

## How it works
![Workflow diagram](./doc/github-action.png)

### Update

The update process is the one used to update coverage report for the main branch of the project. After calculation, it pushes results to a dedicated `coverage` branch.

**Here is an exemple of how to use it (on a php project) :**

```yaml
name: Coverage update
on:
  push:
    branches:
      - master
jobs:
  cov_update:
    runs-on: ubuntu-lastest
    steps:
      - uses: actions/checkout@v2
      - name: install PHP
        uses: shivammathur/setup-php@master
        with:
          php-version: '7.4'
      - name: Install dependencies
        run: composer install --prefer-dist --no-progress --no-suggest
      - name: Run test suite
        run: make test
      - name: Codecov update
        uses: OpenClassrooms/coverage-checker@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          action: update
```
> Note that the `Run test suite` step will generate a [`clover` file containing the coverage informations](https://openclover.org/documentation) named coverage.xml. This action will read in this file to generate the report.

### Check

```yaml
name: Coverage check
on: [pull_request]
jobs:
  cov_check:
    runs-on: ubuntu-lastest
    steps:
      - uses: actions/checkout@v2
      - name: install PHP
        uses: shivammathur/setup-php@master
        with:
          php-version: '7.4'
      - name: Install dependencies
        run: composer install --prefer-dist --no-progress --no-suggest
      - name: Run test suite
        run: make test
      - name: Codecov check
        uses: OpenClassrooms/coverage-checker@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          action: check
```

The output of this action is a comment on the PR to simply see if the coverage has been degraded or not.

![Workflow diagram](./doc/success.png)

![Workflow diagram](./doc/failure.png)

## Contributing

Checking in node_modules directory can cause problems. As an alternative, you must use a tool called @vercel/ncc to compile the code and modules into one file used for distribution. This tool already exists in the project. **Compile code before commit by running this command:**

`ncc build index.js --license licenses.txt`