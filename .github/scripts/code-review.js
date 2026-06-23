const fs = require('fs');
const path = require('path');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!apiKey) {
    console.log('GEMINI_API_KEY is not set. Skipping AI code review. (This is expected for external forks without access to repository secrets)');
    return;
  }

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN is not set.');
    process.exit(1);
  }

  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error('Error: GITHUB_EVENT_PATH is not set or file does not exist.');
    process.exit(1);
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  let pullNumber;
  let owner;
  let repo;

  // Check event type
  if (event.pull_request) {
    pullNumber = event.pull_request.number;
    owner = event.repository.owner.login;
    repo = event.repository.name;
  } else if (event.issue && event.issue.pull_request) {
    pullNumber = event.issue.number;
    owner = event.repository.owner.login;
    repo = event.repository.name;
    
    // For issue comments, ensure the comment triggers the review
    const commentBody = event.comment?.body || '';
    if (!commentBody.includes('@gemini-review')) {
      console.log('Comment does not contain @gemini-review trigger. Skipping.');
      return;
    }
  } else {
    console.log('Event is neither a pull request nor a pull request comment. Skipping.');
    return;
  }

  console.log(`Starting code review for PR #${pullNumber} in ${owner}/${repo}...`);

  // Fetch the PR diff
  const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`;
  const diffResponse = await fetch(diffUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3.diff',
      'Authorization': `token ${githubToken}`,
      'User-Agent': 'Gemini-Code-Reviewer'
    }
  });

  if (!diffResponse.ok) {
    console.error(`Failed to fetch diff from GitHub API: ${diffResponse.status} ${diffResponse.statusText}`);
    process.exit(1);
  }

  const diffText = await diffResponse.text();
  if (!diffText.trim()) {
    console.log('No diff found for this pull request. Skipping review.');
    return;
  }

  // Filter diff to exclude lockfiles, build directories, and binaries
  let filteredDiff = filterDiff(diffText);
  if (!filteredDiff.trim()) {
    console.log('No relevant file changes found after filtering. Skipping review.');
    return;
  }

  // Truncate if diff is excessively large (safety check)
  const maxDiffLength = 80000;
  let isTruncated = false;
  if (filteredDiff.length > maxDiffLength) {
    filteredDiff = filteredDiff.slice(0, maxDiffLength);
    isTruncated = true;
  }

  console.log('Sending diff to Gemini API for review...');
  const feedback = await getGeminiReview(apiKey, filteredDiff, isTruncated);

  if (!feedback) {
    console.error('Failed to get feedback from Gemini API.');
    process.exit(1);
  }

  console.log('Posting review comment to GitHub PR...');
  await postGitHubComment(owner, repo, pullNumber, githubToken, feedback);
  console.log('Code review comment posted successfully.');
}

function filterDiff(diffText) {
  const files = diffText.split(/^diff --git /m);
  const filteredFiles = [];

  for (const file of files) {
    if (!file.trim()) continue;

    const firstLine = file.split('\n')[0];
    const isIgnored = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'dist/',
      'build/',
      'node_modules/',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.ico',
      '.webp',
      '.mp4',
      '.svg',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot'
    ].some(pattern => firstLine.includes(pattern));

    if (!isIgnored) {
      filteredFiles.push('diff --git ' + file);
    }
  }

  return filteredFiles.join('\n');
}

async function getGeminiReview(apiKey, diff, isTruncated) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `You are a Senior Software Engineer and Expert Code Reviewer.
Analyze the following pull request code diff and provide a detailed code review.

Focus your feedback on:
1. **Critical issues**: Bugs, security vulnerabilities, memory leaks, concurrency issues, or logical errors.
2. **Performance & Optimizations**: Redundant operations, sub-optimal algorithm choices, or resource management issues.
3. **Clean Code & Best Practices**: Readability, naming conventions, adherence to standards, proper error handling, modularity, and comments.
4. **Constructive suggestions**: Concrete refactoring recommendations with code snippets where helpful.

Ensure your tone is polite, professional, encouraging, and constructive.
Use clear markdown formatting with headers, bullet points, and code blocks.
If the changes look great with no issues, praise the author and explain why the changes are good.

${isTruncated ? '**Note: The diff has been truncated for length limits. Review what is provided.**\n\n' : ''}
--- DIFF START ---
\`\`\`diff
${diff}
\`\`\`
--- DIFF END ---
`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

async function postGitHubComment(owner, repo, pullNumber, token, body) {
  const commentUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
  
  // Format body with a header and signature
  const formattedBody = `## 🤖 Gemini AI Code Reviewer

${body}

---
*Generated by the Gemini AI Code Reviewer agent. Re-run on-demand by commenting \`@gemini-review\` on this PR.*`;

  try {
    const response = await fetch(commentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`,
        'User-Agent': 'Gemini-Code-Reviewer'
      },
      body: JSON.stringify({ body: formattedBody })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API Error: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error posting comment to GitHub:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal Error:', error);
  process.exit(1);
});
