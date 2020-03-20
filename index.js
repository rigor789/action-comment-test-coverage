const {inspect} = require("util");
const core = require("@actions/core");
const github = require("@actions/github");
const fs = require('fs');

async function run() {
  try {
    const inputs = {
      token: process.env.GITHUB_TOKEN,
      path: core.getInput('coveragePath'),
      coverageURL: core.getInput('coverageURL')
    };

    const {
      payload: {pull_request: pullRequest, repository}
    } = github.context;

    if (!pullRequest) {
      core.error('This action only works on pull_request events');
      return;
    }

    const {number: issueNumber} = pullRequest;
    const {full_name: repoFullName} = repository;
    const [owner, repo] = repoFullName.split('/');

    const octokit = new github.GitHub(inputs.token);

    const data = fs.readFileSync(`${process.env.GITHUB_WORKSPACE}/${inputs.path}`, 'utf8');
    const json = JSON.parse(data);

    const codeBlock = '```'
    const coverage = `**Coverage Report:**
${codeBlock}yaml
Statements: ${json.total.statements.pct}% (${json.total.statements.covered}/${json.total.statements.total})
Branches:   ${json.total.branches.pct}% (${json.total.branches.covered}/${json.total.branches.total})
Functions:  ${json.total.functions.pct}% (${json.total.functions.covered}/${json.total.functions.total})
Lines:      ${json.total.lines.pct}% (${json.total.lines.covered}/${json.total.lines.total})
${codeBlock}

${inputs.coverageURL ? `[See full coverage report](${inputs.coverageURL})` : ''}
<!-- action-comment-test-coverage -->
`
    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber
    }).then(res => res.data)

    const previousComment = Array.isArray(comments) && comments.find(comment => comment.body.includes('action-comment-test-coverage'))

    if (previousComment) {
      // update existing comment
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: previousComment.id,
        body: coverage
      })
    } else {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: coverage
      })
    }
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

run();
