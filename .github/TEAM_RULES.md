# Team Rules & Account Protection

## Why the previous account (ko2527600) was likely suspended

GitHub's automated trust-and-safety systems flag accounts for:

- **Hardcoded secrets in commits** — pushing API keys, database URLs, PATs, or JWT secrets into any repo (public or private) triggers automated secret scanning. GitHub revokes the token and may suspend the account.
- **Rapid or bulk activity** — mass commits, hundreds of files pushed at once, or bot-like behaviour outside normal working hours.
- **DMCA / copyright violations** — pushing code or assets that belong to someone else.
- **Suspicious login patterns** — multiple geographic locations, unusual sign-in times.
- **Multiple accounts for one person** — GitHub's Terms of Service allow one account per person.

---

## Rules for the `ledgio-software` account

### 1. Never commit secrets

No API keys, database URLs, JWT secrets, webhook secrets, or personal access tokens in **any** file — including `.env`, config files, comments, or test fixtures.

- Store secrets locally in `.env` (already in `.gitignore`).
- All production secrets go in **GitHub Secrets** or **Render environment variables**.
- If you accidentally commit a secret:
  1. Rotate/revoke it immediately (the old value is compromised the moment it's pushed).
  2. Remove it from git history: `git filter-repo --path-glob '*.env' --invert-paths` or via BFG Repo-Cleaner.
  3. Force-push the cleaned history and notify the team.

### 2. Keep the repository private

Go to **github.com/ledgio-software/ledgio- → Settings → Danger Zone → Change repository visibility → Make private**.

A private repo still triggers secret scanning but public exposure is far worse — anyone can see the secret before you rotate it.

### 3. One GitHub account per person

Each team member uses their **own personal GitHub account**. Add them as collaborators:

> repo → Settings → Collaborators and teams → Add people

Do not create a second personal account for yourself — it violates GitHub's Terms and can trigger suspension of both accounts.

### 4. No bulk automated pushes

Use a normal development workflow:

```
feature branch → commit incrementally → open PR → review → merge
```

Don't push hundreds of commits at once from a script or external tool.

### 5. Protect your PAT (Personal Access Token)

- **Never paste a token in Slack, chat, email, or a PR comment.** Even if the message is deleted, it may already have been scanned.
- If a token was shared, regenerate it immediately: **github.com → Settings → Developer settings → Personal access tokens**.
- Tokens should have the **minimum required scopes** and an **expiry date**.

### 6. Keep billing current

A lapsed payment can trigger service suspension. Verify billing is active:

> github.com/settings/billing

### 7. If suspended — appeal immediately

Go to **https://support.github.com/contact/reinstatement**:

- State clearly: legitimate business software, team of professional developers.
- Do **NOT** open multiple tickets — it pushes you to the back of the queue. One ticket, wait for a response.
- Attach evidence if you have it: company registration, client contracts, screenshots of the codebase.

---

## Branch protection (configure in GitHub)

Go to **repo → Settings → Branches → Add branch protection rule** for `main`:

- [x] Require a pull request before merging
- [x] Require approvals: **1**
- [x] Require status checks to pass before merging — add `Backend — typecheck / migrate / test` and `Frontend — typecheck / build`
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
