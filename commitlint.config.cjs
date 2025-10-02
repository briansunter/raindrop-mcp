module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'docs',     // documentation changes
        'style',    // formatting, missing semi colons, etc
        'refactor', // refactoring code
        'perf',     // performance improvements
        'test',     // adding tests
        'chore',    // updating build tasks, package manager configs
        'revert',   // reverting changes
        'ci',       // CI/CD changes
        'build'     // build system changes
      ]
    ],
    'body-max-line-length': [0, 'always'] // Disable body line length limit
  }
};
