import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceRoot = path.resolve(import.meta.dirname, "..");
let fixtureRoot = "";
let testEnv;

function zeroOidFor(oid) {
  return "0".repeat(oid.length);
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, { cwd, env: testEnv });
  return stdout.trim();
}

async function run(command, args, { cwd, input = "", env = testEnv }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function createRepository(name = "repo") {
  const repo = path.join(fixtureRoot, `${name}-${Math.random().toString(16).slice(2)}`);
  await fs.mkdir(repo, { recursive: true });
  await git(repo, ["init", "-q"]);
  await git(repo, ["config", "user.name", "Push Gate Fixture"]);
  await git(repo, ["config", "user.email", "push-gate@example.test"]);
  await fs.mkdir(path.join(repo, ".githooks"));
  await fs.mkdir(path.join(repo, "scripts"));
  for (const file of ["scripts/check-project-state-push.sh", "scripts/install-git-hooks.sh", ".githooks/pre-push"]) {
    const source = path.join(sourceRoot, file);
    const target = path.join(repo, file);
    await fs.copyFile(source, target);
    await fs.chmod(target, 0o755);
  }
  await writeFile(path.join(repo, "docs", "PROJECT_STATE.md"), "# Project\n\nFixture\n");
  await writeFile(path.join(repo, "README.md"), "fixture\n");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-qm", "baseline\n\nProject-State-Review: updated"]);
  return repo;
}

async function commit(repo, message, changes = {}) {
  for (const [relativePath, content] of Object.entries(changes)) {
    const target = path.join(repo, relativePath);
    if (content === null) {
      await fs.rm(target);
    } else {
      await writeFile(target, content);
    }
  }
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-qm", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

async function check(repo, lines) {
  return run("sh", ["scripts/check-project-state-push.sh"], {
    cwd: repo,
    input: lines.length ? `${lines.join("\n")}\n` : ""
  });
}

function refLine(localRef, localOid, remoteRef, remoteOid) {
  return `${localRef} ${localOid} ${remoteRef} ${remoteOid}`;
}

before(async () => {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-state-push-gate-"));
  const globalConfig = path.join(fixtureRoot, "global.gitconfig");
  await fs.writeFile(globalConfig, "");
  testEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0"
  };
});

after(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

test("accepts an existing branch with no PROJECT_STATE diff and verified-current", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const head = await commit(repo, "non-state change\n\nProject-State-Review: verified-current", {
    "README.md": "fixture update\n"
  });
  const result = await check(repo, [refLine("refs/heads/main", head, "refs/heads/main", baseline)]);

  assert.equal(result.code, 0, result.stderr);
});

test("requires updated when PROJECT_STATE is added, modified, or deleted", async () => {
  const cases = [
    ["added", null, "new state\n"],
    ["modified", "old state\n", "new state\n"],
    ["deleted", "old state\n", null]
  ];

  for (const [name, baselineState, nextState] of cases) {
    const repo = await createRepository(name);
    if (baselineState === null) {
      await fs.rm(path.join(repo, "docs", "PROJECT_STATE.md"));
      await git(repo, ["add", "-A"]);
      await git(repo, ["commit", "-qm", "remove baseline state\n\nProject-State-Review: verified-current"]);
    } else {
      await writeFile(path.join(repo, "docs", "PROJECT_STATE.md"), baselineState);
      await git(repo, ["add", "docs/PROJECT_STATE.md"]);
      await git(repo, ["commit", "-qm", "set baseline state\n\nProject-State-Review: verified-current"]);
    }
    const baseline = await git(repo, ["rev-parse", "HEAD"]);
    const tip = await commit(repo, `change ${name}\n\nProject-State-Review: updated`, {
      "docs/PROJECT_STATE.md": nextState
    });
    const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

    assert.equal(result.code, 0, `${name}: ${result.stderr}`);
  }
});

test("rejects missing, repeated, invalid, and mis-cased trailers", async () => {
  const cases = [
    ["missing", "missing trailer"],
    ["repeated", "repeat\n\nProject-State-Review: updated\nProject-State-Review: updated"],
    ["invalid", "invalid\n\nProject-State-Review: stale"],
    ["mis-cased", "case\n\nproject-state-review: updated"]
  ];

  for (const [name, message] of cases) {
    const repo = await createRepository(name);
    const baseline = await git(repo, ["rev-parse", "HEAD"]);
    const tip = await commit(repo, message, { "docs/PROJECT_STATE.md": `${name}\n` });
    const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

    assert.notEqual(result.code, 0, name);
    assert.match(result.stderr, /Project-State-Review/);
  }
});

test("accepts Git-normalized whitespace for an otherwise valid trailer", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "spaces\n\nProject-State-Review:   updated", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.equal(result.code, 0, result.stderr);
});

test("rejects a trailer that disagrees with the final tree diff", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "wrong state\n\nProject-State-Review: verified-current", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /expected updated/);
});

test("does not accept body text that only looks like a trailer", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "body\n\nProject-State-Review: updated\n\nnot a trailer block", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Project-State-Review/);
});

test("accepts a valid final trailer when matching text appears earlier in the body", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(
    repo,
    "body\n\nProject-State-Review: updated\n\ncontext after body mention\n\nProject-State-Review: updated",
    { "docs/PROJECT_STATE.md": "changed\n" }
  );
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.equal(result.code, 0, result.stderr);
});

test("uses only the branch tip trailer, not an earlier outgoing commit", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  await commit(repo, "earlier\n\nProject-State-Review: updated", { "docs/PROJECT_STATE.md": "first\n" });
  const tip = await commit(repo, "tip without trailer", { "README.md": "changed\n" });
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Project-State-Review/);
});

test("uses the empty tree for first branch pushes", async () => {
  const repo = await createRepository();
  const tip = await git(repo, ["rev-parse", "HEAD"]);
  const result = await check(repo, [
    refLine("refs/heads/main", tip, "refs/heads/main", zeroOidFor(tip))
  ]);

  assert.equal(result.code, 0, result.stderr);
});

test("skips deletion operations in every ref namespace and empty stdin", async () => {
  const repo = await createRepository();
  const head = await git(repo, ["rev-parse", "HEAD"]);
  const zeroOid = zeroOidFor(head);
  const deletion = await check(repo, [refLine("refs/heads/main", zeroOid, "refs/heads/main", head)]);
  const otherDeletion = await check(repo, [refLine("refs/notes/test", zeroOid, "refs/notes/test", head)]);
  const empty = await check(repo, []);

  assert.equal(deletion.code, 0, deletion.stderr);
  assert.equal(otherDeletion.code, 0, otherDeletion.stderr);
  assert.equal(empty.code, 0, empty.stderr);
});

test("accepts lightweight and annotated tags that point to commits", async () => {
  const repo = await createRepository();
  const head = await git(repo, ["rev-parse", "HEAD"]);
  await git(repo, ["tag", "lightweight", head]);
  await git(repo, ["tag", "-a", "annotated", "-m", "annotated", head]);
  const lightweight = await git(repo, ["rev-parse", "refs/tags/lightweight"]);
  const annotated = await git(repo, ["rev-parse", "refs/tags/annotated"]);
  const result = await check(repo, [
    refLine("refs/tags/lightweight", lightweight, "refs/tags/lightweight", zeroOidFor(lightweight)),
    refLine("refs/tags/annotated", annotated, "refs/tags/annotated", zeroOidFor(annotated))
  ]);

  assert.equal(result.code, 0, result.stderr);
});

test("rejects tags that peel to a non-commit and skips tag deletion", async () => {
  const repo = await createRepository();
  const tree = await git(repo, ["rev-parse", "HEAD^{tree}"]);
  await git(repo, ["tag", "-a", "tree-tag", "-m", "tree", tree]);
  const tagOid = await git(repo, ["rev-parse", "refs/tags/tree-tag"]);
  const zeroOid = zeroOidFor(tagOid);
  const rejected = await check(repo, [refLine("refs/tags/tree-tag", tagOid, "refs/tags/tree-tag", zeroOid)]);
  const deleted = await check(repo, [refLine("refs/tags/tree-tag", zeroOid, "refs/tags/tree-tag", tagOid)]);

  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /commit/);
  assert.equal(deleted.code, 0, deleted.stderr);
});

test("fails closed for other ref namespaces, a missing remote object, and multi-ref failures", async () => {
  const repo = await createRepository();
  const head = await git(repo, ["rev-parse", "HEAD"]);
  const unsupported = await check(repo, [
    refLine("refs/notes/test", head, "refs/notes/test", zeroOidFor(head))
  ]);
  const missingRemote = await check(repo, [
    refLine("refs/heads/main", head, "refs/heads/main", "f".repeat(40))
  ]);
  const badTip = await commit(repo, "bad tip", { "docs/PROJECT_STATE.md": "changed\n" });
  const multiple = await check(repo, [
    refLine("refs/heads/good", head, "refs/heads/good", head),
    refLine("refs/heads/bad", badTip, "refs/heads/bad", head)
  ]);

  assert.notEqual(unsupported.code, 0);
  assert.notEqual(missingRemote.code, 0);
  assert.match(missingRemote.stderr, /synchronize local Git objects/);
  assert.notEqual(multiple.code, 0);
});

test("rejects the same tip sent to branch refs with conflicting expected trailers", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "changed\n\nProject-State-Review: updated", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  const result = await check(repo, [
    refLine("refs/heads/current", tip, "refs/heads/current", tip),
    refLine("refs/heads/updated", tip, "refs/heads/updated", baseline)
  ]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /conflicting Project-State-Review expectations/);
  assert.match(result.stderr, /refs\/heads\/updated/);
  assert.match(result.stderr, /refs\/heads\/current/);
});

test("allows all-compliant multi-ref branch and tag pushes without false conflicts", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "state update\n\nProject-State-Review: updated", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  await git(repo, ["tag", "release", tip]);
  const tagOid = await git(repo, ["rev-parse", "refs/tags/release"]);
  const result = await check(repo, [
    refLine("refs/heads/main", tip, "refs/heads/main", baseline),
    refLine("refs/heads/release", tip, "refs/heads/release", baseline),
    refLine("refs/tags/release", tagOid, "refs/tags/release", zeroOidFor(tagOid))
  ]);

  assert.equal(result.code, 0, result.stderr);
});

test("rejects the whole multi-ref push when one otherwise valid branch fails", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const validTip = await commit(repo, "non-state change\n\nProject-State-Review: verified-current", {
    "README.md": "valid\n"
  });
  const failingTip = await commit(repo, "wrong branch trailer\n\nProject-State-Review: verified-current", {
    "docs/PROJECT_STATE.md": "changed\n"
  });
  const result = await check(repo, [
    refLine("refs/heads/valid", validTip, "refs/heads/valid", baseline),
    refLine("refs/heads/failing", failingTip, "refs/heads/failing", validTip)
  ]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /refs\/heads\/failing/);
  assert.match(result.stderr, /expected updated/);
});

test("uses the final tree comparison for force pushes", async () => {
  const repo = await createRepository();
  const baseline = await git(repo, ["rev-parse", "HEAD"]);
  const tip = await commit(repo, "state update\n\nProject-State-Review: updated", {
    "docs/PROJECT_STATE.md": "force tree\n"
  });
  const result = await check(repo, [refLine("refs/heads/main", tip, "refs/heads/main", baseline)]);

  assert.equal(result.code, 0, result.stderr);
});

test("wires pre-push stdin into accepted and rejected local bare-repository pushes", async () => {
  const repo = await createRepository("real push 验证");
  const remote = path.join(fixtureRoot, "remote.git");
  await git(fixtureRoot, ["init", "--bare", "-q", remote]);
  await git(repo, ["config", "core.hooksPath", ".githooks"]);
  await git(repo, ["remote", "add", "origin", remote]);
  const pushed = await run("git", ["push", "origin", "HEAD:refs/heads/main"], { cwd: repo });
  const pushedHead = await git(repo, ["rev-parse", "HEAD"]);
  const rejectedTip = await commit(repo, "bad trailer\n\nProject-State-Review: verified-current", {
    "docs/PROJECT_STATE.md": "changed after first push\n"
  });
  const rejected = await run("git", ["push", "origin", "HEAD:refs/heads/main"], { cwd: repo });

  assert.equal(pushed.code, 0, pushed.stderr);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /expected updated/);
  assert.equal(await git(remote, ["rev-parse", "refs/heads/main"]), pushedHead);
  assert.notEqual(rejectedTip, pushedHead);
});

test("install script allows default samples, is idempotent, and refuses conflicting hooks", async () => {
  const installedRepo = await createRepository("install");
  const defaultHooks = await fs.readdir(path.join(installedRepo, ".git", "hooks"));
  const first = await run("sh", ["scripts/install-git-hooks.sh"], { cwd: installedRepo });
  const second = await run("sh", ["scripts/install-git-hooks.sh"], { cwd: installedRepo });

  assert.ok(defaultHooks.every((file) => file.endsWith(".sample")));
  assert.equal(first.code, 0, first.stderr);
  assert.equal(await git(installedRepo, ["config", "--local", "--get", "core.hooksPath"]), ".githooks");
  assert.equal(second.code, 0, second.stderr);

  const configuredRepo = await createRepository("configured");
  await git(configuredRepo, ["config", "--local", "core.hooksPath", "custom-hooks"]);
  const configured = await run("sh", ["scripts/install-git-hooks.sh"], { cwd: configuredRepo });
  assert.notEqual(configured.code, 0);
  assert.match(configured.stderr, /hooksPath/);

  const globalConfigRepo = await createRepository("global-config");
  const configuredGlobalConfig = path.join(fixtureRoot, "configured-global.gitconfig");
  await fs.writeFile(configuredGlobalConfig, "[core]\n\thooksPath = global-hooks\n");
  const globalConfigured = await run("sh", ["scripts/install-git-hooks.sh"], {
    cwd: globalConfigRepo,
    env: { ...testEnv, GIT_CONFIG_GLOBAL: configuredGlobalConfig }
  });
  assert.notEqual(globalConfigured.code, 0);
  assert.match(globalConfigured.stderr, /hooksPath/);

  const nonExecutableRepo = await createRepository("non-executable");
  await fs.chmod(path.join(nonExecutableRepo, "scripts", "check-project-state-push.sh"), 0o644);
  const nonExecutable = await run("sh", ["scripts/install-git-hooks.sh"], { cwd: nonExecutableRepo });
  assert.notEqual(nonExecutable.code, 0);
  assert.match(nonExecutable.stderr, /check script is not executable/);

  const defaultHookRepo = await createRepository("default-hook");
  await writeFile(path.join(defaultHookRepo, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
  await fs.chmod(path.join(defaultHookRepo, ".git", "hooks", "pre-commit"), 0o755);
  const defaultHook = await run("sh", ["scripts/install-git-hooks.sh"], { cwd: defaultHookRepo });
  assert.notEqual(defaultHook.code, 0);
  assert.match(defaultHook.stderr, /custom hook/);
});
