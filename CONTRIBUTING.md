# Contributing to MCP Raindrop

Thank you for your interest in contributing to MCP Raindrop!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a `.env` file from `.env.example`
5. Add your Raindrop.io API token to `.env`

## Development Workflow

1. Create a new branch for your feature/fix
2. Make your changes
3. Build the project: `npm run build`
4. Test your changes
5. Commit your changes (see commit guidelines below)
6. Push to your fork
7. Create a pull request

## Security Guidelines

### 🔴 CRITICAL: Never commit sensitive information

- Never commit API tokens, passwords, or secrets
- Always use environment variables for sensitive data
- Check your commits for accidental token exposure
- If you accidentally commit a secret:
  1. Immediately revoke the compromised token
  2. Remove it from git history
  3. Force push the cleaned branch
  4. Notify maintainers

## Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Testing

Before submitting a PR:

1. Ensure the code builds: `npm run build`
2. Test with your own Raindrop.io account
3. Verify all tools work as expected
4. Check for TypeScript errors

## Commit Messages

Use clear, descriptive commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `chore:` for maintenance tasks
- `security:` for security improvements

Example: `feat: add bulk import tool for bookmarks`

## Pull Request Guidelines

1. Update documentation if needed
2. Describe your changes clearly
3. Reference any related issues
4. Ensure no secrets are exposed
5. Be responsive to feedback

## Adding New Tools

When adding new MCP tools:

1. Follow the existing pattern in `src/index.ts`
2. Use Zod for input validation
3. Include proper error handling
4. Add comprehensive descriptions
5. Update README with tool documentation
6. Consider rate limiting implications

## Questions?

Feel free to open an issue for:

- Bug reports
- Feature requests
- Documentation improvements
- General questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.