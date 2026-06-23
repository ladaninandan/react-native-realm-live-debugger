# 🤖 Gemini AI Code Reviewer Agent

This repository is configured with an automated AI code review agent that leverages Google's Gemini 2.5 Flash model. The agent automatically reviews pull requests when they are opened or updated, and can also be triggered on-demand via PR comments.

## How It Works

1. **Automated Trigger**: When a new pull request is opened, synchronized, or reopened, the GitHub Actions workflow triggers.
2. **On-Demand Trigger**: You or any collaborator can request a new review at any time by commenting `@gemini-review` on the pull request.
3. **Diff Fetching & Filtering**: The agent fetches the PR diff from the GitHub API and automatically filters out binary files, lockfiles (`package-lock.json`, `yarn.lock`, etc.), and build outputs to focus only on logical code changes.
4. **Gemini Analysis**: The diff is analyzed by Gemini 2.5 Flash to identify:
   - **Critical issues**: Bugs, security vulnerabilities, logical flaws, or race conditions.
   - **Performance**: Sub-optimal algorithms, redundant operations, or memory leaks.
   - **Best Practices**: Readability, clean code structure, error handling, and naming conventions.
   - **Refactoring Proposals**: Practical code suggestions.
5. **Interactive Review Comment**: The agent writes a structured markdown comment on the pull request detailing the review findings.

## Setup Instructions

To activate the agent, you only need to add your Gemini API Key to your GitHub repository secrets:

1. **Get a Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/).
   - Click **Create API Key**.
   - Copy the generated API Key.

2. **Add to GitHub Secrets**:
   - Go to your repository on GitHub: `https://github.com/ladaninandan/react-native-realm-live-debugger`.
   - Click on the **Settings** tab.
   - In the left sidebar, expand **Secrets and variables** and select **Actions**.
   - Click **New repository secret**.
   - Name the secret: `GEMINI_API_KEY`.
   - Paste your API key as the value.
   - Click **Add secret**.

## Files Added

- **Workflow Configuration**: [.github/workflows/ai-code-review.yml](file:///home/nandan/Disk%20D/realm-debugger/.github/workflows/ai-code-review.yml)
- **Reviewer Engine Script**: [.github/scripts/code-review.js](file:///home/nandan/Disk%20D/realm-debugger/.github/scripts/code-review.js)

## Security & Forks

For security reasons, GitHub Actions do not pass repository secrets to pull requests created from external forks. 
- If a contributor opens a pull request from a fork, the agent will gracefully skip execution without failing the check.
- If you want reviews for external forks, you can trigger them manually by commenting `@gemini-review` once you verify the PR contents are safe, or merge the changes into a branch within the main repository.
