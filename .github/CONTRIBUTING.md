# Contributing to Erlbrew POS

Thank you for your interest in contributing! This document provides guidelines and steps for contributing.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/ctoswar/erlbrew-pos/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Environment details (OS, browser, Node version)

### Suggesting Features

1. Check [existing issues](https://github.com/ctoswar/erlbrew-pos/issues) for similar suggestions
2. Open a new issue using the **Feature Request** template
3. Describe the problem your feature would solve
4. Describe alternatives you've considered

### Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Follow the code style (see below)
5. Test your changes
6. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add new feature description"
   ```
7. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- MySQL database (or Docker)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/erlbrew-pos.git
cd erlbrew-pos

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Start development servers
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd server
npm run dev
```

### Docker Development

```bash
cd infra
docker compose up -d
```

## Code Style

### JavaScript/TypeScript

- Use ES modules (`import`/`export`)
- Follow existing patterns in the codebase
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

### Security

- Never commit `.env` files or secrets
- Use environment variables for configuration
- Report security vulnerabilities privately via [SECURITY.md](../SECURITY.md)

## Pull Request Guidelines

- PR should target the `main` branch
- Include a clear description of changes
- Reference related issues (e.g., "Closes #123")
- Keep PRs focused on a single change
- Ensure no lint errors or type errors
- Update documentation if needed

## Questions?

Open an issue with the label "question" if you need help.
